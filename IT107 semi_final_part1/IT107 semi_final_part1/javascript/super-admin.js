const accounts = document.getElementById('accounts');
const message = document.getElementById('message');
const requests = document.getElementById('requests');
const auditLogs = document.getElementById('auditLogs');
const auditPage = document.getElementById('auditPage');
const previousAudit = document.getElementById('previousAudit');
const nextAudit = document.getElementById('nextAudit');
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
// Optional: items (bullet list of what will happen), tone 'warning', and custom
// confirmLabel / cancelLabel. The dialog is shared, so every call resets them.
function confirmAction(title, messageText, options = {}) {
  const { items = [], tone = '', confirmLabel = 'Confirm', cancelLabel = 'Cancel' } = options;
  return new Promise(resolve => {
    let dialog = document.getElementById('actionConfirmDialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'actionConfirmDialog';
      dialog.innerHTML = '<form method="dialog" class="action-confirm-form"><h2></h2><p></p><ul class="confirm-items"></ul><div><button value="cancel" class="confirm-cancel">Cancel</button><button value="confirm" class="confirm-accept">Confirm</button></div></form>';
      document.body.appendChild(dialog);
    }
    const form = dialog.querySelector('form');
    form.classList.toggle('is-warning', tone === 'warning');
    const heading = dialog.querySelector('h2');
    heading.textContent = title;
    if (tone === 'warning') heading.insertAdjacentHTML('afterbegin', '<i class="fas fa-exclamation-triangle" aria-hidden="true"></i> ');
    dialog.querySelector('p').textContent = messageText;
    const list = dialog.querySelector('.confirm-items');
    list.replaceChildren(...items.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
    list.hidden = !items.length;
    dialog.querySelector('.confirm-accept').textContent = confirmLabel;
    dialog.querySelector('.confirm-cancel').textContent = cancelLabel;
    // The answer comes from the button that submitted the form. Esc closes without a
    // button and counts as "no"; a late close event from an earlier confirm (while
    // this one is open) is ignored.
    dialog.returnValue = '';
    form.onsubmit = event => resolve(event.submitter?.value === 'confirm');
    dialog.onclose = () => { if (!dialog.open) resolve(false); };
    dialog.showModal();
  });
}
function promptAction(title, messageText, options = {}) {
  const { required = true, placeholder = 'Type your reason here…', submitLabel = 'Submit' } = options;
  return new Promise(resolve => {
    let dialog = document.getElementById('actionPromptDialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'actionPromptDialog';
      dialog.innerHTML = '<form method="dialog" class="action-confirm-form action-prompt-form"><h2></h2><p class="prompt-message"></p><textarea rows="3" maxlength="500"></textarea><p class="prompt-error"></p><div><button value="cancel" class="confirm-cancel" type="submit">Cancel</button><button value="confirm" class="confirm-accept" type="submit">Submit</button></div></form>';
      document.body.appendChild(dialog);
    }
    const form = dialog.querySelector('form');
    const textarea = dialog.querySelector('textarea');
    const errorEl = dialog.querySelector('.prompt-error');
    const submitBtn = dialog.querySelector('.confirm-accept');
    dialog.querySelector('h2').textContent = title;
    dialog.querySelector('.prompt-message').textContent = messageText;
    textarea.value = '';
    textarea.placeholder = placeholder;
    submitBtn.textContent = submitLabel;
    errorEl.textContent = '';

    const onSubmit = event => {
      if (event.submitter === submitBtn && required && !textarea.value.trim()) {
        event.preventDefault();
        errorEl.textContent = 'A reason is required.';
        textarea.focus();
      }
    };
    form.addEventListener('submit', onSubmit);

    dialog.onclose = () => {
      form.removeEventListener('submit', onSubmit);
      resolve(dialog.returnValue === 'confirm' ? textarea.value.trim() : null);
    };
    dialog.showModal();
    textarea.focus();
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
  const dataset = { data: values, borderWidth: 2 };
  if (type === 'line') {
    // A line's stroke comes from borderColor, not backgroundColor — using the same
    // near-white tone this helper uses for bar/doughnut borders would make the line
    // invisible against the panel background, so line charts get their own treatment.
    const perPoint = Array.isArray(colors);
    dataset.borderColor = perPoint ? '#176b52' : colors;
    dataset.backgroundColor = 'rgba(23, 107, 82, 0.12)';
    dataset.pointBackgroundColor = perPoint ? colors : (colors || '#176b52');
    dataset.pointBorderColor = perPoint ? colors : (colors || '#176b52');
    dataset.pointRadius = perPoint ? 4 : 3;
    dataset.pointHoverRadius = 6;
    dataset.fill = true;
    dataset.tension = 0.3;
  } else {
    dataset.backgroundColor = colors;
    dataset.borderColor = '#fffdf8';
    dataset.borderRadius = type === 'bar' ? 4 : 0;
  }
  return { type, data: { labels, datasets: [dataset] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: type === 'doughnut' ? 'bottom' : 'top', labels: { color: '#17211b', usePointStyle: true, padding: 16 } } }, scales: type === 'bar' || type === 'line' ? { x: { ticks: { color: '#68736c' }, grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0, color: '#68736c' }, grid: { color: '#d9ded7' } } } : undefined } };
}

function drawChart(id, config) {
  const canvas = document.getElementById(id);
  if (!canvas || typeof Chart === 'undefined') return;
  charts[id]?.destroy();
  charts[id] = new Chart(canvas, config);
}

// Logged before window.print() runs, not after — so the attempt is recorded even if the
// print dialog gets cancelled or the print itself never completes.
async function logReportPrint(report, extra = {}) {
  try {
    await fetch('../php/report_print.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ report, ...extra })
    });
  } catch (error) {
    // Printing should never be blocked by a logging failure.
  }
}

const periodLabels = { days: 'last 30 days', weeks: 'last 12 weeks', months: 'last 12 months' };

function renderStatistics(data) {
  const summary = data.summary;
  const printMeta = document.getElementById('overviewPrintMeta');
  if (printMeta) {
    const preparedBy = document.getElementById('sidebarBrandName')?.textContent || '';
    const preparedByRole = document.getElementById('sidebarBrandRole')?.textContent || '';
    printMeta.innerHTML = `
      <div><strong>Report period:</strong> Security and sign-up figures for the ${periodLabels[data.registrations_period] || 'selected period'}</div>
      <div><strong>Prepared by:</strong> ${escapeHtml(preparedBy)}${preparedByRole ? ` (${escapeHtml(preparedByRole)})` : ''}</div>
      <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
    `;
  }
  statCards.innerHTML = [
    ['Total accounts', summary.total],
    ['Approved', summary.approved],
    ['Pending registrations', summary.pending],
    ['Blocked', summary.blocked],
    ['Administrators', summary.admins],
    ['Super administrators', summary.super_admins]
  ].map(([label, value]) => `<article class="stat-card"><strong>${value}</strong><span>${label}</span></article>`).join('');
  const required = data.action_required;
  actionRequired.innerHTML = `<h3>Action required</h3><div class="required-items"><a href="#accounts" data-view="accounts"><strong>${required.pending_users}</strong><span>Pending registrations</span></a><a href="#requests" data-view="requests"><strong>${required.pending_deletions}</strong><span>Deletion requests</span></a><a href="#audit" data-view="audit"><strong>${required.failed_actions}</strong><span>Failed actions, last 30 days</span></a></div>`;
  actionRequired.querySelectorAll('[data-view]').forEach(link => link.addEventListener('click', () => window.dispatchEvent(new HashChangeEvent('hashchange'))));
  drawChart('statusChart', chartConfig('doughnut', data.status_breakdown.map(item => item.label), data.status_breakdown.map(item => item.count), ['#176b52', '#a46616', '#a63d32']));
  drawChart('roleChart', chartConfig('bar', data.role_breakdown.map(item => item.label), data.role_breakdown.map(item => item.count), ['#176b52', '#5b8f79', '#a46616']));
  drawChart('deletionChart', chartConfig('bar', data.deletion_requests.map(item => item.label), data.deletion_requests.map(item => item.count), ['#a46616', '#176b52', '#a63d32']));
  drawChart('registrationChart', chartConfig('line', data.registrations.map(item => item.date), data.registrations.map(item => item.count), '#176b52'));
  renderSecurityMonitor(data.security, data.registrations_period);
  renderFunnel(data.funnel, data.registrations_period);
}

// Small KPI cards. Values are numbers or text set with textContent (usernames and
// IPs in the Security monitor come from login attempts and must never be HTML).
function renderMiniCards(targetId, cards) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.replaceChildren(...cards.map(({ value, label, note, tone }) => {
    const card = document.createElement('article');
    card.className = `mini-card${tone ? ` ${tone}` : ''}`;
    const strong = document.createElement('strong'); strong.textContent = value;
    const span = document.createElement('span'); span.textContent = label;
    card.append(strong, span);
    if (note) { const small = document.createElement('small'); small.textContent = note; card.appendChild(small); }
    return card;
  }));
}

function renderRows(targetId, rows, columns, emptyText) {
  const body = document.getElementById(targetId);
  if (!body) return;
  body.replaceChildren();
  rows.forEach(row => {
    const tr = document.createElement('tr');
    columns.forEach(column => { const td = document.createElement('td'); td.textContent = column(row); tr.appendChild(td); });
    body.appendChild(tr);
  });
  if (!rows.length) {
    const tr = document.createElement('tr'); const td = document.createElement('td');
    td.colSpan = columns.length; td.className = 'empty'; td.textContent = emptyText;
    tr.appendChild(td); body.appendChild(tr);
  }
}

function renderSecurityMonitor(security, period) {
  if (!security) return;
  document.querySelectorAll('[data-period-label]').forEach(el => { el.textContent = periodLabels[period] ? `Showing the ${periodLabels[period]}` : ''; });
  renderMiniCards('securityCards', [
    { value: security.failed_today, label: 'Failed logins today', tone: security.failed_today >= 10 ? 'alert' : (security.failed_today ? 'warn' : '') },
    { value: security.failed_period, label: 'Failed logins in period' },
    { value: security.lockouts, label: 'Login lockouts', note: '5 wrong passwords in 15 min', tone: security.lockouts ? 'warn' : '' },
    { value: security.recovery_lockouts, label: 'Recovery lockouts', note: '5 wrong security answers', tone: security.recovery_lockouts ? 'alert' : '' },
    { value: security.breached_refused, label: 'Breached passwords refused', note: 'Found in public data breaches' },
  ]);
  const labels = security.logins.map(item => item.date);
  drawChart('loginChart', {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Successful', data: security.logins.map(item => item.successful), backgroundColor: '#176b52', borderRadius: 3, stack: 'logins' },
      { label: 'Failed', data: security.logins.map(item => item.failed), backgroundColor: '#a63d32', borderRadius: 3, stack: 'logins' },
    ] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: '#17211b', usePointStyle: true } } },
      scales: { x: { stacked: true, ticks: { color: '#68736c' }, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0, color: '#68736c' }, grid: { color: '#d9ded7' } } } },
  });
  const when = value => value ? new Date(value.replace(' ', 'T')).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  renderRows('topTargets', security.top_targets, [r => r.username, r => r.attempts, r => when(r.last_attempt)], 'No failed logins in this period.');
  renderRows('topIps', security.top_ips, [r => r.ip, r => r.attempts, r => r.accounts], 'No failed logins in this period.');
}

function renderFunnel(funnel, period) {
  if (!funnel) return;
  const oldest = funnel.oldest_waiting;
  const waitedDays = oldest ? oldest.hours / 24 : 0;
  const age = oldest ? (oldest.hours >= 48 ? `${Math.floor(waitedDays)} days` : `${oldest.hours} hours`) : '';
  renderMiniCards('funnelCards', [
    { value: funnel.signed_up, label: 'Signed up' },
    { value: funnel.approved, label: 'Approved' },
    { value: funnel.rejected, label: 'Rejected', tone: funnel.rejected ? 'warn' : '' },
    { value: funnel.average_wait_hours === null ? '—' : `${funnel.average_wait_hours} h`, label: 'Average wait to approval' },
    oldest
      ? { value: age, label: 'Oldest still waiting', note: `${oldest.name} (${oldest.username})`, tone: oldest.hours > 72 ? 'alert' : '' }
      : { value: '—', label: 'Oldest still waiting', note: 'Nobody is waiting' },
  ]);
}

async function loadStatistics() {
  try {
    const period = document.getElementById('registrationsPeriod')?.value || 'days';
    const response = await fetch(`../php/statistics.php?period=${encodeURIComponent(period)}`);
    const data = await response.json();
    if (!response.ok || data.status !== 'success') throw new Error(data.message || 'Statistics unavailable.');
    renderStatistics(data);
  } catch (error) {
    actionRequired.textContent = error.message;
  }
}

document.getElementById('registrationsPeriod')?.addEventListener('change', loadStatistics);

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

function showCreateMessage(text, error = false) {
  const el = document.getElementById('createMessage');
  el.textContent = text;
  el.className = `form-message ${error ? 'error' : 'success'}`;
}

// Every value from the database is escaped before it goes into HTML, so a name
// like "<img onerror=...>" shows as text instead of running as code.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function renderUsers(users) {
  accounts.innerHTML = users.map(user => {
    const e = escapeHtml;
    const id = Number(user.id);
    const role = e(user.role.replace('_', ' '));
    const status = e(user.account_status);
    const loginReportButton = `<button data-action="login-report" data-employee="${e(user.id_number)}">Login report</button>`;
    const controls = user.role === 'super_admin'
      ? (user.account_status === 'blocked' ? `<button data-action="reactivate" data-id="${id}">Reactivate</button> ${loginReportButton}` : `<span>Protected</span> ${loginReportButton}`)
      : `
      <button data-action="${user.account_status === 'blocked' ? 'unblock' : 'block'}" data-id="${id}">${user.account_status === 'blocked' ? 'Unblock' : 'Block'}</button>
      <button data-action="update" data-id="${id}" data-first="${e(user.first_name)}" data-last="${e(user.last_name)}" data-employee="${e(user.id_number)}" data-email="${e(user.email)}" data-username="${e(user.username)}" data-role="${e(user.role)}">Edit</button>
      ${loginReportButton}
      <button class="danger" data-action="delete" data-id="${id}">Delete</button>`;
    const presence = user.account_status === 'approved' ? (user.is_online ? 'Online' : 'Offline') : '—';
    return `<tr><td>${e(user.first_name)} ${e(user.last_name)}</td><td>${e(user.id_number)}</td><td>${e(user.username)}</td><td class="role">${role}</td><td class="status status-${status}">${status}</td><td class="status status-${presence.toLowerCase()}">${presence}</td><td class="actions">${controls}</td></tr>`;
  }).join('') || '<tr><td colspan="7">No accounts found.</td></tr>';
}

async function loadUsers() {
  const employeeId = document.getElementById('employeeId').value;
  const role = document.getElementById('roleFilter').value;
  try { renderUsers((await request(`list&employee_id=${encodeURIComponent(employeeId)}&role=${encodeURIComponent(role)}`)).users); }
  catch (error) { showMessage(error.message, true); }
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value.replace(' ', 'T'));
  return { date: date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), time: date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) };
}

function renderLoginReport(data) {
  const results = document.getElementById('loginReportResults');
  results.hidden = false;
  document.getElementById('loginReportName').textContent = `${data.account.name} (${data.account.employee_id})`;
  document.getElementById('loginReportMeta').textContent = `${data.account.username} · ${data.account.role.replaceAll('_', ' ')} · ${data.account.account_status}`;
  const printSubtitle = document.getElementById('loginReportPrintSubtitle');
  if (printSubtitle) printSubtitle.textContent = `Account: ${data.account.name} (${data.account.employee_id})`;

  const alertBox = document.getElementById('loginReportAnomalyAlert');
  if (alertBox) {
    const anomalies = data.timeline.filter(entry => entry.is_anomaly);
    if (!data.summary.has_enough_data) {
      alertBox.hidden = true;
    } else if (anomalies.length > 0) {
      const shown = anomalies.slice(0, 5).map(entry => {
        const when = formatDateTime(entry.time);
        return `<li>${when.date} at ${when.time}</li>`;
      }).join('');
      const more = anomalies.length > 5 ? `<li>+ ${anomalies.length - 5} more</li>` : '';
      alertBox.className = 'anomaly-alert';
      alertBox.innerHTML = `<i class="fas fa-exclamation-triangle" aria-hidden="true"></i><div><strong>${anomalies.length} anomalous login${anomalies.length === 1 ? '' : 's'} flagged in the selected period</strong><p>${escapeHtml(data.account.name)} signed in outside their usual hours. Review these before dismissing them as normal.</p><ul>${shown}${more}</ul></div>`;
      alertBox.hidden = false;
    } else {
      alertBox.className = 'anomaly-alert is-clear';
      alertBox.innerHTML = `<i class="fas fa-check-circle" aria-hidden="true"></i><div><strong>No anomalies detected</strong><p>Every login in the selected period falls within this account's usual hours.</p></div>`;
      alertBox.hidden = false;
    }
  }

  const stats = document.getElementById('loginReportStats');
  const first = formatDateTime(data.summary.first_seen);
  const last = formatDateTime(data.summary.last_seen);
  stats.innerHTML = [
    ['total_logins', 'Successful logins', data.summary.total_logins],
    ['total_failed', 'Failed attempts', data.summary.total_failed],
    ['first_seen', 'First seen', data.summary.first_seen ? `${first.date}` : '—'],
    ['last_seen', 'Most recent login', data.summary.last_seen ? `${last.date} ${last.time}` : '—']
  ].map(([key, label, value]) => `<article class="stat-card"><strong>${value}</strong><span>${label}</span></article>`).join('');

  const usualHoursText = document.getElementById('loginReportUsualHours');
  if (!data.summary.has_enough_data) {
    usualHoursText.textContent = 'Not enough login history yet to establish a usual pattern (needs at least 5 successful logins).';
  } else if (data.usual_hours_text.length) {
    usualHoursText.textContent = `Usual login hours: ${data.usual_hours_text.join(', ')}. Points in a different color mark hours this account rarely signs in — worth a second look.`;
  } else {
    usualHoursText.textContent = 'No clearly usual hours yet — logins are spread thin across the day.';
  }
  const baselineNote = document.getElementById('loginReportBaselineNote');
  baselineNote.textContent = data.summary.has_enough_data
    ? `Chart and table below are scoped to the ${periodLabels[data.period] || 'selected period'}; the usual-hours baseline above is always based on this account's full history (${data.summary.baseline_total_logins} logins on record).`
    : '';
  const printMeta = document.getElementById('loginReportPrintMeta');
  if (printMeta) {
    const preparedBy = document.getElementById('sidebarBrandName')?.textContent || '';
    const preparedByRole = document.getElementById('sidebarBrandRole')?.textContent || '';
    printMeta.innerHTML = `
      <div><strong>Role:</strong> ${escapeHtml(data.account.role.replaceAll('_', ' '))} · <strong>Status:</strong> ${escapeHtml(data.account.account_status)}</div>
      <div><strong>Report period:</strong> ${periodLabels[data.period] || 'selected period'}</div>
      <div><strong>Prepared by:</strong> ${escapeHtml(preparedBy)}${preparedByRole ? ` (${escapeHtml(preparedByRole)})` : ''}</div>
      <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
    `;
  }

  const labels = data.hourly_histogram.map(bucket => bucket.label);
  const values = data.hourly_histogram.map(bucket => bucket.count);
  const colors = data.hourly_histogram.map(bucket => bucket.is_anomaly ? '#a63d32' : '#176b52');
  drawChart('loginHourChart', chartConfig('line', labels, values, colors));

  const timelineBody = document.getElementById('loginReportTimeline');
  timelineBody.innerHTML = data.timeline.map(entry => {
    const when = formatDateTime(entry.time);
    const logout = entry.logout_time ? formatDateTime(entry.logout_time).time : (entry.type === 'login' ? 'Still active / no logout recorded' : '—');
    const type = entry.type === 'login'
      ? (entry.is_anomaly ? '<span class="status status-blocked">Login (unusual time)</span>' : '<span class="status status-approved">Login</span>')
      : '<span class="status status-blocked">Failed attempt</span>';
    return `<tr><td>${when.date}</td><td>${when.time}</td><td>${type}</td><td>${logout}</td></tr>`;
  }).join('') || '<tr><td colspan="4">No login activity recorded for this account yet.</td></tr>';
}

async function loadLoginReport(employeeIdOverride) {
  const message = document.getElementById('loginReportMessage');
  const input = document.getElementById('loginReportEmployeeId');
  const employeeId = (employeeIdOverride ?? input.value).trim();
  message.textContent = '';
  document.getElementById('loginReportResults').hidden = true;
  if (!employeeId) return;
  const period = document.getElementById('loginReportPeriod')?.value || 'days';
  try {
    const response = await fetch(`../php/login_report.php?employee_id=${encodeURIComponent(employeeId)}&period=${encodeURIComponent(period)}`);
    const data = await response.json();
    if (!response.ok || data.status !== 'success') throw new Error(data.message || 'Unable to load login report.');
    renderLoginReport(data);
  } catch (error) {
    message.textContent = error.message;
    message.style.color = '#a63d32';
  }
}

document.getElementById('loginReportForm')?.addEventListener('submit', event => {
  event.preventDefault();
  loadLoginReport();
});
document.getElementById('loginReportPeriod')?.addEventListener('change', () => {
  if (document.getElementById('loginReportEmployeeId').value.trim()) loadLoginReport();
});
document.getElementById('printLoginReport')?.addEventListener('click', async () => {
  await logReportPrint('login_report', {
    employee_id: document.getElementById('loginReportEmployeeId').value.trim(),
    period: document.getElementById('loginReportPeriod')?.value || 'days'
  });
  window.print();
});

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
    const result = await request('update', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) });
    showEditMessage(result.message);
    await loadUsers();
    await loadAuditLogs();
    setTimeout(() => editDialog.close(), 700);
  } catch (error) { showEditMessage(error.message, true); }
});

document.getElementById('resetPasswordBtn').addEventListener('click', async () => {
  if (!editTargetId) return;
  if (!await confirmAction('Reset password', "Generate a new temporary password and email it to the address on file for this account? The current password will stop working immediately.")) return;
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
    // A deleted account (approved request) keeps the name it had when the request was made.
    const name = item.target_id ? `${item.first_name} ${item.last_name}` : `${item.target_name || 'Unknown account'} (account deleted)`;
    [name, item.id_number || '-', item.requested_by || '—', item.reason].forEach(value => {
      const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell);
    });
    const statusCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `request-badge request-${item.status}`; badge.textContent = item.status;
    statusCell.appendChild(badge); row.appendChild(statusCell);
    // Approve / Reject live inside the Review Account popup, next to the evidence.
    const review = document.createElement('td');
    const button = document.createElement('button');
    button.type = 'button'; button.className = item.status === 'pending' ? 'review-open' : 'review-open secondary';
    button.dataset.review = item.id;
    button.innerHTML = `<i class="fas fa-search"></i> ${item.status === 'pending' ? 'Review account' : 'View review'}`;
    review.appendChild(button); row.appendChild(review); requests.appendChild(row);
  });
}

// ---- Review Account popup ----
const reviewDialog = document.getElementById('reviewDialog');
const reviewReasonInput = document.getElementById('reviewDecisionReason');
const reviewError = document.getElementById('reviewError');
let reviewRequestId = null;

const reviewDateTime = value => value ? new Date(value.replace(' ', 'T')).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never';
const reviewDate = value => value ? new Date(value.replace(' ', 'T')).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
function daysSince(value) {
  if (!value) return '';
  const days = Math.floor((Date.now() - new Date(value.replace(' ', 'T')).getTime()) / 86400000);
  return days < 1 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
}
function reviewEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function emptyNote(text) { return reviewEl('p', 'review-empty', text); }

function renderReview(data) {
  const { request: req, account } = data;
  const name = account ? [account.first_name, account.middle_name, account.last_name, account.suffix].filter(Boolean).join(' ') : (req.target_name || 'Unknown account');
  document.getElementById('reviewName').textContent = name;

  const meta = document.getElementById('reviewMeta');
  meta.replaceChildren();
  if (account) {
    meta.append(reviewEl('span', '', `@${account.username}`), reviewEl('span', '', account.id_number || '—'), reviewEl('span', 'review-pill', data.role_label),
      reviewEl('span', `review-pill status-${account.account_status}`, account.account_status));
    if (Number(account.is_online)) meta.append(reviewEl('span', 'review-online', 'Online now'));
  } else {
    meta.append(reviewEl('span', '', req.target_id_number || '—'), reviewEl('span', 'review-pill status-blocked', 'Account deleted'));
  }

  document.getElementById('reviewRequestLine').textContent = `Request #${req.id} · sent by ${req.requested_by || 'a deleted administrator'} · ${reviewDateTime(req.created_at)}`;
  document.getElementById('reviewReason').textContent = req.reason;

  const flags = document.getElementById('reviewFlags');
  const stats = document.getElementById('reviewStats');
  flags.replaceChildren(); stats.replaceChildren();
  reviewDialog.querySelectorAll('.review-columns, .review-body > .review-card').forEach(section => { section.hidden = !account; });
  if (!account) {
    flags.append(reviewEl('p', 'review-flag info', 'This account has been deleted, so its activity is no longer linked to it. The saved name and ID number are shown above.'));
  } else {
    if (!data.flags.length) flags.append(reviewEl('p', 'review-flag ok', 'No warning signs found for this account.'));
    data.flags.forEach(flag => flags.append(reviewEl('p', `review-flag ${flag.level}`, flag.text)));

    const s = data.stats;
    [
      ['Successful logins', s.logins_total, `${s.logins_recent} in the last 30 days`, ''],
      ['Failed logins', s.failed_total, `${s.failed_recent} in the last 30 days`, s.failed_recent > 0 ? 'is-danger' : ''],
      ['Last login', s.last_login ? reviewDate(s.last_login) : 'Never', s.last_login ? daysSince(s.last_login) : 'has not logged in', s.last_login ? '' : 'is-muted'],
      ['Member since', reviewDate(s.member_since), daysSince(s.member_since), ''],
    ].forEach(([label, value, note, extra]) => {
      const card = reviewEl('div', `review-stat ${extra}`);
      card.append(reviewEl('span', 'review-stat-label', label), reviewEl('strong', '', String(value)), reviewEl('small', '', note));
      stats.appendChild(card);
    });

    renderPrivileges(data.privileges);
    renderModules(data.modules);
    renderFailed(data.failed_logins);
    renderActivity(data.activity);
  }

  const pending = req.status === 'pending';
  const outcome = document.getElementById('reviewOutcome');
  document.getElementById('reviewDecision').hidden = !pending;
  outcome.hidden = pending;
  if (!pending) {
    outcome.replaceChildren(reviewEl('strong', `request-badge request-${req.status}`, req.status),
      reviewEl('span', '', ` by ${req.reviewed_by || 'Super Administrator'} on ${reviewDateTime(req.reviewed_at)}`),
      reviewEl('p', '', req.decision_reason ? `“${req.decision_reason}”` : 'No decision reason was recorded.'));
  }
}

function renderPrivileges(privileges) {
  const box = document.getElementById('reviewPrivileges');
  box.replaceChildren();
  const denied = new Set(privileges.denied.map(item => item.code));
  // Unusual ones first: extra grants and removals are what a reviewer needs to notice.
  const items = [
    ...privileges.extra.map(item => ({ ...item, kind: 'extra' })),
    ...privileges.denied.map(item => ({ ...item, kind: 'denied' })),
    ...privileges.role.filter(item => !denied.has(item.code)).map(item => ({ ...item, kind: 'role' })),
  ];
  if (!items.length) { box.appendChild(emptyNote('No privileges assigned.')); return; }
  const fromRole = privileges.role.filter(item => !denied.has(item.code)).length;
  const summary = reviewEl('p', 'review-subtle', `${fromRole} from role` + (privileges.extra.length ? ` · ${privileges.extra.length} extra` : '') + (privileges.denied.length ? ` · ${privileges.denied.length} removed` : ''));
  const list = reviewEl('ul', 'review-privileges');
  items.forEach(item => {
    const li = reviewEl('li', `priv-${item.kind}`);
    li.append(reviewEl('span', '', item.label || item.code));
    if (item.kind !== 'role') li.append(reviewEl('em', '', item.kind === 'extra' ? '+ extra' : '− removed'));
    list.appendChild(li);
  });
  box.append(summary, list);
}

function renderModules(modules) {
  const box = document.getElementById('reviewModules');
  box.replaceChildren();
  if (!modules.length) { box.appendChild(emptyNote('No module activity recorded.')); return; }
  const max = Math.max(...modules.map(item => item.count));
  modules.forEach(item => {
    const row = reviewEl('div', 'review-bar');
    const track = reviewEl('div', 'review-bar-track');
    const fill = reviewEl('span'); fill.style.width = `${Math.max(6, Math.round(item.count / max * 100))}%`;
    track.appendChild(fill);
    row.append(reviewEl('span', 'review-bar-label', item.label), track, reviewEl('strong', '', String(item.count)));
    box.appendChild(row);
  });
}

function renderFailed(failed) {
  const box = document.getElementById('reviewFailed');
  box.replaceChildren();
  if (!failed.length) { box.appendChild(emptyNote('No failed login attempts.')); return; }
  const table = reviewEl('table', 'review-table');
  table.innerHTML = '<thead><tr><th>When</th><th>IP address</th><th>Reason</th></tr></thead>';
  const body = reviewEl('tbody');
  failed.forEach(item => {
    const row = reviewEl('tr');
    row.append(reviewEl('td', '', reviewDateTime(item.created_at)), reviewEl('td', '', item.ip_address || '—'), reviewEl('td', '', item.failure_reason || '—'));
    body.appendChild(row);
  });
  table.appendChild(body); box.appendChild(table);
}

function renderActivity(activity) {
  const list = document.getElementById('reviewActivity');
  list.replaceChildren();
  if (!activity.length) { list.appendChild(emptyNote('No activity recorded.')); return; }
  activity.forEach(item => {
    const li = reviewEl('li', item.success ? '' : 'is-failed');
    const text = reviewEl('div');
    text.append(reviewEl('strong', '', item.label + (item.on ? ` — ${item.on}` : '')),
      reviewEl('span', '', `${item.by} · ${reviewDateTime(item.created_at)}${item.success ? '' : ` · ${item.failure_reason || 'failed'}`}`));
    li.appendChild(text); list.appendChild(li);
  });
}

async function openReview(requestId) {
  reviewRequestId = requestId;
  reviewReasonInput.value = '';
  document.getElementById('reviewReasonCount').textContent = '0/500';
  reviewError.textContent = '';
  document.getElementById('reviewName').textContent = 'Loading…';
  ['reviewMeta', 'reviewFlags', 'reviewStats'].forEach(id => document.getElementById(id).replaceChildren());
  reviewDialog.showModal();
  document.getElementById('reviewBody').scrollTop = 0;
  try {
    const response = await fetch(`${api}?action=review-account&request_id=${requestId}`);
    const data = await response.json();
    if (!response.ok || data.status === 'error') throw new Error(data.message || 'Could not load this account.');
    renderReview(data);
  } catch (error) {
    reviewDialog.close();
    showMessage(error.message, true);
  }
}

async function decideReview(decision) {
  const reason = reviewReasonInput.value.trim();
  if (!reason) {
    reviewError.textContent = `Write a reason before you ${decision === 'approve' ? 'approve' : 'reject'} this request.`;
    reviewReasonInput.focus();
    return;
  }
  const label = decision === 'approve' ? 'Approve & delete' : 'Reject request';
  const question = decision === 'approve'
    ? 'This permanently deletes the account and emails the account holder. This cannot be undone.'
    : 'The account stays active and the request is closed.';
  if (!await confirmAction(label, question)) return;
  reviewError.textContent = '';
  try {
    const result = await request('review-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request_id: reviewRequestId, decision, reason }) });
    reviewDialog.close();
    showMessage(result.message);
    await loadRequests(); await loadUsers();
  } catch (error) { reviewError.textContent = error.message; }
}

requests.addEventListener('click', event => {
  const button = event.target.closest('button[data-review]');
  if (button) openReview(Number(button.dataset.review));
});
document.getElementById('reviewApprove').addEventListener('click', () => decideReview('approve'));
document.getElementById('reviewReject').addEventListener('click', () => decideReview('reject'));
document.getElementById('closeReview').addEventListener('click', () => reviewDialog.close());
document.getElementById('reviewCancel').addEventListener('click', () => reviewDialog.close());
reviewDialog.addEventListener('click', event => { if (event.target === reviewDialog) reviewDialog.close(); });
reviewReasonInput.addEventListener('input', () => {
  document.getElementById('reviewReasonCount').textContent = `${reviewReasonInput.value.length}/500`;
  if (reviewReasonInput.value.trim()) reviewError.textContent = '';
});

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
  if (action === 'login-report') {
    location.hash = '#login-report';
    const input = document.getElementById('loginReportEmployeeId');
    if (input) input.value = button.dataset.employee;
    loadLoginReport(button.dataset.employee);
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
    body.reason = await promptAction('Reason required', `Why should this account be ${action === 'block' ? 'blocked' : 'unblocked'}?`);
    if (!body.reason) return;
  }
  if (action === 'delete') {
    body.reason = await promptAction('Reason required', 'Why should this account be deleted?', { submitLabel: 'Delete' });
    if (!body.reason) return;
  }
  const username = button.dataset.user ? JSON.parse(decodeURIComponent(button.dataset.user)).username : button.closest('tr')?.children[2]?.textContent || 'this account';
  const confirmationLabels = {approve: 'Approve', block: 'Block', unblock: 'Unblock', delete: 'Delete', reactivate: 'Reactivate'};
  if (action === 'reactivate' && !await confirmAction('Reactivate Super Administrator', `Reactivate "${username}" as Super Administrator? Your own account will be automatically deactivated the next time you log out.`)) return;
  if (action !== 'reactivate' && confirmationLabels[action] && !await confirmAction(`${confirmationLabels[action]} account`, `${confirmationLabels[action]} account "${username}"?`)) return;
  try { showMessage((await request(action, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body) })).message); loadUsers(); }
  catch (error) { showMessage(error.message, true); }
}

accounts.addEventListener('click', handleAccountAction);

document.getElementById('filterForm').addEventListener('submit', event => { event.preventDefault(); loadUsers(); });
document.getElementById('clearFilter').addEventListener('click', () => { document.getElementById('employeeId').value = ''; document.getElementById('roleFilter').value = ''; loadUsers(); });
document.getElementById('refreshStatistics').addEventListener('click', loadStatistics);
document.getElementById('printOverview')?.addEventListener('click', async () => {
  await logReportPrint('overview', { period: document.getElementById('registrationsPeriod')?.value || 'days' });
  window.print();
});
// Create Account is handled by javascript/create-account.js.
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

// ---- Manage access ----
// Plain-language name, explanation and group for every permission an account can see here.
const PERMISSION_INFO = {
  'accounts.view': { group: 'Accounts', name: 'View accounts', desc: 'Open the Accounts list and search for accounts.' },
  'accounts.create': { group: 'Accounts', name: 'Create accounts', desc: 'Add new accounts; the owner finishes setup with a temporary password.' },
  'accounts.approve': { group: 'Accounts', name: 'Approve registrations', desc: 'Approve or reject people who signed up and are waiting.' },
  'accounts.update': { group: 'Accounts', name: 'Edit account details', desc: 'Change names and contact details, and reset passwords.', sensitive: true },
  'accounts.block': { group: 'Accounts', name: 'Unblock accounts', desc: 'Unblock accounts that are blocked.', sensitive: true },
  'accounts.block.request': { group: 'Requests', name: 'Request a block', desc: 'Ask the Super Administrator to block an account.' },
  'accounts.block.review': { group: 'Requests', name: 'Review block requests', desc: 'Approve or reject block requests sent by other Administrators.', sensitive: true },
  'accounts.delete.request': { group: 'Requests', name: 'Request a deletion', desc: 'Ask the Super Administrator to delete an account.', sensitive: true },
  'content.manage': { group: 'Content', name: 'Manage posts & events', desc: 'Publish, edit and delete announcements and calendar events.' },
  'account.status.view': { group: 'My account', name: 'Approval status', desc: 'See whether their own account is approved.' },
  'dashboard.view': { group: 'My account', name: 'Dashboard', desc: 'Open their home page.' },
  'profile.view': { group: 'My account', name: 'View own profile', desc: 'See their own profile details.' },
  'profile.update': { group: 'My account', name: 'Update own profile', desc: 'Edit their own name and contact details.' },
  'password.change': { group: 'My account', name: 'Change own password', desc: 'Change their own password.' },
};
const ACCESS_GROUPS = ['Accounts', 'Requests', 'Content', 'My account'];
const ROLE_NAMES = { admin: 'Administrator', user: 'User' };
const accessAccounts = document.getElementById('accessAccounts');
const accessDialog = document.getElementById('accessDialog');
const accessReason = document.getElementById('accessReason');
const accessError = document.getElementById('accessError');
let accessList = [];
let access = null; // the account open in the dialog
let accessMode = 'permissions'; // or 'role'

const permissionName = code => PERMISSION_INFO[code]?.name || code;

async function loadAccess() {
  accessList = (await request('access-list')).accounts;
  renderAccessList();
}

function renderAccessList() {
  const search = document.getElementById('accessSearch').value.trim().toLowerCase();
  const role = document.getElementById('accessRole').value;
  const rows = accessList.filter(item => (!role || item.role === role)
    && (!search || `${item.first_name} ${item.last_name} ${item.id_number} ${item.username}`.toLowerCase().includes(search)));
  accessAccounts.replaceChildren();
  if (!rows.length) {
    const row = reviewEl('tr'); const cell = reviewEl('td', 'review-empty', 'No accounts match.'); cell.colSpan = 6; row.appendChild(cell); accessAccounts.appendChild(row);
    return;
  }
  rows.forEach(item => {
    const row = reviewEl('tr');
    const name = reviewEl('td'); name.append(reviewEl('strong', '', `${item.first_name} ${item.last_name}`), reviewEl('small', 'access-sub', `@${item.username}`));
    const roleCell = reviewEl('td'); roleCell.appendChild(reviewEl('span', `access-role role-${item.role}`, ROLE_NAMES[item.role]));
    const accessCell = reviewEl('td');
    const extra = Number(item.extra_count), removed = Number(item.removed_count);
    if (extra || removed) {
      accessCell.appendChild(reviewEl('span', 'access-chip chip-custom', 'Custom'));
      accessCell.appendChild(reviewEl('small', 'access-sub', [extra ? `+${extra} extra` : '', removed ? `−${removed} removed` : ''].filter(Boolean).join(' · ')));
    } else accessCell.appendChild(reviewEl('span', 'access-muted', 'Role default'));
    const changed = reviewEl('td');
    if (item.changed_at) changed.append(reviewEl('span', '', reviewDate(item.changed_at)), reviewEl('small', 'access-sub', `by ${item.changed_by || 'Super Administrator'}`));
    else changed.appendChild(reviewEl('span', 'access-muted', 'Never'));
    const manage = reviewEl('td');
    const button = reviewEl('button', 'access-open'); button.type = 'button'; button.dataset.access = item.id;
    button.innerHTML = '<i class="fas fa-user-shield"></i> Manage';
    manage.appendChild(button);
    row.append(name, reviewEl('td', '', item.id_number || '—'), roleCell, accessCell, changed, manage);
    accessAccounts.appendChild(row);
  });
}

async function openAccess(userId) {
  accessError.textContent = '';
  accessReason.value = '';
  document.getElementById('accessReasonCount').textContent = '0/500';
  document.getElementById('accessName').textContent = 'Loading…';
  document.getElementById('accessGroups').replaceChildren();
  accessDialog.showModal();
  try {
    const response = await fetch(`${api}?action=access-detail&user_id=${userId}`);
    const data = await response.json();
    if (!response.ok || data.status === 'error') throw new Error(data.message || 'Could not load this account.');
    const p = data.permissions;
    const denied = new Set(p.denied.map(item => item.code));
    const effective = new Set([...p.role.map(item => item.code).filter(code => !denied.has(code)), ...p.extra.map(item => item.code)]);
    access = { ...data, roleDefaults: new Set(data.role_defaults), effective, grantable: new Set(data.grantable), locked: new Set(data.locked) };
    renderAccess();
  } catch (error) {
    accessDialog.close();
    showMessage(error.message, true);
  }
}

function renderAccess() {
  const { account } = access;
  const isAdmin = account.role === 'admin';
  document.getElementById('accessName').textContent = `${account.first_name} ${account.last_name}`;
  const meta = document.getElementById('accessMeta');
  meta.replaceChildren(reviewEl('span', '', `@${account.username}`), reviewEl('span', '', account.id_number || '—'),
    reviewEl('span', 'review-pill', ROLE_NAMES[account.role]), reviewEl('span', `review-pill status-${account.account_status}`, account.account_status));
  document.getElementById('accessRoleName').textContent = ROLE_NAMES[account.role];
  document.getElementById('accessRoleNote').textContent = isAdmin
    ? 'Uses the Administrator page. You can turn individual permissions on or off below.'
    : 'Uses the student dashboard. Users have a fixed set of permissions.';
  document.querySelector('#openRoleChange span').textContent = isAdmin ? 'Demote to User…' : 'Promote to Administrator…';
  document.getElementById('accessIntro').textContent = isAdmin
    ? 'Switch permissions on or off. Changes are listed at the bottom and only apply when you save.'
    : 'Users have a fixed set of permissions. Promote this account to Administrator to give it more access.';

  // Permissions this account has that no Administrator screen uses are dropped on save.
  const unsupported = isAdmin ? [...access.effective].filter(code => !access.grantable.has(code)) : [];
  access.unsupported = unsupported;
  const warning = document.getElementById('accessUnsupported');
  warning.hidden = !unsupported.length;
  warning.textContent = unsupported.length ? `Will be removed when you save, because no Administrator screen uses ${unsupported.length === 1 ? 'it' : 'them'}: ${unsupported.map(code => access.catalog.find(item => item.code === code)?.label || code).join(', ')}.` : '';

  const codes = isAdmin ? [...access.grantable] : [...access.effective];
  const groups = document.getElementById('accessGroups');
  groups.replaceChildren();
  ACCESS_GROUPS.forEach(groupName => {
    const inGroup = codes.filter(code => (PERMISSION_INFO[code]?.group || 'My account') === groupName);
    if (!inGroup.length) return;
    const section = reviewEl('section', 'access-group');
    section.appendChild(reviewEl('h3', '', groupName));
    inGroup.forEach(code => {
      const info = PERMISSION_INFO[code] || { name: code, desc: '' };
      const locked = access.locked.has(code) || !isAdmin;
      const row = reviewEl('label', `access-row${locked ? ' is-locked' : ''}`);
      const toggle = reviewEl('input'); toggle.type = 'checkbox'; toggle.className = 'access-toggle'; toggle.value = code;
      toggle.checked = access.effective.has(code) || access.locked.has(code); toggle.disabled = locked;
      const text = reviewEl('span', 'access-text');
      const title = reviewEl('strong', '', info.name);
      if (info.sensitive) title.appendChild(reviewEl('em', 'access-sensitive', 'Sensitive'));
      text.append(title, reviewEl('small', '', info.desc));
      row.append(toggle, text, reviewEl('span', 'access-chip'));
      section.appendChild(row);
    });
    groups.appendChild(section);
  });
  showAccessMode('permissions');
  updateAccessState();
}

function accessSelection() {
  return new Set([...document.querySelectorAll('#accessGroups .access-toggle')].filter(toggle => toggle.checked).map(toggle => toggle.value));
}

// Recomputes each row's chip and the change summary from the current toggles.
function updateAccessState() {
  const isAdmin = access.account.role === 'admin';
  document.querySelectorAll('#accessGroups .access-row').forEach(row => {
    const toggle = row.querySelector('.access-toggle'), chip = row.querySelector('.access-chip');
    const fromRole = access.roleDefaults.has(toggle.value);
    const [label, kind] = access.locked.has(toggle.value) ? ['Always on', 'locked']
      : toggle.checked ? (fromRole ? ['From role', 'role'] : ['Extra', 'extra'])
      : (fromRole ? ['Removed', 'removed'] : ['Off', 'off']);
    chip.className = `access-chip chip-${kind}`; chip.textContent = isAdmin ? label : 'From role';
  });
  if (accessMode !== 'permissions') return;
  const selected = accessSelection();
  const added = [...selected].filter(code => !access.effective.has(code) && !access.locked.has(code));
  const removed = [...access.effective].filter(code => !selected.has(code) && !access.locked.has(code));
  const summary = document.getElementById('accessSummary');
  summary.replaceChildren();
  if (!added.length && !removed.length) summary.appendChild(reviewEl('span', 'access-muted', isAdmin ? 'No changes yet.' : 'Nothing to change here. Use “Promote to Administrator” to give more access.'));
  added.forEach(code => summary.appendChild(reviewEl('span', 'summary-add', `+ ${permissionName(code)}`)));
  removed.forEach(code => summary.appendChild(reviewEl('span', 'summary-remove', `− ${access.grantable.has(code) ? permissionName(code) : (access.catalog.find(item => item.code === code)?.label || code)}`)));
  access.changeCount = added.length + removed.length;
  document.getElementById('accessReset').hidden = !isAdmin;
  document.getElementById('accessSave').hidden = !isAdmin;
  document.querySelector('#accessFooter label').hidden = !isAdmin;
  accessReason.hidden = !isAdmin;
  document.getElementById('accessSave').disabled = !access.changeCount || !accessReason.value.trim();
}

function showAccessMode(mode) {
  accessMode = mode;
  const roleMode = mode === 'role';
  document.getElementById('accessPermissionsPanel').hidden = roleMode;
  document.getElementById('accessRolePanel').hidden = !roleMode;
  document.getElementById('accessSummary').hidden = roleMode;
  document.querySelector('.access-role-card').hidden = roleMode;
  document.getElementById('accessCancel').textContent = roleMode ? 'Back' : 'Cancel';
  document.querySelector('#accessSave span').textContent = roleMode ? (access.account.role === 'admin' ? 'Demote to User' : 'Promote to Administrator') : 'Save changes';
  document.getElementById('accessSave').classList.toggle('is-role', roleMode);
  accessError.textContent = '';
  if (roleMode) {
    accessReason.hidden = false;
    document.querySelector('#accessFooter label').hidden = false;
    document.getElementById('accessSave').hidden = false;
    document.getElementById('accessReset').hidden = true;
    renderRoleChange();
  } else updateAccessState();
}

const isSchoolEmail = email => /@csucc\.edu\.ph$/i.test(email);

function renderRoleChange() {
  const { account } = access;
  const newRole = account.role === 'admin' ? 'user' : 'admin';
  const emailInput = document.getElementById('roleEmail');
  document.getElementById('roleChangeTitle').textContent = newRole === 'admin'
    ? `Promote ${account.first_name} to Administrator` : `Demote ${account.first_name} to User`;
  document.getElementById('roleEmailLabel').textContent = newRole === 'admin'
    ? 'Personal email for the Administrator account' : 'School email (@csucc.edu.ph) for the User account';
  const fits = newRole === 'admin' ? !isSchoolEmail(account.email) : isSchoolEmail(account.email);
  emailInput.value = fits ? account.email : '';
  emailInput.placeholder = newRole === 'admin' ? 'name@gmail.com' : 'name@csucc.edu.ph';
  updateRoleChange();
}

function updateRoleChange() {
  const { account } = access;
  const newRole = account.role === 'admin' ? 'user' : 'admin';
  const email = document.getElementById('roleEmail').value.trim();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (newRole === 'admin' ? !isSchoolEmail(email) : isSchoolEmail(email));
  const hint = document.getElementById('roleEmailHint');
  hint.className = `access-hint${email && !valid ? ' is-error' : ''}`;
  hint.textContent = !email ? (newRole === 'admin' ? 'Administrators must use a personal email (not a school address).' : 'Users must use their @csucc.edu.ph school email.')
    : !valid ? (newRole === 'admin' ? 'This must be a personal email, not a school address.' : 'This must be an @csucc.edu.ph school email.')
    : 'A temporary password will be sent to this address.';
  const effects = document.getElementById('roleEffects');
  effects.replaceChildren(...[
    `The role changes from ${ROLE_NAMES[account.role]} to ${ROLE_NAMES[newRole]}, and the account opens the ${newRole === 'admin' ? 'Administrator page' : 'student dashboard'}.`,
    `Any custom access is cleared; the account gets the standard ${ROLE_NAMES[newRole]} permissions.`,
    `A temporary password is emailed to ${valid ? email : 'the address above'}. Getting it proves the address works, and they choose a new password when they log in.`,
    ...(valid && email.toLowerCase() !== String(account.email).toLowerCase() ? [`The current address (${account.email}) is told about the change.`] : []),
  ].map(text => reviewEl('li', '', text)));
  document.getElementById('accessSave').disabled = !valid || !accessReason.value.trim();
}

async function saveAccess() {
  const reason = accessReason.value.trim();
  if (!reason) { accessError.textContent = 'Please give a reason for this change.'; accessReason.focus(); return; }
  const { account } = access;
  try {
    let result;
    if (accessMode === 'role') {
      const newRole = account.role === 'admin' ? 'user' : 'admin';
      const label = newRole === 'admin' ? 'Promote to Administrator' : 'Demote to User';
      if (!await confirmAction(label, `${account.first_name} ${account.last_name} will become a ${ROLE_NAMES[newRole]} and receive a temporary password by email.`)) return;
      result = await request('change-role', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: account.id, role: newRole, email: document.getElementById('roleEmail').value.trim(), reason }) });
    } else {
      if (!await confirmAction('Save access changes', `Apply ${access.changeCount} change${access.changeCount === 1 ? '' : 's'} to ${account.first_name}'s access? They will be notified by email.`)) return;
      result = await request('privileges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: account.id, enabled: [...accessSelection()], reason }) });
    }
    accessDialog.close();
    showMessage(result.message);
    await loadAccess(); await loadUsers();
  } catch (error) { accessError.textContent = error.message; }
}

accessAccounts.addEventListener('click', event => {
  const button = event.target.closest('button[data-access]');
  if (button) openAccess(Number(button.dataset.access));
});
document.getElementById('accessSearch').addEventListener('input', renderAccessList);
document.getElementById('accessRole').addEventListener('change', renderAccessList);
document.getElementById('accessGroups').addEventListener('change', updateAccessState);
// Reset asks first and spells out exactly which switches it will flip.
document.getElementById('accessReset').addEventListener('click', async () => {
  const toggles = [...document.querySelectorAll('#accessGroups .access-toggle')].filter(toggle => !toggle.disabled);
  const turnOff = toggles.filter(toggle => toggle.checked && !access.roleDefaults.has(toggle.value)).map(toggle => permissionName(toggle.value));
  const turnOn = toggles.filter(toggle => !toggle.checked && access.roleDefaults.has(toggle.value)).map(toggle => permissionName(toggle.value));
  const roleName = ROLE_NAMES[access.account.role];
  if (!turnOff.length && !turnOn.length) {
    const summary = document.getElementById('accessSummary');
    summary.replaceChildren(reviewEl('span', 'access-muted', `Already using the standard ${roleName} permissions.`));
    setTimeout(updateAccessState, 3500);
    return;
  }
  const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
  const items = [
    ...(turnOff.length ? [`Turns off ${plural(turnOff.length, 'extra permission')}: ${turnOff.join(', ')}`] : []),
    ...(turnOn.length ? [`Turns back on ${plural(turnOn.length, 'removed permission')}: ${turnOn.join(', ')}`] : []),
    'Nothing is saved yet. Review the changes, add a reason, then press Save changes.',
  ];
  const ok = await confirmAction('Reset to role defaults?',
    `This puts ${access.account.first_name} ${access.account.last_name} back to the standard ${roleName} permissions.`,
    { tone: 'warning', items, confirmLabel: 'Yes, reset', cancelLabel: 'No, keep current' });
  if (!ok) return;
  toggles.forEach(toggle => { toggle.checked = access.roleDefaults.has(toggle.value); });
  updateAccessState();
});
document.getElementById('openRoleChange').addEventListener('click', () => showAccessMode('role'));
document.getElementById('roleEmail').addEventListener('input', updateRoleChange);
document.getElementById('accessSave').addEventListener('click', saveAccess);
document.getElementById('accessCancel').addEventListener('click', () => { if (accessMode === 'role') showAccessMode('permissions'); else accessDialog.close(); });
document.getElementById('closeAccess').addEventListener('click', () => accessDialog.close());
accessDialog.addEventListener('click', event => { if (event.target === accessDialog) accessDialog.close(); });
accessReason.addEventListener('input', () => {
  document.getElementById('accessReasonCount').textContent = `${accessReason.value.length}/500`;
  if (accessReason.value.trim()) accessError.textContent = '';
  if (accessMode === 'role') updateRoleChange(); else updateAccessState();
});
loadAccess().catch(error => showMessage(error.message, true));
