// Create Account card (css/create-account.css), shared by:
//   super-admin.html -> creates Administrator / Super Administrator accounts (php/super-admin.php)
//   admin.html       -> creates regular user accounts, which wait for approval (php/admin.php)
// Loaded after the page script, whose confirmAction() it reuses.
// Features: generated temporary password + copy, live strength meter, live
// username availability, and a one-time credentials card after creating.

(function () {
  const panel = document.querySelector('.ca-panel');
  const form = panel?.querySelector('form[data-endpoint]');
  if (!form) return;

  const $ = name => form.elements[name];
  const result = panel.querySelector('.ca-result');
  const alertBox = form.querySelector('.ca-alert');
  const submit = form.querySelector('button[type="submit"]');
  const passwordInput = $('password');
  const usernameInput = $('username');
  const employeeIdInput = form.querySelector('[data-ca="employee-id"]');
  const meter = attachPasswordMeter(passwordInput, null, { personalInputs: [usernameInput, $('first_name'), $('last_name')].filter(Boolean) });

  // ---- Field messages ----
  function msg(input, text, kind = '') {
    const field = input.closest('.field');
    let el = field.querySelector(':scope > .field-msg');
    if (!el) { el = document.createElement('div'); el.className = 'field-msg'; field.appendChild(el); }
    el.className = `field-msg ${kind}`.trim();
    el.textContent = text || '';
    field.classList.toggle('invalid', Boolean(text) && !kind);
    return !(text && !kind);
  }
  function showAlert(text) {
    alertBox.textContent = text || '';
    alertBox.hidden = !text;
  }

  // ---- Employee ID preview ----
  async function loadEmployeeId() {
    try {
      const response = await fetch('../php/generate_id.php');
      if (response.ok) employeeIdInput.value = (await response.text()).trim();
    } catch (error) { employeeIdInput.placeholder = 'Assigned when created'; }
  }
  loadEmployeeId();

  // ---- Temporary password: generate / show / copy ----
  function generatePassword() {
    const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%'];
    const all = sets.join('');
    const random = max => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % max; };
    const chars = sets.map(set => set[random(set.length)]);
    while (chars.length < 12) chars.push(all[random(all.length)]);
    for (let i = chars.length - 1; i > 0; i--) { const j = random(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
    return chars.join('');
  }
  form.querySelector('[data-ca="generate"]').addEventListener('click', () => {
    passwordInput.value = generatePassword();
    passwordInput.type = 'text';
    form.querySelector('.pw-toggle').textContent = '🙈';
    passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  form.querySelector('.pw-toggle').addEventListener('click', event => {
    const show = passwordInput.type === 'password';
    passwordInput.type = show ? 'text' : 'password';
    event.currentTarget.textContent = show ? '🙈' : '👁';
  });
  async function copyText(text, button) {
    try { await navigator.clipboard.writeText(text); } catch (error) {
      const area = document.createElement('textarea');
      area.value = text; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove();
    }
    const original = button.textContent;
    button.textContent = 'Copied ✔';
    setTimeout(() => { button.textContent = original; }, 1500);
  }
  form.querySelector('[data-ca="copy"]').addEventListener('click', event => {
    if (passwordInput.value) copyText(passwordInput.value, event.currentTarget);
  });

  // ---- Live username check ----
  let usernameTimer = null;
  let usernameFree = null;
  function usernameProblem(value) {
    if (!value) return 'Username is required.';
    if (!/^[A-Za-z]/.test(value)) return 'Start with a letter.';
    if (!/^[A-Za-z][A-Za-z0-9_]{5,24}$/.test(value)) return 'Use 6-25 letters, numbers or underscores (no spaces).';
    return '';
  }
  async function checkUsername() {
    const value = usernameInput.value;
    try {
      const response = await fetch('../php/check_user.php', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `username=${encodeURIComponent(value)}`,
      });
      const data = await response.json();
      if (usernameInput.value !== value) return usernameFree;
      usernameFree = data.status !== 'username_exists';
      if (usernameFree) msg(usernameInput, '✔ Username is available', 'ok'); else msg(usernameInput, 'That username is already taken.');
    } catch (error) { usernameFree = true; }
    return usernameFree;
  }
  usernameInput.addEventListener('input', () => {
    clearTimeout(usernameTimer);
    usernameFree = null;
    const problem = usernameProblem(usernameInput.value);
    if (problem) { msg(usernameInput, usernameInput.value ? problem : ''); return; }
    msg(usernameInput, 'Checking…', 'info');
    usernameTimer = setTimeout(checkUsername, 400);
  });

  // ---- Validation ----
  const namePattern = /^[\p{L}][\p{L} .'\-]{1,24}$/u;
  async function validate() {
    let ok = true;
    for (const name of ['first_name', 'last_name']) {
      const input = $(name);
      if (!input) continue;
      const label = name === 'first_name' ? 'First name' : 'Last name';
      ok = msg(input, namePattern.test(input.value.trim()) ? '' : `${label}: 2-25 letters (spaces, . ' - allowed).`) && ok;
    }
    if ($('email')) {
      ok = msg($('email'), /^[^\s@]+@csucc\.edu\.ph$/i.test($('email').value.trim()) ? '' : 'Use the person\'s school email (@csucc.edu.ph).') && ok;
    }
    const nameProblem = usernameProblem(usernameInput.value);
    if (nameProblem) ok = msg(usernameInput, nameProblem) && ok;
    else if (usernameFree === null ? !(await checkUsername()) : !usernameFree) ok = msg(usernameInput, 'That username is already taken.') && ok;
    const passwordProblem = meter.problem();
    ok = msg(passwordInput, passwordProblem) && ok;
    return ok;
  }

  // ---- Submit ----
  form.addEventListener('submit', async event => {
    event.preventDefault();
    showAlert('');
    if (!await validate()) { form.querySelector('.field.invalid input')?.focus(); return; }
    const role = form.querySelector('input[name="role"]:checked')?.value || 'user';
    const confirmText = role === 'super_admin'
      ? 'Create a Super Administrator? Only one Super Administrator stays active: your own account will be deactivated when you log out.'
      : role === 'admin' ? 'Create this Administrator account now?' : 'Create this user account? It will wait in Pending registrations until approved.';
    if (!await confirmAction('Create account', confirmText)) return;

    submit.disabled = true;
    const password = passwordInput.value;
    try {
      const response = await fetch(form.dataset.endpoint, { method: 'POST', body: new FormData(form) });
      const data = await response.json();
      if (!response.ok || data.status !== 'success') throw new Error(data.message || 'The account could not be created.');
      showCredentials(data, password, role);
      refreshPage();
    } catch (error) {
      showAlert(error.message);
    }
    submit.disabled = false;
  });

  function showCredentials(data, password, role) {
    const creds = data.credentials || {};
    const rows = [
      ['Employee ID', creds.employee_id || employeeIdInput.value],
      ['Username', creds.username || usernameInput.value],
      ['Temporary password', password],
      ['Account type', { super_admin: 'Super Administrator', admin: 'Administrator', user: 'User (waiting for approval)' }[role]],
    ];
    const list = result.querySelector('.ca-creds');
    list.replaceChildren();
    rows.forEach(([label, value]) => {
      const dt = document.createElement('dt'); dt.textContent = label;
      const dd = document.createElement('dd'); dd.textContent = value;
      list.append(dt, dd);
    });
    result.querySelector('[data-ca="result-text"]').textContent = role === 'user'
      ? 'The account is waiting in Pending registrations. After it is approved, the person logs in with these details and finishes their setup.'
      : 'Give these details to the account holder privately. At first login they verify their personal email, choose their own password and finish their profile.';
    result.querySelector('[data-ca="copy-all"]').onclick = event => copyText(rows.map(([l, v]) => `${l}: ${v}`).join('\n'), event.currentTarget);
    form.hidden = true;
    result.hidden = false;
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  result.querySelector('[data-ca="print"]').addEventListener('click', () => {
    document.body.classList.add('ca-printing');
    window.print();
    document.body.classList.remove('ca-printing');
  });
  result.querySelector('[data-ca="another"]').addEventListener('click', () => {
    form.reset();
    passwordInput.type = 'password';
    passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    form.querySelectorAll('.field-msg').forEach(el => { el.textContent = ''; });
    form.querySelectorAll('.field.invalid').forEach(el => el.classList.remove('invalid'));
    usernameFree = null;
    result.querySelector('.ca-creds').replaceChildren(); // the password is no longer shown anywhere
    result.hidden = true;
    form.hidden = false;
    loadEmployeeId();
  });

  function refreshPage() {
    if (typeof loadUsers === 'function') loadUsers();
    if (typeof load === 'function') load();
    if (typeof loadStatistics === 'function') loadStatistics();
    document.getElementById('refreshPending')?.click();
  }
})();
