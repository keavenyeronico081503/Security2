// Shared look for announcements and event times: the user dashboard feed and the
// Admin / Super Admin composer preview both build cards here, so they always match.
(function () {
  const PRIORITY_LABELS = { important: 'Important', urgent: 'Urgent' };

  // Server times are "YYYY-MM-DD HH:MM:SS" in Philippine time, same as the browser's clock.
  const toDate = value => (value ? new Date(String(value).replace(' ', 'T')) : null);

  function relativeTime(value, now = new Date()) {
    const date = toDate(value);
    if (!date || Number.isNaN(date.getTime())) return '';
    const seconds = Math.round((date - now) / 1000);
    if (Math.abs(seconds) < 60) return 'just now';
    const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    for (const [unit, size] of [['day', 86400], ['hour', 3600], ['minute', 60]]) {
      if (Math.abs(seconds) >= size || unit === 'minute') return format.format(Math.round(seconds / size), unit);
    }
    return '';
  }

  function formatWhen(value) {
    const date = toDate(value);
    if (!date) return '';
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  // "13:30" -> "1:30 PM"
  function timeLabel(hhmm) {
    if (!hhmm) return '';
    const [h, m] = hhmm.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }

  function eventTimeRange(eventItem) {
    return eventItem.start_time ? `${timeLabel(eventItem.start_time)} – ${timeLabel(eventItem.end_time)}` : 'All day';
  }

  // Every half hour of the day, for the time dropdowns.
  function timeOptions() {
    return Array.from({ length: 48 }, (_, i) => {
      const value = `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`;
      return { value, label: timeLabel(value) };
    });
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // post: {title, body, priority, pinned, is_new, author, publish_at, updated_at}
  // options.note replaces the time line (used by the preview, e.g. "Scheduled for …").
  function build(post, options = {}) {
    const card = el('article', `post-card priority-${post.priority || 'normal'}${post.pinned ? ' is-pinned' : ''}`);
    const tags = el('div', 'post-tags');
    if (post.pinned) tags.appendChild(el('span', 'post-tag tag-pinned', '📌 Pinned'));
    if (PRIORITY_LABELS[post.priority]) tags.appendChild(el('span', `post-tag tag-${post.priority}`, PRIORITY_LABELS[post.priority]));
    if (post.is_new) tags.appendChild(el('span', 'post-tag tag-new', 'New'));
    if (tags.childElementCount) card.appendChild(tags);
    card.appendChild(el('h3', 'post-title', post.title || 'Untitled announcement'));
    card.appendChild(el('p', 'post-body', post.body || ''));
    const meta = el('p', 'post-meta');
    const when = options.note || [relativeTime(post.publish_at), post.updated_at ? 'Edited' : ''].filter(Boolean).join(' · ');
    meta.textContent = [post.author || 'Administrator', when].filter(Boolean).join(' · ');
    card.appendChild(meta);
    return card;
  }

  window.PostCard = { build, relativeTime, formatWhen, timeLabel, eventTimeRange, timeOptions, toDate };
})();
