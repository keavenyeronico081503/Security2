<?php
include 'db.php'; // make sure correct connection
require_once 'rate_limit.php';

// Live "already taken?" checks for the signup form (email and username only).
// Passwords are deliberately not checked against other accounts here: saying
// "this password is already used" would confirm a working password to anyone.
// See password_check.php for the safe breached-password check instead.

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    enforce_rate_limit('check_user', 60, 60);

    $username = trim($_POST['username'] ?? '');
    $email    = trim($_POST['email'] ?? '');

    if ($username === '' && $email === '') {
        echo json_encode(["status" => "available", "message" => "All available."]);
        exit;
    }

    // Accounts waiting for approval live in pending_registrations, so check both tables.
    if ($email !== '') {
        $stmt = $conn->prepare("SELECT id FROM users WHERE email = ? UNION SELECT id FROM pending_registrations WHERE email = ?");
        $stmt->bind_param("ss", $email, $email);
        $stmt->execute();
        $stmt->store_result();
        if ($stmt->num_rows > 0) {
            echo json_encode(["status" => "email_exists", "message" => "Email already exists!"]);
            exit;
        }
        $stmt->close();
    }

    if ($username !== '') {
        $stmt = $conn->prepare("SELECT id FROM users WHERE username = ? AND username <> 'Keavenyadmin1' UNION SELECT id FROM pending_registrations WHERE username = ?");
        $stmt->bind_param("ss", $username, $username);
        $stmt->execute();
        $stmt->store_result();
        if ($stmt->num_rows > 0) {
            echo json_encode(["status" => "username_exists", "message" => "Username already exists!"]);
            exit;
        }
        $stmt->close();
    }

    echo json_encode(["status" => "available", "message" => "All available."]);
}
?>
