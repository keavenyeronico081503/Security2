// Live password feedback shared by the registration wizard, the administrator
// setup wizard and the change-password page:
//   - a 5-level meter: Very weak, Weak, Fair, Strong, Super strong
//   - a checklist of the required rules (8-20 chars, A-Z, a-z, 0-9, symbol, no spaces)
//   - a breached-password check (php/password_check.php; never reveals other accounts)
//   - a live "passwords match" indicator updated from either box
// Usage: const meter = attachPasswordMeter(passwordInput, confirmInput, { personalInputs: [...] });
//        meter.isAcceptable() -> true when every rule passes, it isn't breached and both boxes match.

(function () {
  const LEVELS = ['', 'Very weak', 'Weak', 'Fair', 'Strong', 'Super strong'];
  const COLORS = ['', '#c0392b', '#e67e22', '#b7950b', '#27ae60', '#138d75'];
  const RULES = [
    ['length', '8-20 characters', p => p.length >= 8 && p.length <= 20],
    ['upper', 'Uppercase letter', p => /[A-Z]/.test(p)],
    ['lower', 'Lowercase letter', p => /[a-z]/.test(p)],
    ['digit', 'Number', p => /\d/.test(p)],
    ['symbol', 'Symbol', p => /[^A-Za-z0-9\s]/.test(p)],
    ['space', 'No spaces', p => p.length > 0 && !/\s/.test(p)],
  ];

  function hasSequence(password) {
    const lower = password.toLowerCase();
    const runs = ['abcdefghijklmnopqrstuvwxyz', '0123456789', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    for (let i = 0; i + 4 <= lower.length; i++) {
      const piece = lower.slice(i, i + 4);
      if (runs.some(run => run.includes(piece) || [...run].reverse().join('').includes(piece))) return true;
    }
    return false;
  }

  function score(password, personal) {
    let points = 0;
    if (password.length >= 8) points++;
    if (password.length >= 12) points++;
    if (password.length >= 16) points++;
    const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9\s]/].filter(re => re.test(password)).length;
    points += Math.max(0, variety - 1);
    if (/(.)\1\1/.test(password)) points--;
    if (hasSequence(password)) points--;
    const lower = password.toLowerCase();
    if (personal.some(word => word.length >= 3 && lower.includes(word.toLowerCase()))) points -= 2;
    return Math.max(1, Math.min(5, points));
  }

  function attachPasswordMeter(passwordInput, confirmInput, { personalInputs = [] } = {}) {
    const anchor = passwordInput.closest('.field') || passwordInput.parentElement;
    const panel = document.createElement('div');
    panel.className = 'pw-feedback';
    panel.innerHTML = '<div class="pw-meter" data-level="0"><span></span><span></span><span></span><span></span><span></span></div>'
      + '<div class="pw-label" aria-live="polite"></div><ul class="pw-checklist"></ul>';
    anchor.appendChild(panel);
    const meter = panel.querySelector('.pw-meter');
    const label = panel.querySelector('.pw-label');
    const checklist = panel.querySelector('.pw-checklist');
    RULES.forEach(([key, text]) => {
      const li = document.createElement('li');
      li.dataset.rule = key;
      li.textContent = text;
      checklist.appendChild(li);
    });

    const matchBox = confirmInput ? (confirmInput.closest('.field') || confirmInput.parentElement) : null;
    let matchEl = null;
    if (matchBox) {
      matchEl = document.createElement('div');
      matchEl.className = 'field-msg';
      matchEl.setAttribute('aria-live', 'polite');
      matchBox.appendChild(matchEl);
    }

    let breached = false;
    let breachTimer = null;
    let lastChecked = '';

    function rulesPass(password) {
      return RULES.every(([, , test]) => test(password));
    }

    function update() {
      const password = passwordInput.value;
      RULES.forEach(([key, , test]) => checklist.querySelector(`[data-rule="${key}"]`).classList.toggle('ok', test(password)));
      if (!password) {
        meter.dataset.level = '0';
        label.textContent = '';
      } else if (breached && lastChecked === password) {
        meter.dataset.level = '1';
        label.style.color = COLORS[1];
      } else {
        let level = score(password, personalInputs.map(input => input.value.trim()).filter(Boolean));
        if (!rulesPass(password)) level = Math.min(level, 2); // missing a required rule is never better than Weak
        meter.dataset.level = String(level);
        label.textContent = LEVELS[level];
        label.style.color = COLORS[level];
      }
      updateMatch();
    }

    function updateMatch() {
      if (!matchEl) return;
      const confirm = confirmInput.value;
      if (!confirm) { matchEl.textContent = ''; matchEl.className = 'field-msg'; return; }
      const same = confirm === passwordInput.value;
      matchEl.className = same ? 'field-msg ok' : 'field-msg';
      matchEl.textContent = same ? '✔ Passwords match' : '✖ Passwords don\'t match';
      (confirmInput.closest('.field') || confirmInput.parentElement).classList.toggle('invalid', !same);
    }

    function scheduleBreachCheck() {
      clearTimeout(breachTimer);
      const password = passwordInput.value;
      if (!rulesPass(password)) { breached = false; return; }
      breachTimer = setTimeout(async () => {
        try {
          const response = await fetch('../php/password_check.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `password=${encodeURIComponent(password)}`,
          });
          const data = await response.json();
          if (passwordInput.value !== password) return; // the person kept typing
          lastChecked = password;
          breached = data.status === 'breached';
          update();
          if (breached) label.textContent = data.message.replace('Please choose a different one.', '').trim();
        } catch (error) { /* offline: the server checks again on submit */ }
      }, 500);
    }

    passwordInput.addEventListener('input', () => { breached = false; update(); scheduleBreachCheck(); });
    confirmInput?.addEventListener('input', updateMatch);
    personalInputs.forEach(input => input.addEventListener('input', update));
    update();

    return {
      isAcceptable() {
        const password = passwordInput.value;
        return rulesPass(password) && !(breached && lastChecked === password) && (!confirmInput || confirmInput.value === password);
      },
      problem() {
        const password = passwordInput.value;
        if (!password) return 'Password is required.';
        const failed = RULES.find(([, , test]) => !test(password));
        if (failed) return `Password needs: ${failed[1].toLowerCase()}.`;
        if (breached && lastChecked === password) return 'This password appeared in data breaches. Choose a different one.';
        if (confirmInput && confirmInput.value !== password) return 'Passwords don\'t match.';
        return '';
      },
    };
  }

  window.attachPasswordMeter = attachPasswordMeter;
})();
