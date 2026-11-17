const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/clip-utils.js');

test('formatTime', () => {
  assert.equal(C.formatTime(0), '0:00');
  assert.equal(C.formatTime(7), '0:07');
  assert.equal(C.formatTime(83), '1:23');
  assert.equal(C.formatTime(59.9), '0:59');
  assert.equal(C.formatTime(3723), '1:02:03');
  assert.equal(C.formatTime(-5), '0:00');
});

test('parseTime accepts the usual formats', () => {
  assert.equal(C.parseTime('83'), 83);
  assert.equal(C.parseTime('83s'), 83);
  assert.equal(C.parseTime(' 1:23 '), 83);
  assert.equal(C.parseTime('1:2'), 62);
  assert.equal(C.parseTime('01:02:03'), 3723);
  assert.equal(C.parseTime('1m23s'), 83);
  assert.equal(C.parseTime('1h2m3s'), 3723);
  assert.equal(C.parseTime('1h'), 3600);
  assert.equal(C.parseTime('1:23.6'), 84);
  assert.equal(C.parseTime(90), 90);
});

test('parseTime rejects invalid input', () => {
  for (const bad of ['', '   ', 'abc', '1:75', '1:2:3:4', '-5', '1:', ':30', 'm', null, undefined]) {
    assert.equal(C.parseTime(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('validateClip', () => {
  assert.equal(C.validateClip(10, 20, 100), null);
  assert.equal(C.validateClip(10, 20, 0), null, 'unknown duration skips the bounds checks');
  assert.equal(C.validateClip(0, 100, 99.6), null, 'end may round up to the duration');
  assert.deepEqual(C.validateClip(null, 20, 100), { key: 'errorStartInvalid' });
  assert.deepEqual(C.validateClip(10, null, 100), { key: 'errorEndInvalid' });
  assert.deepEqual(C.validateClip(20, 20, 100), { key: 'errorEndBeforeStart' });
  assert.deepEqual(C.validateClip(30, 20, 100), { key: 'errorEndBeforeStart' });
  assert.deepEqual(C.validateClip(10, 120, 100), { key: 'errorEndPastVideo', subs: ['1:40'] });
  assert.deepEqual(C.validateClip(100, 120, 100), { key: 'errorStartPastVideo', subs: ['1:40'] });
});

test('msg falls back to the key outside the extension', () => {
  assert.equal(C.msg('shareClip'), 'shareClip');
});

test('getVideoIdFromUrl', () => {
  const id = 'dQw4w9WgXcQ';
  assert.equal(C.getVideoIdFromUrl(`https://www.youtube.com/watch?v=${id}&t=10`), id);
  assert.equal(C.getVideoIdFromUrl(`https://youtu.be/${id}?si=abc`), id);
  assert.equal(C.getVideoIdFromUrl(`https://youtube.com/shorts/${id}?si=abc`), id);
  assert.equal(C.getVideoIdFromUrl(`https://m.youtube.com/watch?v=${id}`), id);
  assert.equal(C.getVideoIdFromUrl(`https://www.youtube.com/embed/${id}`), id);
  assert.equal(C.getVideoIdFromUrl(`/watch?v=${id}`), id, 'relative URLs resolve against youtube.com');
  assert.equal(C.getVideoIdFromUrl('https://www.youtube.com/playlist?list=PL123'), null);
  assert.equal(C.getVideoIdFromUrl(`https://notyoutube.com/watch?v=${id}`), null);
  assert.equal(C.getVideoIdFromUrl('https://www.youtube.com/watch?v=short'), null);
  assert.equal(C.getVideoIdFromUrl('not a url ::'), null);
});

test('buildClipUrl and parseClipFromUrl round-trip', () => {
  const url = C.buildClipUrl('dQw4w9WgXcQ', 83, 120);
  assert.equal(url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=83s&end=120');
  assert.deepEqual(C.parseClipFromUrl(url), { videoId: 'dQw4w9WgXcQ', start: 83, end: 120 });
});

test('web player links', () => {
  const base = 'https://clipshare.example/';
  const url = C.buildWebClipUrl('dQw4w9WgXcQ', 83, 120, base);
  assert.equal(url, 'https://clipshare.example/watch/dQw4w9WgXcQ?start=83&end=120');
  assert.deepEqual(C.parseWebClipUrl(url), { videoId: 'dQw4w9WgXcQ', start: 83, end: 120 });
  assert.deepEqual(C.parseWebClipUrl(`${base}watch/dQw4w9WgXcQ/?t=1m&end=90`), { videoId: 'dQw4w9WgXcQ', start: 60, end: 90 });
  assert.deepEqual(C.parseWebClipUrl(`${base}?v=dQw4w9WgXcQ&t=83s&end=120`), { videoId: 'dQw4w9WgXcQ', start: 83, end: 120 }, 'query form');
  assert.equal(C.parseWebClipUrl(`${base}watch/dQw4w9WgXcQ?start=10`), null, 'no end');
  assert.equal(C.parseWebClipUrl(`${base}watch/dQw4w9WgXcQ?start=30&end=20`), null, 'end before start');
  assert.equal(C.parseWebClipUrl(`${base}watch/short?start=1&end=5`), null, 'bad video id');
  assert.equal(C.parseWebClipUrl(base), null);
  assert.equal(C.parseWebClipUrl('not a url'), null);
});

test('links for everyone go to the web player at youclip.ca', () => {
  assert.equal(C.WEB_PLAYER_URL, 'https://youclip.ca/');
  assert.deepEqual(C.LINK_TYPES, ['everyone', 'youtube']);
  assert.equal(C.DEFAULT_LINK_TYPE, 'everyone', 'new users get links that work without the extension');
  const link = C.buildClipLink('everyone', 'dQw4w9WgXcQ', 83, 120);
  assert.equal(link, 'https://youclip.ca/watch/dQw4w9WgXcQ?start=83&end=120');
  assert.deepEqual(C.parseWebClipUrl(link), { videoId: 'dQw4w9WgXcQ', start: 83, end: 120 });
  assert.equal(C.buildClipLink('youtube', 'dQw4w9WgXcQ', 83, 120), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=83s&end=120');
});

test('pickLocale', () => {
  const available = ['ar', 'de', 'en', 'es', 'pt_BR', 'pt_PT', 'zh_CN', 'zh_TW'];
  assert.equal(C.pickLocale(['pt-BR', 'en'], available), 'pt_BR');
  assert.equal(C.pickLocale(['pt-PT'], available), 'pt_PT');
  assert.equal(C.pickLocale(['pt'], available), 'pt_BR', 'bare language picks a regional variant');
  assert.equal(C.pickLocale(['es-MX'], available), 'es', 'region falls back to the language');
  assert.equal(C.pickLocale(['de-AT', 'en'], available), 'de');
  assert.equal(C.pickLocale(['zh-HK'], available), 'zh_TW');
  assert.equal(C.pickLocale(['zh-Hant-SG'], available), 'zh_TW');
  assert.equal(C.pickLocale(['zh'], available), 'zh_CN');
  assert.equal(C.pickLocale(['sv-SE', 'de'], available), 'de', 'skips untranslated languages');
  assert.equal(C.pickLocale(['sv'], available), 'en');
  assert.equal(C.pickLocale([], available), 'en');
  assert.equal(C.isRtlLang('ar'), true);
  assert.equal(C.isRtlLang('pt-BR'), false);
});

test('parseClipFromUrl', () => {
  const id = 'dQw4w9WgXcQ';
  assert.deepEqual(C.parseClipFromUrl(`https://www.youtube.com/watch?v=${id}&t=1m23s&end=2:00`), {
    videoId: id,
    start: 83,
    end: 120,
  });
  assert.deepEqual(C.parseClipFromUrl(`https://www.youtube.com/watch?v=${id}&end=30`), {
    videoId: id,
    start: 0,
    end: 30,
  });
  assert.deepEqual(C.parseClipFromUrl(`https://youtu.be/${id}?t=10&end=20`), { videoId: id, start: 10, end: 20 });
  assert.equal(C.parseClipFromUrl(`https://www.youtube.com/watch?v=${id}&t=10`), null, 'no end -> not a clip');
  assert.equal(C.parseClipFromUrl(`https://www.youtube.com/watch?v=${id}&t=30&end=20`), null, 'end before start');
  assert.equal(C.parseClipFromUrl(`https://www.youtube.com/watch?v=${id}&end=soon`), null, 'bad end');
  assert.equal(C.parseClipFromUrl('https://www.youtube.com/feed/subscriptions?end=20'), null, 'no video');
});
