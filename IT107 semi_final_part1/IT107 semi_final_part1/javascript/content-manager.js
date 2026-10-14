// Announcements & events management, shared by admin.html and super-admin.html.
// Needs post-card.js (cards, time helpers) and the page's confirmAction().
(function () {
  const api = '../php/content.php';
  const $ = id => document.getElementById(id);
  if (!$('postForm') && !$('eventForm')) return;
  const { build, relativeTime, formatWhen, timeLabel, eventTimeRange, timeOptions, toDate } = window.PostCard;
  let posts = [];
  let events = [];
  let editingPost = null;
  let editingEvent = null;

  async function call(action, body) {
    const options = body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    const response = await fetch(`${api}?action=${action}`, options);
    const data = await response.json();
    if (!response.ok || data.status === 'error') throw new Error(data.message || 'Request failed.');
    return data;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function say(target, text, error = false) {
    target.textContent = text || '';
    target.className = `cm-message${text ? (error ? ' is-error' : ' is-ok') : ''}`;
  }

  const pad = n => String(n).padStart(2, '0');
  const isoDate = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  // The next half hour after now, so a fresh schedule defaults to something valid.
  function nextSlot(addMinutes = 0) {
    const date = new Date(Date.now() + addMinutes * 60000);
    date.setSeconds(0, 0);
    date.setMinutes(date.getMinutes() < 30 ? 30 : 60);
    return date;
  }

  function fillTimes(select, { after = null, placeholder = null } = {}) {
    const current = select.value;
    select.replaceChildren();
    if (placeholder) select.appendChild(new Option(placeholder, ''));
    timeOptions().filter(option => !after || option.value > after).forEach(option => select.appendChild(new Option(option.label, option.value)));
    if (current && [...select.options].some(option => option.value === current)) select.value = current;
  }

  // A stored value that isn't on the half hour (e.g. created by an older version) still shows.
  function setTime(select, hhmm) {
    if (hhmm && ![...select.options].some(option => option.value === hhmm)) select.appendChild(new Option(timeLabel(hhmm), hhmm));
    select.value = hhmm || '';
  }

  // ---------------- Announcements ----------------
  const postForm = $('postForm');
  const radio = name => postForm.querySelector(`input[name="${name}"]:checked`)?.value;

  function postDraft() {
    const schedule = radio('postPublishMode') === 'schedule';
    const noEnd = $('postNoEnd').checked;
    return {
      title: $('postTitle').value.trim(),
      body: $('postBody').value.trim(),
      priority: radio('postPriority') || 'normal',
      pinned: $('postPinned').checked,
      publish_mode: schedule ? 'schedule' : 'now',
      publish_at: schedule ? `${$('postPublishDate').value} ${$('postPublishTime').value}` : '',
      expires_at: noEnd ? '' : `${$('postExpireDate').value} ${$('postExpireTime').value}`,
    };
  }

  function updatePostForm() {
    const draft = postDraft();
    const schedule = draft.publish_mode === 'schedule';
    $('postScheduleFields').hidden = !schedule;
    $('postExpiryFields').hidden = $('postNoEnd').checked;
    postForm.querySelectorAll('[data-count-for]').forEach(counter => {
      const input = $(counter.dataset.countFor);
      counter.textContent = `${input.value.length}/${input.maxLength}`;
    });
    const publishedAlready = editingPost && editingPost.status !== 'scheduled';
    postForm.querySelector('input[name="postPublishMode"][value="now"] + span').lastChild.textContent = publishedAlready ? ' Keep published' : ' Now';

    // Plain-language summary of when it shows.
    const start = schedule ? toDate(`${draft.publish_at}:00`) : null;
    const end = draft.expires_at ? toDate(`${draft.expires_at}:00`) : null;
    const startText = schedule ? `Goes live ${formatWhen(draft.publish_at)}` : (publishedAlready ? 'Stays published' : 'Goes live right away');
    const endText = end ? `hides after ${formatWhen(draft.expires_at)}` : 'stays up until you remove it';
    let problem = '';
    if (schedule && start && start <= new Date() && !(editingPost && editingPost.publish_at.startsWith(draft.publish_at))) problem = 'That time has already passed.';
    else if (end && end <= (start || new Date())) problem = '"Show until" must be after the publish time.';
    const summary = $('postSummary');
    summary.textContent = problem || `${startText} · ${endText}.`;
    summary.classList.toggle('is-error', Boolean(problem));
    $('postSubmit').lastChild.textContent = editingPost ? ' Save changes' : (schedule ? ' Schedule' : ' Publish now');

    // Live preview, exactly as users will see it.
    const preview = $('postPreview');
    preview.replaceChildren(build({ ...draft, title: draft.title || 'Your title appears here', body: draft.body || 'Your message appears here.', author: 'You' },
      { note: schedule ? `Scheduled · ${formatWhen(draft.publish_at)}` : 'just now' }));
  }

  function resetPostForm() {
    editingPost = null;
    postForm.reset();
    $('postEditing').hidden = true;
    const slot = nextSlot(60);
    $('postPublishDate').value = isoDate(slot);
    $('postPublishDate').min = isoDate(new Date());
    setTime($('postPublishTime'), `${pad(slot.getHours())}:${pad(slot.getMinutes())}`);
    const end = new Date(slot.getTime() + 7 * 86400000);
    $('postExpireDate').value = isoDate(end);
    $('postExpireDate').min = isoDate(new Date());
    setTime($('postExpireTime'), '17:00');
    updatePostForm();
  }

  function editPost(post) {
    editingPost = post;
    $('postEditing').hidden = false;
    $('postTitle').value = post.title;
    $('postBody').value = post.body;
    postForm.querySelector(`input[name="postPriority"][value="${post.priority}"]`).checked = true;
    $('postPinned').checked = post.pinned;
    const scheduled = post.status === 'scheduled';
    postForm.querySelector(`input[name="postPublishMode"][value="${scheduled ? 'schedule' : 'now'}"]`).checked = true;
    if (scheduled) { $('postPublishDate').value = post.publish_at.slice(0, 10); setTime($('postPublishTime'), post.publish_at.slice(11, 16)); }
    $('postNoEnd').checked = !post.expires_at;
    if (post.expires_at) { $('postExpireDate').value = post.expires_at.slice(0, 10); setTime($('postExpireTime'), post.expires_at.slice(11, 16)); }
    say($('postMessage'), '');
    updatePostForm();
    postForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('postTitle').focus({ preventScroll: true });
  }

  const STATUS_TEXT = { scheduled: 'Scheduled', published: 'Published', expired: 'Expired' };

  function renderPosts() {
    const list = $('postsList');
    list.replaceChildren();
    if (!posts.length) { list.appendChild(el('p', 'cm-empty', 'No announcements yet. Write the first one above.')); return; }
    posts.forEach(post => {
      const item = el('div', `cm-item status-${post.status}`);
      const main = el('div', 'cm-item-main');
      const chips = el('div', 'cm-chips');
      chips.appendChild(el('span', `cm-chip chip-${post.status}`, STATUS_TEXT[post.status]));
      if (post.pinned) chips.appendChild(el('span', 'cm-chip chip-pinned', '📌 Pinned'));
      if (post.priority !== 'normal') chips.appendChild(el('span', `cm-chip chip-${post.priority}`, post.priority === 'urgent' ? 'Urgent' : 'Important'));
      main.append(chips, el('strong', 'cm-item-title', post.title), el('p', 'cm-item-body', post.body));
      const when = post.status === 'scheduled' ? `Goes live ${relativeTime(post.publish_at)} (${formatWhen(post.publish_at)})`
        : post.status === 'expired' ? `Expired ${relativeTime(post.expires_at)}` : `Published ${relativeTime(post.publish_at)}`;
      const extra = [post.author, post.status === 'published' && post.expires_at ? `hides ${formatWhen(post.expires_at)}` : '', post.updated_at ? 'Edited' : ''].filter(Boolean);
      main.appendChild(el('small', 'cm-item-meta', [when, ...extra].join(' · ')));
      const actions = el('div', 'cm-item-actions');
      const edit = el('button', 'secondary', 'Edit'); edit.type = 'button'; edit.addEventListener('click', () => editPost(post));
      const remove = el('button', 'danger', 'Delete'); remove.type = 'button'; remove.addEventListener('click', () => deletePost(post));
      actions.append(edit, remove);
      item.append(main, actions);
      list.appendChild(item);
    });
  }

  async function loadPosts() {
    try { posts = (await call('manage-posts')).posts; renderPosts(); }
    catch (error) { say($('postMessage'), error.message, true); }
  }

  async function deletePost(post) {
    if (!await confirmAction('Delete announcement', `Delete "${post.title}"? Users will no longer see it. This cannot be undone.`)) return;
    try {
      const result = await call('delete-post', { id: post.id });
      if (editingPost?.id === post.id) resetPostForm();
      say($('postMessage'), result.message);
      await loadPosts();
    } catch (error) { say($('postMessage'), error.message, true); }
  }

  postForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const draft = postDraft();
    if (!draft.title || !draft.body) { say($('postMessage'), 'Add a title and a message first.', true); return; }
    if ($('postSummary').classList.contains('is-error')) { say($('postMessage'), $('postSummary').textContent, true); return; }
    const submit = $('postSubmit');
    submit.disabled = true;
    try {
      const result = editingPost ? await call('update-post', { ...draft, id: editingPost.id }) : await call('create-post', draft);
      resetPostForm();
      say($('postMessage'), result.message);
      await loadPosts();
    } catch (error) { say($('postMessage'), error.message, true); }
    submit.disabled = false;
  });

  // ---------------- Events ----------------
  const eventForm = $('eventForm');

  function updateEventForm() {
    const allDay = $('eventAllDay').checked;
    $('eventTimes').hidden = allDay;
    fillTimes($('eventEnd'), { after: $('eventStart').value || null });
    const counter = eventForm.querySelector('[data-count-for]');
    if (counter) counter.textContent = `${$('eventTitle').value.length}/${$('eventTitle').maxLength}`;
    $('eventSubmit').lastChild.textContent = editingEvent ? ' Save changes' : ' Add event';
  }

  function resetEventForm() {
    editingEvent = null;
    eventForm.reset();
    $('eventEditing').hidden = true;
    $('eventDate').value = isoDate(new Date());
    $('eventAllDay').checked = false;
    setTime($('eventStart'), '13:00');
    updateEventForm();
    setTime($('eventEnd'), '15:00');
  }

  function editEvent(eventItem) {
    editingEvent = eventItem;
    $('eventEditing').hidden = false;
    $('eventTitle').value = eventItem.title;
    $('eventDate').value = eventItem.event_date;
    $('eventDescription').value = eventItem.description || '';
    $('eventAllDay').checked = !eventItem.start_time;
    if (eventItem.start_time) setTime($('eventStart'), eventItem.start_time);
    updateEventForm();
    if (eventItem.end_time) setTime($('eventEnd'), eventItem.end_time);
    say($('eventMessage'), '');
    eventForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('eventTitle').focus({ preventScroll: true });
  }

  function renderEvents() {
    const list = $('eventsList');
    list.replaceChildren();
    if (!events.length) { list.appendChild(el('p', 'cm-empty', 'No upcoming events. Add one above.')); return; }
    const today = isoDate(new Date());
    events.forEach(eventItem => {
      const date = toDate(`${eventItem.event_date} 00:00:00`);
      const past = eventItem.event_date < today;
      const item = el('div', `cm-item cm-event${past ? ' is-past' : ''}`);
      const badge = el('div', 'cm-date');
      badge.append(el('span', '', date.toLocaleDateString('en-US', { month: 'short' })), el('strong', '', String(date.getDate())));
      const main = el('div', 'cm-item-main');
      const chips = el('div', 'cm-chips');
      chips.appendChild(el('span', 'event-time', `🕒 ${eventTimeRange(eventItem)}`));
      if (eventItem.event_date === today) chips.appendChild(el('span', 'cm-chip chip-published', 'Today'));
      if (past) chips.appendChild(el('span', 'cm-chip chip-expired', 'Past'));
      main.append(el('strong', 'cm-item-title', eventItem.title), chips);
      if (eventItem.description) main.appendChild(el('p', 'cm-item-body', eventItem.description));
      main.appendChild(el('small', 'cm-item-meta', date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })));
      const actions = el('div', 'cm-item-actions');
      const edit = el('button', 'secondary', 'Edit'); edit.type = 'button'; edit.addEventListener('click', () => editEvent(eventItem));
      const remove = el('button', 'danger', 'Delete'); remove.type = 'button'; remove.addEventListener('click', () => deleteEvent(eventItem));
      actions.append(edit, remove);
      item.append(badge, main, actions);
      list.appendChild(item);
    });
  }

  async function loadEvents() {
    try { events = (await call('manage-events')).events; renderEvents(); }
    catch (error) { say($('eventMessage'), error.message, true); }
  }

  async function deleteEvent(eventItem) {
    if (!await confirmAction('Delete event', `Delete "${eventItem.title}" on ${eventItem.event_date}? It will disappear from everyone's calendar.`)) return;
    try {
      const result = await call('delete-event', { id: eventItem.id });
      if (editingEvent?.id === eventItem.id) resetEventForm();
      say($('eventMessage'), result.message);
      await loadEvents();
    } catch (error) { say($('eventMessage'), error.message, true); }
  }

  eventForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const allDay = $('eventAllDay').checked;
    const body = {
      title: $('eventTitle').value.trim(), event_date: $('eventDate').value, description: $('eventDescription').value.trim(),
      start_time: allDay ? '' : $('eventStart').value, end_time: allDay ? '' : $('eventEnd').value,
    };
    if (!body.title || !body.event_date) { say($('eventMessage'), 'Add a title and a date first.', true); return; }
    if (!allDay && (!body.start_time || !body.end_time)) { say($('eventMessage'), 'Choose a start and end time, or switch on "All day".', true); return; }
    const submit = $('eventSubmit');
    submit.disabled = true;
    try {
      const result = editingEvent ? await call('update-event', { ...body, id: editingEvent.id }) : await call('create-event', body);
      resetEventForm();
      say($('eventMessage'), result.message);
      await loadEvents();
    } catch (error) { say($('eventMessage'), error.message, true); }
    submit.disabled = false;
  });

  // ---------------- Wiring ----------------
  if (postForm) {
    [$('postPublishTime'), $('postExpireTime')].forEach(select => fillTimes(select));
    postForm.addEventListener('input', updatePostForm);
    postForm.addEventListener('change', updatePostForm);
    $('postCancelEdit').addEventListener('click', () => { resetPostForm(); say($('postMessage'), ''); });
    resetPostForm();
  }
  if (eventForm) {
    fillTimes($('eventStart'));
    eventForm.addEventListener('change', event => { if (event.target.id !== 'eventEnd') updateEventForm(); });
    $('eventTitle').addEventListener('input', updateEventForm);
    $('eventCancelEdit').addEventListener('click', () => { resetEventForm(); say($('eventMessage'), ''); });
    resetEventForm();
  }

  // Super Admins always manage content; on the Admin page admin.js calls load()
  // once it knows the admin has the content permission.
  window.ContentManager = { load: () => Promise.all([loadPosts(), loadEvents()]) };
  if (document.body.classList.contains('app-superadmin')) window.ContentManager.load();
})();
