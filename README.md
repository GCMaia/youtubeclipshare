# YouClip for YouTube

A Chrome/Chromium extension (Manifest V3) for sharing a specific part of a YouTube video.
Pick a start and an end time, copy the link, and whoever opens it sees the video start at
the start time and pause at the end time.

## Install

1. Open `chrome://extensions` (Edge: `edge://extensions`, Brave: `brave://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Reload any YouTube tabs that were already open.

## Share a clip

Click the **Clip** button under a video, to the left of the Like button. The page switches to a
"clip studio" layout: the clip panel opens to the right of the video, in place of the top of the
recommendations, as tall as the video. If you're in theater mode, it switches to the normal layout
(a smaller video) and back again when you close the panel. When the window is too narrow for a
side column, the panel opens under the button instead. It contains:

- **Start / End**: type times like `1:23`, `1:02:03`, `83` or `1m23s`. Use ↑/↓ to nudge by 1 second, or Shift+↑/↓ for 10 seconds.
- **Now**: fills in the video's current time.
- **Preview**: plays the clip, so you can check the cut. While a preview runs, a **Cancel preview**
  button appears. It stops the preview and puts the video back where it was, playing or paused.
- **Clip title** (optional): a name for the clip, up to 100 characters. It goes in "Link for everyone"
  links and shows on the clip's page above the video's own name. The field is hidden while
  **YouTube link** is selected, because YouTube links don't carry a title.
- **Copy**: copies the clip link.

The panel doesn't cover the video and stays open while you watch, seek or pause. Press **Now**
at the start moment, let the video play or seek to the end moment, then press **Now** again.
Close it with ✕, Esc or the **Clip** button. The times you typed are still there when you reopen it.

The toolbar button opens the same picker in a popup. Keep it open while the video plays and
press **Now** at the start and at the end.

## Opening a clip

A clip link looks like this:

```
https://www.youtube.com/watch?v=VIDEO_ID&t=83s&end=120
```

- **With the extension installed**, the video starts at 1:23 and shows a "Clip 1:23 – 2:00" badge.
  Grey dots on the progress bar mark the clip's start and end. At 2:00 it pauses and offers
  **Replay clip** or **Keep watching**. Any of these turns clip mode off: seeking past the end,
  pressing play after the clip ends, or clicking ✕ on the badge.
- **While the clip plays, the rest of the page is dimmed** so only the video stays bright. The
  dimming lifts when the video is paused, when the clip ends, or when the player is scrolled
  mostly out of view. Clicking anywhere outside the player (comments, search, menus) also lifts it
  until play is pressed again.
- **Without the extension**, the link still starts at 1:23, because `t` is YouTube's own start
  parameter. It plays on past the end, because nothing on the viewer's side reads `end`.

## Links for everyone (web player)

The picker can copy two kinds of link, and the extension remembers which one you chose last:

- **Link for everyone** (the default): `https://youclip.ca/watch/VIDEO_ID?start=83&end=120`, plus
  `&title=…` when the clip has a title. It opens a small dark page from `web/` that plays just the
  clip with YouTube's embedded player. Under the video it shows the clip's range and length, the
  clip title (if any), the video's name and a **Watch on YouTube** link. When the clip ends, it
  shows **Replay clip** and **Keep watching**. It works in any browser and on phones, with no
  extension.
- **YouTube link**: the youtube.com link described above.

The address is `WEB_PLAYER_URL` in `src/clip-utils.js`. Setting it to `''` hides the switch, and
only YouTube links are copied.

The clip is stored in the link itself, so there's no database, and links never expire. Videos whose
owners turned off embedding can't play on the page (it shows a "Watch on YouTube" button instead).

**Link previews.** When a clip link is pasted in WhatsApp, Discord, iMessage, Slack, X and so on, the
preview shows the clip title (or the video's name if there's none), the clip's range and length, the
video's name and channel, and the video's thumbnail. Chat apps read this from tags in the page
without running its JavaScript, so `worker/index.mjs` fills them in on Cloudflare before the page is
sent. It asks YouTube's public oEmbed endpoint for the video's title and checks whether the
thumbnail exists in HD. It sends only the video ID, and both answers are cached for a day. The text
itself is built in `worker/preview.mjs`. Chat apps cache previews too, so a link pasted before a
change keeps its old preview.

**How youclip.ca is hosted.** `web/` is a static site, served by a Cloudflare Worker named
`youtubeclip` (free plan). The Worker is connected to this GitHub repository, so **every push to `main`
updates the site** within a minute or two. `wrangler.jsonc` tells Cloudflare to serve the files in
`web/` directly and to send every other address, which means the `/watch/…` clip pages, to
`worker/index.mjs`, which answers with `index.html` plus the link preview. The free plan allows 100,000 clip page views a day; files like the player script
and icons don't count.

To try the Worker on your computer: `npx wrangler dev`, then open
http://127.0.0.1:8787/watch/dQw4w9WgXcQ?start=43&end=50.

Setting it up (one time):

1. In the Cloudflare dashboard, open **Workers & Pages → Create → Continue with GitHub** and pick this
   repository. If it isn't listed, give Cloudflare's GitHub app access to it.
2. Name the Worker `youtubeclip`, the same as `name` in `wrangler.jsonc`, or the build fails. Use these
   settings:
   - Build command: `node tools/build-site.mjs`
   - Deploy command: `npx wrangler deploy`
   - Root directory: `/`
3. After the first deploy, open the Worker's **Settings → Domains & Routes → Add → Custom domain**
   and enter `youclip.ca`. Cloudflare adds the DNS record and the HTTPS certificate.
4. Open https://youclip.ca/watch/dQw4w9WgXcQ?start=43&end=50 to check that it plays.

Leave Web Analytics turned off. The privacy policy says the page has no analytics.

Shared links use `youclip.ca`, not the `workers.dev` address, so you could move to another host
later without breaking links already sent. Any static host can serve the player if it rewrites
`/watch/*` to `index.html` (on Netlify, a `_redirects` file with `/watch/*  /  200`). Only the link
previews need the Worker. Don't add that file here: on Cloudflare it would answer clip pages before
the Worker gets to add the preview.

The build command regenerates the copies in `web/` on every deploy. Still run
`node tools/build-site.mjs` after changing `src/clip-utils.js`, `_locales/`, `icons/` or
`store/privacy-policy.md`, because the tests fail until the copies in the repository are up to date.
The privacy policy is published as https://youclip.ca/privacy (`web/privacy.html`).

## Languages

The extension's text follows Chrome's display language, which by default is the operating
system's language. It falls back to English for languages that aren't translated.

Included: English, Portuguese (Brazil and Portugal), Spanish, French, German, Italian, Dutch,
Polish, Russian, Ukrainian, Turkish, Arabic (right-to-left), Hindi, Indonesian, Japanese,
Korean, and Chinese (Simplified and Traditional).

To add a language, copy `_locales/en/messages.json` to `_locales/<code>/messages.json`, using a
[locale code Chrome supports](https://developer.chrome.com/docs/extensions/reference/api/i18n#locales).
Then translate each `message` and keep the `$PLACEHOLDERS$` as they are. Set `lang` to the
language's code, for example `sv`. Run `node --test` to check that nothing is missing.

To try another language, start Chrome with a different language. On Windows:
`chrome.exe --lang=pt-BR`

## Publishing

1. For an update, raise `version` in `manifest.json`. Each upload needs a higher version than the
   last one. The first upload can stay at 1.0.0.
2. Run `node --test`, then `node tools/package.mjs`. This creates `dist/youclip-<version>.zip`
   with only the files the extension needs.
3. Upload the zip in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
   `store/listing.md` walks through every dashboard field, with the text to paste. The privacy
   policy URL is https://youclip.ca/privacy. The promo tile is `store/promo-tile-440x280.png`.
   You take the screenshots yourself (see `store/listing.md`).

## Project layout

| Path | What it does |
| --- | --- |
| `manifest.json` | Extension manifest. Runs only on `www.youtube.com`, and its only permission is `storage`, used to remember the link type. |
| `src/clip-utils.js` | Time parsing/formatting and clip-link encoding, shared by everything. |
| `src/content.js` | Runs on YouTube. Stops playback at the clip end, adds the Clip button and its picker, and answers the popup. |
| `src/content.css` | Styles for the Clip button, the picker, and the in-player badge, overlay and dots. |
| `popup/` | Toolbar popup. |
| `_locales/` | Translations of all text, one folder per language. |
| `tools/make-icons.mjs` | Regenerates `icons/*.png` (`node tools/make-icons.mjs`). |
| `tools/package.mjs` | Builds the store upload zip into `dist/`. |
| `tools/make-promo-tile.mjs` | Renders the store's promo tile from `store/promo-tile.html` (needs Edge or Chrome). |
| `web/` | The web player for "Link for everyone" links: a static site to upload to any static host. `clip-utils.js`, `strings.js`, `privacy.html` and the icons in it are generated. |
| `tools/build-site.mjs` | Updates the generated files in `web/` (`node tools/build-site.mjs`). |
| `wrangler.jsonc` | Cloudflare settings for hosting `web/` at youclip.ca. |
| `worker/` | The Cloudflare Worker that adds link previews (title, thumbnail) to clip pages. |
| `store/` | Store listing text and privacy policy. |
| `test/` | Unit tests and translation checks (`node --test`). |

The Clip button depends on YouTube's markup (the `#top-level-buttons-computed` row inside
`ytd-watch-metadata`), which YouTube changes from time to time. If the button stops appearing,
update `injectClipButtons()` in `src/content.js`. The toolbar popup keeps working either way.
