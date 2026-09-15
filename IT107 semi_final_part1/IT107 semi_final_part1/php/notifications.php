<?php
require_once 'auth.php';
header('Content-Type: application/json; charset=utf-8');

$user = require_auth();
$notifications = [
    'pending_users' => 0,
    'deletion_requests' => 0,
    'today_events' => 0
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

if (can('accounts.approve', (int)$user['id'])) {
    $result = $conn->query('SELECT COUNT(*) AS total FROM users WHERE username <> "Keavenyadmin1" AND account_status = "pending"');
    $notifications['pending_users'] = (int)$result->fetch_assoc()['total'];
}

if (can('accounts.delete.approve', (int)$user['id'])) {
    $result = $conn->query('SELECT COUNT(*) AS total FROM admin_delete_requests WHERE status = "pending"');
    $notifications['deletion_requests'] = (int)$result->fetch_assoc()['total'];
}

echo json_encode(['status' => 'success', 'notifications' => $notifications]);