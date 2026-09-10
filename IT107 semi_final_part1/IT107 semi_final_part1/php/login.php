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

    if ($user['account_status'] === 'blocked') {
        echo json_encode(["status" => "error", "message" => "This account is blocked."]);
        exit();
    }

    if ($user['registration_status'] === 'incomplete') {
        // Managed accounts must finish onboarding before entering their dashboard.
        if (!password_verify($password, $user['password'])) {
            echo json_encode(["status" => "error", "message" => "Invalid password or username."]);
            exit();
        }
        session_regenerate_id(true);
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['role'] = $user['role'];
        audit('auth.login.success', (int)$user['id']);
        $touchStmt = $conn->prepare('UPDATE users SET last_login_at = NOW(), is_online = 1 WHERE id = ?');
        $touchStmt->bind_param('i', $user['id']);
        $touchStmt->execute();
        header('Content-Type: application/json');
        echo json_encode(["status" => "success", "message" => "Complete your account setup.", "redirect" => "../html/onboarding.html"]);
        exit();
    }

    if ($user['role'] !== 'user' && $user['account_status'] !== 'approved') {
        echo json_encode(["status" => "error", "message" => "This administrator account is awaiting approval."]);
        exit();
    }

    // Verify password (the emergency account was already authenticated in code above,
    // and its stored hash is an unusable placeholder, so it skips this DB check)
    if ($isEmergencyLogin || password_verify($password, $user['password'])) {
        if (!$isEmergencyLogin && $user['role'] === 'user' && $user['account_status'] === 'pending') {
            audit('auth.login.failed', (int)$user['id'], [], null, null, false, 'Account pending approval.');
            echo json_encode(["status" => "error", "message" => "This account is waiting for approval."]);
            exit();
        }

        session_regenerate_id(true);
        // Set session variables
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['role'] = $user['role'];
        $_SESSION['privileges'] = json_decode($user['privileges'] ?: '{}', true) ?: [];
        $_SESSION['is_emergency_admin'] = $isEmergencyLogin;
        audit('auth.login.success', (int)$user['id']);
        if (!$isEmergencyLogin) {
            $touchStmt = $conn->prepare('UPDATE users SET last_login_at = NOW(), is_online = 1 WHERE id = ?');
            $touchStmt->bind_param('i', $user['id']);
            $touchStmt->execute();
        }

        $redirect = match ($user['role']) {
            'super_admin' => "../html/super-admin.html",
            'admin' => "../html/admin.html",
            'data_administrator' => "../html/admin.html",
            default => "../html/dashboard.html"
        };

        if (!empty($user['must_change_password'])) {
            $redirect = "../html/change-password.html";
        }

        echo json_encode([
            "status" => "success",
            "message" => "Login successful!",
            "redirect" => $redirect
        ]);
    } else {
        audit('auth.login.failed', (int)$user['id'], [], null, null, false, 'Invalid password.');
        echo json_encode(["status" => "error", "message" => "Invalid password or username."]);
    }

} else {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
}

$conn->close();
?>
