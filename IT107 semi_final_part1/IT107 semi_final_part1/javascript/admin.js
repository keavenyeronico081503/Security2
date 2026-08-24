const api = '../php/admin.php';
const table = document.getElementById('accounts');
const message = document.getElementById('message');
const statCards = document.getElementById('adminStatCards');
const actionRequired = document.getElementById('adminActionRequired');
const charts = {};

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

function drawAdminChart(id, type, labels, values, colors) {
  const canvas = document.getElementById(id);
  if (!canvas || typeof Chart === 'undefined') return;
  charts[id]?.destroy();
  charts[id] = new Chart(canvas, {type, data: {labels, datasets: [{data: values, backgroundColor: colors, borderColor: '#fffdf8', borderWidth: 2, borderRadius: type === 'bar' ? 4 : 0}]}, options: {responsive: true, maintainAspectRatio: false, plugins: {legend: {position: type === 'doughnut' ? 'bottom' : 'top', labels: {color: '#17211b', usePointStyle: true, padding: 16}}}, scales: type === 'bar' || type === 'line' ? {x: {ticks: {color: '#68736c'}, grid: {display: false}}, y: {beginAtZero: true, ticks: {precision: 0, color: '#68736c'}, grid: {color: '#d9ded7'}}} : undefined}});
}

async function loadStatistics() {
  try {
    const response = await fetch('../php/admin-statistics.php');
    const data = await response.json();
    if (!response.ok || data.status !== 'success') throw new Error(data.message || 'Statistics unavailable.');
    const summary = data.summary;
    statCards.innerHTML = [['total', 'Managed accounts'], ['approved', 'Approved'], ['pending', 'Pending'], ['blocked', 'Blocked'], ['my_requests', 'Pending deletion requests']].map(([key, label]) => `<article class="stat-card"><strong>${summary[key]}</strong><span>${label}</span></article>`).join('');
    const required = data.action_required;
    actionRequired.innerHTML = `<h3>Action required</h3><div class="required-items"><a href="#accounts"><strong>${required.pending_users}</strong><span>Pending registrations</span></a><a href="#accounts"><strong>${required.pending_deletions}</strong><span>Pending deletion requests</span></a><a href="#accounts"><strong>${required.failed_actions}</strong><span>Failed actions, last 30 days</span></a></div>`;
    drawAdminChart('adminStatusChart', 'doughnut', data.status_breakdown.map(item => item.label), data.status_breakdown.map(item => item.count), ['#176b52', '#a46616', '#a63d32']);
    drawAdminChart('adminRegistrationChart', 'line', data.registrations.map(item => item.date), data.registrations.map(item => item.count), '#176b52');
    drawAdminChart('adminActionsChart', 'bar', data.actions.map(item => item.label), data.actions.map(item => item.count), '#176b52');
  } catch (error) {
    actionRequired.textContent = error.message;
  }
}

async function request(action, body) {
  const options = body ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)} : {};
  const response = await fetch(`${api}?action=${action}`, options);
  const data = await response.json();
  if (!response.ok || data.status === 'error') throw new Error(data.message || 'Request failed.');
  return data;
}

async function loadAdminAccess() {
  const createLink = document.querySelector('[data-permission="accounts.create"]');
  const createPanel = document.getElementById('create-account');
  try {
    const response = await fetch('../php/user.php?action=session');
    const data = await response.json();
    const allowed = response.ok && data.status === 'success' && data.user.permissions.includes('accounts.create');
    if (allowed) {
      createLink.hidden = false;
      createPanel.hidden = false;
    }
  } catch (error) {
    return;
  }
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

function textCell(value, className = '') {
  const cell = document.createElement('td');
  cell.textContent = value ?? '';
  if (className) cell.className = className;
  return cell;
}

function render(users) {
  table.replaceChildren();
  if (!users.length) { table.appendChild(textCell('No accounts found.')); table.firstChild.colSpan = 6; return; }
  users.forEach(user => {
    const row = document.createElement('tr');
    row.append(textCell(`${user.first_name} ${user.last_name}`), textCell(user.id_number), textCell(user.username), textCell(user.role.replace('_', ' '), 'role'), textCell(user.account_status, `status status-${user.account_status}`));
    const actions = document.createElement('td'); actions.className = 'actions';
    if (user.role !== 'super_admin') {
      if (user.account_status !== 'approved') actions.appendChild(actionButton('Approve', 'approve', user.id));
      actions.appendChild(actionButton(user.account_status === 'blocked' ? 'Unblock' : 'Block', user.account_status === 'blocked' ? 'unblock' : 'block', user.id));
      actions.appendChild(actionButton('Edit', 'update', user.id, user));
      actions.appendChild(actionButton('Request delete', 'request-delete', user.id));
    } else actions.textContent = 'Protected';
    row.appendChild(actions); table.appendChild(row);
  });
}

function actionButton(label, action, id, user = null) {
  const button = document.createElement('button'); button.textContent = label; button.dataset.action = action; button.dataset.id = id;
  if (action === 'request-delete') button.className = 'danger';
  if (user) button.dataset.user = JSON.stringify(user);
  return button;
}

async function load() {
  try { render((await request(`list&employee_id=${encodeURIComponent(document.getElementById('employeeId').value)}`)).users); }
  catch (error) { message.textContent = error.message; message.style.color = '#a63d32'; }
}

table.addEventListener('click', async event => {
  const button = event.target.closest('button[data-action]'); if (!button) return;
  const action = button.dataset.action; const body = {user_id: Number(button.dataset.id)};
  if (action === 'request-delete') { body.reason = prompt('Why should this account be deleted?'); if (!body.reason || !body.reason.trim()) return; }
  if (action === 'update') { const user = JSON.parse(button.dataset.user); body.first_name = prompt('First name:', user.first_name); body.last_name = prompt('Last name:', user.last_name); body.id_number = prompt('Employee ID:', user.id_number); body.email = prompt('Email:', user.email); if (Object.values(body).some(value => value === null || value === '')) return; }
  const username = button.dataset.user ? JSON.parse(button.dataset.user).username : button.closest('tr')?.children[2]?.textContent || 'this account';
  const confirmationLabels = {approve: 'Approve', block: 'Block', unblock: 'Unblock', update: 'Save changes to', 'request-delete': 'Send deletion request for'};
  if (confirmationLabels[action] && !await confirmAction(`${confirmationLabels[action]} account`, `${confirmationLabels[action]} account "${username}"?`)) return;
  try { message.textContent = (await request(action, body)).message; message.style.color = '#176b52'; await load(); } catch (error) { message.textContent = error.message; message.style.color = '#a63d32'; }
});
document.getElementById('filter').addEventListener('submit', event => { event.preventDefault(); load(); });
document.getElementById('clear').addEventListener('click', () => { document.getElementById('employeeId').value = ''; load(); });
document.getElementById('refreshAdminStatistics').addEventListener('click', loadStatistics);
document.getElementById('createForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!await confirmAction('Create user account', 'Create this user account now?')) return;
  try {
    const formData = Object.fromEntries(new FormData(event.target));
    showMessage((await request('create', formData)).message);
    event.target.reset();
    await load();
    await loadStatistics();
    await loadNextEmployeeId();
  } catch (error) {
    showMessage(error.message, true);
  }
});
load();
loadStatistics();
loadAdminAccess();
loadNextEmployeeId();
