<?php
session_start();
require_once 'mailer.php';
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

$existing = $_SESSION['registration_otp'] ?? null;
if ($existing) {
    $waitRemaining = $existing['last_sent_at'] + REGISTRATION_OTP_RESEND_COOLDOWN_SECONDS - time();
    if ($waitRemaining > 0) {
        echo json_encode(['status' => 'error', 'message' => "Please wait $waitRemaining second(s) before requesting another code.", 'retry_after' => $waitRemaining]);
        exit;
    }
}

$email = (string) $_SESSION['temp_user_data']['email'];
$name = trim((string) ($_SESSION['temp_user_data']['fname'] ?? '') . ' ' . (string) ($_SESSION['temp_user_data']['lastName'] ?? ''));

$otpCode = issue_registration_otp($email);
if (!send_registration_otp_email($email, $name, $otpCode)) {
    echo json_encode(['status' => 'error', 'message' => 'We could not send a verification code. Please try again later.']);
    exit;
}

echo json_encode(['status' => 'success', 'message' => 'A new verification code has been sent to your email.', 'retry_after' => REGISTRATION_OTP_RESEND_COOLDOWN_SECONDS]);
