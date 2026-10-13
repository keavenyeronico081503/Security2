// Student registration wizard: 1 Account -> 2 Personal -> 3 Address -> 4 Security.
// Final submit goes to php/register.php, which re-checks everything and stores the
// registration in pending_registrations until an administrator approves it.

(function () {
  const { createWizard, setError, setInfo, validators, ageFrom, togglePasswordButtons, loadQuestionOptions } = window.Wizard;
  const form = document.getElementById('registerWizard');
  const $ = id => document.getElementById(id);

  const email = $('email');
  const username = $('username');
  const password = $('password');
  const confirm = $('confirmPassword');
  const firstName = $('firstName');
  const lastName = $('lastName');

  togglePasswordButtons(form);
  const meter = attachPasswordMeter(password, confirm, { personalInputs: [username, firstName, lastName] });
  const picker = attachAddressPicker($('addressPicker'));
  const questionSelects = [...form.querySelectorAll('select[name^="question"]')];
  loadQuestionOptions(questionSelects);
  $('purokList').innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="Purok ${i + 1}">`).join('');

  // Step 1: the school email has to be verified with a code (or via Google).
  const emailCode = attachEmailCode({
    purpose: 'register',
    emailInput: email,
    sendButton: $('sendCode'),
    panel: $('codePanel'),
    codeInput: $('emailCode'),
    verifyButton: $('verifyCode'),
    badge: $('emailVerified'),
    onStatus(status) {
      if (!status.google) return;
      email.value = status.google.email;
      email.readOnly = true;
      if (!firstName.value) firstName.value = status.google.first_name || '';
      if (!lastName.value) lastName.value = status.google.last_name || '';
      wizard.showNotice('Signed in with Google: your school email is already verified.', 'info');
    },
  });

  // Live "is this username free?" check while typing (php/check_user.php).
  let usernameTimer = null;
  let usernameFree = null;
  username.addEventListener('input', () => {
    clearTimeout(usernameTimer);
    usernameFree = null;
    const problem = validators.username(username.value);
    if (problem) { setError(username, username.value ? problem : ''); return; }
    setInfo(username, 'Checking…', 'info');
    usernameTimer = setTimeout(checkUsername, 400);
  });
  async function checkUsername() {
    const value = username.value;
    try {
      const response = await fetch('../php/check_user.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `username=${encodeURIComponent(value)}`,
      });
      const data = await response.json();
      if (username.value !== value) return usernameFree;
      usernameFree = data.status !== 'username_exists';
      if (usernameFree) setInfo(username, '✔ Username is available'); else setError(username, 'That username is already taken.');
    } catch (error) {
      usernameFree = true; // the server checks again on submit
    }
    return usernameFree;
  }

  // Step 2 helpers: age from birthday, ID number preview.
  $('birthday').addEventListener('change', () => {
    const problem = validators.birthday($('birthday').value);
    setError($('birthday'), problem);
    $('age').value = problem ? '' : String(ageFrom($('birthday').value));
  });
  fetch('../php/generate_id.php').then(r => r.text()).then(id => { $('idPreview').value = `${id.trim()} (preview)`; }).catch(() => {});

  // Validate one step; returns true when it may continue.
  async function validateStep(step) {
    if (step === 1) {
      let ok = true;
      if (!emailCode.isVerified()) ok = setError(email, 'Verify your school email with the code first.') && ok;
      const nameProblem = validators.username(username.value);
      if (nameProblem) ok = setError(username, nameProblem) && ok;
      else if (usernameFree === null ? !(await checkUsername()) : !usernameFree) ok = setError(username, 'That username is already taken.') && ok;
      const passwordProblem = meter.problem();
      if (passwordProblem) {
        ok = setError(passwordProblem.includes('match') ? confirm : password, passwordProblem) && ok;
      }
      return ok;
    }
    if (step === 2) {
      const checks = [
        [firstName, validators.name(firstName.value, 'First name')],
        [$('middleName'), validators.name($('middleName').value, 'Middle name', false)],
        [lastName, validators.name(lastName.value, 'Last name')],
        [$('suffix'), validators.suffix($('suffix').value)],
        [$('birthday'), validators.birthday($('birthday').value)],
        [$('gender'), $('gender').value ? '' : 'Please select your sex.'],
      ];
      return checks.map(([input, problem]) => setError(input, problem)).every(Boolean);
    }
    if (step === 3) {
      const checks = Object.values(picker.selects).map(select => [select, select.value ? '' : `Please choose your ${select.previousElementSibling.textContent.toLowerCase()}.`]);
      checks.push([$('street'), validators.street($('street').value)], [$('zipCode'), validators.zip($('zipCode').value)]);
      return checks.map(([input, problem]) => setError(input, problem)).every(Boolean);
    }
    if (step === 4) {
      const values = questionSelects.map(select => select.value);
      let ok = true;
      questionSelects.forEach((select, i) => {
        const answer = form.elements[`answer${i + 1}`];
        let problem = '';
        if (!select.value) problem = 'Choose a question.';
        else if (values.indexOf(select.value) !== i) problem = 'Pick a different question.';
        else if (!answer.value.trim()) problem = 'Enter your answer.';
        ok = setError(select, problem) && ok;
      });
      return ok;
    }
    return true;
  }

  const wizard = createWizard(form, {
    validateStep,
    async onSubmit() {
      const body = new FormData(form);
      body.set('email', email.value.trim());
      const response = await fetch('../php/register.php', { method: 'POST', body });
      return response.json();
    },
  });

  // Restore a refreshed page: address selections and derived fields.
  picker.restore(wizard.savedFields());
  if ($('birthday').value) $('birthday').dispatchEvent(new Event('change'));
  if (username.value) username.dispatchEvent(new Event('input'));
})();
