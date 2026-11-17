// Cloudflare Worker for youclip.ca. Files in web/ are served directly by Cloudflare (the home page
// is web/index.html); every other address comes here. Clip pages
// (/watch/<video id>?start=…&end=…[&title=…]) get the player page, web/watch.html, with the link
// preview tags filled in (title, description, thumbnail), because chat apps read those tags
// without running the page's JavaScript.
//
// To fill them in it asks YouTube for the video's public title and checks which thumbnail size
// exists. Both answers are cached at Cloudflare for a day, and both give up after 2 seconds,
// so a slow YouTube never holds the page up for long. Nothing about the visitor is sent.
import C from '../src/clip-utils.js';
import { clipPreview, oembedUrl, thumbnailCandidates, videoInfoFrom } from './preview.mjs';

const LOOKUP_TIMEOUT_MS = 2000;
const LOOKUP_CACHE = { cacheTtl: 24 * 60 * 60, cacheEverything: true };

async function lookUpVideo(videoId) {
  try {
    const res = await fetch(oembedUrl(videoId), { cf: LOOKUP_CACHE, signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
    return res.ok ? videoInfoFrom(await res.json()) : null; // e.g. 401/404: private, deleted or no embedding
  } catch {
    return null;
  }
}

async function pickThumbnail(videoId) {
  const [best, fallback] = thumbnailCandidates(videoId);
  try {
    const res = await fetch(best.url, { method: 'HEAD', cf: LOOKUP_CACHE, signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
    if (res.ok) return best;
  } catch {}
  return fallback;
}

const setContent = (value) => ({
  element(el) {
    el.setAttribute('content', String(value));
  },
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isClipPage = url.pathname.startsWith('/watch/') && (request.method === 'GET' || request.method === 'HEAD');
    if (!isClipPage) return env.ASSETS.fetch(request);

    const clip = C.parseWebClipUrl(url.href);
    const page = env.ASSETS.fetch(new URL('/watch', url)); // web/watch.html, the player
    if (!clip) return page; // the page itself explains that the link is broken

    const [html, video, thumbnail] = await Promise.all([page, lookUpVideo(clip.videoId), pickThumbnail(clip.videoId)]);
    if (!html.ok) return html;
    const p = clipPreview({ clip, origin: url.origin, video, thumbnail });

    const headers = new Headers(html.headers);
    headers.delete('etag'); // the body differs from watch.html's
    headers.delete('content-length');
    const response = new HTMLRewriter()
      .on('title', { element: (el) => el.setInnerContent(p.pageTitle) })
      .on('meta[name="description"]', setContent(p.description))
      .on('meta[property="og:title"]', setContent(p.title))
      .on('meta[property="og:description"]', setContent(p.description))
      .on('meta[property="og:url"]', setContent(p.url))
      .on('meta[property="og:image"]', setContent(p.image))
      .on('meta[property="og:image:width"]', setContent(p.imageWidth))
      .on('meta[property="og:image:height"]', setContent(p.imageHeight))
      .on('meta[property="og:image:alt"]', setContent(p.imageAlt))
      .on('meta[name="twitter:card"]', setContent('summary_large_image'))
      .transform(new Response(html.body, { status: html.status, headers }));

    return request.method === 'HEAD' ? new Response(null, { status: response.status, headers: response.headers }) : response;
  },
};
