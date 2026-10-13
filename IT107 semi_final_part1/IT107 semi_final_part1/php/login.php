<?php
session_start();
include 'db.php';
require_once 'emergency_admin.php';
require_once 'audit_service.php';
require_once 'account_service.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';

    if (empty($username) || empty($password)) {
        audit('auth.login.failed', null, ['username' => $username], null, null, false, 'Missing username or password.');
        echo json_encode(["status" => "error", "message" => "Username and password are required."]);
        exit();
    }

    // The emergency account is authenticated and authorized entirely from
    // code (never the database), so it stays reachable even if the database
    // is down or in a broken state.
    $isEmergencyLogin = is_emergency_admin_login($username, $password);
    if ($isEmergencyLogin) {
        $user = emergency_admin_user();
    } else {
        deactivate_inactive_accounts();
        $sql = "SELECT id, username, password, role, account_status, privileges, registration_status, must_change_password FROM users WHERE username = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($result->num_rows === 0) {
            audit('auth.login.failed', null, ['username' => $username], null, null, false, 'Unknown username.');
            echo json_encode(["status" => "error", "message" => "Invalid password or username."]);
            exit();
        }
        $user = $result->fetch_assoc();

        $stmt->close();
    }

    if (!$user) {
        echo json_encode(["status" => "error", "message" => "Invalid password or username."]);
        exit();
    }

    // Verify password (the emergency account was already authenticated in code above,
    // and its stored hash is an unusable placeholder, so it skips this DB check)
    if (!$isEmergencyLogin && !password_verify($password, $user['password'])) {
        audit('auth.login.failed', (int)$user['id'], [], null, null, false, 'Invalid password.');
        echo json_encode(["status" => "error", "message" => "Invalid password or username."]);
        exit();
    }

    // Blocked/pending/onboarding rules, session setup and the role redirect are
    // shared with Google sign-in (see complete_login() in account_service.php).
    header('Content-Type: application/json');
    echo json_encode(complete_login($user, $isEmergencyLogin));
} else {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
}

$conn->close();
?>
