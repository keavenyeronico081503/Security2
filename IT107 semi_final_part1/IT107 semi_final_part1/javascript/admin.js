let lastTrackedModule = '';
function trackModuleOpen() {
  const module = location.hash.slice(1) || 'overview';
  if (module === lastTrackedModule) return;
  lastTrackedModule = module;
  fetch('../php/activity.php', { method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: `module=${encodeURIComponent(module)}` }).catch(() => {});
}
window.addEventListener('hashchange', trackModuleOpen);
trackModuleOpen();

const api = '../php/admin.php';
const table = document.getElementById('accounts');
const message = document.getElementById('message');
const statCards = document.getElementById('adminStatCards');
const actionRequired = document.getElementById('adminActionRequired');
const charts = {};
let adminRole = '';
const toggleAdminCreatePassword = document.getElementById('toggleAdminCreatePassword');
toggleAdminCreatePassword?.addEventListener('click', () => {
  const input = document.getElementById('adminCreatePassword');
  const visible = input.type === 'password';
  input.type = visible ? 'text' : 'password';
  toggleAdminCreatePassword.setAttribute('aria-pressed', String(visible));
  toggleAdminCreatePassword.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} temporary password`);
  toggleAdminCreatePassword.querySelector('i').className = `fas fa-eye${visible ? '-slash' : ''}`;
});

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
  const firstName = form.querySelector('[name="first_name"]');
  const lastName = form.querySelector('[name="last_name"]');
  const email = form.querySelector('[name="email"]');
  const username = form.querySelector('[name="username"]');
  const password = form.querySelector('[name="password"]');

  const firstValid = validateNameField(firstName, 'adminCreateFirstNameError', 'First name');
  const lastValid = validateNameField(lastName, 'adminCreateLastNameError', 'Last name');
  const emailValid = validateDashboardEmail(email, 'adminCreateEmailError');
  const usernameValid = validateDashboardUsername(username, 'adminCreateUsernameError', 'adminCreateUsernameHint');
  const passwordValid = validateDashboardPassword(password, 'adminCreatePasswordError', 'adminCreatePasswordStrength');

  return firstValid && lastValid && emailValid && usernameValid && passwordValid;
}

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
    adminRole = data.user.role || '';
    if (allowed) {
      createLink.hidden = false;
      createPanel.hidden = false;
    }
    if (data.user.permissions.includes('accounts.block.review')) {
      document.querySelector('[data-permission="accounts.block.review"]').hidden = false;
      document.getElementById('block-requests').hidden = false;
      loadBlockRequests();
    }
    if (data.user.permissions.includes('content.manage')) {
      document.querySelectorAll('[data-permission="content.manage"]').forEach(element => { element.hidden = false; });
      loadPosts();
      loadEvents();
    }
  } catch (error) {
    return;
  }
}

async function loadBlockRequests() {
  const target = document.getElementById('blockRequests');
  if (!target) return;
  try {
    const data = await request('block-requests');
    target.replaceChildren();
    data.requests.forEach(item => {
      const row = document.createElement('tr');
      [item.username, item.id_number, item.requested_by, item.reason, item.status].forEach(value => row.appendChild(textCell(value)));
      const review = document.createElement('td');
      if (item.status === 'pending') {
        ['approve', 'reject'].forEach(decision => { const button = actionButton(decision === 'approve' ? 'Accept' : 'Reject', 'review-block-request', item.id); button.dataset.request = item.id; button.dataset.decision = decision; review.appendChild(button); });
      } else review.textContent = 'Reviewed';
      row.appendChild(review); target.appendChild(row);
    });
    if (!data.requests.length) { const row = document.createElement('tr'); const empty = textCell('No block requests found.'); empty.colSpan = 6; row.appendChild(empty); target.appendChild(row); }
  } catch (error) { message.textContent = error.message; message.style.color = '#a63d32'; }
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

const editDialog = document.getElementById('editDialog');
const editForm = document.getElementById('editForm');
let editTargetId = null;

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
    username: editForm.username.value.trim()
  };
  if (Object.values(body).some(value => value === '')) { showEditMessage('All fields are required.', true); return; }
  if (!await confirmAction('Save changes', `Save changes to account "${body.username}"?`)) return;
  try {
    const result = await request('update', body);
    showEditMessage(result.message);
    await load();
    setTimeout(() => editDialog.close(), 700);
  } catch (error) { showEditMessage(error.message, true); }
});

document.getElementById('resetPasswordBtn').addEventListener('click', async () => {
  if (!editTargetId) return;
  if (!await confirmAction('Reset password', "Generate a new temporary password and email it to this account's institutional address? The current password will stop working immediately.")) return;
  try {
    const result = await request('reset-password', { user_id: editTargetId });
    showEditMessage(result.message);
  } catch (error) { showEditMessage(error.message, true); }
});

document.getElementById('closeEdit').addEventListener('click', () => editDialog.close());
document.getElementById('cancelEdit').addEventListener('click', () => editDialog.close());

async function load() {
  try { render((await request(`list&employee_id=${encodeURIComponent(document.getElementById('employeeId').value)}`)).users); }
  catch (error) { message.textContent = error.message; message.style.color = '#a63d32'; }
}

table.addEventListener('click', async event => {
  const button = event.target.closest('button[data-action]'); if (!button) return;
  const action = button.dataset.action; const body = {user_id: Number(button.dataset.id)};
  if (action === 'block' && adminRole === 'admin') { body.reason = prompt('Why should this account be blocked?'); if (!body.reason || !body.reason.trim()) return; }
  if (action === 'review-block-request') { body.request_id = Number(button.dataset.request); body.decision = button.dataset.decision; body.reason = prompt('Optional review note:', '') || ''; if (!await confirmAction(`${body.decision === 'approve' ? 'Accept' : 'Reject'} block request`, `${body.decision === 'approve' ? 'Accept' : 'Reject'} this block request?`)) return; try { showMessage((await request('review-block-request', body)).message); await loadBlockRequests(); await load(); } catch (error) { showMessage(error.message, true); } return; }
  if (['request-delete', 'block', 'unblock'].includes(action)) { body.reason = prompt(`Why should this account be ${action === 'request-delete' ? 'deleted' : action + 'ed'}?`); if (!body.reason || !body.reason.trim()) return; }
  if (action === 'update') { openEditDialog(JSON.parse(button.dataset.user)); return; }
  const username = button.dataset.user ? JSON.parse(button.dataset.user).username : button.closest('tr')?.children[2]?.textContent || 'this account';
  const confirmationLabels = {approve: 'Approve', block: 'Block', unblock: 'Unblock', update: 'Save changes to', 'request-delete': 'Send deletion request for'};
  if (confirmationLabels[action] && !await confirmAction(`${confirmationLabels[action]} account`, `${confirmationLabels[action]} account "${username}"?`)) return;
  try { message.textContent = (await request(action, body)).message; message.style.color = '#176b52'; await load(); } catch (error) { message.textContent = error.message; message.style.color = '#a63d32'; }
});
document.getElementById('filter').addEventListener('submit', event => { event.preventDefault(); load(); });
document.getElementById('clear').addEventListener('click', () => { document.getElementById('employeeId').value = ''; load(); });
document.getElementById('refreshBlockRequests')?.addEventListener('click', loadBlockRequests);
document.getElementById('refreshAdminStatistics').addEventListener('click', loadStatistics);
document.getElementById('createForm').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const isValid = validateDashboardCreateForm(form);
  if (!isValid) {
    message.textContent = 'Please correct the highlighted fields before creating the account.';
    message.style.color = '#a63d32';
    return;
  }
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

['first_name', 'last_name', 'email', 'username', 'password'].forEach(fieldName => {
  const selector = document.querySelector(`#createForm [name="${fieldName}"]`);
  if (!selector) return;
  selector.addEventListener('input', () => {
    if (fieldName === 'first_name') validateNameField(selector, 'adminCreateFirstNameError', 'First name');
    if (fieldName === 'last_name') validateNameField(selector, 'adminCreateLastNameError', 'Last name');
    if (fieldName === 'email') validateDashboardEmail(selector, 'adminCreateEmailError');
    if (fieldName === 'username') validateDashboardUsername(selector, 'adminCreateUsernameError', 'adminCreateUsernameHint');
    if (fieldName === 'password') validateDashboardPassword(selector, 'adminCreatePasswordError', 'adminCreatePasswordStrength');
  });
});
const contentApi = '../php/content.php';
async function contentRequest(action, body, method = 'POST') {
  const options = method === 'GET' ? {} : {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body || {})};
  const response = await fetch(`${contentApi}?action=${action}`, options);
  const data = await response.json();
  if (!response.ok || data.status === 'error') throw new Error(data.message || 'Request failed.');
  return data;
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
  } catch (error) { message.textContent = error.message; message.style.color = '#a63d32'; }
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
  } catch (error) { message.textContent = error.message; message.style.color = '#a63d32'; }
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
    catch (error) { message.textContent = error.message; message.style.color = '#a63d32'; }
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
    catch (error) { message.textContent = error.message; message.style.color = '#a63d32'; }
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

load();
loadStatistics();
loadAdminAccess();
loadNextEmployeeId();
