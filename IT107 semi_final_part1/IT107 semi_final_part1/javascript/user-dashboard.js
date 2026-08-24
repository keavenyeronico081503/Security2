document.addEventListener('DOMContentLoaded', async () => {
  renderCalendar(new Date());
  document.getElementById('previousMonth')?.addEventListener('click', () => moveCalendar(-1));
  document.getElementById('nextMonth')?.addEventListener('click', () => moveCalendar(1));
  try {
    const response = await fetch('../php/user.php?action=session');
    const data = await response.json();
    if (!response.ok || data.status !== 'success') throw new Error(data.message || 'Authentication required.');
    const username = data.user.username || 'Player';
    document.querySelectorAll('#username, #profileUsername').forEach(element => {
      element.textContent = username;
    });
    const profileResponse = await fetch('../php/user.php?action=profile');
    const profileData = await profileResponse.json();
    if (profileResponse.ok && profileData.status === 'success') {
      const profile = profileData.profile;
      setText('profilePageUsername', profile.username);
      setText('profileEmail', profile.email);
      setText('profileId', profile.id_number);
      setText('profileStatus', profile.account_status);
    }
  } catch (error) {
    window.location.replace('login.html');
  }
});

let calendarDate = new Date();

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value || 'Not provided';
}

function moveCalendar(monthOffset) {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + monthOffset, 1);
  renderCalendar(calendarDate);
}

function renderCalendar(date) {
  const monthLabel = document.getElementById('calendarMonth');
  const days = document.getElementById('calendarDays');
  if (!monthLabel || !days) return;
  monthLabel.textContent = date.toLocaleDateString(undefined, {month: 'long', year: 'numeric'});
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const today = new Date();
  days.replaceChildren();
  for (let index = 0; index < firstDay; index += 1) days.appendChild(document.createElement('span'));
  for (let day = 1; day <= daysInMonth; day += 1) {
    const cell = document.createElement('span');
    cell.textContent = String(day);
    if (date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && day === today.getDate()) cell.className = 'today';
    days.appendChild(cell);
  }
}
