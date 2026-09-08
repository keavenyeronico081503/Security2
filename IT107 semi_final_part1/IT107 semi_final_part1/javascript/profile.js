const profileForm = document.getElementById('profileForm');
const passwordForm = document.getElementById('passwordForm');
const profileMessage = document.getElementById('profileMessage');
const passwordMessage = document.getElementById('passwordMessage');
const toggleCurrentPassword = document.getElementById('toggleCurrentPassword');

if (!profileForm || !passwordForm) {
  throw new Error('Profile module is unavailable.');
}

fetch('../php/activity.php', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: 'module=profile'}).catch(() => {});

toggleCurrentPassword?.addEventListener('click', () => {
  const input = document.getElementById('currentPassword');
  const visible = input.type === 'password';
  input.type = visible ? 'text' : 'password';
  toggleCurrentPassword.setAttribute('aria-pressed', String(visible));
  toggleCurrentPassword.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} current password`);
  toggleCurrentPassword.querySelector('i').className = `fas fa-eye${visible ? '-slash' : ''}`;
});

function showMessage(element, text, success = false) {
  element.textContent = text;
  element.className = `form-message ${success ? 'success' : 'error'}`;
}

async function loadProfile() {
  const response = await fetch('../php/user.php?action=profile');
  const data = await response.json();
  if (!response.ok || data.status !== 'success') throw new Error(data.message || 'Profile unavailable.');
  const profile = data.profile;
  for (const [field, value] of Object.entries(profile)) {
    const input = profileForm.elements[field];
    if (input) input.value = value || '';
  }
  document.getElementById('profileRole').textContent = (profile.role || '').replaceAll('_', ' ');
}

profileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const response = await fetch('../php/user.php?action=update-profile', {method: 'POST', body: new FormData(profileForm)});
    const data = await response.json();
    showMessage(profileMessage, data.message || 'Unable to update profile.', data.status === 'success');
  } catch (error) {
    showMessage(profileMessage, 'Unable to update profile. Please try again.');
  }
});

passwordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const response = await fetch('../php/change-password.php', {method: 'POST', body: new FormData(passwordForm)});
    const data = await response.json();
    showMessage(passwordMessage, data.message || 'Unable to change password.', data.success === true);
    if (data.success && data.redirect) setTimeout(() => window.location.replace(data.redirect), 900);
  } catch (error) {
    showMessage(passwordMessage, 'Unable to change password. Please try again.');
  }
});

loadProfile().catch(error => {
  showMessage(profileMessage, error.message || 'Please sign in again.');
});
