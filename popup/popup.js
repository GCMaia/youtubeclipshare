/* Clip Share popup: the same start/end picker as the Clip button on the page,
 * for when you'd rather use the toolbar button. Talks to the content script. */
(() => {
  'use strict';

  const C = globalThis.YTClip;
  const t = C.msg; // translated text, see _locales/
  const $ = (id) => document.getElementById(id);

  /** Fills in the data-i18n* attributes of popup.html with the translated text. */
  function localizePage() {
    C.applyLocale(document.documentElement);
    for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
    for (const node of document.querySelectorAll('[data-i18n-title]')) node.title = t(node.dataset.i18nTitle);
    for (const node of document.querySelectorAll('[data-i18n-aria-label]')) {
      node.setAttribute('aria-label', t(node.dataset.i18nAriaLabel));
    }
    // The tip shows the "Now" button label in bold, wherever the language puts it.
    const marker = '\u0001';
    const [before, after = ''] = t('popupTip', [marker]).split(marker);
    const now = document.createElement('b');
    now.textContent = t('now');
    $('tip').replaceChildren(before, now, after);
  }
  localizePage();
  const el = {
    message: $('message'),
    picker: $('picker'),
    title: $('video-title'),
    length: $('length'),
    start: $('start'),
    end: $('end'),
    startNow: $('start-now'),
    endNow: $('end-now'),
    link: $('link'),
    error: $('error'),
    preview: $('preview'),
    cancelPreview: $('cancel-preview'),
    copy: $('copy'),
  };

  let tabId = null;
  let videoId = null;
  let duration = 0;
  let link = '';
  let linkType = C.DEFAULT_LINK_TYPE;
  const typeButtons = document.querySelectorAll('[data-link-type]');

  function showLinkType() {
    for (const button of typeButtons) button.setAttribute('aria-pressed', String(button.dataset.linkType === linkType));
    $('footer-hint').textContent = linkType === 'youtube' ? t('stopHint') : t('everyoneHint');
  }

  // The switch only appears once the web player has an address (WEB_PLAYER_URL in clip-utils.js).
  document.querySelector('.segmented').hidden = C.LINK_TYPES.length < 2;

  for (const button of typeButtons) {
    button.addEventListener('click', () => {
      linkType = button.dataset.linkType;
      chrome.storage.sync.set({ linkType }).catch(() => {});
      showLinkType();
      if (videoId) update();
    });
  }

  const send = (message) => chrome.tabs.sendMessage(tabId, message);

  function showMessage(text) {
    el.message.textContent = text;
    el.message.hidden = false;
    el.picker.hidden = true;
  }

  function update() {
    const start = C.parseTime(el.start.value);
    const end = C.parseTime(el.end.value);
    const error = C.validateClip(start, end, duration);
    el.start.classList.toggle('invalid', start == null);
    el.end.classList.toggle('invalid', end == null || (start != null && end <= start));
    el.error.textContent = error ? t(error.key, error.subs) : '';
    link = error ? '' : C.buildClipLink(linkType, videoId, start, end);
    el.link.value = link;
    el.length.textContent = error ? '' : t('clipLength', [C.formatTime(end - start)]);
    el.copy.disabled = el.preview.disabled = !!error;
  }

  function onEdited() {
    update();
    send({ type: 'ytcs:setDraft', videoId, start: el.start.value, end: el.end.value }).catch(() => {});
  }

  async function setFromNow(input, kind) {
    try {
      const state = await send({ type: 'ytcs:getState' });
      if (!state?.playback) return;
      if (state.playback.duration) duration = state.playback.duration;
      const t = state.playback.currentTime;
      input.value = C.formatTime(kind === 'end' ? Math.ceil(t) : Math.floor(t));
      onEdited();
    } catch {
      showMessage(t('msgLostConnection'));
    }
  }

  async function init() {
    try {
      const stored = await chrome.storage.sync.get({ linkType: C.DEFAULT_LINK_TYPE });
      if (C.LINK_TYPES.includes(stored.linkType)) linkType = stored.linkType;
    } catch {}
    showLinkType();

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id ?? null;
    const onYouTube = /^https:\/\/www\.youtube\.com\//.test(tab?.url ?? '');

    let state = null;
    if (tabId != null && onYouTube) {
      try {
        state = await send({ type: 'ytcs:getState' });
      } catch {
        return showMessage(t('msgReloadTab'));
      }
    }
    if (!state?.videoId) return showMessage(t('msgOpenVideo'));

    videoId = state.videoId;
    duration = state.playback?.duration ?? 0;
    el.title.textContent = state.title;
    el.title.title = state.title;
    el.start.value = state.initial.start;
    el.end.value = state.initial.end;
    el.cancelPreview.hidden = !state.previewing;
    el.picker.hidden = false;
    update();
  }

  for (const input of [el.start, el.end]) {
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
      } else if (e.key === 'Enter' && link) {
        el.copy.click();
      }
    });
  }

  el.startNow.addEventListener('click', () => setFromNow(el.start, 'start'));
  el.endNow.addEventListener('click', () => setFromNow(el.end, 'end'));

  el.preview.addEventListener('click', () => {
    const start = C.parseTime(el.start.value);
    const end = C.parseTime(el.end.value);
    if (start == null || end == null || end <= start) return;
    send({ type: 'ytcs:preview', start, end })
      .then((r) => (el.cancelPreview.hidden = !r?.ok))
      .catch(() => {});
  });

  el.cancelPreview.addEventListener('click', () => {
    el.cancelPreview.hidden = true;
    send({ type: 'ytcs:cancelPreview' }).catch(() => {});
  });

  let copiedTimer = 0;
  el.copy.addEventListener('click', async () => {
    if (!link) return;
    let ok = true;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      el.link.select();
      ok = document.execCommand('copy');
    }
    el.copy.textContent = ok ? t('copied') : t('copyFailed');
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (el.copy.textContent = t('copyClipLink')), 1600);
  });

  el.link.addEventListener('focus', () => el.link.select());

  init().catch(() => showMessage(t('msgOpenVideo')));
})();
