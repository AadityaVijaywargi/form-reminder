// Trimmed-down copies of Google Forms markup (structure and ARIA roles as of Oct 2026).
// Verify against live forms when Google changes its pages; see providers/google.ts.

export const VIEWFORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdTEST123/viewform';
export const RESPONSE_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdTEST123/formResponse';

const head = `<head><title>Hackathon Registration 2026</title>
  <meta property="og:title" content="Hackathon Registration 2026"></head>`;

export const viewform = `<!doctype html><html>${head}<body>
<form action="${RESPONSE_URL}" method="POST">
  <div role="heading" aria-level="1">Hackathon Registration 2026</div>
  <div role="list">
    <div role="listitem" id="q-team">
      <div role="heading">Team name<span aria-label="Required question"> *</span></div>
      <input type="text" aria-label="Your answer" value="">
    </div>
    <div role="listitem" id="q-track">
      <div role="heading">Track *</div>
      <div role="radiogroup" aria-labelledby="x">
        <div role="radio" data-value="AI / ML" aria-checked="false"></div>
        <div role="radio" data-value="Web" aria-checked="false"></div>
        <div role="radio" data-value="__other_option__" aria-checked="false"></div>
        <input type="text" aria-label="Other response" value="">
      </div>
    </div>
    <div role="listitem" id="q-diet">
      <div role="heading">Dietary needs</div>
      <div role="checkbox" data-answer-value="Vegetarian" aria-checked="false"></div>
      <div role="checkbox" data-answer-value="No nuts" aria-checked="false"></div>
      <input type="hidden" name="entry.333_sentinel" value="">
    </div>
    <div role="listitem" id="q-size">
      <div role="heading">T-shirt size</div>
      <div role="listbox">
        <div role="option" data-value="" aria-selected="true">Choose</div>
        <div role="option" data-value="M" aria-selected="false">M</div>
      </div>
    </div>
    <div role="listitem" id="q-grid">
      <div role="heading">Rate the sessions</div>
      <div role="radiogroup" aria-label="Keynote">
        <div role="radio" data-value="Good" aria-checked="false"></div>
        <div role="radio" data-value="Great" aria-checked="false"></div>
      </div>
      <div role="radiogroup" aria-label="Workshops">
        <div role="radio" data-value="Good" aria-checked="false"></div>
        <div role="radio" data-value="Great" aria-checked="false"></div>
      </div>
    </div>
    <div role="listitem" id="q-time">
      <div role="heading">Arrival time</div>
      <input type="text" aria-label="Hour" value="">
      <input type="text" aria-label="Minute" value="">
    </div>
    <div role="listitem" id="q-pass">
      <div role="heading">Portal password</div>
      <input type="text" aria-label="Your answer" value="">
    </div>
    <div role="listitem" id="section-header">
      <div class="image"></div>
    </div>
  </div>
  <div role="button" jsname="M2UYVd">Submit</div>
</form>
</body></html>`;

/** What /formResponse looks like after "Next" on a multi-section form: still has questions. */
export const midForm = `<!doctype html><html>${head}<body>
<form action="${RESPONSE_URL}" method="POST">
  <div role="list">
    <div role="listitem"><div role="heading">College</div><input type="text" value=""></div>
  </div>
  <div role="button">Back</div><div role="button">Submit</div>
</form></body></html>`;

/** Confirmation page after a real submit. */
export const confirmation = `<!doctype html><html>${head}<body>
<div role="heading" aria-level="1">Hackathon Registration 2026</div>
<div>Your response has been recorded.</div>
<a href="https://docs.google.com/forms/d/e/1FAIpQLSdTEST123/viewform?usp=form_confirm">Submit another response</a>
</body></html>`;

/** Confirmation where the owner disabled "Submit another response". */
export const confirmationNoLink = `<!doctype html><html>${head}<body>
<div role="heading" aria-level="1">Hackathon Registration 2026</div>
<div>Thanks! See you there.</div>
</body></html>`;

export function load(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}
