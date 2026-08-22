const statusMessage = document.getElementById('statusMessage');
const username = document.getElementById('username');

async function loadStatus() {
  try {
    const response = await fetch('../php/user.php?action=status');
    const data = await response.json();
    if (!response.ok || data.status !== 'success') throw new Error(data.message || 'Account status unavailable.');
    username.textContent = data.account.username;
  } catch (error) {
    statusMessage.textContent = 'Your session has expired or this account is no longer pending.';
    setTimeout(() => window.location.replace('login.html'), 1500);
  }
}

document.getElementById('logout').addEventListener('click', () => { window.location.href = '../php/logout.php'; });
loadStatus();
