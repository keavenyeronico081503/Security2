const accounts = document.getElementById('accounts');
const message = document.getElementById('message');
const requests = document.getElementById('requests');
const auditLogs = document.getElementById('auditLogs');
const privilegeAccounts = document.getElementById('privilegeAccounts');
const auditPage = document.getElementById('auditPage');
const previousAudit = document.getElementById('previousAudit');
const nextAudit = document.getElementById('nextAudit');
const privilegeDialog = document.getElementById('privilegeDialog');
const privilegeForm = document.getElementById('privilegeForm');
const privilegeModules = document.getElementById('privilegeModules');
const privilegeAccount = document.getElementById('privilegeAccount');
const api = '../php/super-admin.php';
const statCards = document.getElementById('statCards');
const actionRequired = document.getElementById('actionRequired');
const charts = {};
let lastTrackedModule = '';
function trackModuleOpen() {
  const module = location.hash.slice(1) || 'overview';
  if (module === lastTrackedModule) return;
  lastTrackedModule = module;
  fetch('../php/activity.php', { method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: `module=${encodeURIComponent(module)}` }).catch(() => {});
}
window.addEventListener('hashchange', trackModuleOpen);
trackModuleOpen();
function confirmAction(title, messageText) {
  return new Promise(resolve => {
    let dialog = document.getElementById('actionConfirmDialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'actionConfirmDialog';
      dialog.innerHTML = '<form method="dialog" class="action-confirm-form"><h2></h2><p></p><div><button value="cancel" class="confirm-cancel">Cancel</button><button value="confirm" class="confirm-accept">Confirm</button></div></form>';
      document.body.appendChild(dialog);
    }
    dialog.onclose = () => resolve(dialog.returnValue === 'confirm');
    dialog.querySelector('h2').textContent = title;
    dialog.querySelector('p').textContent = messageText;
    dialog.showModal();
  });
}
async function loadNextEmployeeId() {
  const input = document.getElementById('createEmployeeId');
  if (!input) return;
  try {
    const response = await fetch('../php/generate_id.php');
    if (response.ok) input.value = (await response.text()).trim();
  } catch (error) {
    input.placeholder = 'Employee ID generated on submit';
  }
}
document.querySelectorAll('.password-toggle').forEach(toggle => {
  toggle.addEventListener('click', function() {
    const input = document.getElementById(toggle.dataset.passwordTarget);
    if (!input) return;
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(visible));
    toggle.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} temporary password`);
    toggle.querySelector('i').className = `fas fa-eye${visible ? '-slash' : ''}`;
  });
});
const toggleSuperAdminCurrentPassword = document.getElementById('toggleSuperAdminCurrentPassword');
toggleSuperAdminCurrentPassword?.addEventListener('click', () => {
  const input = document.getElementById('superAdminCurrentPassword');
  const visible = input.type === 'password';
  input.type = visible ? 'text' : 'password';
  toggleSuperAdminCurrentPassword.setAttribute('aria-pressed', String(visible));
  toggleSuperAdminCurrentPassword.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} current password`);
  toggleSuperAdminCurrentPassword.querySelector('i').className = `fas fa-eye${visible ? '-slash' : ''}`;
});
let auditCurrentPage = 1;
let auditTotalPages = 1;
let privilegeTargetId = 0;

const moduleNames = {
  accounts: 'Accounts',
  dashboard: 'Dashboard',
  profile: 'Profile',
  password: 'Password',
  roles: 'Roles',
  permissions: 'Permissions',
  audit: 'Audit log'
};

function setInlineError(input, message, errorId) {
  const field = input;
  const error = document.getElementById(errorId);
  if (!field) return false;
  field.classList.toggle('input-error', Boolean(message));
  field.classList.toggle('input-success', !message);
  if (error) error.textContent = message || '';
  return !message;
}

function validateNameField(input, errorId, label) {
  const value = (input?.value ?? '').trim();
  if (!value) return setInlineError(input, `${label} is required.`, errorId);
  if (value.length < 2) return setInlineError(input, `${label} must be at least 2 characters.`, errorId);
  if (!/^[A-Z][a-zA-Z]*(?: [A-Z][a-zA-Z]*)*$/.test(value)) {
    return setInlineError(input, `${label} must use letters and spaces only, starting with a capital letter.`, errorId);
  }
  return setInlineError(input, '', errorId);
}

function validateDashboardEmail(input, errorId) {
  const value = (input?.value ?? '').trim();
  if (!value) return setInlineError(input, 'Email is required.', errorId);
  if (value.includes(' ') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return setInlineError(input, 'Please enter a valid email address.', errorId);
  }
  return setInlineError(input, '', errorId);
}

function validateDashboardUsername(input, errorId, hintId) {
  const value = (input?.value ?? '').trim();
  const error = document.getElementById(errorId);
  const hint = document.getElementById(hintId);
  if (!value) {
    if (hint) hint.textContent = '';
    return setInlineError(input, 'Username is required.', errorId);
  }
  if (value.length < 6 || value.length > 25) {
    if (hint) hint.textContent = 'Username must be 6-25 characters long.';
    return setInlineError(input, 'Username must be 6-25 characters long.', errorId);
  }
  if (/\s/.test(value)) {
    if (hint) hint.textContent = 'Username cannot contain spaces.';
    return setInlineError(input, 'Username cannot contain spaces.', errorId);
  }
  if (!/^[A-Z][a-zA-Z0-9]*$/.test(value)) {
    if (hint) hint.textContent = 'Username must start with a capital letter and contain only letters and numbers.';
    return setInlineError(input, 'Username must start with a capital letter and contain only letters and numbers.', errorId);
  }
  if (!/[0-9]$/.test(value)) {
    if (hint) hint.textContent = 'Username must end with a number (example: Sachin123).';
    return setInlineError(input, 'Username must end with a number (example: Sachin123).', errorId);
  }
  if ((value.match(/[A-Z]/g) || []).length > 1) {
    if (hint) hint.textContent = 'Use lowercase letters after the first character.';
    return setInlineError(input, 'Use lowercase letters after the first character.', errorId);
  }
  if (hint) hint.textContent = 'Valid username format.';
  return setInlineError(input, '', errorId);
}

function validateDashboardPassword(input, errorId, strengthId) {
  const value = input?.value ?? '';
  const error = document.getElementById(errorId);
  const strength = document.getElementById(strengthId);
  if (!value) {
    if (strength) strength.textContent = '';
    return setInlineError(input, 'Password is required.', errorId);
  }
  if (value.length < 8) {
    if (strength) strength.textContent = 'Minimum 8 characters required.';
    return setInlineError(input, 'Minimum 8 characters required.', errorId);
  }
  const checks = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/];
  const score = checks.filter(regex => regex.test(value)).length;
  if (score < 3) {
    if (strength) strength.textContent = 'Use a stronger password: uppercase, lowercase, number, and symbol.';
    return setInlineError(input, 'Password must include uppercase, lowercase, number, and symbol.', errorId);
  }
  if (strength) {
    strength.textContent = 'Strong password.';
    strength.style.color = '#176b52';
  }
  return setInlineError(input, '', errorId);
}

function validateDashboardCreateForm(form) {
  if (!form) return false;
  const username = form.querySelector('[name="username"]');
  const password = form.querySelector('[name="password"]');

  const usernameValid = validateDashboardUsername(username, 'superCreateUsernameError', 'superCreateUsernameHint');
  const passwordValid = validateDashboardPassword(password, 'superCreatePasswordError', 'superCreatePasswordStrength');

  return usernameValid && passwordValid;
}

function chartConfig(type, labels, values, colors) {
  return { type, data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: '#fffdf8', borderWidth: 2, borderRadius: type === 'bar' ? 4 : 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: type === 'doughnut' ? 'bottom' : 'top', labels: { color: '#17211b', usePointStyle: true, padding: 16 } } }, scales: type === 'bar' || type === 'line' ? { x: { ticks: { color: '#68736c' }, grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0, color: '#68736c' }, grid: { color: '#d9ded7' } } } : undefined } };
}

function drawChart(id, config) {
  const canvas = document.getElementById(id);
  if (!canvas || typeof Chart === 'undefined') return;
  charts[id]?.destroy();
  charts[id] = new Chart(canvas, config);
}

function renderStatistics(data) {
  const summary = data.summary;
  statCards.innerHTML = [['total', 'Total accounts'], ['approved', 'Approved'], ['pending', 'Pending registrations'], ['blocked', 'Blocked'], ['admins', 'Administrators'], ['data_administrators', 'Data administrators'], ['super_admins', 'Super administrators']].map(([key, label]) => `<article class="stat-card"><strong>${summary[key]}</strong><span>${label}</span></article>`).join('');
  const required = data.action_required;
  actionRequired.innerHTML = `<h3>Action required</h3><div class="required-items"><a href="#accounts" data-view="accounts"><strong>${required.pending_users}</strong><span>Pending registrations</span></a><a href="#requests-panel" data-view="requests"><strong>${required.pending_deletions}</strong><span>Deletion requests</span></a><a href="#audit" data-view="audit"><strong>${required.failed_actions}</strong><span>Failed actions, last 30 days</span></a></div>`;
  actionRequired.querySelectorAll('[data-view]').forEach(link => link.addEventListener('click', () => window.dispatchEvent(new HashChangeEvent('hashchange'))));
  drawChart('statusChart', chartConfig('doughnut', data.status_breakdown.map(item => item.label), data.status_breakdown.map(item => item.count), ['#176b52', '#a46616', '#a63d32']));
  drawChart('roleChart', chartConfig('bar', data.role_breakdown.map(item => item.label), data.role_breakdown.map(item => item.count), ['#176b52', '#5b8f79', '#a46616']));
  drawChart('deletionChart', chartConfig('bar', data.deletion_requests.map(item => item.label), data.deletion_requests.map(item => item.count), ['#a46616', '#176b52', '#a63d32']));
  drawChart('registrationChart', chartConfig('line', data.registrations.map(item => item.date), data.registrations.map(item => item.count), '#176b52'));
}

async function loadStatistics() {
  try {
    const response = await fetch('../php/statistics.php');
    const data = await response.json();
    if (!response.ok || data.status !== 'success') throw new Error(data.message || 'Statistics unavailable.');
    renderStatistics(data);
  } catch (error) {
    actionRequired.textContent = error.message;
  }
}

async function request(action, options = {}) {
  const response = await fetch(`${api}?action=${action}`, options);
  const data = await response.json();
  if (!response.ok || data.status === 'error') throw new Error(data.message || 'Request failed.');
  return data;
}

function showMessage(text, error = false) {
  message.textContent = text;
  message.style.color = error ? '#a63d32' : '#176b52';
}

function renderUsers(users) {
  accounts.innerHTML = users.map(user => {
    const role = user.role.replace('_', ' ');
    const status = user.account_status;
    const controls = user.role === 'super_admin' ? '<span>Protected</span>' : `
      ${status !== 'approved' ? `<button data-action="approve" data-id="${user.id}">Approve</button>` : ''}
      <button data-action="${status === 'blocked' ? 'unblock' : 'block'}" data-id="${user.id}">${status === 'blocked' ? 'Unblock' : 'Block'}</button>
      <button data-action="update" data-id="${user.id}" data-first="${user.first_name}" data-last="${user.last_name}" data-employee="${user.id_number}" data-email="${user.email}">Edit</button>
      <button data-action="privileges" data-id="${user.id}" data-user="${encodeURIComponent(JSON.stringify(user))}">Privileges</button>
      <button class="danger" data-action="delete" data-id="${user.id}">Delete</button>`;
    return `<tr><td>${user.first_name} ${user.last_name}</td><td>${user.id_number}</td><td>${user.username}</td><td class="role">${role}</td><td class="status status-${status}">${status}</td><td class="actions">${controls}</td></tr>`;
  }).join('') || '<tr><td colspan="6">No accounts found.</td></tr>';
  if (privilegeAccounts) {
    privilegeAccounts.replaceChildren();
    users.filter(user => user.role !== 'super_admin').forEach(user => {
      const row = document.createElement('tr');
      [user.first_name + ' ' + user.last_name, user.id_number, user.role.replace('_', ' ')].forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell); });
      const cell = document.createElement('td'); const button = document.createElement('button'); button.textContent = 'Manage privileges'; button.dataset.action = 'privileges'; button.dataset.id = user.id; button.dataset.user = encodeURIComponent(JSON.stringify(user)); cell.appendChild(button); row.appendChild(cell); privilegeAccounts.appendChild(row);
    });
  }
}

async function loadUsers(employeeId = '') {
  try { renderUsers((await request(`list&employee_id=${encodeURIComponent(employeeId)}`)).users); }
  catch (error) { showMessage(error.message, true); }
}

async function openPrivilegeDialog(user) {
  const catalog = (await request('permission-catalog')).permissions;
  const grouped = {};
  catalog.forEach(permission => {
    const module = permission.code.split('.')[0];
    (grouped[module] ||= []).push(permission);
  });
  privilegeTargetId = user.id;
  privilegeAccount.textContent = `${user.first_name} ${user.last_name} (${user.role.replace('_', ' ')})`;
  privilegeModules.replaceChildren();
  Object.entries(grouped).forEach(([module, permissions]) => {
    const section = document.createElement('section'); section.className = 'privilege-module';
    const parentLabel = document.createElement('label');
    const parent = document.createElement('input'); parent.type = 'checkbox'; parent.dataset.module = module;
    parentLabel.append(parent, document.createTextNode(moduleNames[module] || module)); section.appendChild(parentLabel);
    const children = document.createElement('div'); children.className = 'privilege-children';
    permissions.forEach(permission => {
      const label = document.createElement('label'); const checkbox = document.createElement('input');
      checkbox.type = 'checkbox'; checkbox.value = permission.code; checkbox.dataset.module = module;
      checkbox.checked = Boolean(user.privileges && user.privileges[permission.code]);
      label.append(checkbox, document.createTextNode(permission.label)); children.appendChild(label);
    });
    parent.checked = [...children.querySelectorAll('input')].every(input => input.checked);
    parent.indeterminate = [...children.querySelectorAll('input')].some(input => input.checked) && !parent.checked;
    privilegeModules.append(section, children);
    section.appendChild(children);
  });
  privilegeDialog.showModal();
}

async function loadRequests() {
  const data = await request('delete-requests');
  requests.replaceChildren();
  data.requests.forEach(item => {
    const row = document.createElement('tr');
    [item.first_name ? `${item.first_name} ${item.last_name}` : 'Account deleted', item.id_number || '-', item.requested_by, item.reason, item.status].forEach(value => {
      const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell);
    });
    const review = document.createElement('td');
    if (item.status === 'pending') {
      ['approve', 'reject'].forEach(decision => {
        const button = document.createElement('button'); button.textContent = decision === 'approve' ? 'Approve' : 'Reject'; button.dataset.request = item.id; button.dataset.decision = decision; review.appendChild(button);
      });
    } else review.textContent = 'Reviewed';
    row.appendChild(review); requests.appendChild(row);
  });
}

async function loadAuditLogs() {
  const params = new URLSearchParams({page: auditCurrentPage});
  const search = document.getElementById('auditSearch')?.value.trim();
  const action = document.getElementById('auditAction')?.value;
  const dateFrom = document.getElementById('auditDateFrom')?.value;
  const dateTo = document.getElementById('auditDateTo')?.value;
  if (search) params.set('search', search);
  if (action) params.set('action', action);
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);
  const data = await fetch(`../php/audit.php?${params}`).then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Audit log unavailable.'); return result; });
  auditTotalPages = data.pagination.total_pages;
  auditPage.textContent = `Page ${data.pagination.page} of ${auditTotalPages}`;
  previousAudit.disabled = auditCurrentPage <= 1;
  nextAudit.disabled = auditCurrentPage >= auditTotalPages;
  auditLogs.replaceChildren();
  data.logs.forEach(log => {
    const row = document.createElement('tr');
    [
      `${log.created_at}`,
      log.actor_employee_id || '-',
      formatAuditAction(log.action_code),
      `${log.target_username || 'Deleted account'} (${log.target_employee_id || '-'})`,
      log.success ? 'Success' : 'Failed',
      formatAuditDetails(log)
    ].forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell); });
    auditLogs.appendChild(row);
  });
}

function formatAuditAction(action) {
  const labels = {
    'auth.login.success': 'Login',
    'auth.login.failed': 'Failed login',
    'auth.logout': 'Logout',
    'module.open': 'Module opened',
    'accounts.create': 'Account created',
    'accounts.update': 'Account edited',
    'accounts.approve': 'Account approved',
    'accounts.block': 'Account blocked',
    'accounts.unblock': 'Account unblocked',
    'accounts.delete.request': 'Deletion request',
    'accounts.delete.approve': 'Deletion decision',
    'permissions.assign': 'Privileges changed'
  };
  return labels[action] || action.replaceAll('.', ' ');
}

function formatAuditDetails(log) {
  const details = log.details || {};
  if (log.action_code === 'module.open') return `View only: ${String(details.module || 'module').replaceAll('-', ' ')}`;
  if (log.action_code === 'accounts.update') {
    const oldValues = log.old_values || {};
    const newValues = log.new_values || {};
    const fields = ['first_name', 'last_name', 'id_number', 'email', 'role', 'account_status']
      .filter(field => oldValues[field] !== newValues[field]);
    return fields.length ? `Edited: ${fields.map(field => field.replaceAll('_', ' ')).join(', ')}` : 'Edited account details';
  }
  if (details.reason) return `Reason: ${details.reason}`;
  if (log.action_code === 'accounts.create') return 'Created account credentials';
  if (log.action_code === 'auth.login.failed') return log.failure_reason || 'Login was not accepted';
  if (log.action_code === 'auth.login.success' || log.action_code === 'auth.logout') return 'View only';
  if (log.action_code === 'permissions.assign') return 'Updated account privileges';
  return 'View only';
}

async function handleAccountAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  let body = { user_id: Number(button.dataset.id) };
  if (action === 'privileges') {
    try { await openPrivilegeDialog(JSON.parse(decodeURIComponent(button.dataset.user))); } catch (error) { showMessage(error.message, true); }
    return;
  }
  if (action === 'update') {
    body.first_name = prompt('First name:', button.dataset.first);
    body.last_name = prompt('Last name:', button.dataset.last);
    body.id_number = prompt('Employee ID:', button.dataset.employee);
    body.email = prompt('Email:', button.dataset.email);
    if ([body.first_name, body.last_name, body.id_number, body.email].some(value => value === null || !value.trim())) return;
  }
  if (['block', 'unblock'].includes(action)) {
    body.reason = prompt(`Why should this account be ${action === 'block' ? 'blocked' : 'unblocked'}?`);
    if (!body.reason || !body.reason.trim()) return;
  }
  const username = button.dataset.user ? JSON.parse(decodeURIComponent(button.dataset.user)).username : button.closest('tr')?.children[2]?.textContent || 'this account';
  const confirmationLabels = {approve: 'Approve', block: 'Block', unblock: 'Unblock', update: 'Save changes to', delete: 'Delete'};
  if (confirmationLabels[action] && !await confirmAction(`${confirmationLabels[action]} account`, `${confirmationLabels[action]} account "${username}"?`)) return;
  try { showMessage((await request(action, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) })).message); loadUsers(document.getElementById('employeeId').value); }
  catch (error) { showMessage(error.message, true); }
}

accounts.addEventListener('click', handleAccountAction);
privilegeAccounts?.addEventListener('click', handleAccountAction);

privilegeModules.addEventListener('change', event => {
  const input = event.target;
  if (input.dataset.module && !input.value.includes('.')) {
    privilegeModules.querySelectorAll(`input[data-module="${input.dataset.module}"]`).forEach(child => { child.checked = input.checked; });
  } else if (input.value) {
    const children = [...privilegeModules.querySelectorAll(`input[data-module="${input.dataset.module}"][value]`)];
    const parent = privilegeModules.querySelector(`input[data-module="${input.dataset.module}"]:not([value])`);
    parent.checked = children.every(child => child.checked); parent.indeterminate = children.some(child => child.checked) && !parent.checked;
  }
});

privilegeForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!await confirmAction('Save privileges', 'Save these privilege changes now?')) return;
  const privileges = {};
  privilegeModules.querySelectorAll('input[type="checkbox"][value]:checked').forEach(input => { privileges[input.value] = true; });
  try { showMessage((await request('privileges', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({user_id: privilegeTargetId, privileges})})).message); privilegeDialog.close(); await loadUsers(); await loadAuditLogs(); }
  catch (error) { showMessage(error.message, true); }
});

document.getElementById('closePrivileges').addEventListener('click', () => privilegeDialog.close());
document.getElementById('cancelPrivileges').addEventListener('click', () => privilegeDialog.close());

requests.addEventListener('click', async event => {
  const button = event.target.closest('button[data-request]'); if (!button) return;
  const reason = prompt(`Reason for ${button.dataset.decision}:`); if (!reason || !reason.trim()) return;
  const decisionLabel = button.dataset.decision === 'approve' ? 'Approve' : 'Reject';
  if (!await confirmAction(`${decisionLabel} deletion request`, `${decisionLabel} this deletion request?`)) return;
  try { showMessage((await request('review-delete', {request_id: Number(button.dataset.request), decision: button.dataset.decision, reason})).message); await loadRequests(); await loadUsers(); }
  catch (error) { showMessage(error.message, true); }
});

document.getElementById('filterForm').addEventListener('submit', event => { event.preventDefault(); loadUsers(document.getElementById('employeeId').value); });
document.getElementById('clearFilter').addEventListener('click', () => { document.getElementById('employeeId').value = ''; loadUsers(); });
document.getElementById('refreshStatistics').addEventListener('click', loadStatistics);
document.getElementById('createForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const isValid = validateDashboardCreateForm(form);
  if (!isValid) {
    showMessage('Please correct the highlighted fields before creating the account.', true);
    return;
  }
  if (form.querySelector('[name="role"]')?.value === 'data_administrator') {
    try {
      const status = await request('data-administrator-status');
      if (status.active_data_administrators > 0 && !await confirmAction('Active Data Administrator already exists', 'There is already an active Data Administrator. Are you sure you want to create another one?')) return;
    } catch (error) {
      showMessage(error.message, true);
      return;
    }
  }
  if (!await confirmAction('Create account', 'Create this account now?')) return;
  try {
    const result = await request('create', { method: 'POST', body: new FormData(event.target) });
    const credentials = result.credentials || {};
    showMessage(`${result.message} Employee ID: ${credentials.employee_id || 'not available'}, Username: ${credentials.username || 'not available'}`);
    event.target.reset();
    loadUsers();
    await loadNextEmployeeId();
  }
  catch (error) { showMessage(error.message, true); }
});

['username', 'password'].forEach(fieldName => {
  const selector = document.querySelector(`#createForm [name="${fieldName}"]`);
  if (!selector) return;
  selector.addEventListener('input', () => {
    if (fieldName === 'username') validateDashboardUsername(selector, 'superCreateUsernameError', 'superCreateUsernameHint');
    if (fieldName === 'password') validateDashboardPassword(selector, 'superCreatePasswordError', 'superCreatePasswordStrength');
  });
});
document.getElementById('logoutButton')?.addEventListener('click', () => { window.location.href = '../php/logout.php'; });
document.getElementById('refreshRequests').addEventListener('click', () => loadRequests().catch(error => showMessage(error.message, true)));
document.getElementById('refreshAudit').addEventListener('click', () => loadAuditLogs().catch(error => showMessage(error.message, true)));
document.getElementById('auditFilterForm')?.addEventListener('submit', event => { event.preventDefault(); auditCurrentPage = 1; loadAuditLogs().catch(error => showMessage(error.message, true)); });
document.getElementById('clearAuditFilters')?.addEventListener('click', () => { document.getElementById('auditFilterForm').reset(); auditCurrentPage = 1; loadAuditLogs().catch(error => showMessage(error.message, true)); });
previousAudit.addEventListener('click', () => { if (auditCurrentPage > 1) { auditCurrentPage -= 1; loadAuditLogs().catch(error => showMessage(error.message, true)); } });
nextAudit.addEventListener('click', () => { if (auditCurrentPage < auditTotalPages) { auditCurrentPage += 1; loadAuditLogs().catch(error => showMessage(error.message, true)); } });
loadUsers();
loadStatistics();
loadRequests().catch(error => showMessage(error.message, true));
loadAuditLogs().catch(error => showMessage(error.message, true));
loadNextEmployeeId();
