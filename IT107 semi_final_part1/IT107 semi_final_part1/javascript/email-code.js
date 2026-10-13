// "Send code -> enter code -> verified" widget for step 1 of both wizards,
// backed by php/email_code.php. Editing the email after verifying resets it.
// Usage: const code = attachEmailCode({ purpose: 'register', emailInput, sendButton, panel, codeInput, verifyButton, badge });
//        await code.ready; code.isVerified();

(function () {
  function attachEmailCode({ purpose, emailInput, sendButton, panel, codeInput, verifyButton, badge, onStatus }) {
    const api = `../php/email_code.php?purpose=${purpose}`;
    let verifiedEmail = '';
    let timer = null;

    function post(action, body) {
      return fetch(`${api}&action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body),
      }).then(response => response.json());
    }

    function setVerified(email) {
      verifiedEmail = email || '';
      const ok = Boolean(verifiedEmail) && emailInput.value.trim().toLowerCase() === verifiedEmail.toLowerCase();
      badge.hidden = !ok;
      panel.hidden = true;
      sendButton.hidden = ok;
      if (ok) Wizard.setInfo(emailInput, '');
    }

    function cooldown(seconds) {
      clearInterval(timer);
      let left = seconds;
      sendButton.disabled = true;
      sendButton.textContent = `Resend (${left}s)`;
      timer = setInterval(() => {
        left -= 1;
        if (left <= 0) {
          clearInterval(timer);
          sendButton.disabled = false;
          sendButton.textContent = 'Resend code';
        } else {
          sendButton.textContent = `Resend (${left}s)`;
        }
      }, 1000);
    }

    sendButton.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      if (!email) { Wizard.setError(emailInput, 'Enter your email first.'); return; }
      sendButton.disabled = true;
      try {
        const data = await post('send', { email });
        if (data.status === 'success') {
          Wizard.setInfo(emailInput, data.message, 'info');
          panel.hidden = false;
          codeInput.value = '';
          codeInput.focus();
        } else {
          Wizard.setError(emailInput, data.message);
        }
        if (data.retry_after) cooldown(data.retry_after); else sendButton.disabled = false;
      } catch (error) {
        Wizard.setError(emailInput, 'Could not send the code. Please try again.');
        sendButton.disabled = false;
      }
    });

    codeInput.addEventListener('input', () => { codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6); });

    verifyButton.addEventListener('click', async () => {
      if (!/^\d{6}$/.test(codeInput.value)) { Wizard.setError(codeInput, 'Enter the 6-digit code.'); return; }
      verifyButton.disabled = true;
      try {
        const data = await post('verify', { email: emailInput.value.trim(), code: codeInput.value });
        if (data.status === 'success') {
          clearInterval(timer);
          sendButton.disabled = false;
          sendButton.textContent = 'Send code';
          setVerified(emailInput.value.trim());
        } else {
          Wizard.setError(codeInput, data.message);
        }
      } catch (error) {
        Wizard.setError(codeInput, 'Could not verify the code. Please try again.');
      }
      verifyButton.disabled = false;
    });

    emailInput.addEventListener('input', () => {
      badge.hidden = true;
      sendButton.hidden = false;
      if (verifiedEmail && emailInput.value.trim().toLowerCase() === verifiedEmail.toLowerCase()) setVerified(verifiedEmail);
    });

    const ready = fetch(`${api}&action=status`).then(response => response.json()).then(data => {
      onStatus?.(data);
      if (data.verified_email && !emailInput.value) emailInput.value = data.verified_email;
      setVerified(data.verified_email);
      return data;
    }).catch(() => ({}));

    return {
      ready,
      isVerified: () => Boolean(verifiedEmail) && emailInput.value.trim().toLowerCase() === verifiedEmail.toLowerCase(),
    };
  }

  window.attachEmailCode = attachEmailCode;
})();
