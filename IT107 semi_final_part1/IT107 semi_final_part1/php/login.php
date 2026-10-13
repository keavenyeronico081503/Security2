<?php
session_start();
include 'db.php';
require_once 'emergency_admin.php';
require_once 'audit_service.php';
require_once 'account_service.php';
require_once 'rate_limit.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';

    if (empty($username) || empty($password)) {
        audit('auth.login.failed', null, ['username' => $username], null, null, false, 'Missing username or password.');
        echo json_encode(["status" => "error", "message" => "Username and password are required."]);
        exit();
    }

    // Server-side brute-force lock (the browser's own lockout is easy to bypass):
    // 5 wrong passwords for this username from this IP, or 20 from anywhere, in
    // 15 minutes locks further tries until the window ends. The per-username
    // limit is skipped for the emergency account so nobody can lock it out remotely.
    $lockWindow = 900;
    $ipBucket = 'login:' . strtolower($username) . ':' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $userBucket = 'login-user:' . strtolower($username);
    $checkUserBucket = strcasecmp($username, EMERGENCY_ADMIN_USERNAME) !== 0;
    $lockedBucket = rate_limit_count($ipBucket, $lockWindow) >= 5 ? $ipBucket
        : ($checkUserBucket && rate_limit_count($userBucket, $lockWindow) >= 20 ? $userBucket : null);
    if ($lockedBucket !== null) {
        $minutes = rate_limit_minutes_left($lockedBucket, $lockWindow);
        audit('auth.login.failed', null, ['username' => $username], null, null, false, 'Locked: too many failed attempts.');
        echo json_encode(["status" => "locked", "message" => "Too many failed attempts. Try again in $minutes minute(s)."]);
        exit();
    }
    $recordFailure = function () use ($ipBucket, $userBucket, $lockWindow, $checkUserBucket) {
        rate_limit($ipBucket, PHP_INT_MAX, $lockWindow);
        if ($checkUserBucket) rate_limit($userBucket, PHP_INT_MAX, $lockWindow);
    };

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
            // Accounts waiting for approval aren't in `users` yet; with the right
            // password, tell them they're pending instead of "invalid".
            $pendingStmt = $conn->prepare('SELECT password FROM pending_registrations WHERE username = ? LIMIT 1');
            $pendingStmt->bind_param('s', $username);
            $pendingStmt->execute();
            $pendingRow = $pendingStmt->get_result()->fetch_assoc();
            if ($pendingRow && password_verify($password, $pendingRow['password'])) {
                audit('auth.login.failed', null, ['username' => $username], null, null, false, 'Account pending approval.');
                echo json_encode(["status" => "pending", "message" => "This account is waiting for administrator approval."]);
                exit();
            }
            $recordFailure();
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
        $recordFailure();
        audit('auth.login.failed', (int)$user['id'], [], null, null, false, 'Invalid password.');
        echo json_encode(["status" => "error", "message" => "Invalid password or username."]);
        exit();
    }
    rate_limit_clear($ipBucket);

    // Blocked/pending/onboarding rules, session setup and the role redirect are
    // shared with Google sign-in (see complete_login() in account_service.php).
    header('Content-Type: application/json');
    echo json_encode(complete_login($user, $isEmergencyLogin));
} else {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
}

$conn->close();
?>
