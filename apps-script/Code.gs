/**
 * Form Submit Receipt relay.
 *
 * Deploy from the dedicated receipts Gmail as a web app:
 *   Execute as: Me  ·  Who has access: Anyone
 * Then run setup() once from the editor to install the daily summary trigger.
 *
 * API: POST a JSON body with an "action" field. Every reply is JSON: { ok: true, ... } or
 * { ok: false, error }. Form titles, links and answers are never stored or logged.
 */

var P = PropertiesService.getScriptProperties();
var C = CacheService.getScriptCache();

var LIMITS = {
  codeRequestsPerHour: 3, // per email
  codeAttemptsPer10Min: 5, // per email
  receiptsPer6h: 20, // per install token
  maxAnswers: 200,
  maxValueLength: 2000,
};

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (_) {
    return reply({ ok: false, error: 'bad_json' });
  }
  switch (body && body.action) {
    case 'verify_start':
      return reply(verifyStart(body.email));
    case 'verify_confirm':
      return reply(verifyConfirm(body.email, body.code));
    case 'receipt':
      return reply(receipt(body));
    case 'delete':
      return reply(removeUser(body.token));
    default:
      return reply({ ok: false, error: 'unknown_action' });
  }
}

/** Health check: opening the web app URL in a browser shows this. */
function doGet() {
  return reply({ ok: true, service: 'form-submit-receipt-relay' });
}

// ---------------------------------------------------------------------------- actions

function verifyStart(rawEmail) {
  var email = normaliseEmail(rawEmail);
  if (!email) return { ok: false, error: 'bad_email' };
  if (!bump('vs:' + email, LIMITS.codeRequestsPerHour, 3600)) return { ok: false, error: 'rate_limited' };
  if (MailApp.getRemainingDailyQuota() < 2) return { ok: false, error: 'busy' };

  var code = sixDigitCode();
  C.put('code:' + email, code, 600);
  C.remove('ca:' + email);
  MailApp.sendEmail({
    to: email,
    name: 'Form Receipt',
    subject: 'Your Form Receipt code: ' + code,
    htmlBody:
      '<p>Enter this code in the Form Submit Receipt extension to finish setup:</p>' +
      '<p style="font-size:28px;font-weight:bold;letter-spacing:4px">' + code + '</p>' +
      '<p style="color:#5f6368">It expires in 10 minutes. If you didn\'t ask for this, ignore this email.</p>',
  });
  countStat('verify');
  return { ok: true };
}

function verifyConfirm(rawEmail, rawCode) {
  var email = normaliseEmail(rawEmail);
  var code = String(rawCode || '').replace(/\D/g, '');
  if (!email) return { ok: false, error: 'bad_email' };
  if (!bump('ca:' + email, LIMITS.codeAttemptsPer10Min, 600)) return { ok: false, error: 'rate_limited' };
  var expected = C.get('code:' + email);
  if (!expected || code !== expected) return { ok: false, error: 'bad_code' };

  C.remove('code:' + email);
  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  P.setProperty('t:' + hash(token), email);
  return { ok: true, token: token };
}

function receipt(r) {
  var key = 't:' + hash(String(r.token || ''));
  var email = r.token ? P.getProperty(key) : null;
  if (!email) return { ok: false, error: 'unknown_token' };
  if (!bump('rc:' + key, LIMITS.receiptsPer6h, 21600)) {
    countStat('busy');
    return { ok: false, error: 'rate_limited' };
  }
  if (MailApp.getRemainingDailyQuota() < 1) {
    countStat('busy');
    return { ok: false, error: 'busy' };
  }

  var title = clip(r.title || 'Untitled form', 150);
  MailApp.sendEmail({
    to: email,
    name: 'Form Receipt',
    subject: (r.test ? '[Test] ' : '') + '✅ Submitted: ' + title,
    htmlBody: renderReceipt(r),
  });
  countStat('sent');
  return { ok: true, quota: MailApp.getRemainingDailyQuota() };
}

function removeUser(token) {
  if (!token) return { ok: false, error: 'unknown_token' };
  P.deleteProperty('t:' + hash(String(token)));
  return { ok: true };
}

// ---------------------------------------------------------------------------- email

function renderReceipt(r) {
  var rows =
    row('Form', esc(clip(r.title || 'Untitled form', 300)) +
      (r.providerName ? ' <span style="color:#5f6368">· ' + esc(clip(r.providerName, 40)) + '</span>' : '')) +
    row('Submitted', esc(clip(r.submittedAtText || r.submittedAt || '', 120)));
  var link = safeUrl(r.url);
  if (link) rows += row('Link', '<a href="' + esc(link) + '" style="color:#1a73e8">' + esc(clip(link, 80)) + '</a>');

  var answersHtml = '';
  if (Array.isArray(r.answers) && r.answers.length) {
    var answerRows = r.answers.slice(0, LIMITS.maxAnswers).map(function (a) {
      return row(
        esc(clip(a && a.question, 300)),
        esc(clip(a && a.value, LIMITS.maxValueLength)).replace(/\n/g, '<br>'),
      );
    });
    answersHtml =
      '<h3 style="font-size:15px;margin:20px 0 6px">Your answers</h3>' +
      '<table style="border-collapse:collapse;width:100%;font-size:14px">' + answerRows.join('') + '</table>';
  } else if (Array.isArray(r.answers)) {
    answersHtml = '<p style="color:#5f6368;font-size:13px">Answers unavailable for this form.</p>';
  }

  return (
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#1f1f1f;max-width:640px">' +
    '<p>You submitted ' + (r.test ? 'a <b>test</b> receipt.' : 'a form.') + '</p>' +
    '<table style="border-collapse:collapse;width:100%;font-size:14px">' + rows + '</table>' +
    answersHtml +
    '<p style="color:#5f6368;font-size:12px;margin-top:24px">Sent by the Form Submit Receipt extension. ' +
    'You can turn off answers or delete your data from the extension\'s settings.</p>' +
    '</div>'
  );
}

function row(label, html) {
  return (
    '<tr><td style="color:#5f6368;padding:6px 16px 6px 0;vertical-align:top;width:35%;border-bottom:1px solid #eee">' +
    label + '</td><td style="padding:6px 0;vertical-align:top;border-bottom:1px solid #eee">' + html + '</td></tr>'
  );
}

// ---------------------------------------------------------------------------- daily summary

/** Run once from the editor: installs the daily usage summary trigger. */
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailySummary') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailySummary').timeBased().everyDays(1).atHour(7).create();
}

function dailySummary() {
  var yesterday = dayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  var stats = JSON.parse(P.getProperty('stats:' + yesterday) || '{}');
  var users = P.getKeys().filter(function (k) { return k.indexOf('t:') === 0; }).length;
  MailApp.sendEmail({
    to: Session.getEffectiveUser().getEmail(),
    subject: 'Form Receipt relay · ' + yesterday,
    body:
      'Receipts sent: ' + (stats.sent || 0) + '\n' +
      'Verification codes: ' + (stats.verify || 0) + '\n' +
      'Busy / rate limited: ' + (stats.busy || 0) + '\n' +
      'Installs (tokens): ' + users + '\n' +
      'Quota left today: ' + MailApp.getRemainingDailyQuota() + '\n\n' +
      'When "sent" is regularly above ~80, it is time to move to the Resend relay.',
  });
  P.deleteProperty('stats:' + yesterday);
}

// ---------------------------------------------------------------------------- helpers

/** Fixed-window counter. Returns false once `max` is reached within the window. */
function bump(key, max, ttlSeconds) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var n = Number(C.get(key) || 0);
    if (n >= max) return false;
    C.put(key, String(n + 1), ttlSeconds); // CacheService TTL is capped at 6 h
    return true;
  } finally {
    lock.releaseLock();
  }
}

function countStat(name) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var key = 'stats:' + dayKey(new Date());
    var stats = JSON.parse(P.getProperty(key) || '{}');
    stats[name] = (stats[name] || 0) + 1;
    P.setProperty(key, JSON.stringify(stats));
  } finally {
    lock.releaseLock();
  }
}

function dayKey(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function normaliseEmail(raw) {
  var email = String(raw || '').trim().toLowerCase();
  return email.length <= 254 && /^[^@\s<>"]+@[^@\s<>"]+\.[a-z]{2,}$/.test(email) ? email : null;
}

function sixDigitCode() {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid());
  var n = 0;
  for (var i = 0; i < 4; i++) n = n * 256 + (bytes[i] & 0xff);
  return String(n % 1000000).padStart(6, '0');
}

function hash(s) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8),
  );
}

function safeUrl(url) {
  url = String(url || '');
  return /^https:\/\/[^\s"<>]+$/.test(url) ? url : '';
}

function clip(s, n) {
  s = String(s == null ? '' : s);
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
