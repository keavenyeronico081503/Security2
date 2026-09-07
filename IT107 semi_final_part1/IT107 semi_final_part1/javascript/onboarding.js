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

    try {
        const response = await fetch('../php/complete_account.php', {
            method: 'POST',
            body: new FormData(form)
        });
        const data = await response.json();
        message.textContent = data.message || 'Unable to complete account setup.';
        message.className = data.status === 'success' ? 'success' : 'error';
        if (data.status === 'success') {
            setTimeout(() => window.location.replace(data.redirect), 700);
        }
    } catch (error) {
        message.textContent = 'Unable to save account setup. Please try again.';
        message.className = 'error';
    }
});
