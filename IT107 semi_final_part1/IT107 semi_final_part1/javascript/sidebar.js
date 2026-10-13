// Send visitors who aren't logged in to the login page, and logged-in visitors
// on another role's page to their own home page (same mapping as php/login.php).
(async () => {
  const roleHomes = { super_admin: 'super-admin.html', admin: 'admin.html', data_administrator: 'admin.html' };
  const pageRoles = { 'app-superadmin': ['super_admin'], 'app-admin': ['admin', 'data_administrator'], 'app-user': ['user'] };
  const pageClass = Object.keys(pageRoles).find(name => document.body.classList.contains(name));
  if (!pageClass) return;
  try {
    const response = await fetch('../php/user.php?action=profile');
    if (response.status === 401) {
      location.replace('login.html');
      return;
    }
    const data = await response.json();
    const role = data.profile?.role;
    if (role && !pageRoles[pageClass].includes(role)) {
      location.replace(roleHomes[role] || 'dashboard.html');
    }
  } catch (error) {
    return;
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.querySelector('.app-sidebar');
  const scrim = document.querySelector('.sidebar-scrim');
  const menuButton = document.querySelector('.sidebar-menu-button');
  const closeButton = document.querySelector('.sidebar-close');
  if (!sidebar) return;

  const profileLink = sidebar.querySelector('[data-view="profile"]');
  if (profileLink) {
    profileLink.href = '#profile';
  } else if (document.body.classList.contains('app-admin') || document.body.classList.contains('app-superadmin')) {
    const link = document.createElement('a');
    link.className = 'sidebar-link';
    link.href = '#profile';
    link.dataset.view = 'profile';
    link.textContent = 'My Profile';
    sidebar.querySelector('.sidebar-nav')?.appendChild(link);
  }

  const loadNotifications = async () => {
    try {
      const response = await fetch('../php/notifications.php');
      if (!response.ok) return;
      const data = await response.json();
      sidebar.querySelectorAll('[data-notification]').forEach(badge => {
        const count = Number(data.notifications?.[badge.dataset.notification] || 0);
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.hidden = count < 1;
        badge.setAttribute('aria-label', `${count} pending`);
      });
    } catch (error) {
      return;
    }
  };
  loadNotifications();

  const roleLabels = {
    user: 'User',
    admin: 'Administrator',
    data_administrator: 'Data Administrator',
    super_admin: 'Super Administrator'
  };

  const loadSidebarIdentity = async () => {
    const brandName = document.getElementById('sidebarBrandName');
    const brandRole = document.getElementById('sidebarBrandRole');
    if (!brandName || !brandRole) return;
    try {
      const response = await fetch('../php/user.php?action=profile');
      const data = await response.json();
      if (!response.ok || data.status !== 'success') return;
      const profile = data.profile;
      const displayName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
      brandName.textContent = displayName || profile.username;
      brandRole.textContent = roleLabels[profile.role] || profile.role;
    } catch (error) {
      return;
    }
  };
  loadSidebarIdentity();

  const moduleSelectors = {
    overview: ['#overview'],
    accounts: ['.app-superadmin main > .toolbar', '.app-superadmin main > #message', '.app-superadmin main > #accounts-panel', '.app-admin main > .toolbar', '.app-admin main > #message', '.app-admin main > .table-wrap'],
    'create-account': ['#create-account'],
    requests: ['#requests-panel'],
    audit: ['#audit'],
    'login-report': ['#login-report'],
    privileges: ['#privileges'],
    dashboard: ['.app-user main > .dashboard-hero', '.app-user main > .dashboard-grid'],
    statistics: ['#statistics'],
    players: ['#players'],
    calendar: ['#calendar'],
    profile: ['#profile'],
    notifications: ['#notifications'],
    'block-requests': ['#block-requests'],
    posts: ['#posts'],
    events: ['#events']
  };

  const applyModuleView = () => {
    const hash = location.hash.slice(1) || (document.body.classList.contains('app-superadmin') || document.body.classList.contains('app-admin') ? 'overview' : 'dashboard');
    const targets = moduleSelectors[hash];
    if (!targets) return;
    const main = document.querySelector('main');
    if (!main) return;
    [...main.children].forEach(child => { child.hidden = true; });
    targets.forEach(selector => document.querySelectorAll(selector).forEach(element => { element.hidden = false; }));
    sidebar.querySelectorAll('[data-view]').forEach(link => link.classList.toggle('active', link.dataset.view === hash));
  };
  window.addEventListener('hashchange', applyModuleView);
  applyModuleView();

  const setOpen = open => {
    sidebar.classList.toggle('open', open);
    scrim?.classList.toggle('open', open);
    menuButton?.setAttribute('aria-expanded', String(open));
  };
  menuButton?.addEventListener('click', () => setOpen(true));
  closeButton?.addEventListener('click', () => setOpen(false));
  scrim?.addEventListener('click', () => setOpen(false));

  sidebar.querySelectorAll('.sidebar-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const submenu = document.getElementById(toggle.getAttribute('aria-controls'));
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      if (submenu) submenu.hidden = expanded;
    });
  });

  const current = `${location.pathname}${location.hash}`;
  sidebar.querySelectorAll('.sidebar-link').forEach(link => {
    if (link.dataset.noActive !== undefined) return;
    if (link.href && current.endsWith(new URL(link.href).pathname + new URL(link.href).hash)) link.classList.add('active');
    link.addEventListener('click', () => setOpen(false));
  });
});
