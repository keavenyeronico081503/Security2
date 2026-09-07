<?php
session_start();
require_once 'db.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method.']);
    exit;
}

$userId = (int)($_SESSION['user_id'] ?? 0);
if ($userId < 1) {
    http_response_code(401);
    echo json_encode(['status' => 'error', 'message' => 'Authentication required.']);
    exit;
}

$allowedQuestions = [
    'petName', 'favoriteColor', 'favoriteFood', 'birthCity', 'firstSchool',
    'childhoodNickname', 'favoriteTeacher', 'dreamJob', 'memorablePlace'
];

$firstName = trim((string)($_POST['first_name'] ?? ''));
$middleName = trim((string)($_POST['middle_name'] ?? ''));
$lastName = trim((string)($_POST['last_name'] ?? ''));
$suffix = trim((string)($_POST['suffix'] ?? ''));
$birthday = trim((string)($_POST['birthday'] ?? ''));
$gender = trim((string)($_POST['gender'] ?? ''));
$email = trim((string)($_POST['email'] ?? ''));
$street = trim((string)($_POST['street'] ?? ''));
$barangay = trim((string)($_POST['barangay'] ?? ''));
$city = trim((string)($_POST['city'] ?? ''));
$province = trim((string)($_POST['province'] ?? ''));
$country = trim((string)($_POST['country'] ?? ''));
$zipCode = trim((string)($_POST['zip_code'] ?? ''));
$newPassword = (string)($_POST['new_password'] ?? '');
$confirmPassword = (string)($_POST['confirm_password'] ?? '');
$questions = [(string)($_POST['question1'] ?? ''), (string)($_POST['question2'] ?? ''), (string)($_POST['question3'] ?? '')];
$answers = [trim((string)($_POST['answer1'] ?? '')), trim((string)($_POST['answer2'] ?? '')), trim((string)($_POST['answer3'] ?? ''))];

if ($firstName === '' || $lastName === '' || $birthday === '' || $gender === '' || $email === '' || $street === '' || $barangay === '' || $city === '' || $province === '' || $country === '' || $zipCode === '') {
    echo json_encode(['status' => 'error', 'message' => 'Please complete all profile fields.']);
    exit;
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['status' => 'error', 'message' => 'Please provide a valid email address.']);
    exit;
}
if (!in_array($gender, ['Male', 'Female'], true)) {
    echo json_encode(['status' => 'error', 'message' => 'Please select a valid sex.']);
    exit;
}
if (strlen($newPassword) < 8 || strlen($newPassword) > 20 || $newPassword !== $confirmPassword) {
    echo json_encode(['status' => 'error', 'message' => 'Passwords must match and contain 8 to 20 characters.']);
    exit;
}
if (count(array_unique($questions)) !== 3 || count(array_diff($questions, $allowedQuestions)) > 0 || in_array('', $answers, true)) {
    echo json_encode(['status' => 'error', 'message' => 'Choose three different recovery questions and answer each one.']);
    exit;
}

$lookup = $conn->prepare('SELECT id, registration_status FROM users WHERE id = ? LIMIT 1');
$lookup->bind_param('i', $userId);
$lookup->execute();
$user = $lookup->get_result()->fetch_assoc();
$lookup->close();
if (!$user || $user['registration_status'] !== 'incomplete') {
    echo json_encode(['status' => 'error', 'message' => 'This account does not require onboarding.']);
    exit;
}

$emailCheck = $conn->prepare('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1');
$emailCheck->bind_param('si', $email, $userId);
$emailCheck->execute();
if ($emailCheck->get_result()->num_rows > 0) {
    $emailCheck->close();
    echo json_encode(['status' => 'error', 'message' => 'That email address is already in use.']);
    exit;
}
$emailCheck->close();

$conn->begin_transaction();
try {
    $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
    $age = max(0, (int)date('Y') - (int)date('Y', strtotime($birthday)));
    $update = $conn->prepare('UPDATE users SET first_name = ?, middle_name = ?, last_name = ?, suffix = ?, birthday = ?, age = ?, gender = ?, email = ?, street = ?, barangay = ?, city = ?, province = ?, country = ?, zip_code = ?, password = ?, registration_status = "complete" WHERE id = ? AND registration_status = "incomplete"');
    $update->bind_param('sssssi' . str_repeat('s', 9) . 'i', $firstName, $middleName, $lastName, $suffix, $birthday, $age, $gender, $email, $street, $barangay, $city, $province, $country, $zipCode, $hashedPassword, $userId);
    if (!$update->execute() || $update->affected_rows < 1) {
        throw new RuntimeException('Account profile could not be saved.');
    }
    $update->close();

    $deleteQuestions = $conn->prepare('DELETE FROM security_questions WHERE user_id = ?');
    $deleteQuestions->bind_param('i', $userId);
    $deleteQuestions->execute();
    $deleteQuestions->close();

    $insertQuestion = $conn->prepare('INSERT INTO security_questions (user_id, authQuestion1, authAnswer1, authQuestion2, authAnswer2, authQuestion3, authAnswer3) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $hashedAnswers = array_map(fn($answer) => password_hash($answer, PASSWORD_DEFAULT), $answers);
    $insertQuestion->bind_param('issssss', $userId, $questions[0], $hashedAnswers[0], $questions[1], $hashedAnswers[1], $questions[2], $hashedAnswers[2]);
    if (!$insertQuestion->execute()) {
        throw new RuntimeException('Recovery questions could not be saved.');
    }
    $insertQuestion->close();

    $conn->commit();
    $_SESSION['registration_complete'] = true;
    echo json_encode(['status' => 'success', 'message' => 'Account setup complete.', 'redirect' => $_SESSION['role'] === 'super_admin' ? '../html/super-admin.html' : '../html/admin.html']);
} catch (Throwable $error) {
    $conn->rollback();
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => $error->getMessage()]);
}
