/*
 * YouClip web player (youclip.ca): plays just the shared part of a YouTube video, for anyone
 * and on any device, without the extension.
 * Link format: /watch/<video id>?start=<s>&end=<s>[&title=<clip title>]
 * (on youclip.ca, worker/index.mjs answers every /watch/… address with this page).
 *
 * Under the video: a progress bar with grey dots at the clip's start and end, the clip's
 * range and length, the clip title (when the link has one), the video's own name, and a
 * link to the clip on YouTube.
 *
 * It uses YouTube's official IFrame Player API with the privacy-enhanced
 * youtube-nocookie.com player. The clip lives entirely in the link, so nothing is stored.
 */
(() => {
  'use strict';

  const C = window.YTClip;
  const STRINGS = window.YOUCLIP_STRINGS;
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
  $('clip-length').textContent = t('clipLength', [C.formatTime(clip.end - clip.start)]);
  $('yt-link').href = youtubeUrl;
  $('yt-link').textContent = t('watchOnYouTube');

  // The sharer's own title for the clip, if they gave one. It's text from the link, so it's
  // only ever set as textContent (never as HTML).
  if (clip.title) {
    $('clip-title').textContent = clip.title;
    $('clip-title').hidden = false;
    $('details').classList.add('has-clip-title');
    document.title = `${clip.title} · YouClip`;
  }

  let player = null;
  let clipMode = true; // false after "Keep watching": the video plays on past the clip

  function showOverlay(title, detail, actions) {
    const card = $('overlay-card');
    card.setAttribute('aria-label', title);
    const parts = [el('div', 'card-title', title), detail ? el('div', 'card-detail', detail) : null, el('div', 'card-actions', ...actions)];
    card.replaceChildren(...parts.filter(Boolean)); // (replaceChildren would print a null as "null")
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

  /** The video's own name, from YouTube's player, under the clip title. */
  function showTitle() {
    const title = player?.getVideoData?.()?.title;
    if (!title) return;
    $('title').textContent = title;
    if (!clip.title) document.title = `${title} · YouClip`;
  }

  // ------------------------------------------- progress bar with the clip's grey dots
  const bar = {
    root: $('timeline'),
    track: $('timeline-track'),
    clip: $('timeline-clip'),
    played: $('timeline-played'),
    head: $('timeline-head'),
    start: $('marker-start'),
    end: $('marker-end'),
  };
  let playerFailed = false;

  /** The video's length in seconds, or 0 while it's unknown (or while something shorter, like an ad, plays). */
  function videoLength() {
    const length = playerFailed ? 0 : Number(player?.getDuration?.()) || 0;
    return length >= clip.end - 1 ? length : 0;
  }

  function drawTimeline() {
    const length = videoLength();
    bar.root.hidden = !length;
    if (length) {
      const at = (seconds) => `${Math.min(100, Math.max(0, (seconds / length) * 100))}%`;
      const now = Number(player.getCurrentTime?.()) || 0;
      bar.start.style.left = bar.clip.style.left = at(clip.start);
      bar.end.style.left = at(clip.end);
      bar.clip.style.width = at(clip.end - clip.start);
      bar.played.style.width = bar.head.style.left = at(now);
    }
    requestAnimationFrame(drawTimeline);
  }

  /** Jumps to a moment. Up to the clip's end it's still the clip; past it, the video just plays on. */
  function jumpTo(seconds) {
    hideOverlay();
    if (clipMode && seconds >= clip.end) {
      clipMode = false;
      player.loadVideoById({ videoId: clip.videoId, startSeconds: seconds });
    } else if (clipMode && player.getPlayerState() === window.YT.PlayerState.ENDED) {
      player.loadVideoById({ videoId: clip.videoId, startSeconds: seconds, endSeconds: clip.end });
    } else {
      player.seekTo(seconds, true);
      player.playVideo();
    }
  }

  bar.root.addEventListener('click', (e) => {
    const length = videoLength();
    if (!length) return;
    const rect = bar.track.getBoundingClientRect();
    jumpTo(Math.max(0, Math.min(length - 0.5, ((e.clientX - rect.left) / rect.width) * length)));
  });

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
        onReady() {
          showTitle();
          requestAnimationFrame(drawTimeline);
        },
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
          playerFailed = true;
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
