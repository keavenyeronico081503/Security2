<?php
require_once 'auth.php';
header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? 'list-posts';
$data = request_json();

try {
    if ($action === 'list-posts') {
        require_auth();
        $stmt = $conn->prepare('SELECT p.id, p.title, p.body, p.created_at, u.first_name, u.last_name FROM posts p LEFT JOIN users u ON u.id = p.created_by ORDER BY p.created_at DESC LIMIT 20');
        $stmt->execute();
        $result = $stmt->get_result();
        $posts = [];
        while ($row = $result->fetch_assoc()) {
            $posts[] = [
                'id' => (int)$row['id'],
                'title' => $row['title'],
                'body' => $row['body'],
                'created_at' => $row['created_at'],
                'author' => trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? '')) ?: 'Administrator'
            ];
        }
        echo json_encode(['status' => 'success', 'posts' => $posts]);
        exit;
    }

    if ($action === 'create-post') {
        $user = require_permission('content.manage');
        $title = trim((string)($data['title'] ?? ''));
        $body = trim((string)($data['body'] ?? ''));
        if ($title === '' || $body === '') {
            throw new InvalidArgumentException('Title and body are required.');
        }
        $stmt = $conn->prepare('INSERT INTO posts (title, body, created_by) VALUES (?, ?, ?)');
        $stmt->bind_param('ssi', $title, $body, $user['id']);
        if (!$stmt->execute()) {
            throw new RuntimeException('Could not create post: ' . $conn->error);
        }
        audit('content.post.create', null, ['post_id' => $conn->insert_id, 'title' => $title]);
        echo json_encode(['status' => 'success', 'message' => 'Post published.']);
        exit;
    }

    if ($action === 'update-post') {
        require_permission('content.manage');
        $id = (int)($data['id'] ?? 0);
        $title = trim((string)($data['title'] ?? ''));
        $body = trim((string)($data['body'] ?? ''));
        if ($title === '' || $body === '') {
            throw new InvalidArgumentException('Title and body are required.');
        }
        $stmt = $conn->prepare('UPDATE posts SET title = ?, body = ? WHERE id = ?');
        $stmt->bind_param('ssi', $title, $body, $id);
        if (!$stmt->execute()) {
            throw new RuntimeException('Post was not updated: ' . $conn->error);
        }
        audit('content.post.update', null, ['post_id' => $id]);
        echo json_encode(['status' => 'success', 'message' => 'Post updated.']);
        exit;
    }

    if ($action === 'delete-post') {
        require_permission('content.manage');
        $id = (int)($data['id'] ?? 0);
        $stmt = $conn->prepare('DELETE FROM posts WHERE id = ?');
        $stmt->bind_param('i', $id);
        if (!$stmt->execute() || $stmt->affected_rows < 1) {
            throw new RuntimeException('Post was not deleted.');
        }
        audit('content.post.delete', null, ['post_id' => $id]);
        echo json_encode(['status' => 'success', 'message' => 'Post deleted.']);
        exit;
    }

    if ($action === 'list-events') {
        require_auth();
        $month = (int)($_GET['month'] ?? date('n'));
        $year = (int)($_GET['year'] ?? date('Y'));
        if ($month < 1 || $month > 12) {
            $month = (int)date('n');
        }
        $stmt = $conn->prepare('SELECT id, title, description, event_date FROM events WHERE YEAR(event_date) = ? AND MONTH(event_date) = ? ORDER BY event_date ASC');
        $stmt->bind_param('ii', $year, $month);
        $stmt->execute();
        $result = $stmt->get_result();
        $events = [];
        while ($row = $result->fetch_assoc()) {
            $events[] = [
                'id' => (int)$row['id'],
                'title' => $row['title'],
                'description' => $row['description'],
                'event_date' => $row['event_date']
            ];
        }
        echo json_encode(['status' => 'success', 'events' => $events]);
        exit;
    }

    if ($action === 'upcoming-events') {
        require_auth();
        $days = min(60, max(1, (int)($_GET['days'] ?? 30)));
        $stmt = $conn->prepare('SELECT id, title, description, event_date FROM events WHERE event_date >= CURDATE() AND event_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY) ORDER BY event_date ASC LIMIT 20');
        $stmt->bind_param('i', $days);
        $stmt->execute();
        $result = $stmt->get_result();
        $events = [];
        while ($row = $result->fetch_assoc()) {
            $events[] = [
                'id' => (int)$row['id'],
                'title' => $row['title'],
                'description' => $row['description'],
                'event_date' => $row['event_date']
            ];
        }
        echo json_encode(['status' => 'success', 'events' => $events]);
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
        $stmt = $conn->prepare('SELECT id, title, description, event_date FROM events WHERE event_date = CURDATE() ORDER BY id ASC');
        $stmt->execute();
        $result = $stmt->get_result();
        $events = [];
        while ($row = $result->fetch_assoc()) {
            $events[] = [
                'id' => (int)$row['id'],
                'title' => $row['title'],
                'description' => $row['description'],
                'event_date' => $row['event_date']
            ];
        }
        echo json_encode(['status' => 'success', 'events' => $events]);
        exit;
    }

    if ($action === 'create-event') {
        $user = require_permission('content.manage');
        $title = trim((string)($data['title'] ?? ''));
        $description = trim((string)($data['description'] ?? ''));
        $eventDate = trim((string)($data['event_date'] ?? ''));
        if ($title === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $eventDate)) {
            throw new InvalidArgumentException('Title and a valid date are required.');
        }
        $stmt = $conn->prepare('INSERT INTO events (title, description, event_date, created_by) VALUES (?, ?, ?, ?)');
        $stmt->bind_param('sssi', $title, $description, $eventDate, $user['id']);
        if (!$stmt->execute()) {
            throw new RuntimeException('Could not create event: ' . $conn->error);
        }
        audit('content.event.create', null, ['event_id' => $conn->insert_id, 'title' => $title, 'event_date' => $eventDate]);
        echo json_encode(['status' => 'success', 'message' => 'Event added.']);
        exit;
    }

    if ($action === 'update-event') {
        require_permission('content.manage');
        $id = (int)($data['id'] ?? 0);
        $title = trim((string)($data['title'] ?? ''));
        $description = trim((string)($data['description'] ?? ''));
        $eventDate = trim((string)($data['event_date'] ?? ''));
        if ($title === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $eventDate)) {
            throw new InvalidArgumentException('Title and a valid date are required.');
        }
        $stmt = $conn->prepare('UPDATE events SET title = ?, description = ?, event_date = ? WHERE id = ?');
        $stmt->bind_param('sssi', $title, $description, $eventDate, $id);
        if (!$stmt->execute()) {
            throw new RuntimeException('Event was not updated: ' . $conn->error);
        }
        audit('content.event.update', null, ['event_id' => $id]);
        echo json_encode(['status' => 'success', 'message' => 'Event updated.']);
        exit;
    }

    if ($action === 'delete-event') {
        require_permission('content.manage');
        $id = (int)($data['id'] ?? 0);
        $stmt = $conn->prepare('DELETE FROM events WHERE id = ?');
        $stmt->bind_param('i', $id);
        if (!$stmt->execute() || $stmt->affected_rows < 1) {
            throw new RuntimeException('Event was not deleted.');
        }
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
