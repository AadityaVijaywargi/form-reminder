# Form Submit Receipt

A browser extension that emails you a receipt every time you submit an online form: the form's
name, when you submitted it, a link to it, and (on by default) a copy of your answers. Click the
toolbar icon for a popup with setup, options and recent receipts.

- **Browsers:** Brave, Chrome and Edge (MV3), Firefox desktop and Firefox for Android (MV3).
  Safari is a follow-up release. Brave/Chrome on phones can't run extensions at all.
- **Providers:** Google Forms, Microsoft Forms, Typeform, Jotform and Tally, including embedded forms.
- **Email:** one Google Apps Script web app (`apps-script/`) that you own relays every user's
  receipts. Users verify their email once with a 6-digit code.

## Install (no coding needed)

1. Open the [latest release](https://github.com/AadityaVijaywargi/form-reminder/releases/latest)
   and download the `...-chrome.zip` file under *Assets*.
2. Unzip it into a folder you'll keep. The extension stops working if that folder is moved or
   deleted.
3. Open `chrome://extensions` (or `brave://extensions`, `edge://extensions`), turn on
   **Developer mode** (top right), click **Load unpacked** and pick the unzipped folder.
4. A welcome tab opens: enter your email, type the 6-digit code you receive, then click
   **Send test email**.

It doesn't update itself: to update, download the new zip, replace the folder's contents and
click the reload icon on the extension's card. Chrome may warn about developer-mode extensions
on start-up; that's expected for extensions installed this way.

## How it works

```
form page ──▶ content script ──▶ background ──HTTPS──▶ Apps Script relay ──▶ user's inbox
             (providers/*.ts)   (queue, retry)          (token → email, MailApp)
```

- Each provider has one adapter in `providers/` (shared answer reading in `read-controls.ts`).
  Single-page providers (Microsoft, Typeform, Tally) count "questions gone and stayed gone" as a
  submit, and the background also watches their submit request with `webRequest` (Jotform too).
- `providers/google.ts` holds every Google-specific selector: detecting the confirmation page
  (the "Submit another response" link, or `/formResponse` with no questions left) and reading
  answers. On multi-section forms, `/formResponse` also appears after **Next**, so the URL alone
  is never trusted.
- `lib/watcher.ts` keeps a draft of answers as the user fills the form (they're gone from the page
  after Submit) and reports the confirmation once. Drafts live in `storage.session` (memory only)
  and are deleted once the receipt is queued.
- `lib/queue.ts` saves each receipt before any network call, dedupes repeat submits of the same
  form within 60 s, and retries with back-off (hourly when the relay's daily quota is used up).
- `lib/mask.ts` hides answers that look like passwords, OTPs, card numbers or ID numbers.

## Set up the relay (once)

1. Create a dedicated Gmail account to own the relay (e.g. `formreceipt.app@gmail.com`). Receipts
   are sent from it.
2. Signed in as that account, go to <https://script.google.com>, **New project**, and paste
   `apps-script/Code.gs`. In **Project Settings**, tick *Show "appsscript.json"* and paste
   `apps-script/appsscript.json`. (Or use [clasp](https://github.com/google/clasp):
   `npx @google/clasp login`, `clasp create --type webapp --rootDir apps-script`, `clasp push`.)
3. **Deploy → New deployment → Web app**: *Execute as: Me*, *Who has access: Anyone*. Authorize
   when asked, then copy the web app URL (ends in `/exec`).
4. In the editor, choose `setup` in the function picker and click **Run** once. This installs the
   daily usage summary email.
5. Opening the `/exec` URL in a browser should show `{"ok":true,"service":"form-submit-receipt-relay"}`.

Free Gmail accounts can send about **100 emails/day in total** (receipts + verification codes,
across all users). When the daily summary shows ~80 regularly, move to a Cloudflare Worker +
Resend relay: it speaks the same `action`-based API, so only `WXT_RELAY_URL` changes.

## Build and run the extension

```bash
npm install
cp .env.example .env   # then paste your /exec URL into WXT_RELAY_URL
npm run build          # → .output/chrome-mv3 (Brave, Chrome, Edge)
npm run build:firefox  # → .output/firefox-mv3
```

- **Brave / Chrome:** open `brave://extensions` (or `chrome://extensions`), turn on *Developer
  mode*, click **Load unpacked** and pick `.output/chrome-mv3`.
- **Firefox:** `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → pick
  `.output/firefox-mv3/manifest.json`.
- `npm run dev` opens a browser with the extension loaded and reloads it as you edit.

A welcome tab opens on install: enter your email, type the code you receive, then click
**Send test email**. Afterwards everything is in the toolbar popup. A custom relay URL can be set under *Advanced*.

## Tests

```bash
npm test         # vitest: adapter fixtures, watcher, queue, sender, relay client, Code.gs in a VM
npm run compile  # TypeScript
```

`tests/apps-script.test.ts` runs `Code.gs` against in-memory fakes of PropertiesService,
CacheService, MailApp and friends, covering verification, rate limits, quota, escaping and deletion.

## Publishing

See `store/listing.md` (descriptions, permission justifications, data disclosures, checklist) and
`PRIVACY.md` (publish it, e.g. on GitHub Pages, and use its URL in each store).

## License

[MIT](LICENSE)
