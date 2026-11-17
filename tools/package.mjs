// Builds dist/youclip-<version>.zip for uploading to the Chrome Web Store.
// Only the files the extension needs go in (no tests, tools or docs).
// Run with: node tools/package.mjs   (no dependencies)
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateRawSync } from 'node:zlib';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const INCLUDE = ['manifest.json', '_locales', 'icons', 'popup', 'src'];

function* walk(path) {
  if (statSync(path).isDirectory()) {
    for (const name of readdirSync(path).sort()) {
      if (!name.startsWith('.') && name !== 'Thumbs.db') yield* walk(join(path, name));
    }
  } else {
    yield path;
  }
}

/** Minimal ZIP writer (deflate, UTF-8 names, fixed timestamps so builds are reproducible). */
function zip(entries) {
  const DOS_TIME = 0;
  const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const packed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 file names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, packed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + packed.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
const entries = INCLUDE.flatMap((item) => [...walk(join(ROOT, item))]).map((file) => ({
  name: relative(ROOT, file).split('\\').join('/'),
  data: readFileSync(file),
}));

const outDir = join(ROOT, 'dist');
const outFile = join(outDir, `youclip-${manifest.version}.zip`);
mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, zip(entries));
console.log(`${relative(ROOT, outFile)}  (${entries.length} files, version ${manifest.version})`);
