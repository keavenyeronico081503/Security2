// Live username rules under a username field: an example, a checklist that ticks
// as you type, and an availability check (php/check_user.php). Shared by Create
// Account (Admin / Super Admin pages) and the signup wizard. The server enforces
// the same rule in validate_name_fields() (php/profile_validation.php).
(function () {
  const RULES = [
    ['letter', 'Starts with a letter', value => /^[A-Za-z]/.test(value)],
    ['length', '6–25 characters', value => value.length >= 6 && value.length <= 25],
    ['chars', 'Letters, numbers or _ only', value => value.length > 0 && /^[A-Za-z0-9_]+$/.test(value)],
  ];

  function formatProblem(value) {
    if (!value) return 'Username is required.';
    if (!/^[A-Za-z]/.test(value)) return 'Start with a letter.';
    if (!/^[A-Za-z0-9_]+$/.test(value)) return 'Use only letters, numbers or _ (no spaces or symbols).';
    if (value.length < 6 || value.length > 25) return 'Use 6–25 characters.';
    return '';
  }

  async function isFree(value) {
    const response = await fetch('../php/check_user.php', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `username=${encodeURIComponent(value)}`,
    });
    const data = await response.json();
    return data.status !== 'username_exists';
  }

  // options.onChange(api): called after every update (e.g. to clear an old error).
  // options.suggestFrom: [firstNameInput, lastNameInput] adds a "Suggest" button.
  function attachUsernameRules(input, options = {}) {
    const field = input.closest('.field') || input.parentElement;
    const anchor = input.parentElement === field ? input : input.parentElement;
    const panel = document.createElement('div');
    panel.className = 'username-rules';
    panel.innerHTML = '<p class="username-example">Example: <em>MariaAdmin1</em> or <em>maria_santos</em></p>'
      + '<ul class="pw-checklist"></ul><p class="username-note" aria-live="polite" hidden></p>';
    anchor.after(panel);
    const list = panel.querySelector('ul');
    const note = panel.querySelector('.username-note');
    RULES.forEach(([key, label]) => { const li = document.createElement('li'); li.dataset.rule = key; li.textContent = label; list.appendChild(li); });
    const available = document.createElement('li');
    available.dataset.rule = 'available';
    list.appendChild(available);

    let state = null; // null = not checked yet, 'checking', true = free, false = taken
    let timer = null;
    let noteTimer = null;

    function showNote(text) {
      note.textContent = text;
      note.hidden = !text;
      clearTimeout(noteTimer);
      if (text) noteTimer = setTimeout(() => { note.hidden = true; }, 3500);
    }

    function render() {
      const value = input.value;
      RULES.forEach(([key, label, test]) => {
        const li = list.querySelector(`[data-rule="${key}"]`);
        li.classList.toggle('ok', test(value));
        if (key === 'length') li.textContent = `${label} (${value.length})`;
      });
      available.classList.toggle('ok', state === true);
      available.classList.toggle('bad', state === false);
      available.textContent = state === 'checking' ? 'Checking if it\'s free…' : state === false ? 'Already taken, try another' : 'Not already taken';
      options.onChange?.(api);
    }

    async function check() {
      const value = input.value;
      if (formatProblem(value)) { state = null; render(); return false; }
      state = 'checking';
      render();
      let free;
      try { free = await isFree(value); } catch (error) { free = true; } // the server checks again on submit
      if (input.value !== value) return state === true;
      state = free;
      render();
      return free;
    }

    input.addEventListener('input', () => {
      // Spaces are never allowed in a username: drop them right away and say why.
      if (/\s/.test(input.value)) {
        const caret = input.selectionStart - (input.value.slice(0, input.selectionStart).match(/\s/g) || []).length;
        input.value = input.value.replace(/\s+/g, '');
        input.setSelectionRange(caret, caret);
        showNote('Spaces aren\'t allowed. Use _ instead, e.g. maria_santos.');
      }
      clearTimeout(timer);
      state = null;
      render();
      if (!formatProblem(input.value)) timer = setTimeout(check, 400);
    });

    if (options.suggestFrom) {
      const [first, last] = options.suggestFrom;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'username-suggest';
      button.textContent = 'Suggest from name';
      panel.querySelector('.username-example').append(' · ', button);
      const clean = text => (text || '').normalize('NFD').replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(Boolean)
        .map(word => word[0].toUpperCase() + word.slice(1).toLowerCase()).join('');
      button.addEventListener('click', async () => {
        let base = clean(first.value) + clean(last.value);
        if (base.length < 3) { showNote('Type the first and last name first.'); return; }
        base = base.slice(0, 22);
        button.disabled = true;
        for (let attempt = 0; attempt < 4; attempt++) {
          input.value = `${base}${Math.floor(Math.random() * 90) + 10}`;
          if (await check()) break;
        }
        button.disabled = false;
        input.focus();
      });
    }

    const api = {
      problem: () => formatProblem(input.value),
      // Resolves true when free (checks first if it hasn't yet).
      ensureAvailable: async () => (state === true ? true : state === false ? false : check()),
      reset: () => { clearTimeout(timer); state = null; showNote(''); render(); },
    };
    render();
    return api;
  }

  window.attachUsernameRules = attachUsernameRules;
})();
