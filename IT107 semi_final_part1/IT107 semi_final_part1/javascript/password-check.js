// Live "has this password appeared in data breaches?" warning for any password
// field marked with data-breach-check. Uses php/password_check.php, which never
// reveals whether another account uses the password. The server repeats the
// check on submit, so this is only an early heads-up.
document.querySelectorAll('input[data-breach-check]').forEach(input => {
  const hint = document.createElement('div');
  hint.className = 'breach-hint';
  hint.setAttribute('role', 'status');
  hint.style.cssText = 'margin-top:6px;font-size:13px;font-weight:600;';
  (input.closest('label, .password-input') || input).insertAdjacentElement('afterend', hint);

  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    hint.textContent = '';
    const password = input.value;
    if (password.length < 8) return;
    timer = setTimeout(async () => {
      try {
        const response = await fetch('../php/password_check.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `password=${encodeURIComponent(password)}`
        });
        const data = await response.json();
        if (input.value !== password) return; // a newer check is on its way
        if (data.status === 'breached') {
          hint.style.color = '#a63d32';
          hint.textContent = data.message;
        } else if (data.status === 'ok') {
          hint.style.color = '#176b52';
          hint.textContent = 'Not found in known data breaches.';
        }
      } catch (error) {
        hint.textContent = '';
      }
    }, 500);
  });
});
