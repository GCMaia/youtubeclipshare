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

**Language:** English (add Portuguese (Brazil) as a second listing language and use the text below)

**Support URL** (if the form asks): https://github.com/GCMaia/youtubeclipshare/issues

### Description — English

```
Share the exact part of a YouTube video you mean, not the whole thing.

Click the new Clip button under any video. A panel opens beside the video where you set the start and the end: type the times, or press "Now" at the right moment while the video plays. Give the clip a title if you like, preview it, and copy the link.

ANYONE CAN WATCH, NOTHING TO INSTALL
The link opens a page that plays just that part of the video, on a computer or a phone. When the clip ends, viewers can replay it or keep watching. Pasted into most chat apps, the link shows your clip's title and the video's thumbnail.

EVEN BETTER WITH YOUCLIP INSTALLED
Prefer a regular YouTube link? Switch to "YouTube link". For people who have YouClip, it starts at your start time, marks the clip with grey dots on the progress bar, dims the rest of the page and pauses at your end time. Without YouClip, it still starts at the right moment.

ALSO
• Optional clip title, shown above the video
• Preview the clip before you share it
• The toolbar button opens the same picker
• Works with YouTube's light and dark themes
• Available in 19 languages

PRIVATE BY DESIGN
The extension collects no data and only runs on youtube.com. A clip link contains only the video, the times and your title. No accounts, no ads, no tracking.

YouClip is not affiliated with or endorsed by YouTube or Google.
```

### Description — Português (Brasil)

```
Compartilhe exatamente o trecho de um vídeo do YouTube que você quer mostrar, não o vídeo inteiro.

Clique no novo botão Clipe embaixo de qualquer vídeo. Um painel abre ao lado do vídeo, onde você define o início e o fim: digite os tempos ou clique em "Agora" no momento certo enquanto o vídeo toca. Se quiser, dê um título ao clipe, veja uma prévia e copie o link.

QUALQUER PESSOA ASSISTE, SEM INSTALAR NADA
O link abre uma página que reproduz só aquele trecho do vídeo, no computador ou no celular. Quando o clipe termina, dá para repetir ou continuar assistindo. Colado na maioria dos apps de conversa, o link mostra o título do clipe e a miniatura do vídeo.

AINDA MELHOR COM O YOUCLIP INSTALADO
Prefere um link normal do YouTube? Escolha "Link do YouTube". Para quem tem o YouClip, ele começa no seu tempo de início, marca o clipe com pontos cinza na barra de progresso, escurece o resto da página e pausa no tempo final. Sem o YouClip, ele ainda começa no momento certo.

TAMBÉM
• Título do clipe opcional, mostrado acima do vídeo
• Prévia do clipe antes de compartilhar
• O botão na barra de ferramentas abre o mesmo seletor
• Funciona nos temas claro e escuro do YouTube
• Disponível em 19 idiomas

PRIVACIDADE EM PRIMEIRO LUGAR
A extensão não coleta nenhum dado e só funciona no youtube.com. Um link de clipe contém apenas o vídeo, os tempos e o seu título. Sem contas, sem anúncios, sem rastreamento.

O YouClip não é afiliado nem endossado pelo YouTube ou pelo Google.
```

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
