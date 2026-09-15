<?php
session_start();
require_once 'otp.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
    exit;
}

if (!isset($_SESSION['temp_user_data'])) {
    echo json_encode(['status' => 'error', 'message' => 'No registration in progress. Please register first.', 'redirect' => '../html/register.html']);
    exit;
}

if (!empty($_SESSION['temp_user_data']['email_verified'])) {
    echo json_encode(['status' => 'success', 'message' => 'Email already verified.', 'redirect' => '../html/question.html']);
    exit;
}

$otpData = $_SESSION['registration_otp'] ?? null;
if (!$otpData) {
    echo json_encode(['status' => 'error', 'message' => 'No verification code was found. Please request a new one.']);
    exit;
}

if (time() > $otpData['expires_at']) {
    unset($_SESSION['registration_otp']);
    echo json_encode(['status' => 'error', 'message' => 'Your verification code has expired. Please request a new one.']);
    exit;
}

if ($otpData['attempts'] >= REGISTRATION_OTP_MAX_ATTEMPTS) {
    unset($_SESSION['registration_otp']);
    echo json_encode(['status' => 'error', 'message' => 'Too many incorrect attempts. Please request a new code.']);
    exit;
}

$submittedCode = trim((string) ($_POST['otp'] ?? ''));
if ($submittedCode === '' || !preg_match('/^\d{6}$/', $submittedCode)) {
    echo json_encode(['status' => 'error', 'message' => 'Enter the 6-digit code sent to your email.']);
    exit;
}

if (!password_verify($submittedCode, $otpData['code_hash'])) {
    $_SESSION['registration_otp']['attempts'] = $otpData['attempts'] + 1;
    $remaining = REGISTRATION_OTP_MAX_ATTEMPTS - $_SESSION['registration_otp']['attempts'];
    if ($remaining <= 0) {
        unset($_SESSION['registration_otp']);
        echo json_encode(['status' => 'error', 'message' => 'Too many incorrect attempts. Please request a new code.']);
    } else {
        echo json_encode(['status' => 'error', 'message' => "Incorrect code. $remaining attempt(s) remaining."]);
    }
    exit;
}

$_SESSION['temp_user_data']['email_verified'] = true;
unset($_SESSION['registration_otp']);

echo json_encode(['status' => 'success', 'message' => 'Email verified successfully.', 'redirect' => '../html/question.html']);
