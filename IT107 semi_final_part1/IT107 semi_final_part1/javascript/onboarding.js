const questionOptions = [
    ['petName', 'What was the name of your first pet?'],
    ['favoriteColor', 'What is your favorite color?'],
    ['favoriteFood', 'What is your favorite food?'],
    ['birthCity', 'In what city were you born?'],
    ['firstSchool', 'What was the name of your first school?'],
    ['childhoodNickname', 'What was your childhood nickname?'],
    ['favoriteTeacher', 'What was the name of your favorite teacher?'],
    ['dreamJob', 'What was your dream job as a child?'],
    ['memorablePlace', 'What is a memorable place you have visited?']
];

const form = document.getElementById('onboardingForm');
const message = document.getElementById('formMessage');

for (const select of form.querySelectorAll('select[name^="question"]')) {
    select.innerHTML = '<option value="">Choose a question</option>' + questionOptions
        .map(([value, label]) => `<option value="${value}">${label}</option>`)
        .join('');
}

const newPasswordInput = document.getElementById('newPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const confirmPasswordError = document.getElementById('confirmPasswordError');

function passwordsMatch() {
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!confirmPassword) {
        confirmPasswordError.textContent = '';
        confirmPasswordInput.classList.remove('input-error', 'input-success');
        return false;
    }

    if (newPassword !== confirmPassword) {
        confirmPasswordError.textContent = 'Passwords do not match.';
        confirmPasswordInput.classList.add('input-error');
        confirmPasswordInput.classList.remove('input-success');
        return false;
    }

    confirmPasswordError.textContent = '';
    confirmPasswordInput.classList.remove('input-error');
    confirmPasswordInput.classList.add('input-success');
    return true;
}

newPasswordInput.addEventListener('input', passwordsMatch);
confirmPasswordInput.addEventListener('input', passwordsMatch);

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = '';
    message.className = '';

    const selected = [...form.querySelectorAll('select[name^="question"]')].map((select) => select.value);
    if (new Set(selected).size !== 3) {
        message.textContent = 'Choose three different recovery questions.';
        message.className = 'error';
        return;
    }

    if (!passwordsMatch()) {
        confirmPasswordError.textContent = 'Passwords do not match.';
        confirmPasswordInput.classList.add('input-error');
        message.textContent = 'Passwords must match and contain 8 to 20 characters.';
        message.className = 'error';
        return;
    }

    if (!codeBox.hidden && !/^\d{6}$/.test(codeInput.value)) {
        message.textContent = 'Enter the 6-digit code sent to your email.';
        message.className = 'error';
        return;
    }
    await submitSetup(!codeBox.hidden);
});

// Administrator setup is finished in two steps: the first submit emails a code
// to the address entered, the second submit includes that code.
const codeBox = document.getElementById('emailCodeBox');
const codeInput = document.getElementById('emailCode');
const resendButton = document.getElementById('resendCode');
const submitButton = document.getElementById('submitButton');
let cooldownTimer = null;

async function submitSetup(withCode) {
    const body = new FormData(form);
    if (withCode) body.append('otp', codeInput.value);
    try {
        const response = await fetch('../php/complete_account.php', { method: 'POST', body });
        const data = await response.json();
        message.textContent = data.message || 'Unable to complete account setup.';
        message.className = data.status === 'error' ? 'error' : 'success';
        if (data.status === 'verify') {
            codeBox.hidden = false;
            submitButton.textContent = 'Verify and finish setup';
            codeInput.value = '';
            codeInput.focus();
        }
        if (data.retry_after) startCooldown(data.retry_after);
        if (data.status === 'success') {
            setTimeout(() => window.location.replace(data.redirect), 700);
        }
    } catch (error) {
        message.textContent = 'Unable to save account setup. Please try again.';
        message.className = 'error';
    }
}

function startCooldown(seconds) {
    clearInterval(cooldownTimer);
    let remaining = seconds;
    resendButton.disabled = true;
    resendButton.textContent = `Resend code (${remaining}s)`;
    cooldownTimer = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
            clearInterval(cooldownTimer);
            resendButton.disabled = false;
            resendButton.textContent = 'Resend code';
        } else {
            resendButton.textContent = `Resend code (${remaining}s)`;
        }
    }, 1000);
}

codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
});

resendButton.addEventListener('click', () => submitSetup(false));

// A code only confirms the address it was sent to, so editing the email starts over.
form.elements.email.addEventListener('input', () => {
    if (codeBox.hidden) return;
    codeBox.hidden = true;
    submitButton.textContent = 'Finish account setup';
    clearInterval(cooldownTimer);
    resendButton.disabled = false;
    resendButton.textContent = 'Resend code';
    message.textContent = '';
});
