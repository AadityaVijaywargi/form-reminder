# Privacy Policy: Form Submit Receipt

_Last updated: 18 October 2026_

Form Submit Receipt ("the extension") emails you a receipt when you submit an online form. This
policy explains exactly what data it handles. In short: it only looks at supported form pages, it
only sends data to email you your own receipt, and nothing is sold, shared for advertising or
kept after the email is sent.

## What the extension reads

The extension runs **only** on these form pages:

- Google Forms (`docs.google.com/forms`)
- Microsoft Forms (`forms.office.com`, `forms.microsoft.com`, `forms.cloud.microsoft`)
- Typeform (`*.typeform.com/to/…`)
- Jotform (`form.jotform.com`, `submit.jotform.com`, `eu.jotform.com`, `www.jotform.com/form/…`)
- Tally (`tally.so/r/…`, `tally.so/embed/…`)

On those pages it reads the form's title, its link, the questions and the answers you type or
select, and whether the "thank you" screen has appeared. It also notices when the provider's own
"submit" request completes, to confirm the submission. It does not read any other websites,
your browsing history, cookies or passwords.

## What leaves your device, and why

| Data | When | Sent to | Purpose |
| --- | --- | --- | --- |
| Your email address | Once, when you set up the extension | The extension's email relay | To send you a 6-digit verification code and, afterwards, your receipts |
| Form title, form link, submission time | Each time you submit a supported form | The email relay | To write your receipt |
| Your answers | Each time you submit a form, **only if "Include my answers" is on** (it is on by default and you can turn it off) | The email relay | To include a copy of your answers in your receipt |

Answers to questions that look like passwords, one-time codes, card numbers or government ID
numbers are replaced with `••••` **on your device**, before anything is sent. Uploaded files are
never sent, only their file names.

## The email relay

The relay is a Google Apps Script run by the extension's developer in a dedicated Google account.
Emails are sent with Google's MailApp service, so your receipt passes through Google's servers
as any Gmail message would.

The relay stores **only**:

- your email address, linked to a one-way hash (SHA-256) of a random install token, so it knows
  where to send receipts from your browser; and
- daily counts of emails sent, for rate limiting and quota monitoring (no content, no addresses).

Form titles, links, times and answers are used to build the email and are **never stored or
logged** by the relay.

## What stays on your device

- Your settings and install token (`storage.local`).
- A list of your last 20 receipts: form title, provider, time and delivery status (`storage.local`).
- Receipts waiting to be sent while you're offline (`storage.local`, deleted once sent, or after 7 days).
- Answers collected while you fill in a form (`storage.session`: kept in memory only, cleared
  when the browser closes, and deleted as soon as the receipt is queued).

## Your choices

- **Turn answers off:** toolbar icon → untick "Include my answers in the email".
- **Delete your data:** toolbar icon → **Delete my data**. This removes your email address and
  token from the relay and clears everything the extension stored in your browser.
- **Uninstall:** removes all local data. Your relay record can be removed with "Delete my data"
  first, or by emailing the address below.

## Sharing

Data is never sold, used for advertising, used to build profiles, or shared with anyone other
than Google acting as the email provider. The extension's use of data complies with the
Chrome Web Store User Data Policy, including the Limited Use requirements.

## Children

The extension isn't directed at children under 13 and doesn't knowingly collect their data.

## Changes

If this policy changes, the new version will be published at the same address with a new date.
Material changes will be announced in the extension's release notes.

## Contact

Questions or deletion requests: **formreceipt.app@gmail.com** (replace with the relay account's address before publishing).
