<?php
require_once 'auth.php';
header('Content-Type: application/json; charset=utf-8');

$user = require_auth();
$notifications = [
    'pending_users' => 0,
    'block_requests' => 0,
    'deletion_requests' => 0,
    'today_events' => 0,
    'new_posts' => 0
];

$seenStmt = $conn->prepare('SELECT notifications_seen_at FROM users WHERE id = ?');
$seenStmt->bind_param('i', $user['id']);
$seenStmt->execute();
$seenAt = $seenStmt->get_result()->fetch_assoc()['notifications_seen_at'] ?? null;

if ($seenAt) {
    $eventResult = $conn->prepare('SELECT COUNT(*) AS total FROM events WHERE event_date >= CURDATE() AND event_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND created_at > ?');
    $eventResult->bind_param('s', $seenAt);
    $eventResult->execute();
    $notifications['today_events'] = (int)$eventResult->get_result()->fetch_assoc()['total'];
} else {
    $eventResult = $conn->query('SELECT COUNT(*) AS total FROM events WHERE event_date >= CURDATE() AND event_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)');
    $notifications['today_events'] = (int)$eventResult->fetch_assoc()['total'];
}

// Announcements that went live since the user last opened their feed.
$postStmt = $conn->prepare('SELECT COUNT(*) AS total FROM posts p LEFT JOIN users viewer ON viewer.id = ? WHERE p.publish_at <= NOW() AND (p.expires_at IS NULL OR p.expires_at > NOW()) AND (viewer.posts_seen_at IS NULL OR p.publish_at > viewer.posts_seen_at)');
$postStmt->bind_param('i', $user['id']);
$postStmt->execute();
$notifications['new_posts'] = (int)$postStmt->get_result()->fetch_assoc()['total'];

if (can('accounts.approve', (int)$user['id'])) {
    $result = $conn->query('SELECT COUNT(*) AS total FROM pending_registrations');
    $notifications['pending_users'] = (int)$result->fetch_assoc()['total'];
}

if (can('accounts.block.review', (int)$user['id'])) {
    $result = $conn->query('SELECT COUNT(*) AS total FROM admin_block_requests WHERE status = "pending"');
    $notifications['block_requests'] = (int)$result->fetch_assoc()['total'];
}

if (can('accounts.delete.approve', (int)$user['id'])) {
    $result = $conn->query('SELECT COUNT(*) AS total FROM admin_delete_requests WHERE status = "pending"');
    $notifications['deletion_requests'] = (int)$result->fetch_assoc()['total'];
}

echo json_encode(['status' => 'success', 'notifications' => $notifications]);