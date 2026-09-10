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
const editDialog = document.getElementById('editDialog');
const editForm = document.getElementById('editForm');
let editTargetId = null;
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
    const controls = user.role === 'super_admin'
      ? (status === 'blocked' ? `<button data-action="reactivate" data-id="${user.id}">Reactivate</button>` : '<span>Protected</span>')
      : `
      ${status === 'pending' ? `<button data-action="approve" data-id="${user.id}">Approve</button>` : ''}
      <button data-action="${status === 'blocked' ? 'unblock' : 'block'}" data-id="${user.id}">${status === 'blocked' ? 'Unblock' : 'Block'}</button>
      <button data-action="update" data-id="${user.id}" data-first="${user.first_name}" data-last="${user.last_name}" data-employee="${user.id_number}" data-email="${user.email}" data-username="${user.username}" data-role="${user.role}">Edit</button>
      <button class="danger" data-action="delete" data-id="${user.id}">Delete</button>`;
    const presence = status === 'approved' ? (user.is_online ? 'Online' : 'Offline') : '—';
    return `<tr><td>${user.first_name} ${user.last_name}</td><td>${user.id_number}</td><td>${user.username}</td><td class="role">${role}</td><td class="status status-${status}">${status}</td><td class="status status-${presence.toLowerCase()}">${presence}</td><td class="actions">${controls}</td></tr>`;
  }).join('') || '<tr><td colspan="7">No accounts found.</td></tr>';
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

function showEditMessage(text, error = false) {
  const el = document.getElementById('editMessage');
  el.textContent = text;
  el.style.color = error ? '#a63d32' : '#176b52';
}

function openEditDialog(user) {
  editTargetId = Number(user.id);
  editForm.first_name.value = user.first_name;
  editForm.last_name.value = user.last_name;
  editForm.id_number.value = user.id_number;
  editForm.email.value = user.email;
  editForm.username.value = user.username;
  editForm.role.value = user.role;
  document.getElementById('editAccountLabel').textContent = `${user.first_name} ${user.last_name} (${user.username})`;
  showEditMessage('');
  editDialog.showModal();
}

editForm.addEventListener('submit', async event => {
  event.preventDefault();
  const body = {
    user_id: editTargetId,
    first_name: editForm.first_name.value.trim(),
    last_name: editForm.last_name.value.trim(),
    id_number: editForm.id_number.value.trim(),
    email: editForm.email.value.trim(),
    username: editForm.username.value.trim(),
    role: editForm.role.value
  };
  if (Object.values(body).some(value => value === '')) { showEditMessage('All fields are required.', true); return; }
  if (!await confirmAction('Save changes', `Save changes to account "${body.username}"?`)) return;
  try {
    const result = await request('update', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) });
    showEditMessage(result.message);
    await loadUsers(document.getElementById('employeeId').value);
    await loadAuditLogs();
    setTimeout(() => editDialog.close(), 700);
  } catch (error) { showEditMessage(error.message, true); }
});

document.getElementById('resetPasswordBtn').addEventListener('click', async () => {
  if (!editTargetId) return;
  if (!await confirmAction('Reset password', "Generate a new temporary password and email it to this account's institutional address? The current password will stop working immediately.")) return;
  try {
    const result = await request('reset-password', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ user_id: editTargetId }) });
    showEditMessage(result.message);
    await loadAuditLogs();
  } catch (error) { showEditMessage(error.message, true); }
});

document.getElementById('closeEdit').addEventListener('click', () => editDialog.close());
document.getElementById('cancelEdit').addEventListener('click', () => editDialog.close());

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

  if (!data.buckets.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td'); cell.colSpan = 6; cell.textContent = 'No activity recorded for this filter.';
    row.appendChild(cell); auditLogs.appendChild(row);
    return;
  }

  data.buckets.forEach(bucket => {
    const summaryRow = document.createElement('tr');
    summaryRow.append(textCell(bucket.employee_id), textCell(bucket.name), textCell(bucket.position), textCell(bucket.date_text), textCell(bucket.time_text));

    const actionsCell = document.createElement('td');
    actionsCell.className = 'audit-actions-cell';
    const summary = document.createElement('span');
    summary.className = 'audit-summary';
    if (bucket.login_status === 'active') {
      summary.innerHTML = 'Logged in — <span class="audit-status-active">Active</span>';
    } else if (bucket.login_status === 'logged_out') {
      summary.textContent = `Logged in — Logged out at ${bucket.logout_time_text}`;
    } else {
      summary.textContent = `${bucket.actions.length} action${bucket.actions.length > 1 ? 's' : ''}`;
    }
    const viewBtn = document.createElement('button');
    viewBtn.type = 'button'; viewBtn.className = 'secondary audit-view-toggle'; viewBtn.textContent = 'View';
    actionsCell.append(summary, viewBtn);
    summaryRow.appendChild(actionsCell);
    auditLogs.appendChild(summaryRow);

    const detailRow = document.createElement('tr');
    detailRow.className = 'audit-detail-row';
    detailRow.hidden = true;
    const detailCell = document.createElement('td');
    detailCell.colSpan = 6;
    const list = document.createElement('ul');
    list.className = 'audit-actions-list';
    bucket.actions.forEach(action => {
      const item = document.createElement('li');
      if (!action.success) item.classList.add('audit-action-failed');
      const time = document.createElement('span'); time.className = 'audit-action-time'; time.textContent = action.time_text;
      const label = document.createElement('span'); label.className = 'audit-action-label'; label.textContent = action.label;
      item.append(time, label);
      if (action.target && action.target !== '—') {
        const target = document.createElement('span'); target.className = 'audit-action-target'; target.textContent = action.target;
        item.appendChild(target);
      }
      const note = action.detail || action.failure_reason;
      if (note) {
        const detail = document.createElement('span'); detail.className = 'audit-action-detail'; detail.textContent = note;
        item.appendChild(detail);
      }
      list.appendChild(item);
    });
    detailCell.appendChild(list);
    detailRow.appendChild(detailCell);
    auditLogs.appendChild(detailRow);

    viewBtn.addEventListener('click', () => {
      detailRow.hidden = !detailRow.hidden;
      viewBtn.textContent = detailRow.hidden ? 'View' : 'Hide';
    });
  });
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
    openEditDialog({
      id: button.dataset.id,
      first_name: button.dataset.first,
      last_name: button.dataset.last,
      id_number: button.dataset.employee,
      email: button.dataset.email,
      username: button.dataset.username,
      role: button.dataset.role
    });
    return;
  }
  if (['block', 'unblock'].includes(action)) {
    body.reason = prompt(`Why should this account be ${action === 'block' ? 'blocked' : 'unblocked'}?`);
    if (!body.reason || !body.reason.trim()) return;
  }
  const username = button.dataset.user ? JSON.parse(decodeURIComponent(button.dataset.user)).username : button.closest('tr')?.children[2]?.textContent || 'this account';
  const confirmationLabels = {approve: 'Approve', block: 'Block', unblock: 'Unblock', delete: 'Delete', reactivate: 'Reactivate'};
  if (action === 'reactivate' && !await confirmAction('Reactivate Super Administrator', `Reactivate "${username}" as Super Administrator? Your own account will be automatically deactivated the next time you log out.`)) return;
  if (action !== 'reactivate' && confirmationLabels[action] && !await confirmAction(`${confirmationLabels[action]} account`, `${confirmationLabels[action]} account "${username}"?`)) return;
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
const contentApi = '../php/content.php';
async function contentRequest(action, body, method = 'POST') {
  const options = method === 'GET' ? {} : {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})};
  const response = await fetch(`${contentApi}?action=${action}`, options);
  const data = await response.json();
  if (!response.ok || data.status === 'error') throw new Error(data.message || 'Request failed.');
  return data;
}

function textCell(value) {
  const cell = document.createElement('td');
  cell.textContent = value ?? '';
  return cell;
}

async function loadPosts() {
  const list = document.getElementById('postsList');
  if (!list) return;
  try {
    const data = await contentRequest('list-posts', null, 'GET');
    list.replaceChildren();
    if (!data.posts.length) { const row = document.createElement('tr'); const cell = textCell('No posts yet.'); cell.colSpan = 3; row.appendChild(cell); list.appendChild(row); return; }
    data.posts.forEach(post => {
      const row = document.createElement('tr');
      row.append(textCell(post.title), textCell(post.created_at));
      const actions = document.createElement('td');
      const editBtn = document.createElement('button'); editBtn.textContent = 'Edit'; editBtn.dataset.postId = post.id; editBtn.dataset.title = post.title; editBtn.dataset.body = post.body; editBtn.className = 'edit-post';
      const deleteBtn = document.createElement('button'); deleteBtn.textContent = 'Delete'; deleteBtn.dataset.postId = post.id; deleteBtn.className = 'danger delete-post';
      actions.append(editBtn, deleteBtn);
      row.appendChild(actions);
      list.appendChild(row);
    });
  } catch (error) { showMessage(error.message, true); }
}

async function loadEvents() {
  const list = document.getElementById('eventsList');
  if (!list) return;
  try {
    const data = await contentRequest('list-events', null, 'GET');
    list.replaceChildren();
    if (!data.events.length) { const row = document.createElement('tr'); const cell = textCell('No events yet.'); cell.colSpan = 3; row.appendChild(cell); list.appendChild(row); return; }
    data.events.forEach(eventItem => {
      const row = document.createElement('tr');
      row.append(textCell(eventItem.title), textCell(eventItem.event_date));
      const actions = document.createElement('td');
      const editBtn = document.createElement('button'); editBtn.textContent = 'Edit'; editBtn.dataset.eventId = eventItem.id; editBtn.dataset.title = eventItem.title; editBtn.dataset.description = eventItem.description || ''; editBtn.dataset.eventDate = eventItem.event_date; editBtn.className = 'edit-event';
      const deleteBtn = document.createElement('button'); deleteBtn.textContent = 'Delete'; deleteBtn.dataset.eventId = eventItem.id; deleteBtn.className = 'danger delete-event';
      actions.append(editBtn, deleteBtn);
      row.appendChild(actions);
      list.appendChild(row);
    });
  } catch (error) { showMessage(error.message, true); }
}

document.getElementById('createPostForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const postMessage = document.getElementById('postMessage');
  const body = Object.fromEntries(new FormData(form));
  if (!await confirmAction('Publish post', 'Publish this post to all users now?')) return;
  try {
    const result = await contentRequest('create-post', body);
    postMessage.textContent = result.message; postMessage.style.color = '#176b52';
    form.reset();
    await loadPosts();
  } catch (error) { postMessage.textContent = error.message; postMessage.style.color = '#a63d32'; }
});

document.getElementById('createEventForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const eventMessage = document.getElementById('eventMessage');
  const body = Object.fromEntries(new FormData(form));
  if (!await confirmAction('Add event', 'Add this event to the shared calendar now?')) return;
  try {
    const result = await contentRequest('create-event', body);
    eventMessage.textContent = result.message; eventMessage.style.color = '#176b52';
    form.reset();
    await loadEvents();
  } catch (error) { eventMessage.textContent = error.message; eventMessage.style.color = '#a63d32'; }
});

document.getElementById('postsList')?.addEventListener('click', async event => {
  const editBtn = event.target.closest('.edit-post');
  const deleteBtn = event.target.closest('.delete-post');
  if (editBtn) {
    const dialog = document.getElementById('postEditDialog');
    const form = document.getElementById('postEditForm');
    form.title.value = editBtn.dataset.title;
    form.body.value = editBtn.dataset.body;
    form.dataset.postId = editBtn.dataset.postId;
    document.getElementById('postEditMessage').textContent = '';
    dialog.showModal();
  }
  if (deleteBtn) {
    if (!await confirmAction('Delete post', 'Delete this post permanently?')) return;
    try { await contentRequest('delete-post', {id: Number(deleteBtn.dataset.postId)}); await loadPosts(); }
    catch (error) { showMessage(error.message, true); }
  }
});

document.getElementById('eventsList')?.addEventListener('click', async event => {
  const editBtn = event.target.closest('.edit-event');
  const deleteBtn = event.target.closest('.delete-event');
  if (editBtn) {
    const dialog = document.getElementById('eventEditDialog');
    const form = document.getElementById('eventEditForm');
    form.title.value = editBtn.dataset.title;
    form.description.value = editBtn.dataset.description;
    form.event_date.value = editBtn.dataset.eventDate;
    form.dataset.eventId = editBtn.dataset.eventId;
    document.getElementById('eventEditMessage').textContent = '';
    dialog.showModal();
  }
  if (deleteBtn) {
    if (!await confirmAction('Delete event', 'Delete this event permanently?')) return;
    try { await contentRequest('delete-event', {id: Number(deleteBtn.dataset.eventId)}); await loadEvents(); }
    catch (error) { showMessage(error.message, true); }
  }
});

document.getElementById('postEditForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const postEditMessage = document.getElementById('postEditMessage');
  const body = {id: Number(form.dataset.postId), title: form.title.value.trim(), body: form.body.value.trim()};
  if (!await confirmAction('Save changes', 'Save changes to this post?')) return;
  try {
    const result = await contentRequest('update-post', body);
    postEditMessage.textContent = result.message; postEditMessage.style.color = '#176b52';
    await loadPosts();
    setTimeout(() => document.getElementById('postEditDialog').close(), 700);
  } catch (error) { postEditMessage.textContent = error.message; postEditMessage.style.color = '#a63d32'; }
});

document.getElementById('eventEditForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const eventEditMessage = document.getElementById('eventEditMessage');
  const body = {id: Number(form.dataset.eventId), title: form.title.value.trim(), description: form.description.value.trim(), event_date: form.event_date.value};
  if (!await confirmAction('Save changes', 'Save changes to this event?')) return;
  try {
    const result = await contentRequest('update-event', body);
    eventEditMessage.textContent = result.message; eventEditMessage.style.color = '#176b52';
    await loadEvents();
    setTimeout(() => document.getElementById('eventEditDialog').close(), 700);
  } catch (error) { eventEditMessage.textContent = error.message; eventEditMessage.style.color = '#a63d32'; }
});

document.getElementById('closePostEdit')?.addEventListener('click', () => document.getElementById('postEditDialog').close());
document.getElementById('cancelPostEdit')?.addEventListener('click', () => document.getElementById('postEditDialog').close());
document.getElementById('closeEventEdit')?.addEventListener('click', () => document.getElementById('eventEditDialog').close());
document.getElementById('cancelEventEdit')?.addEventListener('click', () => document.getElementById('eventEditDialog').close());

loadUsers();
loadStatistics();
loadRequests().catch(error => showMessage(error.message, true));
loadAuditLogs().catch(error => showMessage(error.message, true));
loadNextEmployeeId();
loadPosts();
loadEvents();
