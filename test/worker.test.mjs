// Link previews for youclip.ca clip pages (worker/preview.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import C from '../src/clip-utils.js';
import { clipPreview, oembedUrl, thumbnailCandidates, videoInfoFrom } from '../worker/preview.mjs';

const ID = 'dQw4w9WgXcQ';
const ORIGIN = 'https://youclip.ca';
const [MAXRES, HQ] = thumbnailCandidates(ID);
const VIDEO = { title: 'Never Gonna Give You Up', author: 'Rick Astley' };

test('YouTube lookups use the video ID only', () => {
  assert.equal(oembedUrl(ID), 'https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ');
  assert.deepEqual(MAXRES, { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg', width: 1280, height: 720 });
  assert.deepEqual(HQ, { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', width: 480, height: 360 });
});

test('videoInfoFrom reads the oEmbed answer', () => {
  assert.deepEqual(videoInfoFrom({ title: ' Never Gonna\nGive You Up ', author_name: 'Rick Astley', html: '<iframe>' }), VIDEO);
  assert.equal(videoInfoFrom({}), null);
  assert.equal(videoInfoFrom(null), null);
});

test('clip with its own title', () => {
  const clip = C.parseWebClipUrl(`${ORIGIN}/watch/${ID}?start=43&end=50&title=The+best+part`);
  const p = clipPreview({ clip, origin: ORIGIN, video: VIDEO, thumbnail: MAXRES });
  assert.equal(p.title, 'The best part');
  assert.equal(p.description, 'Clip 0:43 – 0:50 (0:07) · Never Gonna Give You Up · Rick Astley');
  assert.equal(p.pageTitle, 'The best part · YouClip');
  assert.equal(p.url, `${ORIGIN}/watch/${ID}?start=43&end=50&title=The+best+part`);
  assert.equal(p.image, MAXRES.url);
  assert.equal(p.imageWidth, 1280);
  assert.equal(p.imageAlt, 'Never Gonna Give You Up');
});

test('clip without a title uses the video name', () => {
  const clip = C.parseWebClipUrl(`${ORIGIN}/watch/${ID}?start=43&end=50`);
  const p = clipPreview({ clip, origin: ORIGIN, video: VIDEO, thumbnail: HQ });
  assert.equal(p.title, 'Never Gonna Give You Up');
  assert.equal(p.description, 'Clip 0:43 – 0:50 (0:07) · Rick Astley');
  assert.equal(p.url, `${ORIGIN}/watch/${ID}?start=43&end=50`);
  assert.equal(p.image, HQ.url);
  assert.equal(p.imageHeight, 360);
});

test('YouTube didn’t answer: still a useful preview', () => {
  const titled = C.parseWebClipUrl(`${ORIGIN}/watch/${ID}?start=3723&end=3730&title=Hi`);
  const p1 = clipPreview({ clip: titled, origin: ORIGIN, video: null, thumbnail: HQ });
  assert.equal(p1.title, 'Hi');
  assert.equal(p1.description, 'Clip 1:02:03 – 1:02:10 (0:07)');
  assert.equal(p1.imageAlt, 'Hi');

  const plain = C.parseWebClipUrl(`${ORIGIN}/watch/${ID}?start=43&end=50`);
  const p2 = clipPreview({ clip: plain, origin: ORIGIN, video: null, thumbnail: HQ });
  assert.equal(p2.title, 'YouTube clip 0:43 – 0:50');
  assert.equal(p2.pageTitle, 'YouTube clip 0:43 – 0:50 · YouClip');
});

test('the preview link is the tidy version of the address', () => {
  const clip = C.parseWebClipUrl(`${ORIGIN}/watch/${ID}/?t=1m&end=90&title=%20a%0Ab%20&utm_source=x`);
  const p = clipPreview({ clip, origin: ORIGIN, video: VIDEO, thumbnail: HQ });
  assert.equal(p.url, `${ORIGIN}/watch/${ID}?start=60&end=90&title=a+b`);
});
