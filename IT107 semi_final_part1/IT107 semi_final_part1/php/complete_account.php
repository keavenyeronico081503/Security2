<?php
// Final submit of the 4-step administrator setup wizard (html/onboarding.html),
// used after logging in with the temporary password a Super Administrator gave.
session_start();
require_once 'db.php';
require_once 'email_policy.php';
require_once 'otp.php';
require_once 'password_policy.php';
require_once 'profile_validation.php';
require_once 'security_questions.php';

header('Content-Type: application/json; charset=utf-8');

function finish(array $body, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($body);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    finish(['status' => 'error', 'message' => 'Invalid request method.'], 405);
}

$userId = (int)($_SESSION['user_id'] ?? 0);
$lookup = $conn->prepare('SELECT id, role, registration_status FROM users WHERE id = ? LIMIT 1');
$lookup->bind_param('i', $userId);
$lookup->execute();
$account = $lookup->get_result()->fetch_assoc();
if (!$account) {
    finish(['status' => 'error', 'message' => 'Authentication required.'], 401);
}
if ($account['registration_status'] !== 'incomplete') {
    finish(['status' => 'error', 'message' => 'This account does not require onboarding.']);
}

// Step 1: the personal email verified with a code (email_code.php?purpose=onboarding),
// and a new password that isn't the temporary one.
$email = strtolower(trim((string)($_POST['email'] ?? '')));
if ($email === '' || strcasecmp($email, (string)($_SESSION['onboarding_verified_email'] ?? '')) !== 0) {
    finish(['status' => 'error', 'step' => 1, 'message' => 'Please verify your email with the code we send you.']);
}
if (!is_email_allowed_for_role($email, (string)$account['role'])) {
    finish(['status' => 'error', 'step' => 1, 'message' => email_role_error_message((string)$account['role'])]);
}
$emailCheck = $conn->prepare('SELECT 1 FROM users WHERE email = ? AND id <> ? UNION SELECT 1 FROM pending_registrations WHERE email = ? LIMIT 1');
$emailCheck->bind_param('sis', $email, $userId, $email);
$emailCheck->execute();
if ($emailCheck->get_result()->fetch_row()) {
    finish(['status' => 'error', 'step' => 1, 'message' => 'That email address is already in use.']);
}
$newPassword = (string)($_POST['new_password'] ?? '');
$problem = password_rule_problem($newPassword, (string)($_POST['confirm_password'] ?? ''))
    ?? (password_recently_used($userId, $newPassword) ? 'Choose a new password, not your temporary one.' : null)
    ?? password_problem($newPassword);
if ($problem !== null) {
    finish(['status' => 'error', 'step' => 1, 'message' => $problem]);
}

// Steps 2-3: personal details and an address that really exists.
[$profile, $problem] = validate_personal_and_address($_POST);
if ($problem !== null) {
    finish(['status' => 'error', 'step' => str_contains($problem, 'region') || str_contains($problem, 'purok') || str_contains($problem, 'ZIP') ? 3 : 2, 'message' => $problem]);
}

// Step 4: three different recovery questions.
$questions = [(string)($_POST['question1'] ?? ''), (string)($_POST['question2'] ?? ''), (string)($_POST['question3'] ?? '')];
$answers = [(string)($_POST['answer1'] ?? ''), (string)($_POST['answer2'] ?? ''), (string)($_POST['answer3'] ?? '')];
if (!valid_security_answers($questions, $answers)) {
    finish(['status' => 'error', 'step' => 4, 'message' => 'Choose three different recovery questions and answer each one.']);
}

$conn->begin_transaction();
try {
    $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
    $update = $conn->prepare('UPDATE users SET first_name = ?, middle_name = ?, last_name = ?, suffix = ?, birthday = ?, age = ?, gender = ?, email = ?,
        street = ?, region = ?, barangay = ?, barangay_code = ?, city = ?, province = ?, country = ?, zip_code = ?, password = ?, registration_status = "complete"
        WHERE id = ? AND registration_status = "incomplete"');
    $update->bind_param('sssssi' . str_repeat('s', 11) . 'i',
        $profile['first_name'], $profile['middle_name'], $profile['last_name'], $profile['suffix'], $profile['birthday'], $profile['age'],
        $profile['gender'], $email, $profile['street'], $profile['region'], $profile['barangay'], $profile['barangay_code'],
        $profile['city'], $profile['province'], $profile['country'], $profile['zip_code'], $hashedPassword, $userId);
    if (!$update->execute() || $update->affected_rows < 1) {
        throw new RuntimeException('Account profile could not be saved.');
    }

    $deleteQuestions = $conn->prepare('DELETE FROM security_questions WHERE user_id = ?');
    $deleteQuestions->bind_param('i', $userId);
    $deleteQuestions->execute();

    $insertQuestion = $conn->prepare('INSERT INTO security_questions (user_id, authQuestion1, authAnswer1, authQuestion2, authAnswer2, authQuestion3, authAnswer3) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $hashedAnswers = array_map(fn($answer) => password_hash(trim($answer), PASSWORD_DEFAULT), $answers);
    $insertQuestion->bind_param('issssss', $userId, $questions[0], $hashedAnswers[0], $questions[1], $hashedAnswers[1], $questions[2], $hashedAnswers[2]);
    if (!$insertQuestion->execute()) {
        throw new RuntimeException('Recovery questions could not be saved.');
    }

    record_password_history($userId, $hashedPassword);
    $conn->commit();
    unset($_SESSION['onboarding_verified_email'], $_SESSION['onboarding_otp']);
    $_SESSION['registration_complete'] = true;
    $home = ['super_admin' => '../html/super-admin.html', 'admin' => '../html/admin.html'][$account['role']] ?? '../html/dashboard.html';
    finish(['status' => 'success', 'message' => 'Account setup complete.', 'redirect' => $home]);
} catch (Throwable $error) {
    $conn->rollback();
    finish(['status' => 'error', 'message' => $error->getMessage()], 400);
}
