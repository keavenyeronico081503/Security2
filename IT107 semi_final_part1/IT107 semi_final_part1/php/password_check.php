<?php
// Real-time password check for signup, onboarding and change-password forms.
// Only says whether the password appears in known data breaches; it never
// reveals whether another account uses it.
require_once 'db.php';
require_once 'rate_limit.php';
require_once 'password_policy.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
    exit;
}

enforce_rate_limit('password_check', 30, 60);

$problem = password_problem((string)($_POST['password'] ?? ''));
echo json_encode($problem === null
    ? ['status' => 'ok']
    : ['status' => 'breached', 'message' => $problem]);
