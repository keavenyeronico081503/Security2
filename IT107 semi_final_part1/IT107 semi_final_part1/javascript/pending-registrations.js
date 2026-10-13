// Shared by admin.html and super-admin.html (loaded after the page script, whose
// confirmAction / promptAction / showMessage helpers it reuses).
// - Pending registrations: sign-ups waiting for approval. They are stored in
//   pending_registrations, not in `users`, until approved.
// - Block requests (Super Administrator page): Admins' block requests to review.

(() => {
  const adminApi = '../php/admin.php';

  async function adminRequest(action, body) {
    const options = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
    const response = await fetch(`${adminApi}?action=${action}`, options);
    const data = await response.json();
    if (!response.ok || data.status === 'error') throw new Error(data.message || 'Request failed.');
    return data;
  }

  function cell(value) {
    const td = document.createElement('td');
    td.textContent = value ?? '';
    return td;
  }

  function emptyRow(target, text, columns) {
    const row = document.createElement('tr');
    const td = cell(text);
    td.colSpan = columns;
    row.appendChild(td);
    target.appendChild(row);
  }

  function button(label, dataset, className = '') {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    if (className) element.className = className;
    Object.assign(element.dataset, dataset);
    return element;
  }

  function refreshAccounts() {
    if (typeof loadUsers === 'function') loadUsers();
    else if (typeof load === 'function') load();
  }

  // ---- Pending registrations ----
  const pendingBody = document.getElementById('pendingRegistrations');

  async function loadPendingRegistrations() {
    if (!pendingBody) return;
    try {
      const { registrations } = await adminRequest('pending-list');
      pendingBody.replaceChildren();
      registrations.forEach(item => {
        const row = document.createElement('tr');
        const name = [item.first_name, item.middle_name, item.last_name, item.suffix].filter(Boolean).join(' ');
        const submitted = new Date(item.submitted_at.replace(' ', 'T')).toLocaleString();
        [name, item.id_number, item.username, item.email, item.created_by ? `${submitted} (by ${item.created_by})` : submitted]
          .forEach(value => row.appendChild(cell(value)));
        const actions = document.createElement('td');
        actions.className = 'actions';
        actions.append(
          button('Approve', { pendingAction: 'approve', pendingId: item.id, pendingName: item.username }),
          button('Reject', { pendingAction: 'reject', pendingId: item.id, pendingName: item.username }, 'danger')
        );
        row.appendChild(actions);
        pendingBody.appendChild(row);
      });
      if (!registrations.length) emptyRow(pendingBody, 'No registrations are waiting for approval.', 6);
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  pendingBody?.addEventListener('click', async event => {
    const target = event.target.closest('button[data-pending-action]');
    if (!target) return;
    const id = Number(target.dataset.pendingId);
    const name = target.dataset.pendingName;
    try {
      if (target.dataset.pendingAction === 'approve') {
        if (!await confirmAction('Approve registration', `Approve "${name}"? This creates the account and emails the person that they can log in.`)) return;
        showMessage((await adminRequest('approve-registration', { pending_id: id })).message);
      } else {
        const reason = await promptAction('Reason required', `Why is the registration "${name}" being rejected? The person will receive this reason by email.`, { submitLabel: 'Reject' });
        if (!reason) return;
        showMessage((await adminRequest('reject-registration', { pending_id: id, reason })).message);
      }
    } catch (error) {
      showMessage(error.message, true);
    }
    await loadPendingRegistrations();
    refreshAccounts();
  });

  document.getElementById('refreshPending')?.addEventListener('click', loadPendingRegistrations);
  loadPendingRegistrations();

  // ---- Block requests (Super Administrator page) ----
  const blockBody = document.getElementById('superBlockRequests');

  async function loadSuperBlockRequests() {
    if (!blockBody) return;
    try {
      const { requests } = await adminRequest('block-requests');
      blockBody.replaceChildren();
      requests.forEach(item => {
        const row = document.createElement('tr');
        [`${item.first_name} ${item.last_name} (${item.username})`, item.id_number, item.requested_by, item.reason, item.status]
          .forEach(value => row.appendChild(cell(value)));
        const review = document.createElement('td');
        review.className = 'actions';
        if (item.status === 'pending') {
          review.append(
            button('Accept', { blockDecision: 'approve', blockId: item.id }),
            button('Reject', { blockDecision: 'reject', blockId: item.id }, 'danger')
          );
        } else {
          review.textContent = 'Reviewed';
        }
        row.appendChild(review);
        blockBody.appendChild(row);
      });
      if (!requests.length) emptyRow(blockBody, 'No block requests found.', 6);
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  blockBody?.addEventListener('click', async event => {
    const target = event.target.closest('button[data-block-decision]');
    if (!target) return;
    const decision = target.dataset.blockDecision;
    const label = decision === 'approve' ? 'Accept' : 'Reject';
    const reason = (await promptAction('Review note', 'Optional note for this decision:', { required: false, submitLabel: 'Save' })) || '';
    if (!await confirmAction(`${label} block request`, `${label} this block request?`)) return;
    try {
      showMessage((await adminRequest('review-block-request', { request_id: Number(target.dataset.blockId), decision, reason })).message);
    } catch (error) {
      showMessage(error.message, true);
    }
    await loadSuperBlockRequests();
    refreshAccounts();
  });

  document.getElementById('refreshSuperBlockRequests')?.addEventListener('click', loadSuperBlockRequests);
  loadSuperBlockRequests();
})();
