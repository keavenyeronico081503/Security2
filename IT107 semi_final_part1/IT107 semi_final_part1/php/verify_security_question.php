<?php
// Forgot-password step 2: checks one security answer at a time (position 1-3).
// - Only the account chosen in step 1 (verify-username.php) can be checked.
// - The password reset is authorized (reset_user_id) only after all three
//   answers have been verified here, on the server.
// - 5 wrong answers in 30 minutes lock recovery for that account, and the owner
//   is emailed about the attempt.
session_start();
include 'db.php';
require_once 'rate_limit.php';
require_once 'audit_service.php';
require_once 'account_mail.php';

header('Content-Type: application/json');

function reply(string $status, string $message): void
{
    echo json_encode(['status' => $status, 'message' => $message]);
    exit();
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    reply('error', 'Invalid request method.');
}

$id = trim($_POST['id'] ?? '');
$question = trim($_POST['question'] ?? '');
$answer = trim($_POST['answer'] ?? '');
$position = (int)($_POST['position'] ?? 0);
if ($id === '' || $question === '' || $answer === '' || $position < 1 || $position > 3) {
    reply('error', 'All fields are required.');
}

$userId = (int)($_SESSION['reset_candidate_id'] ?? 0);
if ($userId < 1 || ($_SESSION['reset_id_number'] ?? '') !== $id) {
    reply('error', 'Please start again from the Forgot Password page.');
}

$lockWindow = 1800;
$bucket = "recovery:$userId";
if (rate_limit_count($bucket, $lockWindow) >= 5) {
    $minutes = rate_limit_minutes_left($bucket, $lockWindow);
    reply('locked', "Too many incorrect answers. Account recovery is locked for $minutes minute(s).");
}

$stmt = $conn->prepare('SELECT authQuestion1, authAnswer1, authQuestion2, authAnswer2, authQuestion3, authAnswer3 FROM security_questions WHERE user_id = ?');
$stmt->bind_param('i', $userId);
$stmt->execute();
$questionData = $stmt->get_result()->fetch_assoc();
if (!$questionData) {
    reply('error', 'Security questions not found for this user.');
}

$isValid = hash_equals((string)$questionData['authQuestion' . $position], $question)
    && password_verify($answer, (string)$questionData['authAnswer' . $position]);

if (!$isValid) {
    unset($_SESSION['reset_passed'], $_SESSION['reset_user_id']);
    rate_limit($bucket, PHP_INT_MAX, $lockWindow);
    audit('auth.recovery.failed', $userId, ['position' => $position], null, null, false, 'Incorrect security answer.');
    if (rate_limit_count($bucket, $lockWindow) >= 5) {
        audit('auth.recovery.locked', $userId, [], null, null, false, 'Too many incorrect security answers.');
        notify_account(account_snapshot($userId), 'recovery_locked');
        reply('locked', 'Too many incorrect answers. Account recovery is locked for 30 minutes.');
    }
    reply('error', 'The question order or answer is incorrect. Please try again.');
}

$_SESSION['reset_passed'][$position] = true;
if (count($_SESSION['reset_passed']) === 3) {
    // All three answers verified: this session may now set a new password.
    $_SESSION['reset_user_id'] = $userId;
    rate_limit_clear($bucket);
    audit('auth.recovery.verified', $userId);
}
reply('success', 'Security question verified successfully.');
