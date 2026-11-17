/*
 * YouClip for YouTube — content script (runs on www.youtube.com).
 *
 * 1. Viewer side: when the URL is a clip link (…&t=83s&end=120), make sure playback
 *    starts at `t` and pause the video when it reaches `end`.
 * 2. Sharer side: add a "Clip" button left of the Like button. It opens a pop-over where the
 *    user picks start/end times, optionally a clip title, and copies the clip link.
 * 3. Answer messages from the toolbar popup, which offers the same picker.
 *
 * YouTube enforces Trusted Types, so all UI is built with DOM APIs (no innerHTML).
 */
(() => {
  'use strict';

  const C = globalThis.YTClip;
  const t = C.msg; // translated text, see _locales/
  const DEFAULT_CLIP_LENGTH = 30; // seconds, used to prefill the end time
  const rangeText = (start, end) => `${C.formatTime(start)} – ${C.formatTime(end)}`;

  // ------------------------------------------------------------------ DOM helpers

  function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
      else el.setAttribute(key, value === true ? '' : String(value));
    }
    el.append(...children.filter((child) => child != null && child !== false));
    return el;
  }

  // Material "content_cut" icon (Apache 2.0).
  const SCISSORS_PATH =
    'M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3h-3z';

  function scissorsIcon(size) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'ytcs-icon');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', SCISSORS_PATH);
    svg.append(path);
    return svg;
  }

  /** Keep clicks/keys on our in-player UI from reaching YouTube's player handlers. */
  function isolateFromPlayer(el) {
    for (const type of ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'keydown', 'contextmenu']) {
      el.addEventListener(type, (e) => e.stopPropagation());
    }
  }

  // --------------------------------------------------------------- player helpers

  const isMainVideo = (el) =>
    el instanceof HTMLVideoElement && el.classList.contains('html5-main-video') && !!el.closest('#movie_player');
  const getPageVideo = () => document.querySelector('#movie_player video.html5-main-video');
  const playerOf = (video) => video.closest('.html5-video-player');
  const urlVideoId = () => C.getVideoIdFromUrl(location.href);
  /** The video of the regular watch page (not Shorts, not the miniplayer on other pages). */
  const watchVideoId = () => (location.pathname === '/watch' ? urlVideoId() : null);

  function isAdPlaying(video) {
    const player = playerOf(video);
    return !!player && (player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'));
  }

  function playbackInfo() {
    const video = getPageVideo();
    if (!video || !watchVideoId() || isAdPlaying(video)) return null;
    return {
      currentTime: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
    };
  }

  function videoTitle() {
    return document.title.replace(/^\(\d+\)\s*/, '').replace(/\s+-\s+YouTube$/, '');
  }

  // ------------------------------------------------------------------ viewer side

  let clip = null; // { videoId, start, end, armed, ended, startApplied, preview }
  let pendingClip = null; // clip link clicked inside YouTube, waiting for the in-app navigation
  let lastHref = '';
  let ignoreSeeksUntil = 0;
  let rafId = 0;
  let badgeEl = null;
  let overlayEl = null;
  let previewReturn = null; // { time, paused } before Preview started, for "Cancel preview"
  let onClipChanged = () => {}; // set by the picker below, so it can show/hide "Cancel preview"

  function activateClip({ videoId, start, end }, { startApplied = false, preview = false } = {}) {
    clip = { videoId, start, end, armed: true, ended: false, startApplied, preview };
    if (!preview) previewReturn = null;
    stopWatchLoop();
    removeOverlay();
    removeBadge();
    removeMarkers();
    onClipChanged();
  }

  function deactivateClip() {
    clip = null;
    previewReturn = null;
    stopWatchLoop();
    removeOverlay();
    removeBadge();
    removeMarkers();
    setSpotlight(false);
    onClipChanged();
  }

  const isPreviewing = (videoId) => !!clip?.preview && clip.videoId === videoId;

  function syncClipWithLocation() {
    lastHref = location.href;
    const videoId = urlVideoId();
    const fromUrl = C.parseClipFromUrl(location.href);
    const pending = pendingClip;
    pendingClip = null;

    if (fromUrl) {
      // YouTube may tidy the URL after load; keep the running clip if it's the same one.
      if (!clip || clip.videoId !== fromUrl.videoId || clip.end !== fromUrl.end) activateClip(fromUrl);
    } else if (pending && pending.videoId === videoId && Date.now() - pending.at < 15000) {
      activateClip(pending);
    } else if (clip && clip.videoId !== videoId) {
      deactivateClip();
    }
  }

  function seekTo(video, time) {
    ignoreSeeksUntil = performance.now() + 1000;
    video.currentTime = time;
  }

  function clipAppliesTo(video) {
    return !!clip && !isAdPlaying(video) && clip.videoId === urlVideoId();
  }

  function checkClipEnd(video) {
    if (!clip || !clip.armed || !clip.startApplied || !clipAppliesTo(video)) return;
    if (video.currentTime < clip.end) return;
    clip.armed = false;
    clip.ended = true;
    stopWatchLoop();
    video.pause();
    showOverlay(video);
  }

  // timeupdate only fires ~4x per second, so while a clip plays we also check every frame.
  function startWatchLoop(video) {
    stopWatchLoop();
    const tick = () => {
      rafId = 0;
      if (!clip || !clip.armed || video.paused) return;
      checkClipEnd(video);
      if (clip && clip.armed) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  function stopWatchLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function replayClip(video) {
    if (!clip) return;
    clip.armed = true;
    clip.ended = false;
    removeOverlay();
    seekTo(video, clip.start);
    video.play().catch(() => {});
  }

  function onTimeUpdate(e) {
    const video = e.target;
    if (!isMainVideo(video)) return;
    if (location.href !== lastHref) syncClipWithLocation();
    refreshSpotlight(video);
    if (!clipAppliesTo(video)) return;

    showBadge(video);
    showMarkers(video);
    if (!clip.startApplied) {
      // First real frame of the clip's video: YouTube normally honours `t`, but make sure.
      if (video.readyState < 1) return;
      clip.startApplied = true;
      if (video.currentTime < clip.start - 1 || video.currentTime >= clip.end) seekTo(video, clip.start);
      return;
    }
    checkClipEnd(video);
  }

  function onPlaying(e) {
    const video = e.target;
    if (!isMainVideo(video) || !clip) return;
    if (clip.ended && video.currentTime >= clip.end - 0.5) {
      // Pressed play after the clip ended: they want to keep watching.
      deactivateClip();
      return;
    }
    if (clip.armed) startWatchLoop(video);
    refreshSpotlight(video);
  }

  function onPlay(e) {
    if (isMainVideo(e.target)) spotlightDismissed = false; // pressing play brings the dimming back
  }

  function onSeeking(e) {
    const video = e.target;
    if (!isMainVideo(video) || !clip || !clip.startApplied || !clipAppliesTo(video)) return;
    if (performance.now() < ignoreSeeksUntil) return;
    const t = video.currentTime;
    if (t > clip.end + 0.5) {
      // Jumped past the clip on purpose: let them watch freely.
      deactivateClip();
    } else if (clip.ended && t < clip.end - 0.5) {
      // Jumped back into the clip after it ended: stop at the end again.
      clip.ended = false;
      clip.armed = true;
      removeOverlay();
      if (!video.paused) startWatchLoop(video);
    }
  }

  function onPause(e) {
    if (!isMainVideo(e.target)) return;
    stopWatchLoop();
    refreshSpotlight(e.target);
  }

  function showBadge(video) {
    const player = playerOf(video);
    if (!player || !clip) return;
    const key = `${clip.videoId}:${clip.start}:${clip.end}`;
    if (badgeEl && badgeEl.parentElement === player && badgeEl.dataset.key === key) return;
    removeBadge();
    badgeEl = h(
      'div',
      { class: 'ytcs-badge', title: t('badgeTooltip') },
      scissorsIcon(16),
      h('span', {}, t('badgeLabel', [rangeText(clip.start, clip.end)])),
      h(
        'button',
        {
          class: 'ytcs-badge-close',
          type: 'button',
          title: t('badgeCloseTooltip'),
          'aria-label': t('badgeCloseLabel'),
          onclick: deactivateClip,
        },
        '✕'
      )
    );
    badgeEl.dataset.key = key;
    C.applyLocale(badgeEl);
    isolateFromPlayer(badgeEl);
    player.append(badgeEl);
  }

  function removeBadge() {
    badgeEl?.remove();
    badgeEl = null;
  }

  function showOverlay(video) {
    const player = playerOf(video);
    if (!player || !clip) return;
    removeOverlay();
    const card = h(
      'div',
      { class: 'ytcs-end-card', role: 'dialog', 'aria-label': t('clipEnded') },
      h('div', { class: 'ytcs-end-title' }, t('clipEnded')),
      h('div', { class: 'ytcs-end-range', dir: 'ltr' }, rangeText(clip.start, clip.end)),
      h(
        'div',
        { class: 'ytcs-end-actions' },
        h('button', { class: 'ytcs-btn ytcs-btn-primary', type: 'button', onclick: () => replayClip(video) }, t('replayClip')),
        h(
          'button',
          {
            class: 'ytcs-btn',
            type: 'button',
            onclick: () => {
              deactivateClip();
              video.play().catch(() => {});
            },
          },
          t('keepWatching')
        )
      )
    );
    C.applyLocale(card);
    isolateFromPlayer(card);
    overlayEl = h('div', { class: 'ytcs-end-overlay' }, card);
    player.append(overlayEl);
  }

  function removeOverlay() {
    overlayEl?.remove();
    overlayEl = null;
  }

  // ------------------------------------------------- clip start/end dots on the progress bar

  let markersEl = null;

  function showMarkers(video) {
    const bar = playerOf(video)?.querySelector('.ytp-progress-bar');
    const duration = video.duration;
    if (!bar || !clip || !Number.isFinite(duration) || duration <= 0) return removeMarkers();
    const key = `${clip.start}:${clip.end}:${duration}`;
    if (markersEl && markersEl.parentElement === bar && markersEl.dataset.key === key) return;

    removeMarkers();
    const dot = (time) => {
      const el = h('span', { class: 'ytcs-marker' });
      el.style.left = `${Math.min(100, (time / duration) * 100)}%`;
      return el;
    };
    markersEl = h('div', { class: 'ytcs-markers', 'aria-hidden': 'true' }, dot(clip.start), dot(clip.end));
    markersEl.dataset.key = key;

    // Sit just under YouTube's red current-time dot: same layer, earlier in the DOM.
    let scrubber = bar.querySelector('.ytp-scrubber-container');
    while (scrubber && scrubber.parentElement !== bar) scrubber = scrubber.parentElement;
    if (scrubber) markersEl.style.zIndex = getComputedStyle(scrubber).zIndex;
    bar.insertBefore(markersEl, scrubber);
  }

  function removeMarkers() {
    markersEl?.remove();
    markersEl = null;
  }

  // ------------------------------------------------- spotlight: dim the page around the player

  // While a clip plays, everything except the video is dimmed. A transparent box sits
  // exactly over the player and its huge shadow does the dimming, so the player itself
  // stays untouched and the page underneath stays clickable.
  let shadeEl = null;
  let shadeRaf = 0;
  let spotlightOn = false;
  let spotlightDismissed = false; // clicked elsewhere on the page: stay off until play is pressed again

  function setSpotlight(on) {
    if (on === spotlightOn) return;
    spotlightOn = on;
    cancelAnimationFrame(shadeRaf);
    shadeRaf = 0;
    if (on) positionShade();
    else shadeEl?.classList.remove('ytcs-shade-on');
  }

  function refreshSpotlight(video) {
    setSpotlight(!!clip && clip.armed && !video.paused && !spotlightDismissed && clipAppliesTo(video));
  }

  const youtubeDialogOpen = () => [...document.querySelectorAll('tp-yt-paper-dialog')].some((d) => d.offsetWidth > 0);

  /** Corner radius of the box YouTube draws the player in, so the bright cut-out matches it. */
  function playerRadius(player, rect) {
    for (let el = player; el && el !== document.body; el = el.parentElement) {
      const r = el.getBoundingClientRect();
      if (Math.abs(r.width - rect.width) > 1 || Math.abs(r.height - rect.height) > 1) break;
      const radius = getComputedStyle(el).borderTopLeftRadius;
      if (radius && radius !== '0px') return radius;
    }
    return '0px';
  }

  // Runs every frame while the spotlight is on, so the cut-out follows scrolling and resizing.
  function positionShade() {
    shadeRaf = requestAnimationFrame(positionShade);
    const player = document.getElementById('movie_player');
    const rect = player?.getBoundingClientRect();
    const mostlyOnScreen =
      !!rect && rect.width > 0 && Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0) >= rect.height / 2;
    const show = mostlyOnScreen && !document.fullscreenElement && !youtubeDialogOpen() && !pickerOpen;

    if (show) {
      if (!shadeEl) {
        shadeEl = h('div', { class: 'ytcs-shade', 'aria-hidden': 'true' });
        document.body.append(shadeEl);
      }
      const box = `${rect.left},${rect.top},${rect.width},${rect.height}`;
      if (shadeEl.dataset.box !== box) {
        const size = `${rect.width}x${rect.height}`;
        if (shadeEl.dataset.size !== size) shadeEl.style.borderRadius = playerRadius(player, rect);
        shadeEl.dataset.box = box;
        shadeEl.dataset.size = size;
        shadeEl.style.left = `${rect.left}px`;
        shadeEl.style.top = `${rect.top}px`;
        shadeEl.style.width = `${rect.width}px`;
        shadeEl.style.height = `${rect.height}px`;
      }
    }
    shadeEl?.classList.toggle('ytcs-shade-on', show);
  }

  // Clicking anywhere outside the player (comments, menus, search…) turns the dimming off.
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (!spotlightOn || (e.target instanceof Element && e.target.closest('#movie_player'))) return;
      spotlightDismissed = true;
      setSpotlight(false);
    },
    true
  );

  /** Plays [start, end] of the current watch-page video with the clip behaviour applied. */
  function previewClip(start, end) {
    const video = getPageVideo();
    const videoId = watchVideoId();
    if (!video || !videoId || isAdPlaying(video)) return false;
    // Remember where the video was, for "Cancel preview". Previewing again keeps the first spot.
    const returnTo = isPreviewing(videoId) && previewReturn ? previewReturn : { time: video.currentTime, paused: video.paused };
    activateClip({ videoId, start, end }, { startApplied: true, preview: true });
    previewReturn = returnTo;
    seekTo(video, start);
    video.play().catch(() => {});
    return true;
  }

  /** Stops a preview and puts the video back where it was before Preview was pressed. */
  function cancelPreview() {
    const video = getPageVideo();
    if (!video || !isPreviewing(watchVideoId())) return false;
    const back = previewReturn;
    deactivateClip();
    if (back) {
      seekTo(video, back.time);
      if (back.paused) video.pause();
      else video.play().catch(() => {});
    }
    return true;
  }

  // Media events don't bubble, but they do pass through capture listeners on the document.
  document.addEventListener('timeupdate', onTimeUpdate, true);
  document.addEventListener('play', onPlay, true);
  document.addEventListener('playing', onPlaying, true);
  document.addEventListener('seeking', onSeeking, true);
  document.addEventListener('pause', onPause, true);

  // YouTube navigates in-app and may drop unknown URL params, so remember clip links on click.
  document.addEventListener(
    'click',
    (e) => {
      const link = e.target instanceof Element ? e.target.closest('a[href]') : null;
      const found = link && C.parseClipFromUrl(link.href);
      if (found) pendingClip = { ...found, at: Date.now() };
    },
    true
  );
  document.addEventListener('yt-navigate-finish', syncClipWithLocation);
  window.addEventListener('popstate', syncClipWithLocation);

  // Read the clip from the URL before YouTube's own scripts get a chance to rewrite it.
  syncClipWithLocation();

  // ------------------------------------------------------------------ sharer side

  // Which kind of link to copy ('everyone' = web player, 'youtube' = youtube.com link).
  // Saved in chrome.storage so the choice is remembered and shared with the popup.
  let linkType = C.DEFAULT_LINK_TYPE;

  function onLinkTypeChanged(type) {
    if (!C.LINK_TYPES.includes(type)) return;
    linkType = type;
    picker?.update();
  }

  function chooseLinkType(type) {
    onLinkTypeChanged(type);
    chrome.storage?.sync.set({ linkType: type }).catch(() => {});
  }

  chrome.storage?.sync
    .get({ linkType: C.DEFAULT_LINK_TYPE })
    .then((stored) => onLinkTypeChanged(stored.linkType))
    .catch(() => {});
  chrome.storage?.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.linkType) onLinkTypeChanged(changes.linkType.newValue);
  });

  // What the user typed, kept while the picker closes/reopens and shared with the
  // toolbar popup. Raw strings: { videoId, start, end, title }.
  let draft = null;

  function setDraft(videoId, start, end, title = '') {
    draft = videoId ? { videoId, start, end, title: String(title ?? '') } : null;
  }

  /**
   * Initial picker values for a video, { start, end, title }:
   * last draft > clip being watched > current time (and no title).
   */
  function initialRange(videoId, isCurrentVideo) {
    if (draft && draft.videoId === videoId) return { start: draft.start, end: draft.end, title: draft.title };
    if (clip && clip.videoId === videoId) {
      return { start: C.formatTime(clip.start), end: C.formatTime(clip.end), title: '' };
    }
    const info = isCurrentVideo ? playbackInfo() : null;
    const start = info ? Math.floor(info.currentTime) : 0;
    let end = start + DEFAULT_CLIP_LENGTH;
    if (info?.duration) end = Math.min(end, Math.floor(info.duration));
    return { start: C.formatTime(start), end: C.formatTime(end), title: '' };
  }

  function nowTime(kind) {
    const info = playbackInfo();
    if (!info) return null;
    // Round outward so the moment you clicked on is inside the clip.
    return kind === 'end' ? Math.ceil(info.currentTime) : Math.floor(info.currentTime);
  }

  async function copyText(text, fallbackInput) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        fallbackInput.focus();
        fallbackInput.select();
        return document.execCommand('copy');
      } catch {
        return false;
      }
    }
  }

  /** Whether the element sits on a dark background, so the panel can pick readable colours. */
  function onDarkBackground(el) {
    if (document.documentElement.hasAttribute('dark')) return true; // YouTube's dark theme
    for (let node = el; node instanceof Element; node = node.parentElement) {
      const rgba = getComputedStyle(node).backgroundColor.match(/^rgba?\(([^)]+)\)/);
      if (!rgba) continue;
      const [r, g, b, a = 1] = rgba[1].split(/[\s,/]+/).map(Number);
      if (a < 0.5) continue; // transparent: look further up
      return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
    }
    return false;
  }

  function timeInput(label) {
    return h('input', {
      class: 'ytcs-input ytcs-time-input',
      type: 'text',
      dir: 'ltr',
      inputmode: 'numeric',
      autocomplete: 'off',
      spellcheck: 'false',
      placeholder: '0:00',
      'aria-label': label,
    });
  }

  /** The clip picker (start/end times, link, copy), shown in a pop-over under the Clip button. */
  function createPicker() {
    const startInput = timeInput(t('startTimeLabel'));
    const endInput = timeInput(t('endTimeLabel'));
    const nowButton = () => h('button', { class: 'ytcs-btn ytcs-btn-small', type: 'button', title: t('nowTooltip') }, t('now'));
    const startNow = nowButton();
    const endNow = nowButton();
    const previewBtn = h('button', { class: 'ytcs-btn', type: 'button', title: t('previewTooltip') }, t('preview'));
    // Only shown while a preview is running.
    const cancelPreviewBtn = h(
      'button',
      { class: 'ytcs-btn', type: 'button', title: t('cancelPreviewTooltip'), hidden: true, onclick: cancelPreview },
      t('cancelPreview')
    );
    const lengthEl = h('span', { class: 'ytcs-length' });
    const linkInput = h('input', {
      class: 'ytcs-input ytcs-link',
      type: 'text',
      dir: 'ltr',
      readonly: true,
      spellcheck: 'false',
      'aria-label': t('clipLinkLabel'),
    });
    const copyBtn = h('button', { class: 'ytcs-btn ytcs-btn-primary', type: 'button' }, t('copy'));
    const errorEl = h('div', { class: 'ytcs-error', role: 'status', 'aria-live': 'polite' });
    const hintEl = h('div', { class: 'ytcs-hint' });
    const typeButtons = {
      everyone: h('button', { class: 'ytcs-segment', type: 'button', onclick: () => chooseLinkType('everyone') }, t('linkEveryone')),
      youtube: h('button', { class: 'ytcs-segment', type: 'button', onclick: () => chooseLinkType('youtube') }, t('linkYouTube')),
    };
    // Optional. It goes in "Link for everyone" links and shows on the clip's web page, so
    // the field is hidden while "YouTube link" is selected.
    const titleInput = h('input', {
      class: 'ytcs-input ytcs-title-input',
      type: 'text',
      dir: 'auto',
      maxlength: C.MAX_TITLE_LENGTH,
      autocomplete: 'off',
      placeholder: t('clipTitlePlaceholder'),
    });
    const titleField = h('label', { class: 'ytcs-field ytcs-title-field' }, h('span', { class: 'ytcs-label' }, t('clipTitle')), titleInput);

    const field = (label, input, nowBtn) =>
      h('div', { class: 'ytcs-field' }, h('span', { class: 'ytcs-label' }, label), h('div', { class: 'ytcs-time' }, input, nowBtn));

    const closeBtn = h(
      'button',
      { class: 'ytcs-close', type: 'button', title: t('close'), 'aria-label': t('close'), onclick: () => closePicker({ focusButton: true }) },
      '✕'
    );

    const root = h(
      'div',
      { class: 'ytcs-picker', role: 'dialog', 'aria-label': t('shareClip'), hidden: true },
      h('div', { class: 'ytcs-header' }, scissorsIcon(20), h('span', { class: 'ytcs-title' }, t('shareClip')), lengthEl, closeBtn),
      h(
        'div',
        { class: 'ytcs-row' },
        field(t('start'), startInput, startNow),
        field(t('end'), endInput, endNow),
        h('div', { class: 'ytcs-preview-actions' }, previewBtn, cancelPreviewBtn)
      ),
      h(
        'div',
        // Only shown once the web player has an address (WEB_PLAYER_URL in clip-utils.js).
        { class: 'ytcs-segmented', role: 'group', 'aria-label': t('linkTypeLabel'), hidden: C.LINK_TYPES.length < 2 },
        typeButtons.everyone,
        typeButtons.youtube
      ),
      titleField,
      h('div', { class: 'ytcs-link-row' }, linkInput, copyBtn),
      errorEl,
      hintEl
    );
    C.applyLocale(root);

    const state = { videoId: null, link: '' };

    /** Fills the picker in for the video on the page (called each time it opens). */
    function refresh() {
      state.videoId = watchVideoId();
      root.dataset.video = state.videoId ?? '';
      root.classList.toggle('ytcs-dark', onDarkBackground(document.body));
      if (!state.videoId) return;
      const range = initialRange(state.videoId, true);
      startInput.value = range.start;
      endInput.value = range.end;
      titleInput.value = range.title;
      update();
    }

    function update() {
      if (!state.videoId) return;
      const start = C.parseTime(startInput.value);
      const end = C.parseTime(endInput.value);
      const duration = playbackInfo()?.duration ?? 0;
      const error = C.validateClip(start, end, duration);

      startInput.classList.toggle('ytcs-invalid', start == null);
      endInput.classList.toggle('ytcs-invalid', end == null || (start != null && end <= start));
      errorEl.textContent = error ? t(error.key, error.subs) : '';
      state.link = error ? '' : C.buildClipLink(linkType, state.videoId, start, end, titleInput.value);
      linkInput.value = state.link;
      lengthEl.textContent = error ? '' : t('clipLength', [C.formatTime(end - start)]);
      copyBtn.disabled = previewBtn.disabled = !!error;
      cancelPreviewBtn.hidden = !isPreviewing(state.videoId);
      for (const [type, button] of Object.entries(typeButtons)) button.setAttribute('aria-pressed', String(type === linkType));
      titleField.hidden = linkType === 'youtube';
      hintEl.textContent = linkType === 'youtube' ? t('stopHint') : t('everyoneHint');
    }

    function onEdited() {
      setDraft(state.videoId, startInput.value, endInput.value, titleInput.value);
      update();
    }

    titleInput.addEventListener('input', onEdited);
    titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && state.link) {
        e.preventDefault();
        copyBtn.click();
      }
    });

    for (const input of [startInput, endInput]) {
      input.addEventListener('input', onEdited);
      input.addEventListener('change', () => {
        const t = C.parseTime(input.value);
        if (t != null) input.value = C.formatTime(t);
        onEdited();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const step = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1);
          input.value = C.formatTime(Math.max(0, (C.parseTime(input.value) ?? 0) + step));
          onEdited();
        } else if (e.key === 'Enter' && state.link) {
          e.preventDefault();
          copyBtn.click();
        }
      });
    }

    startNow.addEventListener('click', () => {
      const t = nowTime('start');
      if (t != null) startInput.value = C.formatTime(t);
      onEdited();
    });
    endNow.addEventListener('click', () => {
      const t = nowTime('end');
      if (t != null) endInput.value = C.formatTime(t);
      onEdited();
    });
    previewBtn.addEventListener('click', () => {
      const start = C.parseTime(startInput.value);
      const end = C.parseTime(endInput.value);
      if (start != null && end != null && end > start) previewClip(start, end);
    });

    let copiedTimer = 0;
    copyBtn.addEventListener('click', async () => {
      update();
      if (!state.link) return;
      const ok = await copyText(state.link, linkInput);
      copyBtn.textContent = ok ? t('copied') : t('copyFailed');
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => (copyBtn.textContent = t('copy')), 1600);
    });
    linkInput.addEventListener('focus', () => linkInput.select());

    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePicker({ focusButton: true });
      }
      e.stopPropagation(); // keep YouTube's keyboard shortcuts out of the way while using the picker
    });

    return { root, refresh, update };
  }

  // ------------------------------------------------------------------ Clip button

  let picker = null; // created the first time it's opened
  let pickerOpen = false;
  onClipChanged = () => picker?.update(); // a preview started or ended: show/hide "Cancel preview"
  let pickerButton = null; // the Clip button the open picker hangs under
  let pickerRaf = 0;

  function createClipButton() {
    const button = h(
      'button',
      { class: 'ytcs-clip-button', type: 'button', title: t('actionTitle'), 'aria-haspopup': 'dialog', 'aria-expanded': 'false' },
      scissorsIcon(20),
      h('span', {}, t('clipButton'))
    );
    button.addEventListener('click', () => (pickerOpen && pickerButton === button ? closePicker() : openPicker(button)));
    return button;
  }

  // "Studio" layout while the picker is open: the video at its normal size on the left
  // and the picker docked in YouTube's right-hand column, beside it. In theater mode we
  // switch back to the normal layout first, and restore theater mode on close.
  let leftTheaterMode = false;
  let dockWaitUntil = 0; // after leaving theater mode, give YouTube a moment to re-lay out

  const watchLayout = () => document.querySelector('ytd-watch-flexy');
  const sizeButton = () => document.querySelector('#movie_player .ytp-size-button');

  function leaveTheaterMode() {
    if (!watchLayout()?.hasAttribute('theater') || document.fullscreenElement || !sizeButton()) return;
    sizeButton().click();
    leftTheaterMode = true;
    dockWaitUntil = performance.now() + 700;
  }

  function restoreTheaterMode() {
    if (!leftTheaterMode) return;
    leftTheaterMode = false;
    if (!watchLayout()?.hasAttribute('theater')) sizeButton()?.click();
  }

  /** YouTube's right-hand column, if it currently sits beside the player (two-column layout). */
  function sideColumn() {
    const player = document.getElementById('movie_player');
    const column = document.querySelector('ytd-watch-flexy #secondary-inner') ?? document.querySelector('ytd-watch-flexy #secondary');
    if (!player || !column) return null;
    const p = player.getBoundingClientRect();
    const c = column.getBoundingClientRect();
    return p.width > 0 && c.width >= 280 && c.left >= p.right - 4 && c.top < p.bottom ? column : null;
  }

  function openPicker(button) {
    if (!watchVideoId()) return;
    picker ??= createPicker();
    if (!picker.root.isConnected) document.body.append(picker.root);
    pickerButton?.setAttribute('aria-expanded', 'false');
    pickerButton = button;
    button.setAttribute('aria-expanded', 'true');
    pickerOpen = true;
    leaveTheaterMode();
    const player = document.getElementById('movie_player');
    if (player && player.getBoundingClientRect().top < 56) window.scrollTo({ top: 0, behavior: 'smooth' });
    picker.root.hidden = false;
    picker.refresh();
    cancelAnimationFrame(pickerRaf);
    layoutPicker();
  }

  function closePicker({ focusButton = false } = {}) {
    if (!pickerOpen) return;
    pickerOpen = false;
    picker.root.hidden = true;
    cancelAnimationFrame(pickerRaf);
    pickerRaf = 0;
    pickerButton?.setAttribute('aria-expanded', 'false');
    restoreTheaterMode();
    if (focusButton) pickerButton?.focus();
  }

  // Runs every frame while the picker is open. Docks it beside the video when YouTube's
  // layout has a right-hand column, otherwise floats it under the Clip button, and follows
  // layout changes (theater mode, window size…). Closes it when the page moves to another video.
  function layoutPicker() {
    pickerRaf = requestAnimationFrame(layoutPicker);
    if (!pickerButton?.isConnected || watchVideoId() !== picker.root.dataset.video) return closePicker();
    const root = picker.root;

    const column = sideColumn();
    if (column) {
      if (column.firstElementChild !== root) column.prepend(root);
      root.classList.add('ytcs-docked');
      root.style.visibility = '';
      root.style.left = root.style.top = '';
      root.dataset.pos = '';
      const height = `${Math.round(document.getElementById('movie_player').getBoundingClientRect().height)}px`;
      if (root.style.minHeight !== height) root.style.minHeight = height; // as tall as the video
      return;
    }

    // Leaving theater mode takes YouTube a moment; don't flash the floating version meanwhile.
    root.style.visibility = performance.now() < dockWaitUntil ? 'hidden' : '';
    if (root.parentElement !== document.body) document.body.append(root);
    root.classList.remove('ytcs-docked');
    root.style.minHeight = '';

    const r = pickerButton.getBoundingClientRect();
    if (!r.width) return; // button briefly hidden while YouTube re-lays out
    const margin = 16;
    const width = root.offsetWidth;
    const pageWidth = document.documentElement.clientWidth || innerWidth;
    const left = Math.max(margin, Math.min(r.left, pageWidth - width - margin));
    const pos = `${Math.round(left + scrollX)},${Math.round(r.bottom + 8 + scrollY)}`;
    if (root.dataset.pos === pos) return;
    root.dataset.pos = pos;
    const [x, y] = pos.split(',');
    root.style.left = `${x}px`;
    root.style.top = `${y}px`;
  }

  /** Adds the Clip button at the start of the watch page's action buttons, left of Like/Dislike. */
  function injectClipButtons() {
    if (location.pathname !== '/watch') return;
    for (const bar of document.querySelectorAll('ytd-watch-metadata #top-level-buttons-computed')) {
      const existing = bar.querySelector(':scope > .ytcs-clip-button');
      if (existing === bar.firstElementChild) continue;
      // Missing, or YouTube inserted its own buttons in front of it: (re)place it first.
      bar.prepend(existing ?? createClipButton());
    }
  }

  // YouTube builds (and rebuilds) the page dynamically, so add the button whenever it's missing.
  let injectQueued = false;
  new MutationObserver(() => {
    if (injectQueued) return;
    injectQueued = true;
    requestAnimationFrame(() => {
      injectQueued = false;
      injectClipButtons();
    });
  }).observe(document, { childList: true, subtree: true });

  // ------------------------------------------------------------------ popup bridge

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    switch (msg?.type) {
      case 'ytcs:getState': {
        const videoId = watchVideoId();
        sendResponse({
          videoId,
          title: videoTitle(),
          playback: playbackInfo(),
          initial: videoId ? initialRange(videoId, true) : null,
          previewing: isPreviewing(videoId),
        });
        break;
      }
      case 'ytcs:cancelPreview':
        sendResponse({ ok: cancelPreview() });
        break;
      case 'ytcs:setDraft':
        if (msg.videoId && msg.videoId === watchVideoId()) setDraft(msg.videoId, msg.start, msg.end, msg.title);
        sendResponse({ ok: true });
        break;
      case 'ytcs:preview':
        sendResponse({ ok: previewClip(msg.start, msg.end) });
        break;
    }
  });
})();
