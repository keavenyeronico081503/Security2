async function markNotificationsSeen() {
  try {
    await fetch('../php/content.php?action=mark-notifications-seen', {method: 'POST'});
    document.querySelectorAll('[data-notification="today_events"]').forEach(badge => { badge.hidden = true; badge.textContent = '0'; });
  } catch (error) {
    return;
  }
}

function checkNotificationsView() {
  if (location.hash === '#notifications') markNotificationsSeen();
}
window.addEventListener('hashchange', checkNotificationsView);

document.addEventListener('DOMContentLoaded', async () => {
  fetch('../php/activity.php', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: 'module=dashboard'}).catch(() => {});
  renderCalendar(new Date());
  loadFeed();
  loadTodayBanner();
  loadNotificationsModule();
  checkNotificationsView();
  document.getElementById('previousMonth')?.addEventListener('click', () => moveCalendar(-1));
  document.getElementById('nextMonth')?.addEventListener('click', () => moveCalendar(1));
  try {
    const response = await fetch('../php/user.php?action=session');
    const data = await response.json();
    if (!response.ok || data.status !== 'success') throw new Error(data.message || 'Authentication required.');
    const username = data.user.username || 'Player';
    document.querySelectorAll('#username').forEach(element => {
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

async function loadFeed() {
  const list = document.getElementById('feedList');
  if (!list) return;
  try {
    const response = await fetch('../php/content.php?action=list-posts');
    const data = await response.json();
    if (!response.ok || data.status !== 'success' || !data.posts.length) return;
    list.replaceChildren();
    data.posts.forEach(post => {
      const article = document.createElement('article');
      article.className = 'feed-post';
      const title = document.createElement('h3'); title.textContent = post.title;
      const body = document.createElement('p'); body.textContent = post.body;
      const meta = document.createElement('span'); meta.className = 'post-meta'; meta.textContent = `${post.author} — ${post.created_at}`;
      article.append(title, body, meta);
      list.appendChild(article);
    });
  } catch (error) {
    return;
  }
}

async function loadTodayBanner() {
  const banner = document.getElementById('todayBanner');
  if (!banner) return;
  try {
    const response = await fetch('../php/content.php?action=today');
    const data = await response.json();
    if (!response.ok || data.status !== 'success' || !data.events.length) { banner.hidden = true; return; }
    const event = data.events[0];
    document.getElementById('todayBannerTitle').textContent = `Today: ${event.title}`;
    document.getElementById('todayBannerBody').textContent = event.description || 'Come and join!';
    banner.hidden = false;
  } catch (error) {
    banner.hidden = true;
  }
}

function buildNotificationItem(eventItem, isToday) {
  const item = document.createElement('div');
  item.className = isToday ? 'notification-item notification-today' : 'notification-item';
  const icon = document.createElement('i'); icon.className = 'fas fa-bell'; icon.setAttribute('aria-hidden', 'true');
  const wrap = document.createElement('div');
  const heading = document.createElement('strong'); heading.textContent = isToday ? `Today: ${eventItem.title}` : eventItem.title;
  const body = document.createElement('p');
  body.textContent = isToday
    ? (eventItem.description || 'Come and join!')
    : (eventItem.description ? `${eventItem.event_date} — ${eventItem.description}` : eventItem.event_date);
  wrap.append(heading, body);
  item.append(icon, wrap);
  return item;
}

async function loadNotificationsModule() {
  const todayContainer = document.getElementById('notificationsToday');
  const upcomingContainer = document.getElementById('notificationsUpcoming');
  const emptyState = document.getElementById('notificationsEmpty');
  if (!todayContainer || !upcomingContainer) return;
  todayContainer.replaceChildren();
  upcomingContainer.replaceChildren();
  try {
    const [todayResponse, upcomingResponse] = await Promise.all([
      fetch('../php/content.php?action=today'),
      fetch('../php/content.php?action=upcoming-events&days=30')
    ]);
    const todayData = await todayResponse.json();
    const upcomingData = await upcomingResponse.json();
    const todayEvents = (todayResponse.ok && todayData.status === 'success') ? todayData.events : [];
    const allUpcoming = (upcomingResponse.ok && upcomingData.status === 'success') ? upcomingData.events : [];
    const todayDates = new Set(todayEvents.map(eventItem => eventItem.event_date));
    const laterEvents = allUpcoming.filter(eventItem => !todayDates.has(eventItem.event_date));

    todayEvents.forEach(eventItem => todayContainer.appendChild(buildNotificationItem(eventItem, true)));
    laterEvents.forEach(eventItem => upcomingContainer.appendChild(buildNotificationItem(eventItem, false)));

    if (emptyState) emptyState.hidden = Boolean(todayEvents.length || laterEvents.length);
  } catch (error) {
    if (emptyState) emptyState.hidden = false;
  }
}

async function renderCalendar(date) {
  const monthLabel = document.getElementById('calendarMonth');
  const days = document.getElementById('calendarDays');
  if (!monthLabel || !days) return;
  monthLabel.textContent = date.toLocaleDateString(undefined, {month: 'long', year: 'numeric'});
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const today = new Date();

  let events = [];
  try {
    const response = await fetch(`../php/content.php?action=list-events&month=${date.getMonth() + 1}&year=${date.getFullYear()}`);
    const data = await response.json();
    if (response.ok && data.status === 'success') events = data.events;
  } catch (error) {
    events = [];
  }
  const eventsByDay = {};
  events.forEach(eventItem => {
    const day = Number(eventItem.event_date.split('-')[2]);
    (eventsByDay[day] ||= []).push(eventItem);
  });

  days.replaceChildren();
  for (let index = 0; index < firstDay; index += 1) days.appendChild(document.createElement('span'));
  for (let day = 1; day <= daysInMonth; day += 1) {
    const cell = document.createElement('span');
    cell.textContent = String(day);
    if (date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && day === today.getDate()) cell.classList.add('today');
    if (eventsByDay[day]) {
      cell.classList.add('has-event');
      cell.addEventListener('click', () => showEventDetail(eventsByDay[day]));
    }
    days.appendChild(cell);
  }

  const emptyState = document.getElementById('calendarEmptyState');
  const detail = document.getElementById('calendarEventDetail');
  if (!events.length) {
    if (emptyState) emptyState.hidden = false;
    if (detail) detail.hidden = true;
  } else {
    if (emptyState) emptyState.hidden = true;
    if (detail) {
      detail.hidden = false;
      detail.innerHTML = `<i class="far fa-calendar-check" aria-hidden="true"></i><div><h2>${events.length} event${events.length > 1 ? 's' : ''} this month</h2><p>Click a highlighted day to see details.</p></div>`;
    }
  }
}

function showEventDetail(dayEvents) {
  const detail = document.getElementById('calendarEventDetail');
  if (!detail) return;
  detail.replaceChildren();
  dayEvents.forEach(eventItem => {
    const icon = document.createElement('i'); icon.className = 'far fa-calendar-check'; icon.setAttribute('aria-hidden', 'true');
    const wrap = document.createElement('div');
    const heading = document.createElement('h2'); heading.textContent = eventItem.title;
    const paragraph = document.createElement('p'); paragraph.textContent = eventItem.description ? `${eventItem.event_date} — ${eventItem.description}` : eventItem.event_date;
    wrap.append(heading, paragraph);
    detail.append(icon, wrap);
  });
}
