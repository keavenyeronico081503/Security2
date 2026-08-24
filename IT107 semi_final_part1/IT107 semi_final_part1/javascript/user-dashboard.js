document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('../php/user.php?action=session');
    const data = await response.json();
    if (!response.ok || data.status !== 'success') throw new Error(data.message || 'Authentication required.');
    const username = data.user.username || 'Player';
    document.querySelectorAll('#username, #profileUsername').forEach(element => {
      element.textContent = username;
    });
  } catch (error) {
    window.location.replace('login.html');
  }
});
