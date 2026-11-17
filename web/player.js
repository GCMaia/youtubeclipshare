/*
 * Clip Share web player: plays just the shared part of a YouTube video, for anyone and
 * on any device, without the extension. Link format: /watch/<video id>?start=<s>&end=<s>
 * (_redirects sends every /watch/… address to this page).
 *
 * It uses YouTube's official IFrame Player API with the privacy-enhanced
 * youtube-nocookie.com player. The clip lives entirely in the link, so nothing is stored.
 */
(() => {
  'use strict';

  const C = window.YTClip;
  const STRINGS = window.CLIP_SHARE_STRINGS;
  const $ = (id) => document.getElementById(id);

  const locale = C.pickLocale(
    navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language],
    Object.keys(STRINGS)
  );
  function t(key, subs = []) {
    const text = STRINGS[locale]?.[key] ?? STRINGS.en[key] ?? key;
    return text.replace(/\$(\d)/g, (_, i) => subs[i - 1] ?? '');
  }
  document.documentElement.lang = t('lang');
  document.documentElement.dir = C.isRtlLang(t('lang')) ? 'rtl' : 'ltr';

  function el(tag, className, ...children) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.append(...children.filter((child) => child != null && child !== ''));
    return node;
  }

  const clip = C.parseWebClipUrl(location.href);
  if (!clip) {
    $('stage').hidden = true;
    $('message').textContent = t('siteInvalidLink');
    $('message').hidden = false;
    return;
  }

  const youtubeUrl = C.buildClipUrl(clip.videoId, clip.start, clip.end);
  const range = `${C.formatTime(clip.start)} – ${C.formatTime(clip.end)}`;
  $('clip-label').textContent = t('badgeLabel', [range]);
  $('yt-link').href = youtubeUrl;
  $('yt-link').textContent = t('watchOnYouTube');

  let player = null;
  let clipMode = true; // false after "Keep watching": the video plays on past the clip

  function showOverlay(title, detail, actions) {
    const card = $('overlay-card');
    card.setAttribute('aria-label', title);
    card.replaceChildren(
      el('div', 'card-title', title),
      detail ? el('div', 'card-detail', detail) : null,
      el('div', 'card-actions', ...actions)
    );
    card.querySelector('.card-detail')?.setAttribute('dir', 'ltr');
    $('overlay').hidden = false;
  }

  function hideOverlay() {
    $('overlay').hidden = true;
  }

  function button(label, primary, onClick) {
    const b = el('button', primary ? 'btn primary' : 'btn', label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  function replay() {
    clipMode = true;
    hideOverlay();
    player.loadVideoById({ videoId: clip.videoId, startSeconds: clip.start, endSeconds: clip.end });
  }

  function keepWatching() {
    clipMode = false;
    hideOverlay();
    player.loadVideoById({ videoId: clip.videoId, startSeconds: clip.end });
  }

  function showClipEnded() {
    showOverlay(t('clipEnded'), range, [button(t('replayClip'), true, replay), button(t('keepWatching'), false, keepWatching)]);
  }

  function showTitle() {
    const title = player?.getVideoData?.()?.title;
    if (!title) return;
    $('title').textContent = title;
    document.title = `${title} · Clip Share`;
  }

  window.onYouTubeIframeAPIReady = () => {
    player = new window.YT.Player('player', {
      host: 'https://www.youtube-nocookie.com',
      videoId: clip.videoId,
      width: '100%',
      height: '100%',
      playerVars: {
        start: clip.start,
        end: clip.end,
        autoplay: 1,
        playsinline: 1,
        rel: 0,
        origin: location.origin,
      },
      events: {
        onReady: showTitle,
        onStateChange(e) {
          const { PLAYING, ENDED } = window.YT.PlayerState;
          if (e.data === PLAYING) {
            hideOverlay();
            showTitle();
          } else if (e.data === ENDED && clipMode) {
            showClipEnded();
          }
        },
        // e.g. the owner doesn't allow playing the video outside youtube.com
        onError() {
          const link = el('a', 'btn primary', t('watchOnYouTube'));
          link.href = youtubeUrl;
          link.target = '_blank';
          link.rel = 'noopener';
          showOverlay(t('siteCantEmbed'), '', [link]);
        },
      },
    });
  };

  const api = document.createElement('script');
  api.src = 'https://www.youtube.com/iframe_api';
  document.head.append(api);
})();
