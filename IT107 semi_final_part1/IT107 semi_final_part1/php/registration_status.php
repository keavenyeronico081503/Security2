<?php
session_start();

header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['temp_user_data'])) {
    echo json_encode(['status' => 'error', 'message' => 'No registration in progress. Please register first.', 'redirect' => '../html/register.html']);
    exit;
}

$email = (string) ($_SESSION['temp_user_data']['email'] ?? '');
$verified = !empty($_SESSION['temp_user_data']['email_verified']);

$maskedEmail = $email;
$atPos = strpos($email, '@');
if ($atPos !== false) {
    $localPart = substr($email, 0, $atPos);
    $domainPart = substr($email, $atPos);
    $visible = min(2, strlen($localPart));
    $maskedEmail = substr($localPart, 0, $visible) . str_repeat('*', max(strlen($localPart) - $visible, 3)) . $domainPart;
}

echo json_encode([
    'status' => 'success',
    'email' => $maskedEmail,
    'verified' => $verified,
    'redirect' => $verified ? '../html/question.html' : null,
]);
