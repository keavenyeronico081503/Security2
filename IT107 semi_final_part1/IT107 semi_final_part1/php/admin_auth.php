<?php
require_once 'auth.php';
header('Content-Type: application/json; charset=utf-8');

function require_super_admin(): void
{
    $user = require_auth();
    if ($user['role_code'] !== 'super_admin') {
        http_response_code(403);
        echo json_encode(['status' => 'error', 'message' => 'Super Administrator access required.']);
        exit;
    }
}

