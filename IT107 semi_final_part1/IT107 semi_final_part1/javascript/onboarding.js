// Administrator setup wizard (after logging in with the temporary password):
// 1 Account (personal email + code, new password) -> 2 Personal -> 3 Address -> 4 Security -> 5 Review.
// Final submit goes to php/complete_account.php, which re-checks everything.

(function () {
  const { createWizard, setError, validators, ageFrom, togglePasswordButtons, loadQuestionOptions } = window.Wizard;
  const form = document.getElementById('onboardingWizard');
  // The mint note under the header explains the current step (Create Account style).
  const stepNotes = {
    1: 'Verify your personal email with the code we send (administrators can\'t use a school address), then replace your temporary password.',
    2: 'Your name and details for your profile.',
    3: 'Pick from the lists. Each list only shows places inside the one above it.',
    4: 'Used to recover your account if you forget your password. Pick three different questions.',
    5: 'Check everything below. Use Edit to change anything, then press Finish setup.',
  };
  const $ = id => document.getElementById(id);

  const email = $('email');
  const password = $('password');
  const confirm = $('confirmPassword');
  const firstName = $('firstName');
  const lastName = $('lastName');

  togglePasswordButtons(form);
  const meter = attachPasswordMeter(password, confirm, { personalInputs: [$('username'), firstName, lastName] });
  const picker = attachAddressPicker($('addressPicker'));
  const questionSelects = [...form.querySelectorAll('select[name^="question"]')];
  loadQuestionOptions(questionSelects);
  $('purokList').innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="Purok ${i + 1}">`).join('');

  const emailCode = attachEmailCode({
    purpose: 'onboarding',
    emailInput: email,
    sendButton: $('sendCode'),
    panel: $('codePanel'),
    codeInput: $('emailCode'),
    verifyButton: $('verifyCode'),
    badge: $('emailVerified'),
    onStatus(status) {
      if (status.status !== 'success') {
        wizard.showNotice(status.message || 'Please log in with your temporary password first.');
        return;
      }
      $('username').value = status.username || '';
      // Sidebar and header card say who is setting up which kind of account.
      const roleName = { super_admin: 'Super Administrator', admin: 'Administrator', user: 'Player' }[status.role] || 'New account';
      $('setupBrandName').textContent = status.username || 'Account setup';
      $('setupBrandRole').textContent = `${roleName} · setting up`;
      $('setupTitle').textContent = status.role === 'user' ? 'Complete your account' : `Complete your ${roleName} account`;
      // Regular users (created by an Administrator) verify their school email;
      // administrators use a personal one.
      if (status.role === 'user') {
        $('setupIntro').textContent = 'An administrator created your account. Verify your school email, choose your own password and finish your profile.';
        $('emailLabel').textContent = 'School email';
        $('emailHint').textContent = 'Your @csucc.edu.ph address';
        email.placeholder = 'yourname@csucc.edu.ph';
        email.dataset.review = 'School email';
        stepNotes[1] = 'Verify your school email with the code we send, then replace your temporary password.';
      }
      $('setupNote').textContent = stepNotes[wizard.current()];
    },
  });

  $('birthday').addEventListener('change', () => {
    const problem = validators.birthday($('birthday').value);
    setError($('birthday'), problem);
    $('age').value = problem ? '' : String(ageFrom($('birthday').value));
  });

  function validateStep(step) {
    if (step === 1) {
      let ok = true;
      if (!emailCode.isVerified()) ok = setError(email, 'Verify your email with the code first.') && ok;
      const passwordProblem = meter.problem();
      if (passwordProblem) ok = setError(passwordProblem.includes('match') ? confirm : password, passwordProblem) && ok;
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

  // Phones: the step list sits in a slide-out sidebar behind the menu button.
  const sidebar = document.querySelector('.app-sidebar');
  const scrim = document.querySelector('.sidebar-scrim');
  const menuButton = document.querySelector('.sidebar-menu-button');
  const setMenu = open => {
    sidebar.classList.toggle('open', open);
    scrim?.classList.toggle('open', open);
    menuButton?.setAttribute('aria-expanded', String(open));
  };
  menuButton?.addEventListener('click', () => setMenu(true));
  document.querySelector('.sidebar-close')?.addEventListener('click', () => setMenu(false));
  scrim?.addEventListener('click', () => setMenu(false));

  const wizard = createWizard(form, {
    validateStep,
    stepperRoot: sidebar,
    onEnterStep(step) {
      $('setupStepBadge').textContent = `Step ${step} of 5`;
      $('setupNote').textContent = stepNotes[step];
      setMenu(false);
    },
    async onSubmit() {
      const response = await fetch('../php/complete_account.php', { method: 'POST', body: new FormData(form) });
      return response.json();
    },
  });

  picker.restore(wizard.savedFields());
  if ($('birthday').value) $('birthday').dispatchEvent(new Event('change'));
})();
