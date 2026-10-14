<?php
// Final submit of the 4-step student registration wizard (html/register.html).
// Every step is re-checked here, then the registration is stored in
// pending_registrations (never `users`) until an Admin or Super Admin approves it.
session_start();
include 'db.php';
require_once 'email_policy.php';
require_once 'account_service.php';
require_once 'password_policy.php';
require_once 'profile_validation.php';
require_once 'security_questions.php';

header('Content-Type: application/json; charset=utf-8');

function finish(array $body): void
{
    echo json_encode($body);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    finish(['status' => 'error', 'message' => 'Invalid request method.']);
}

// A repeat of a submit that already succeeded (double-click or a second tab).
$username = trim((string)($_POST['username'] ?? ''));
if (!empty($_SESSION['registration_submitted']) && $_SESSION['registration_submitted'] === $username) {
    finish(['status' => 'success', 'message' => 'Your registration was already submitted and is waiting for approval.', 'redirect' => '../html/login.html']);
}

// Step 1: the email must be the one verified with a code (or by Google).
$email = strtolower(trim((string)($_POST['email'] ?? '')));
$verifiedEmail = $_SESSION['register_verified_email'] ?? ($_SESSION['google_signup']['email'] ?? '');
if ($email === '' || strcasecmp($email, (string)$verifiedEmail) !== 0) {
    finish(['status' => 'error', 'step' => 1, 'message' => 'Please verify your school email with the code we send you.']);
}
if (!is_institutional_email($email)) {
    finish(['status' => 'error', 'step' => 1, 'message' => institutional_email_error_message()]);
}
if (!preg_match('/^[A-Za-z][A-Za-z0-9_]{5,24}$/', $username)) {
    finish(['status' => 'error', 'step' => 1, 'message' => 'Username must be 6-25 letters, numbers or underscores, starting with a letter.']);
}
$password = (string)($_POST['password'] ?? '');
$problem = password_rule_problem($password, (string)($_POST['confirm_password'] ?? '')) ?? password_problem_on_submit($password, 'registration');
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

$result = create_pending_registration($profile + [
    'email' => $email,
    'username' => $username,
    'password_hash' => password_hash($password, PASSWORD_DEFAULT),
], $questions, $answers);

if ($result['status'] === 'success') {
    $_SESSION['registration_submitted'] = $username;
    unset($_SESSION['register_verified_email'], $_SESSION['register_otp'], $_SESSION['google_signup']);
}
finish($result);
