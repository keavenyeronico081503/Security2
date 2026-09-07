<?php
require_once 'auth.php';
header('Content-Type: application/json; charset=utf-8');

$user = require_auth();
$module = trim((string)($_POST['module'] ?? ''));
if ($module === '' || !preg_match('/^[a-z0-9._-]{1,80}$/i', $module)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid module.']);
    exit;
}

audit('module.open', null, ['module' => $module]);
echo json_encode(['status' => 'success']);
