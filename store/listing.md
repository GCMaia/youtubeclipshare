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

Click the new Clip button under any video. A clip panel opens right next to the video, where you pick a start and end time. Type the times, or press "Now" at the moment you want. The panel stays open while the video plays, so you can mark the start and the end as you watch. Then copy the link and send it anywhere.

When someone with YouClip opens your link:
• the video starts at your start time
• grey dots on the progress bar show where the clip begins and ends
• the rest of the page dims, so the clip gets the spotlight
• the video pauses at your end time, with buttons to replay the clip or keep watching

Sending it to someone who doesn't have YouClip, or who'll open it on a phone? Pick "Link for everyone". It opens a simple page that plays just that part of the video, on any device, with nothing to install. Pasted in a chat, the link shows your clip's title and the video's thumbnail.

Also:
• Give your clip a title (optional). It shows above the video on the clip's page
• Preview the clip before you share it
• The toolbar button opens the same picker
• Works in YouTube's light and dark themes
• Available in 19 languages

Private by design: YouClip doesn't collect or send any data. The extension only runs on youtube.com, and everything happens in your browser.

YouClip is not affiliated with or endorsed by YouTube or Google.
```

### Description — Português (Brasil)

```
Compartilhe exatamente o trecho de um vídeo do YouTube que você quer mostrar, não o vídeo inteiro.

Clique no novo botão Clipe embaixo de qualquer vídeo. Um painel de clipe abre ao lado do vídeo, onde você escolhe o início e o fim. Digite os tempos ou clique em "Agora" no momento que você quiser. O painel fica aberto enquanto o vídeo toca, então dá para marcar o início e o fim assistindo. Depois é só copiar o link e mandar para quem quiser.

Quando alguém com o YouClip abre o seu link:
• o vídeo começa no tempo de início escolhido
• pontos cinza na barra de progresso mostram onde o clipe começa e termina
• o resto da página escurece, deixando o clipe em destaque
• o vídeo pausa no tempo final, com botões para repetir o clipe ou continuar assistindo

Vai mandar para alguém que não tem o YouClip, ou que vai abrir no celular? Escolha "Link para todos". Ele abre uma página simples que reproduz só aquele trecho do vídeo, em qualquer aparelho, sem precisar instalar nada. Colado numa conversa, o link mostra o título do clipe e a miniatura do vídeo.

Também:
• Dê um título ao seu clipe (opcional). Ele aparece acima do vídeo na página do clipe
• Veja uma prévia do clipe antes de compartilhar
• O botão na barra de ferramentas abre o mesmo seletor
• Funciona nos temas claro e escuro do YouTube
• Disponível em 19 idiomas

Privacidade em primeiro lugar: o YouClip não coleta nem envia nenhum dado. A extensão só funciona no youtube.com e tudo acontece no seu navegador.

O YouClip não é afiliado nem endossado pelo YouTube ou pelo Google.
```

### Graphics

- **Store icon (128×128):** `icons/icon128.png`
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
YouClip lets people share a link to a specific part of a YouTube video (a start and an end time), and plays those links so the video starts at the start time and pauses at the end time.
```

**Host permission justification** (for `https://www.youtube.com/*`)

```
The extension's content script runs only on www.youtube.com. It adds a Clip button under the video that opens a start/end time picker, and reads the current playback time to fill in times. When a clip link is opened, it pauses the video at the clip's end time, marks the clip on the progress bar and dims the page around the player. Nothing is sent anywhere; everything happens in the page.
```

**`storage` justification**

```
Remembers which kind of clip link the user prefers: a link to the YouClip web player or a regular YouTube link. Nothing else is stored.
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
