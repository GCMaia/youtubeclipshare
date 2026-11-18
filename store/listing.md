# Chrome Web Store submission

Text to paste into the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole),
section by section. The name and short summary come from the extension itself (in all its languages),
so they aren't entered here.

## Before you start (one time)

1. Sign in to the dashboard with the Google account that should own the extension. Accept the
   developer agreement and pay the one-time registration fee (US$5 at the time of writing).
2. In **Account**, set and verify the contact email. Google uses it to contact you; it isn't shown on
   the store unless you choose to show it.
3. If it asks whether you're a trader (EU rules): a free extension with no business behind it is
   usually **non-trader**.

Before submitting, check that these work, because reviewers may open them:
- https://youclip.ca/watch/dQw4w9WgXcQ?start=43&end=50&title=Test (plays 0:43–0:50)
- https://youclip.ca/privacy (the privacy policy)

---

## Package tab

Upload `dist/youclip-<version>.zip` (build it with `node tools/package.mjs`).

---

## Store listing tab

**Category:** Lifestyle → Entertainment (or Social Networking)

**Language:** English is the default language.

**Homepage URL:** https://youclip.ca (the home page has the "Buy me a pizza" button)

**Support URL** (if the form asks): https://github.com/GCMaia/youtubeclipshare/issues

### Description, in every language

The store shows each visitor the extension's name and summary in their own language (they come from
`_locales/`), but the description only in the languages it was entered in, and English everywhere
else. So enter a description for every language, or visitors get a translated name and summary above
an English description.

There's one file per language in `store/descriptions/`, named like the `_locales/` folders. In the
**Store listing** tab, pick each language in the language menu at the top, paste its file into
**Description**, and save. When all of them are in, click **Submit for review**. Screenshots and the
promo tile don't need translating: the ones in the default language are shown for every language.

| File | Language |
| --- | --- |
| `en.txt` | English |
| `ar.txt` | Arabic |
| `de.txt` | German |
| `es.txt` | Spanish |
| `fr.txt` | French |
| `hi.txt` | Hindi |
| `id.txt` | Indonesian |
| `it.txt` | Italian |
| `ja.txt` | Japanese |
| `ko.txt` | Korean |
| `nl.txt` | Dutch |
| `pl.txt` | Polish |
| `pt_BR.txt` | Portuguese (Brazil) |
| `pt_PT.txt` | Portuguese (Portugal) |
| `ru.txt` | Russian |
| `tr.txt` | Turkish |
| `uk.txt` | Ukrainian |
| `zh_CN.txt` | Chinese (Simplified) |
| `zh_TW.txt` | Chinese (Traditional) |

When you add a language to `_locales/`, add its description here too, and paste it in the dashboard.

### Graphics

- **Store icon (128×128):** `store/store-icon-128.png`, the extension icon at 96×96 with transparent
  space around it, as the store's image guidelines ask (made by `node tools/make-icons.mjs`)
- **Screenshots (1280×800, at least 1, up to 5):** take these yourself on a real video:
  1. The clip panel open beside the video (after clicking the Clip button)
  2. A clip playing: dimmed page, "Clip" badge and the grey dots on the progress bar
  3. The "Clip ended" screen with Replay clip / Keep watching
  4. The toolbar popup

  Tip: in Brave/Chrome press F12 → toggle the device toolbar (Ctrl+Shift+M) → set the size to
  1280 × 800 → ⋮ menu → **Capture screenshot**. That gives an exact 1280×800 image of the page.
- **Small promo tile (440×280):** `store/promo-tile-440x280.png` (regenerate it from
  `store/promo-tile.html` with `node tools/make-promo-tile.mjs`).

---

## Privacy practices tab

**Single purpose**

```
YouClip lets people share a link to a specific part of a YouTube video (a start time, an end time and an optional title), and plays those links so the video starts at the start time and pauses at the end time.
```

**Host permission justification** (for `https://www.youtube.com/*`)

```
The content script runs only on https://www.youtube.com/*. It adds a Clip button under the video that opens a picker for the clip's start time, end time and optional title, and it reads the video's ID and current playback time to fill in the times and build the clip link. When someone opens a YouTube clip link (…&t=83s&end=120), the script pauses the video at the clip's end time, marks the start and end on the progress bar and dims the page around the player.

It has to run on YouTube pages as they load, not only after a click, because the clip must stop at its end time as soon as a shared link is opened. That's why activeTab isn't enough.

The extension makes no network requests and sends no data anywhere. Everything happens in the page.
```

**`storage` justification**

```
Remembers one setting: which kind of clip link the user prefers to copy, a link to the YouClip web player (youclip.ca) or a regular YouTube link. Nothing else is stored, and no personal data or browsing history is kept.
```

**Are you using remote code?** No, I am not using remote code.

**Data usage:** leave every data type unchecked (the extension collects no user data), then tick the three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://youclip.ca/privacy (generated from `store/privacy-policy.md` by
`node tools/build-site.mjs`). Before submitting, turn off Cloudflare Web Analytics for youclip.ca,
because the policy says the page has no analytics.

---

## Distribution tab

- **Visibility:** Public. Choose Unlisted to share it only with people who have the link.
- **Regions:** All regions

Then click **Submit for review**.
