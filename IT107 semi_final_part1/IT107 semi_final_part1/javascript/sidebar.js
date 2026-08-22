document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.querySelector('.app-sidebar');
  const scrim = document.querySelector('.sidebar-scrim');
  const menuButton = document.querySelector('.sidebar-menu-button');
  const closeButton = document.querySelector('.sidebar-close');
  if (!sidebar) return;

  const moduleSelectors = {
    accounts: ['.app-superadmin main > .toolbar', '.app-superadmin main > #message', '.app-superadmin main > #accounts-panel', '.app-admin main > *'],
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
    const hash = location.hash.slice(1) || (document.body.classList.contains('app-superadmin') ? 'accounts' : document.body.classList.contains('app-pending') ? 'account-status' : 'dashboard');
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
    if (link.href && current.endsWith(new URL(link.href).pathname + new URL(link.href).hash)) link.classList.add('active');
    link.addEventListener('click', () => setOpen(false));
  });
});
