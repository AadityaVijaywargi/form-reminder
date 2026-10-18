// Trimmed copies of provider markup. Tally, Typeform and Jotform were copied from live forms
// (Oct 2026); Microsoft Forms is reconstructed from its data-automation-id attributes and is
// unverified until checked against a real form.

export const TALLY_URL = 'https://tally.so/r/Vw2e3O';
export const tallyForm = `<!doctype html><html><head><title>Customer Satisfaction Survey</title>
<meta property="og:title" content="Customer Satisfaction Survey"></head><body>
<form>
  <div data-block-type="FORM_TITLE"><h1>Customer Satisfaction Survey</h1></div>
  <div data-block-type="TITLE"><div><div><h3 id="label_g1">How often do you use the product?</h3>
    <div aria-hidden="true"><span>*</span></div></div></div></div>
  <div data-block-type="MULTIPLE_CHOICE_OPTION"><input id="choice_a" type="radio" name="multiple_choice_g1"><label for="choice_a">Every day</label></div>
  <div data-block-type="MULTIPLE_CHOICE_OPTION"><input id="choice_b" type="radio" name="multiple_choice_g1"><label for="choice_b">Weekly</label></div>
  <div data-block-type="TITLE"><div><div><h3 id="label_g2">How satisfied are you?</h3></div></div></div>
  <div data-block-type="RATING"><fieldset role="radiogroup" aria-labelledby="label_g2">
    <div><input id="star_1" type="radio" name="rating_r" value="1"><label for="star_1">1 stars</label></div>
    <div><input id="star_4" type="radio" name="rating_r" value="4"><label for="star_4">4 stars</label></div>
  </fieldset></div>
  <div data-block-type="TITLE"><div><div><h3 id="label_t1">Anything else?</h3></div></div></div>
  <div data-block-type="TEXTAREA"><textarea id="t1" aria-labelledby="label_t1"></textarea></div>
  <button type="submit">Submit</button>
</form></body></html>`;
export const tallyThanks = `<!doctype html><html><head><title>Customer Satisfaction Survey</title></head><body>
<div><div>Thanks for completing this form!</div><a href="https://tally.so">Made with Tally</a></div></body></html>`;

export const TYPEFORM_URL = 'https://form.typeform.com/to/WDFSox2j';
export const typeformScreen = `<!doctype html><html><head><title>Customer Satisfaction Survey Template | How satisfied are you?</title>
<meta property="og:title" content="Customer Satisfaction Survey Template"></head><body>
<div data-qa="renderer">
  <div data-qa="blocktype-rating">
    <fieldset id="b1" data-qa-block="true" data-qa-blockref="b1" data-qa-focused="true" aria-labelledby="b1-prefix b1-title">
      <span id="b1-prefix" data-qa="question-header-counter">1</span>
      <legend id="b1-title" data-qa="block-title"><span>How satisfied are you with your overall experience?</span></legend>
      <div role="radiogroup" aria-labelledby="b1-title">
        <button type="button" role="radio" aria-checked="false" value="1"><span>1</span></button>
        <button type="button" role="radio" aria-checked="false" value="4"><span>4</span></button>
      </div>
    </fieldset>
  </div>
  <div data-qa="blocktype-short_text">
    <div data-qa-blockref="b2" data-qa-focused="false">
      <h2 id="b2-title" data-qa="block-title">What's your name?*</h2>
      <input type="text" value="">
    </div>
  </div>
</div></body></html>`;

export const JOTFORM_URL = 'https://form.jotform.com/240421974148053';
export const JOTFORM_SUBMIT_URL = 'https://submit.jotform.com/submit/240421974148053/';
// Where the browser lands after solving Jotform's captcha check (live, Oct 2026).
export const JOTFORM_AFTER_CAPTCHA_URL = 'https://submit.jotform.com/240421974148053';
export const jotformForm = `<!doctype html><html><head><title>Simple Registration Form</title>
<meta property="og:title" content="Simple Registration Form"></head><body>
<form action="https://submit.jotform.com/submit/240421974148053" method="post"><ul>
  <li class="form-line" data-type="control_head" id="id_1"><div class="form-header">Simple Registration Form</div></li>
  <li class="form-line" data-type="control_fullname" id="id_3"><label class="form-label" id="label_3" for="first_3"> Name </label>
    <div id="cid_3" class="form-input-wide"><div role="group">
      <span class="form-sub-label-container"><input type="text" id="first_3" name="q3_name[first]" value=""><label class="form-sub-label" for="first_3">First Name</label></span>
      <span class="form-sub-label-container"><input type="text" id="last_3" name="q3_name[last]" value=""><label class="form-sub-label" for="last_3">Last Name</label></span>
    </div></div></li>
  <li class="form-line" data-type="control_email" id="id_4"><label class="form-label" id="label_4" for="input_4"> Email<span class="form-required">*</span> </label>
    <div class="form-input-wide"><span class="form-sub-label-container"><input type="email" id="input_4" name="q4_email" value=""><label class="form-sub-label" for="input_4">example@example.com</label></span></div></li>
  <li class="form-line" data-type="control_radio" id="id_6"><span class="form-label form-label-top" id="label_6"> Gender </span>
    <div class="form-input-wide"><div class="form-single-column" role="radiogroup" aria-labelledby="label_6">
      <span class="form-radio-item"><input type="radio" class="form-radio" id="input_6_0" name="q6_gender" value="Male"><label for="input_6_0">Male</label></span>
      <span class="form-radio-item"><input type="radio" class="form-radio" id="input_6_1" name="q6_gender" value="Female"><label for="input_6_1">Female</label></span>
    </div></div></li>
  <li class="form-line" data-type="control_checkbox" id="id_7"><span class="form-label form-label-top" id="label_7"> Dietary needs </span>
    <div class="form-input-wide"><div class="form-single-column" role="group" aria-labelledby="label_7">
      <span class="form-checkbox-item"><input type="checkbox" class="form-checkbox" id="input_7_0" name="q7_diet[]" value="Vegan"><label for="input_7_0">Vegan</label></span>
      <span class="form-checkbox-item"><input type="checkbox" class="form-checkbox" id="input_7_1" name="q7_diet[]" value="No nuts"><label for="input_7_1">No nuts</label></span>
    </div></div></li>
  <li class="form-line" data-type="control_button" id="id_2"><div class="form-input-wide"><button type="submit">Submit</button></div></li>
</ul></form></body></html>`;
// Live (Oct 2026): Jotform may answer the submit POST with an hCaptcha check on the same URL
// before it accepts the response.
export const jotformCaptcha = `<!doctype html><html><head><title>Please Complete</title></head><body>
<form action="https://submit.jotform.com/submit/240421974148053" method="post"><ul>
  <li class="form-line" data-type="control_captcha" id="id_1"><div class="form-input-wide"><div class="h-captcha"></div></div></li>
  <li class="form-line" data-type="control_button" id="id_2"><div class="form-input-wide"><button type="submit">Submit Form</button></div></li>
</ul></form></body></html>`;
export const jotformThanks = `<!doctype html><html><head><title>Thank You</title></head><body>
<div class="form-all"><div class="thankyou-wrapper"><h1>Thank You!</h1><p>Your submission has been received.</p></div></div></body></html>`;

export const MS_URL = 'https://forms.office.com/Pages/ResponsePage.aspx?id=AbC123_xyz';
export const msForm = `<!doctype html><html><head><title>Course Feedback</title></head><body>
<div data-automation-id="formTitle"><span>Course Feedback, Sem 5</span></div>
<div data-automation-id="questionItem">
  <div data-automation-id="questionTitle"><span>1.</span><span>Your name</span><span>*</span></div>
  <input data-automation-id="textInput" type="text" value="">
</div>
<div data-automation-id="questionItem">
  <div data-automation-id="questionTitle"><span>2.</span><span>Rate the course</span></div>
  <div role="radiogroup">
    <span><input type="radio" id="r1" name="q2" value="Good" aria-label="Good"></span>
    <span><input type="radio" id="r2" name="q2" value="Great" aria-label="Great"></span>
  </div>
</div>
<button data-automation-id="submitButton">Submit</button>
</body></html>`;
export const msThanks = `<!doctype html><html><head><title>Course Feedback</title></head><body>
<div data-automation-id="thankYouMessage">Your response was submitted.</div>
<button data-automation-id="submitAnother">Submit another response</button></body></html>`;
