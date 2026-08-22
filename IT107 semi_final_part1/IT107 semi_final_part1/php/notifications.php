<?php
require_once 'auth.php';
header('Content-Type: application/json; charset=utf-8');

$user = require_auth();
$notifications = [
    'pending_users' => 0,
    'deletion_requests' => 0
];

if (can('accounts.approve', (int)$user['id'])) {
    $result = $conn->query('SELECT COUNT(*) AS total FROM users WHERE account_status = "pending"');
    $notifications['pending_users'] = (int)$result->fetch_assoc()['total'];
}

if (can('accounts.delete.approve', (int)$user['id'])) {
    $result = $conn->query('SELECT COUNT(*) AS total FROM admin_delete_requests WHERE status = "pending"');
    $notifications['deletion_requests'] = (int)$result->fetch_assoc()['total'];
}

echo json_encode(['status' => 'success', 'notifications' => $notifications]);