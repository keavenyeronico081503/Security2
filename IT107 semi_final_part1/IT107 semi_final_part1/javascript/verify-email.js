document.addEventListener('DOMContentLoaded', function () {
    const messageDiv = document.getElementById('message');
    const emailDisplay = document.getElementById('emailDisplay');
    const otpInput = document.getElementById('otpInput');
    const verifyBtn = document.getElementById('verifyBtn');
    const resendBtn = document.getElementById('resendBtn');
    const prevBtn = document.getElementById('prevBtn');

    let cooldownTimer = null;

    function showMessage(text, color) {
        if (!messageDiv) return;
        messageDiv.style.color = color || 'red';
        messageDiv.innerText = text;
    }

    function startCooldown(seconds) {
        if (!resendBtn) return;
        clearInterval(cooldownTimer);
        let remaining = seconds;
        resendBtn.disabled = true;
        resendBtn.textContent = `Resend Code (${remaining}s)`;
        cooldownTimer = setInterval(function () {
            remaining -= 1;
            if (remaining <= 0) {
                clearInterval(cooldownTimer);
                resendBtn.disabled = false;
                resendBtn.textContent = 'Resend Code';
            } else {
                resendBtn.textContent = `Resend Code (${remaining}s)`;
            }
        }, 1000);
    }

    if (otpInput) {
        otpInput.addEventListener('input', function () {
            this.value = this.value.replace(/\D/g, '').slice(0, 6);
        });
    }

    // Load the masked email for this in-progress registration; bounce back to
    // register.html if there's no session data, or straight to question.html
    // if this email was already verified (e.g. user hit Back then forward).
    fetch('../php/registration_status.php')
        .then(res => res.json())
        .then(data => {
            if (data.status !== 'success') {
                showMessage(data.message || 'Please register first.', 'red');
                setTimeout(() => {
                    window.location.href = data.redirect || 'register.html';
                }, 1500);
                return;
            }
            if (emailDisplay) {
                emailDisplay.textContent = data.email;
            }
            if (data.verified) {
                window.location.href = data.redirect || 'question.html';
            }
        })
        .catch(() => {
            showMessage('Could not load registration status.', 'red');
        });

    if (verifyBtn) {
        verifyBtn.addEventListener('click', function () {
            const code = (otpInput.value || '').trim();
            if (!/^\d{6}$/.test(code)) {
                showMessage('Enter the 6-digit code sent to your email.', 'red');
                return;
            }

            verifyBtn.disabled = true;
            const originalText = verifyBtn.textContent;
            verifyBtn.textContent = 'Verifying...';

            const formData = new FormData();
            formData.append('otp', code);

            fetch('../php/verify_email_otp.php', {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    showMessage(data.message || 'Verified!', 'green');
                    setTimeout(() => {
                        window.location.href = data.redirect || 'question.html';
                    }, 800);
                } else {
                    showMessage(data.message || 'Invalid code.', 'red');
                    verifyBtn.disabled = false;
                    verifyBtn.textContent = originalText;
                }
            })
            .catch(() => {
                showMessage('An error occurred. Please try again.', 'red');
                verifyBtn.disabled = false;
                verifyBtn.textContent = originalText;
            });
        });
    }

    if (resendBtn) {
        resendBtn.addEventListener('click', function () {
            resendBtn.disabled = true;
            fetch('../php/resend_otp.php', { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    if (data.status === 'success') {
                        showMessage(data.message || 'A new code has been sent.', 'green');
                        startCooldown(data.retry_after || 60);
                    } else {
                        showMessage(data.message || 'Could not resend code.', 'red');
                        if (data.retry_after) {
                            startCooldown(data.retry_after);
                        } else {
                            resendBtn.disabled = false;
                        }
                    }
                })
                .catch(() => {
                    showMessage('An error occurred while resending the code.', 'red');
                    resendBtn.disabled = false;
                });
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', function () {
            window.location.href = 'register.html';
        });
    }
});
