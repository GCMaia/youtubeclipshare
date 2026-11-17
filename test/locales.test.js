// Checks that every translation in _locales/ matches the English one, and that the
// message keys used in the code exist.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const readJson = (p) => JSON.parse(read(p));

// Locale folder names Chrome accepts (https://developer.chrome.com/docs/extensions/reference/api/i18n#locales).
const CHROME_LOCALES = new Set(
  'ar am bg bn ca cs da de el en en_AU en_GB en_US es es_419 et fa fi fil fr gu he hi hr hu id it ja kn ko lt lv ml mr ms nl no pl pt_BR pt_PT ro ru sk sl sr sv sw ta te th tr uk vi zh_CN zh_TW'.split(' ')
);

const locales = fs.readdirSync(path.join(ROOT, '_locales')).sort();
const messages = Object.fromEntries(locales.map((l) => [l, readJson(`_locales/${l}/messages.json`)]));
const en = messages.en;
const placeholdersIn = (text) => [...text.matchAll(/\$([A-Za-z0-9_]+)\$/g)].map((m) => m[1].toLowerCase()).sort();

test('locale folders are ones Chrome understands', () => {
  for (const locale of locales) assert.ok(CHROME_LOCALES.has(locale), `unknown locale folder: ${locale}`);
});

test('the manifest uses English as the default and its __MSG_ keys exist', () => {
  const manifest = read('manifest.json');
  assert.equal(JSON.parse(manifest).default_locale, 'en');
  for (const [, key] of manifest.matchAll(/__MSG_(\w+)__/g)) assert.ok(en[key], `manifest uses missing key ${key}`);
});

for (const locale of locales) {
  test(`${locale}: same keys and placeholders as English`, () => {
    const m = messages[locale];
    assert.deepEqual(Object.keys(m).sort(), Object.keys(en).sort());
    for (const [key, entry] of Object.entries(m)) {
      assert.equal(typeof entry.message, 'string', `${key}.message`);
      assert.ok(entry.message.trim(), `${key} is empty`);
      const used = placeholdersIn(entry.message);
      assert.deepEqual(used, placeholdersIn(en[key].message), `${key} placeholders differ from English`);
      for (const name of used) {
        assert.ok(entry.placeholders?.[name]?.content, `${key} uses $${name.toUpperCase()}$ but does not define it`);
      }
    }
    // Chrome Web Store limits for the manifest name and description.
    assert.ok(m.extName.message.length <= 75, `extName is ${m.extName.message.length} chars (max 75)`);
    assert.ok(m.extDescription.message.length <= 132, `extDescription is ${m.extDescription.message.length} chars (max 132)`);
  });
}

test('every message key used in the code exists, and every English key is used', () => {
  const code = ['src/clip-utils.js', 'src/content.js', 'popup/popup.js', 'popup/popup.html', 'web/player.js']
    .map(read)
    .join('\n');
  const used = new Set([
    ...[...code.matchAll(/\b(?:t|msg)\('(\w+)'/g)].map((m) => m[1]),
    ...[...code.matchAll(/\bkey: '(\w+)'/g)].map((m) => m[1]),
    ...[...code.matchAll(/data-i18n(?:-[\w-]+)?="(\w+)"/g)].map((m) => m[1]),
    ...[...read('manifest.json').matchAll(/__MSG_(\w+)__/g)].map((m) => m[1]),
  ]);
  for (const key of used) assert.ok(en[key], `code uses missing key "${key}"`);
  for (const key of Object.keys(en)) assert.ok(used.has(key), `English key "${key}" is never used`);
});

test('the web player in web/ is up to date with the extension sources', () => {
  const { execFileSync } = require('node:child_process');
  // Throws (failing the test) when tools/build-site.mjs --check exits non-zero.
  execFileSync(process.execPath, [path.join(ROOT, 'tools/build-site.mjs'), '--check'], { stdio: 'pipe' });
});
