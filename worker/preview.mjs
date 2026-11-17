// What chat apps and social sites show for a youclip.ca clip link (the "link preview"):
// the clip title (or the video's name), the clip's range and length, and the video thumbnail.
// Pure functions, so the Node tests can check them; worker/index.mjs does the fetching.
import C from '../src/clip-utils.js';

export const SITE_NAME = 'YouClip';

/** YouTube's public oEmbed endpoint: the video's title and channel, no API key needed. */
export function oembedUrl(videoId) {
  const watch = `https://www.youtube.com/watch?v=${videoId}`;
  return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`;
}

/**
 * Thumbnails to use, best first. maxresdefault (1280×720) is missing for some videos;
 * hqdefault (480×360) always exists.
 */
export function thumbnailCandidates(videoId) {
  return [
    { url: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`, width: 1280, height: 720 },
    { url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, width: 480, height: 360 },
  ];
}

/** The fields we use from YouTube's oEmbed answer, tidied to one line each. Null if there's no title. */
export function videoInfoFrom(json) {
  const title = C.cleanClipTitle(json?.title);
  if (!title) return null;
  return { title, author: C.cleanClipTitle(json?.author_name) };
}

/**
 * The preview for a clip. `video` ({ title, author }) is null when YouTube didn't answer.
 * Example: title "The best part", description "Clip 0:43 – 0:50 (0:07) · Video name · Channel".
 */
export function clipPreview({ clip, origin, video = null, thumbnail }) {
  const range = `${C.formatTime(clip.start)} – ${C.formatTime(clip.end)}`;
  const title = clip.title || video?.title || `YouTube clip ${range}`;
  const description = [
    `Clip ${range} (${C.formatTime(clip.end - clip.start)})`,
    clip.title ? video?.title : null, // without a clip title, the video's name is already the title
    video?.author,
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    pageTitle: `${title} · ${SITE_NAME}`,
    title,
    description,
    url: C.buildWebClipUrl(clip.videoId, clip.start, clip.end, clip.title ?? '', `${origin}/`),
    image: thumbnail.url,
    imageWidth: thumbnail.width,
    imageHeight: thumbnail.height,
    imageAlt: video?.title || title,
  };
}
