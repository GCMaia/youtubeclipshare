// Renders store/promo-tile.html to store/promo-tile-440x280.png (the Chrome Web Store's small
// promo tile) with headless Microsoft Edge or Google Chrome. Run: node tools/make-promo-tile.mjs
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'store/promo-tile-440x280.png');
const BROWSERS = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const browser = BROWSERS.find((path) => existsSync(path));
if (!browser) throw new Error('No Edge or Chrome found. Set BROWSER to its path.');

const profile = mkdtempSync(join(tmpdir(), 'promo-tile-'));
const before = existsSync(OUT) ? statSync(OUT).mtimeMs : 0;
const written = () => existsSync(OUT) && statSync(OUT).mtimeMs > before;
try {
  spawnSync(browser, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--user-data-dir=${profile}`,
    '--allow-file-access-from-files',
    '--window-size=440,280',
    `--screenshot=${OUT}`,
    pathToFileURL(join(ROOT, 'store/promo-tile.html')).href,
  ]);
  // On Windows the browser's launcher returns before the headless window has saved the image.
  for (let waited = 0; !written() && waited < 20000; waited += 250) await new Promise((r) => setTimeout(r, 250));
  await new Promise((r) => setTimeout(r, 500)); // let it finish writing and exit
} finally {
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
}
console.log(written() ? `wrote ${OUT}` : 'screenshot failed');
