<?php
// Step 1 of both wizards: prove the email works before the rest of the form.
//   ?purpose=register    students signing up (school email, not yet registered)
//   ?purpose=onboarding  a newly created administrator finishing setup (personal email)
// Actions: status (GET), send (POST email), verify (POST email + code).
// A verified address is remembered in the session as "{purpose}_verified_email"
// and required again by register.php / complete_account.php on final submit.
session_start();
require_once 'db.php';
require_once 'email_policy.php';
require_once 'mailer.php';
require_once 'otp.php';
require_once 'rate_limit.php';
require_once 'account_service.php';

header('Content-Type: application/json; charset=utf-8');

function respond(array $body, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

$purpose = ($_GET['purpose'] ?? '') === 'onboarding' ? 'onboarding' : 'register';
$action = (string)($_GET['action'] ?? 'status');
$otpKey = "{$purpose}_otp";
$verifiedKey = "{$purpose}_verified_email";

// Onboarding is only for a logged-in account that still has to finish setup.
$account = null;
if ($purpose === 'onboarding') {
    $userId = (int)($_SESSION['user_id'] ?? 0);
    $stmt = $conn->prepare('SELECT id, username, role, registration_status FROM users WHERE id = ?');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $account = $stmt->get_result()->fetch_assoc();
    if (!$account || $account['registration_status'] !== 'incomplete') {
        respond(['status' => 'error', 'message' => 'Please log in with your temporary password first.'], 401);
    }
}

if ($action === 'status') {
    $google = $purpose === 'register' ? ($_SESSION['google_signup'] ?? null) : null;
    respond([
        'status' => 'success',
        'verified_email' => $_SESSION[$verifiedKey] ?? ($google['email'] ?? null),
        'google' => $google,
        'username' => $account['username'] ?? null,
        'role' => $account['role'] ?? null,
    ]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['status' => 'error', 'message' => 'Invalid request method.'], 405);
}

$email = strtolower(trim((string)($_POST['email'] ?? '')));

if ($action === 'send') {
    if ($purpose === 'register' && !is_institutional_email($email)) {
        respond(['status' => 'error', 'message' => institutional_email_error_message()]);
    }
    if ($purpose === 'onboarding' && !is_email_allowed_for_role($email, (string)$account['role'])) {
        respond(['status' => 'error', 'message' => email_role_error_message((string)$account['role'])]);
    }
    $taken = identity_taken($email, '', '');
    if ($taken !== null) {
        respond(['status' => 'error', 'message' => identity_taken_message($taken)]);
    }
    $existing = $_SESSION[$otpKey] ?? null;
    if ($existing && strcasecmp((string)($existing['email'] ?? ''), $email) === 0) {
        $wait = $existing['last_sent_at'] + REGISTRATION_OTP_RESEND_COOLDOWN_SECONDS - time();
        if ($wait > 0) {
            respond(['status' => 'error', 'message' => "Please wait $wait second(s) before requesting another code.", 'retry_after' => $wait]);
        }
    }
    enforce_rate_limit("email_code_$purpose", 5, 600);
    unset($_SESSION[$verifiedKey]);
    $code = issue_registration_otp($email, $otpKey);
    if (!send_registration_otp_email($email, '', $code)) {
        unset($_SESSION[$otpKey]);
        respond(['status' => 'error', 'message' => "We couldn't send a code to that email. Check the address and try again."]);
    }
    respond([
        'status' => 'success',
        'message' => 'We sent a 6-digit code to ' . mask_email($email) . '.',
        'retry_after' => REGISTRATION_OTP_RESEND_COOLDOWN_SECONDS,
    ]);
}

if ($action === 'verify') {
    $error = check_otp_code($otpKey, $email, trim((string)($_POST['code'] ?? '')));
    if ($error !== null) {
        respond(['status' => 'error', 'message' => $error]);
    }
    $_SESSION[$verifiedKey] = $email;
    respond(['status' => 'success', 'message' => 'Email verified.']);
}

respond(['status' => 'error', 'message' => 'Unknown action.'], 400);
