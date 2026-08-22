const api = '../php/admin.php';
const table = document.getElementById('accounts');
const message = document.getElementById('message');

async function request(action, body) {
  const options = body ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)} : {};
  const response = await fetch(`${api}?action=${action}`, options);
  const data = await response.json();
  if (!response.ok || data.status === 'error') throw new Error(data.message || 'Request failed.');
  return data;
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
      if (user.account_status !== 'blocked') actions.appendChild(actionButton('Block', 'block', user.id));
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
  try { message.textContent = (await request(action, body)).message; message.style.color = '#176b52'; await load(); } catch (error) { message.textContent = error.message; message.style.color = '#a63d32'; }
});
document.getElementById('filter').addEventListener('submit', event => { event.preventDefault(); load(); });
document.getElementById('clear').addEventListener('click', () => { document.getElementById('employeeId').value = ''; load(); });
document.getElementById('logout').addEventListener('click', () => { window.location.href = '../php/logout.php'; });
load();
