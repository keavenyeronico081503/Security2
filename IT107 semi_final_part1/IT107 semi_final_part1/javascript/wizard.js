// Shared step-by-step form engine for register.html and onboarding.html.
//
// Markup it expects inside the <form>:
//   <ol class="stepper"> <li data-step="1"><button type="button"><span class="step-dot"><span class="step-num">1</span></span>Account</button></li> ... </ol>
//   <p class="stepper-compact"></p>
//   <section class="wizard-step" data-step="1" data-title="Account"> ... </section>   (one per step)
//   <button data-wizard="back">, <button data-wizard="next">, <button data-wizard="submit">
// Fields that should appear in the review use data-review="Label".

(function () {
  // ---- Field messages ----
  function fieldBox(input) {
    return input.closest('.field') || input.parentElement;
  }

  function messageEl(input) {
    const box = fieldBox(input);
    let el = box.querySelector(':scope > .field-msg');
    if (!el) {
      el = document.createElement('div');
      el.className = 'field-msg';
      el.setAttribute('aria-live', 'polite');
      box.appendChild(el);
    }
    return el;
  }

  function setError(input, message) {
    fieldBox(input).classList.toggle('invalid', Boolean(message));
    const el = messageEl(input);
    el.className = 'field-msg';
    el.textContent = message || '';
    return !message;
  }

  function setInfo(input, message, kind = 'ok') {
    fieldBox(input).classList.remove('invalid');
    const el = messageEl(input);
    el.className = `field-msg ${kind}`;
    el.textContent = message || '';
  }

  // ---- Common validators (return an error message or '') ----
  const namePattern = /^[\p{L}][\p{L} .'\-]{1,24}$/u;
  const validators = {
    name(value, label, required = true) {
      value = value.trim();
      if (!value) return required ? `${label} is required.` : '';
      if (!namePattern.test(value)) return `${label} should be 2-25 letters (spaces, . ' - allowed).`;
      return '';
    },
    suffix(value) {
      value = value.trim();
      if (!value) return '';
      return /^[\p{L}][\p{L}.]{0,9}$/u.test(value) ? '' : 'Use a suffix like Jr., Sr. or III.';
    },
    birthday(value) {
      if (!value) return 'Birthday is required.';
      const date = new Date(`${value}T00:00:00`);
      if (Number.isNaN(date.getTime()) || date > new Date()) return 'Birthday cannot be in the future.';
      const age = ageFrom(value);
      if (age < 10 || age > 120) return 'Please check your birthday; age must be between 10 and 120.';
      return '';
    },
    required(value, label) {
      return value.trim() ? '' : `${label} is required.`;
    },
    zip(value) {
      return /^\d{4}$/.test(value.trim()) ? '' : 'Enter a 4-digit ZIP code.';
    },
    street(value) {
      value = value.trim();
      if (value.length < 2) return 'Enter your purok / street.';
      return value.length > 100 ? 'Keep it under 100 characters.' : '';
    },
    username(value) {
      if (!value) return 'Username is required.';
      if (/\s/.test(value)) return 'Spaces are not allowed.';
      if (!/^[A-Za-z]/.test(value)) return 'Start with a letter.';
      if (!/^[A-Za-z][A-Za-z0-9_]{5,24}$/.test(value)) return 'Use 6-25 letters, numbers or underscores.';
      return '';
    },
  };

  function ageFrom(value) {
    const birth = new Date(`${value}T00:00:00`);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const beforeBirthday = today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
    return beforeBirthday ? age - 1 : age;
  }

  // ---- Wizard ----
  function createWizard(form, options) {
    const steps = [...form.querySelectorAll('.wizard-step')];
    // The step list may live outside the form (the setup page puts it in the sidebar).
    const stepperItems = [...(options.stepperRoot || form).querySelectorAll('.stepper li')];
    const compact = form.querySelector('.stepper-compact');
    const back = form.querySelector('[data-wizard="back"]');
    const next = form.querySelector('[data-wizard="next"]');
    const submit = form.querySelector('[data-wizard="submit"]');
    const notice = form.querySelector('.wizard-notice');
    const storageKey = `wizard:${form.id}`;
    let current = 1;
    let furthest = 1;

    function showNotice(message, kind = 'error') {
      if (!notice) return;
      notice.className = `wizard-notice ${kind}`;
      notice.textContent = message || '';
      notice.hidden = !message;
      if (message) notice.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function render() {
      steps.forEach(step => { step.hidden = Number(step.dataset.step) !== current; });
      stepperItems.forEach(item => {
        const n = Number(item.dataset.step);
        // Earlier steps are done (and clickable to go back); later ones are still to do.
        item.dataset.state = n === current ? 'current' : (n < current ? 'done' : 'todo');
        item.querySelector('button').setAttribute('aria-current', n === current ? 'step' : 'false');
      });
      const title = steps[current - 1].dataset.title || '';
      if (compact) compact.textContent = `Step ${current} of ${steps.length} · ${title}`;
      back.hidden = current === 1;
      next.hidden = current === steps.length;
      submit.hidden = current !== steps.length;
      if (current === steps.length) buildReview();
      options.onEnterStep?.(current);
    }

    async function go(target, validate) {
      if (validate) {
        showNotice('');
        const ok = await options.validateStep(current);
        if (!ok) {
          const firstBad = steps[current - 1].querySelector('.field.invalid input, .field.invalid select');
          firstBad?.focus();
          return;
        }
      }
      current = Math.max(1, Math.min(steps.length, target));
      furthest = Math.max(furthest, current);
      render();
      save();
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    back.addEventListener('click', () => go(current - 1, false));
    next.addEventListener('click', () => go(current + 1, true));
    stepperItems.forEach(item => item.querySelector('button').addEventListener('click', () => {
      const n = Number(item.dataset.step);
      if (n < current) go(n, false);
    }));

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (current !== steps.length) { go(current + 1, true); return; }
      if (submit.disabled) return;
      showNotice('');
      if (!await options.validateStep(current)) return;
      submit.disabled = true;
      const original = submit.textContent;
      submit.textContent = 'Submitting…';
      try {
        const result = await options.onSubmit();
        if (result?.status === 'success') {
          clearSaved();
          showNotice(result.message, 'success');
          if (result.redirect) setTimeout(() => window.location.replace(result.redirect), 2500);
          return;
        }
        if (result?.step) { current = result.step; render(); }
        showNotice(result?.message || 'Something went wrong. Please try again.');
      } catch (error) {
        showNotice('Could not reach the server. Please try again.');
      }
      submit.disabled = false;
      submit.textContent = original;
    });

    // Review: every field with data-review, grouped by step.
    function buildReview() {
      const target = form.querySelector('[data-review-target]');
      if (!target) return;
      target.replaceChildren();
      steps.slice(0, -1).forEach(step => {
        const group = document.createElement('div');
        group.className = 'review-group';
        const h4 = document.createElement('h4');
        h4.textContent = step.dataset.title;
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.textContent = 'Edit';
        edit.addEventListener('click', () => go(Number(step.dataset.step), false));
        h4.appendChild(edit);
        const dl = document.createElement('dl');
        if (!step.querySelector('[data-review]')) {
          // e.g. Security: the answers are private, so just confirm the step is done.
          const dt = document.createElement('dt'); dt.textContent = 'Status';
          const dd = document.createElement('dd'); dd.textContent = '✔ Completed';
          dl.append(dt, dd);
        }
        step.querySelectorAll('[data-review]').forEach(input => {
          let value = input.tagName === 'SELECT' ? (input.selectedOptions[0]?.value ? input.selectedOptions[0].text : '') : input.value.trim();
          if (input.type === 'password') value = value ? '•'.repeat(Math.min(value.length, 12)) : '';
          const dt = document.createElement('dt');
          dt.textContent = input.dataset.review;
          const dd = document.createElement('dd');
          dd.textContent = value || '—';
          dl.append(dt, dd);
        });
        group.append(h4, dl);
        target.appendChild(group);
      });
    }

    // Keep progress across a refresh (never passwords, codes or security answers).
    function persistable() {
      return [...form.querySelectorAll('input[name], select[name]')]
        .filter(el => el.type !== 'password' && !el.hasAttribute('data-no-persist') && !el.readOnly);
    }
    function save() {
      try {
        const data = { step: current, furthest, fields: {} };
        persistable().forEach(el => { data.fields[el.name] = el.value; });
        sessionStorage.setItem(storageKey, JSON.stringify(data));
      } catch (error) { /* storage unavailable: progress just isn't kept */ }
    }
    function clearSaved() {
      try { sessionStorage.removeItem(storageKey); } catch (error) { /* ignore */ }
    }
    function restore() {
      try {
        const data = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
        if (!data) return null;
        persistable().forEach(el => {
          if (el.tagName !== 'SELECT' && data.fields[el.name] !== undefined && !el.value) el.value = data.fields[el.name];
        });
        return data;
      } catch (error) { return null; }
    }
    form.addEventListener('input', save);
    form.addEventListener('change', save);

    const saved = restore();
    render();

    return {
      showNotice,
      goTo: n => go(n, false),
      savedFields: () => saved?.fields || {},
      current: () => current,
    };
  }

  function togglePasswordButtons(root) {
    root.querySelectorAll('.pw-toggle').forEach(button => button.addEventListener('click', () => {
      const input = button.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? '🙈' : '👁';
      button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    }));
  }

  async function loadQuestionOptions(selects) {
    const response = await fetch('../php/security_questions.php');
    const { questions } = await response.json();
    selects.forEach(select => {
      select.innerHTML = '<option value="">Choose a question</option>' + questions
        .map(q => `<option value="${q.value}">${q.label}</option>`).join('');
    });
    // Each question can only be picked once across the three dropdowns.
    const sync = () => {
      const chosen = selects.map(s => s.value);
      selects.forEach(select => [...select.options].forEach(option => {
        option.disabled = option.value !== '' && option.value !== select.value && chosen.includes(option.value);
      }));
    };
    selects.forEach(select => select.addEventListener('change', sync));
    return sync;
  }

  window.Wizard = { createWizard, setError, setInfo, validators, ageFrom, togglePasswordButtons, loadQuestionOptions };
})();
