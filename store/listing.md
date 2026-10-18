# Store listing kit

Everything needed to submit to the Chrome Web Store (also serves Brave), Firefox Add-ons (AMO)
and Edge Add-ons. Build the uploads with `npm run zip` and `npm run zip:firefox` (AMO also asks
for the source zip that `zip:firefox` produces).

## Name
Form Submit Receipt

## Short description (≤132 chars)
Get an email receipt (form name, time and your answers) every time you submit a Google Form, Microsoft Form, Typeform, Jotform or Tally.

## Category
Productivity

## Full description
Never wonder "did I actually submit that form?" again.

Form Submit Receipt emails you a receipt the moment you submit an online form, even when the
form's owner didn't turn on "send me a copy".

Each receipt includes:
• The form's name and which service it's on
• The exact date and time you submitted it, in your time zone
• A link back to the form
• A copy of your answers (you can switch this off)

Works with Google Forms, Microsoft Forms, Typeform, Jotform and Tally, including forms embedded
in other websites.

Private by design:
• Runs only on those form sites, nowhere else
• Answers that look like passwords, OTPs, card or ID numbers are hidden as •••• before anything leaves your browser
• Receipts are sent to the address you verify, and nothing is stored after the email goes out
• One click deletes your data

Setup takes a minute: enter your email, type the code you receive, done. Click the toolbar icon
any time to see recent receipts or send a test email.

## Single purpose (Chrome Web Store)
Email the user a receipt (form name, submission time and, optionally, their answers) when they submit an online form.

## Permission justifications (Chrome Web Store "Privacy practices" tab)

| Permission | Justification |
| --- | --- |
| `storage` | Saves the user's settings, verified email token, a short list of recent receipts, and receipts waiting to be sent while offline. Answers being collected during form filling are kept in session storage (memory only). |
| `alarms` | Retries sending queued receipts once a minute when the user was offline or the email service was temporarily unavailable. |
| `notifications` | Shows an optional "Receipt sent ✓" notification after a receipt is emailed. The user can turn it off. |
| `webRequest` | Observes (never blocks or modifies) the form provider's own submit request, to confirm that a form was really submitted, since some providers render their thank-you screen without a page change. |
| Host permissions: form sites (`docs.google.com/forms/*`, `forms.office.com/*`, `forms.microsoft.com/*`, `forms.cloud.microsoft/*`, `*.typeform.com/to/*`, `*.typeform.com/forms/*`, `api.typeform.com/forms/*`, Jotform and Tally hosts) | The content script reads the form's title, questions and the user's answers on these pages only, and detects the confirmation screen. These are the only sites the extension runs on. |
| Host permissions: `script.google.com/macros/*`, `script.googleusercontent.com/*` | The extension's email relay (a Google Apps Script web app) that sends the receipt email. |
| Remote code | No. All code is bundled in the package. |

## Data usage disclosures (Chrome Web Store)
Collected: **Personally identifiable information** (email address), **Website content** (form
titles, questions, answers), **Web history** (only the link of a form the user submitted).

Certify:
- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

Privacy policy URL: publish `PRIVACY.md` (e.g. GitHub Pages) and paste the URL.

## AMO (Firefox)
- Data collection is declared in the manifest (`browser_specific_settings.gecko.data_collection_permissions`:
  personallyIdentifyingInfo, websiteActivity, websiteContent).
- Tick "This add-on is compatible with Firefox for Android".
- Notes for reviewers: "The relay URL is a Google Apps Script web app owned by the developer.
  Build: `npm ci && npm run build:firefox` (Node 22). The relay source is in `apps-script/`."

## Edge Add-ons
Same zip and text as the Chrome Web Store.

## Screenshots to capture (1280×800)
1. The toolbar popup with a verified address and a few recent receipts
2. A receipt email in Gmail (title, time, link, answers)
3. The welcome screen after install
4. A Google Form next to its receipt

## Before submitting
- [ ] Relay deployed from the dedicated Gmail; `.env` has its `/exec` URL; rebuilt
- [ ] `PRIVACY.md` contact address updated and published
- [ ] Ran the test matrix in the plan on live forms (T1–T14, T16, T17)
- [ ] Version bumped in `package.json`
