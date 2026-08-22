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
      ${status !== 'blocked' ? `<button data-action="block" data-id="${user.id}">Block</button>` : ''}
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
  const data = await fetch(`../php/audit.php?page=${auditCurrentPage}`).then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.message || 'Audit log unavailable.'); return result; });
  auditTotalPages = data.pagination.total_pages;
  auditPage.textContent = `Page ${data.pagination.page} of ${auditTotalPages}`;
  previousAudit.disabled = auditCurrentPage <= 1;
  nextAudit.disabled = auditCurrentPage >= auditTotalPages;
  auditLogs.replaceChildren();
  data.logs.forEach(log => {
    const row = document.createElement('tr');
    [`${log.created_at}`, `${log.actor_username || 'Deleted account'} (${log.actor_employee_id || '-'})`, log.action_code, `${log.target_username || 'Deleted account'} (${log.target_employee_id || '-'})`, log.success ? 'Success' : 'Failed', JSON.stringify(log.details)].forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell); });
    auditLogs.appendChild(row);
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
    body.first_name = prompt('First name:', button.dataset.first);
    body.last_name = prompt('Last name:', button.dataset.last);
    body.id_number = prompt('Employee ID:', button.dataset.employee);
    body.email = prompt('Email:', button.dataset.email);
    if ([body.first_name, body.last_name, body.id_number, body.email].some(value => value === null || !value.trim())) return;
  }
  if (action === 'delete' && !confirm('Delete this account permanently?')) return;
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
  try { showMessage((await request('review-delete', {request_id: Number(button.dataset.request), decision: button.dataset.decision, reason})).message); await loadRequests(); await loadUsers(); }
  catch (error) { showMessage(error.message, true); }
});

document.getElementById('filterForm').addEventListener('submit', event => { event.preventDefault(); loadUsers(document.getElementById('employeeId').value); });
document.getElementById('clearFilter').addEventListener('click', () => { document.getElementById('employeeId').value = ''; loadUsers(); });
document.getElementById('createForm').addEventListener('submit', async event => {
  event.preventDefault();
  try { showMessage((await request('create', { method: 'POST', body: new FormData(event.target) })).message); event.target.reset(); loadUsers(); }
  catch (error) { showMessage(error.message, true); }
});
document.getElementById('logoutButton')?.addEventListener('click', () => { window.location.href = '../php/logout.php'; });
document.getElementById('refreshRequests').addEventListener('click', () => loadRequests().catch(error => showMessage(error.message, true)));
document.getElementById('refreshAudit').addEventListener('click', () => loadAuditLogs().catch(error => showMessage(error.message, true)));
previousAudit.addEventListener('click', () => { if (auditCurrentPage > 1) { auditCurrentPage -= 1; loadAuditLogs().catch(error => showMessage(error.message, true)); } });
nextAudit.addEventListener('click', () => { if (auditCurrentPage < auditTotalPages) { auditCurrentPage += 1; loadAuditLogs().catch(error => showMessage(error.message, true)); } });
loadUsers();
loadRequests().catch(error => showMessage(error.message, true));
loadAuditLogs().catch(error => showMessage(error.message, true));
