document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.querySelector('.app-sidebar');
  const scrim = document.querySelector('.sidebar-scrim');
  const menuButton = document.querySelector('.sidebar-menu-button');
  const closeButton = document.querySelector('.sidebar-close');
  if (!sidebar) return;

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

  const moduleSelectors = {
    overview: ['#overview'],
    accounts: ['.app-superadmin main > .toolbar', '.app-superadmin main > #message', '.app-superadmin main > #accounts-panel', '.app-admin main > .toolbar', '.app-admin main > #message', '.app-admin main > .table-wrap'],
    'create-account': ['#create-account'],
    requests: ['#requests-panel'],
    audit: ['#audit'],
    privileges: ['#privileges'],
    dashboard: ['.app-user main > *'],
    statistics: ['#statistics'],
    players: ['#players'],
    'account-status': ['#account-status']
  };

  const applyModuleView = () => {
    const hash = location.hash.slice(1) || (document.body.classList.contains('app-superadmin') || document.body.classList.contains('app-admin') ? 'overview' : document.body.classList.contains('app-pending') ? 'account-status' : 'dashboard');
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
