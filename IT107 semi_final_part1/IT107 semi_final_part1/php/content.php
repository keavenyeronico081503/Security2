<?php
require_once 'auth.php';
header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? 'list-posts';
$data = request_json();

const POST_PRIORITIES = ['normal', 'important', 'urgent'];
const POST_TITLE_MAX = 200;
const POST_BODY_MAX = 5000;
// A post is visible to users from publish_at until expires_at (if any).
const POST_STATUS_SQL = 'CASE WHEN p.publish_at > NOW() THEN "scheduled" WHEN p.expires_at IS NOT NULL AND p.expires_at <= NOW() THEN "expired" ELSE "published" END';
const POST_VISIBLE_SQL = 'p.publish_at <= NOW() AND (p.expires_at IS NULL OR p.expires_at > NOW())';
const EVENT_COLUMNS = 'id, title, description, event_date, TIME_FORMAT(start_time, "%H:%i") AS start_time, TIME_FORMAT(end_time, "%H:%i") AS end_time';
const EVENT_ORDER = 'event_date ASC, start_time IS NOT NULL, start_time ASC';

// "YYYY-MM-DD HH:MM" from the composer's date input + time dropdown.
function parse_post_datetime(string $value, string $label): string
{
    $date = DateTime::createFromFormat('Y-m-d H:i', trim($value));
    if (!$date || $date->format('Y-m-d H:i') !== trim($value)) {
        throw new InvalidArgumentException("Choose a valid date and time for \"$label\".");
    }
    return $date->format('Y-m-d H:i:00');
}

// Validates the announcement fields; $existing is the current row when editing.
function post_fields(array $data, ?array $existing = null): array
{
    $title = trim((string)($data['title'] ?? ''));
    $body = trim((string)($data['body'] ?? ''));
    if ($title === '' || $body === '') throw new InvalidArgumentException('Title and message are required.');
    if (mb_strlen($title) > POST_TITLE_MAX) throw new InvalidArgumentException('Keep the title under ' . POST_TITLE_MAX . ' characters.');
    if (mb_strlen($body) > POST_BODY_MAX) throw new InvalidArgumentException('Keep the message under ' . POST_BODY_MAX . ' characters.');
    $priority = (string)($data['priority'] ?? 'normal');
    if (!in_array($priority, POST_PRIORITIES, true)) throw new InvalidArgumentException('Choose Normal, Important or Urgent.');
    $pinned = !empty($data['pinned']) ? 1 : 0;

    $now = date('Y-m-d H:i:s');
    if (($data['publish_mode'] ?? 'now') === 'schedule') {
        $publishAt = parse_post_datetime((string)($data['publish_at'] ?? ''), 'Publish on');
        $unchanged = $existing && $existing['publish_at'] === $publishAt;
        if ($publishAt <= $now && !$unchanged) throw new InvalidArgumentException('The scheduled time has already passed. Pick a later time or choose "Publish now".');
    } else {
        // Keep the original time when an already-published post is edited.
        $publishAt = $existing && $existing['publish_at'] <= $now ? $existing['publish_at'] : $now;
    }

    $expiresAt = null;
    if (trim((string)($data['expires_at'] ?? '')) !== '') {
        $expiresAt = parse_post_datetime((string)$data['expires_at'], 'Show until');
        if ($expiresAt <= $publishAt) throw new InvalidArgumentException('"Show until" must be after the publish time.');
        $unchanged = $existing && $existing['expires_at'] === $expiresAt;
        if ($expiresAt <= $now && !$unchanged) throw new InvalidArgumentException('"Show until" has already passed. Pick a later time or remove it.');
    }
    return compact('title', 'body', 'priority', 'pinned', 'publishAt', 'expiresAt');
}

function post_output(array $row): array
{
    return [
        'id' => (int)$row['id'],
        'title' => $row['title'],
        'body' => $row['body'],
        'priority' => $row['priority'],
        'pinned' => (bool)$row['is_pinned'],
        'publish_at' => $row['publish_at'],
        'expires_at' => $row['expires_at'],
        'created_at' => $row['created_at'],
        'updated_at' => $row['updated_at'],
        'status' => $row['status'] ?? 'published',
        'is_new' => (bool)($row['is_new'] ?? false),
        'author' => trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? '')) ?: 'Administrator',
    ];
}

// "HH:MM" on the half hour, or '' for none.
function parse_event_time(string $value, string $label): ?string
{
    $value = trim($value);
    if ($value === '') return null;
    if (!preg_match('/^([01]\d|2[0-3]):(00|30)$/', $value)) throw new InvalidArgumentException("Choose a valid $label.");
    return $value . ':00';
}

function event_fields(array $data): array
{
    $title = trim((string)($data['title'] ?? ''));
    $description = trim((string)($data['description'] ?? ''));
    $eventDate = trim((string)($data['event_date'] ?? ''));
    if ($title === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $eventDate)) throw new InvalidArgumentException('Title and a valid date are required.');
    if (mb_strlen($title) > POST_TITLE_MAX) throw new InvalidArgumentException('Keep the title under ' . POST_TITLE_MAX . ' characters.');
    $start = parse_event_time((string)($data['start_time'] ?? ''), 'start time');
    $end = parse_event_time((string)($data['end_time'] ?? ''), 'end time');
    if (($start === null) !== ($end === null)) throw new InvalidArgumentException('Choose both a start and an end time, or mark the event as all day.');
    if ($start !== null && $end <= $start) throw new InvalidArgumentException('The end time must be after the start time.');
    return compact('title', 'description', 'eventDate', 'start', 'end');
}

function fetch_events(string $where, string $types = '', ...$params): array
{
    global $conn;
    $stmt = $conn->prepare('SELECT ' . EVENT_COLUMNS . " FROM events WHERE $where ORDER BY " . EVENT_ORDER . ' LIMIT 200');
    if ($types !== '') $stmt->bind_param($types, ...$params);
    $stmt->execute();
    return array_map(fn($row) => ['id' => (int)$row['id']] + $row, $stmt->get_result()->fetch_all(MYSQLI_ASSOC));
}

try {
    // Users' feed: only what is live right now, pinned first.
    if ($action === 'list-posts') {
        $user = require_auth();
        $stmt = $conn->prepare('SELECT p.*, u.first_name, u.last_name,
                (viewer.posts_seen_at IS NULL OR p.publish_at > viewer.posts_seen_at) AS is_new
            FROM posts p LEFT JOIN users u ON u.id = p.created_by LEFT JOIN users viewer ON viewer.id = ?
            WHERE ' . POST_VISIBLE_SQL . ' ORDER BY p.is_pinned DESC, p.publish_at DESC LIMIT 20');
        $stmt->bind_param('i', $user['id']);
        $stmt->execute();
        echo json_encode(['status' => 'success', 'posts' => array_map('post_output', $stmt->get_result()->fetch_all(MYSQLI_ASSOC))]);
        exit;
    }

    // Management list: everything, with its status; scheduled ones first.
    if ($action === 'manage-posts') {
        require_permission('content.manage');
        $result = $conn->query('SELECT p.*, u.first_name, u.last_name, ' . POST_STATUS_SQL . ' AS status
            FROM posts p LEFT JOIN users u ON u.id = p.created_by
            ORDER BY FIELD(' . POST_STATUS_SQL . ', "scheduled", "published", "expired"), p.is_pinned DESC, p.publish_at DESC LIMIT 100');
        echo json_encode(['status' => 'success', 'posts' => array_map('post_output', $result->fetch_all(MYSQLI_ASSOC))]);
        exit;
    }

    if ($action === 'mark-posts-seen') {
        $user = require_auth();
        $stmt = $conn->prepare('UPDATE users SET posts_seen_at = NOW() WHERE id = ?');
        $stmt->bind_param('i', $user['id']);
        $stmt->execute();
        echo json_encode(['status' => 'success']);
        exit;
    }

    if ($action === 'create-post') {
        $user = require_permission('content.manage');
        $f = post_fields($data);
        // The emergency account has no users row (id 0), so its posts have no author id.
        $authorId = (int)$user['id'] > 0 ? (int)$user['id'] : null;
        $stmt = $conn->prepare('INSERT INTO posts (title, body, publish_at, expires_at, priority, is_pinned, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->bind_param('sssssii', $f['title'], $f['body'], $f['publishAt'], $f['expiresAt'], $f['priority'], $f['pinned'], $authorId);
        if (!$stmt->execute()) throw new RuntimeException('Could not create the announcement: ' . $conn->error);
        audit('content.post.create', null, ['post_id' => $conn->insert_id, 'title' => $f['title'], 'priority' => $f['priority'], 'pinned' => (bool)$f['pinned'], 'publish_at' => $f['publishAt'], 'expires_at' => $f['expiresAt']]);
        $scheduled = $f['publishAt'] > date('Y-m-d H:i:s');
        echo json_encode(['status' => 'success', 'message' => $scheduled ? 'Announcement scheduled for ' . date('M j, g:i A', strtotime($f['publishAt'])) . '.' : 'Announcement published.']);
        exit;
    }

    if ($action === 'update-post') {
        require_permission('content.manage');
        $id = (int)($data['id'] ?? 0);
        $stmt = $conn->prepare('SELECT publish_at, expires_at FROM posts WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $existing = $stmt->get_result()->fetch_assoc();
        if (!$existing) throw new RuntimeException('That announcement no longer exists.');
        $f = post_fields($data, $existing);
        $stmt = $conn->prepare('UPDATE posts SET title = ?, body = ?, publish_at = ?, expires_at = ?, priority = ?, is_pinned = ?, updated_at = NOW() WHERE id = ?');
        $stmt->bind_param('sssssii', $f['title'], $f['body'], $f['publishAt'], $f['expiresAt'], $f['priority'], $f['pinned'], $id);
        if (!$stmt->execute()) throw new RuntimeException('The announcement was not updated: ' . $conn->error);
        audit('content.post.update', null, ['post_id' => $id, 'priority' => $f['priority'], 'pinned' => (bool)$f['pinned'], 'publish_at' => $f['publishAt'], 'expires_at' => $f['expiresAt']]);
        echo json_encode(['status' => 'success', 'message' => 'Announcement updated.']);
        exit;
    }

    if ($action === 'delete-post') {
        require_permission('content.manage');
        $id = (int)($data['id'] ?? 0);
        $stmt = $conn->prepare('DELETE FROM posts WHERE id = ?');
        $stmt->bind_param('i', $id);
        if (!$stmt->execute() || $stmt->affected_rows < 1) throw new RuntimeException('The announcement was not deleted.');
        audit('content.post.delete', null, ['post_id' => $id]);
        echo json_encode(['status' => 'success', 'message' => 'Announcement deleted.']);
        exit;
    }

    if ($action === 'list-events') {
        require_auth();
        $month = (int)($_GET['month'] ?? date('n'));
        $year = (int)($_GET['year'] ?? date('Y'));
        if ($month < 1 || $month > 12) $month = (int)date('n');
        echo json_encode(['status' => 'success', 'events' => fetch_events('YEAR(event_date) = ? AND MONTH(event_date) = ?', 'ii', $year, $month)]);
        exit;
    }

    // Management list: the last 30 days and everything after, not just this month.
    if ($action === 'manage-events') {
        require_permission('content.manage');
        echo json_encode(['status' => 'success', 'events' => fetch_events('event_date >= CURDATE() - INTERVAL 30 DAY')]);
        exit;
    }

    if ($action === 'upcoming-events') {
        require_auth();
        $days = min(60, max(1, (int)($_GET['days'] ?? 30)));
        echo json_encode(['status' => 'success', 'events' => array_slice(fetch_events('event_date >= CURDATE() AND event_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)', 'i', $days), 0, 20)]);
        exit;
    }

    if ($action === 'mark-notifications-seen') {
        $user = require_auth();
        $stmt = $conn->prepare('UPDATE users SET notifications_seen_at = NOW() WHERE id = ?');
        $stmt->bind_param('i', $user['id']);
        $stmt->execute();
        echo json_encode(['status' => 'success']);
        exit;
    }

    if ($action === 'today') {
        require_auth();
        echo json_encode(['status' => 'success', 'events' => fetch_events('event_date = CURDATE()')]);
        exit;
    }

    if ($action === 'create-event') {
        $user = require_permission('content.manage');
        $f = event_fields($data);
        $authorId = (int)$user['id'] > 0 ? (int)$user['id'] : null;
        $stmt = $conn->prepare('INSERT INTO events (title, description, event_date, start_time, end_time, created_by) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->bind_param('sssssi', $f['title'], $f['description'], $f['eventDate'], $f['start'], $f['end'], $authorId);
        if (!$stmt->execute()) throw new RuntimeException('Could not create the event: ' . $conn->error);
        audit('content.event.create', null, ['event_id' => $conn->insert_id, 'title' => $f['title'], 'event_date' => $f['eventDate'], 'start_time' => $f['start'], 'end_time' => $f['end']]);
        echo json_encode(['status' => 'success', 'message' => 'Event added.']);
        exit;
    }

    if ($action === 'update-event') {
        require_permission('content.manage');
        $id = (int)($data['id'] ?? 0);
        $f = event_fields($data);
        $stmt = $conn->prepare('UPDATE events SET title = ?, description = ?, event_date = ?, start_time = ?, end_time = ? WHERE id = ?');
        $stmt->bind_param('sssssi', $f['title'], $f['description'], $f['eventDate'], $f['start'], $f['end'], $id);
        if (!$stmt->execute()) throw new RuntimeException('The event was not updated: ' . $conn->error);
        audit('content.event.update', null, ['event_id' => $id, 'event_date' => $f['eventDate'], 'start_time' => $f['start'], 'end_time' => $f['end']]);
        echo json_encode(['status' => 'success', 'message' => 'Event updated.']);
        exit;
    }

    if ($action === 'delete-event') {
        require_permission('content.manage');
        $id = (int)($data['id'] ?? 0);
        $stmt = $conn->prepare('DELETE FROM events WHERE id = ?');
        $stmt->bind_param('i', $id);
        if (!$stmt->execute() || $stmt->affected_rows < 1) throw new RuntimeException('The event was not deleted.');
        audit('content.event.delete', null, ['event_id' => $id]);
        echo json_encode(['status' => 'success', 'message' => 'Event deleted.']);
        exit;
    }

    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Unknown action.']);
} catch (Throwable $error) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => $error->getMessage()]);
}
