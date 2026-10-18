// Shared by the toolbar popup and the full-page options tab.
export const SETTINGS_MARKUP = /* html */ `
  <header>
    <img src="/icon/48.png" alt="" width="32" height="32" />
    <div class="grow">
      <h1>Form Submit Receipt</h1>
      <p class="muted small tagline">An email receipt every time you submit an online form.</p>
    </div>
  </header>

  <section class="card welcome" id="welcome" hidden>
    <h2>Welcome! One minute of setup</h2>
    <ol>
      <li>Enter the email address you want receipts sent to, below.</li>
      <li>Type in the 6-digit code we email you.</li>
      <li>Submit any Google Form, Microsoft Form, Typeform, Jotform or Tally form. The receipt arrives in seconds.</li>
    </ol>
    <p class="muted small">
      Pin the extension (puzzle-piece icon → pin) to check its status from the toolbar. Tip: add the sender to your
      contacts so receipts never land in spam.
    </p>
  </section>

  <section class="card" id="status-card">
    <div id="status" role="status" aria-live="polite"></div>
  </section>

  <section class="card">
    <h2>Send receipts to</h2>

    <form id="email-form">
      <label for="email">Email address</label>
      <div class="row">
        <input id="email" type="email" required autocomplete="email" placeholder="you@example.com" />
        <button type="submit" id="send-code">Send code</button>
      </div>
    </form>

    <form id="code-form" hidden>
      <label for="code">6-digit code we emailed you</label>
      <div class="row">
        <input id="code" inputmode="numeric" pattern="\\d{6}" maxlength="6" required autocomplete="one-time-code" />
        <button type="submit">Verify</button>
      </div>
    </form>

    <div id="verified" hidden>
      <div class="row between">
        <span class="truncate"><b id="verified-email"></b> <span class="pill ok">verified ✓</span></span>
        <button type="button" class="link" id="change-email">Change</button>
      </div>
    </div>

    <p class="error" id="email-error" role="alert"></p>
    <p class="muted small privacy">
      Receipts include the form's name, when you submitted it, a link to it and (if switched on) your answers.
      They're sent through our email relay and not stored there.
    </p>
  </section>

  <section class="card">
    <h2>Options</h2>
    <label class="toggle"><input type="checkbox" id="include-answers" /> Include my answers in the email</label>
    <label class="toggle"><input type="checkbox" id="notify" /> Notify me when a receipt is sent</label>
    <p class="muted small">Answers that look like passwords, OTPs or card numbers are always hidden as ••••.</p>
    <div class="row wrap">
      <button type="button" id="test">Send test email</button>
      <button type="button" class="danger" id="delete">Delete my data</button>
    </div>
    <p class="small" id="action-result" role="status" aria-live="polite"></p>
  </section>

  <section class="card">
    <div class="row between">
      <h2>Recent receipts</h2>
      <span class="muted small" id="last-receipt"></span>
    </div>
    <ul id="history"></ul>
  </section>

  <details class="card">
    <summary>Advanced</summary>
    <label for="relay-url">Custom relay URL</label>
    <div class="row">
      <input id="relay-url" type="url" placeholder="Built-in relay" />
      <button type="button" id="save-relay">Save</button>
    </div>
    <p class="muted small">Only change this if you run your own copy of the relay script.</p>
  </details>

  <a class="muted small open-tab" id="open-tab" href="#" hidden>Open in a full tab ↗</a>
`;
