<?php
// Start the session
session_start();
include 'db.php';
require_once 'audit_service.php';

if (!empty($_SESSION['user_id'])) {
    $loggingOutUserId = (int)$_SESSION['user_id'];
    audit('auth.logout', $loggingOutUserId);

    $presenceStmt = $conn->prepare('UPDATE users SET is_online = 0 WHERE id = ?');
    $presenceStmt->bind_param('i', $loggingOutUserId);
    $presenceStmt->execute();

    // A Super Administrator who created or reactivated another Super Administrator
    // account is flagged (see super-admin.php) to step down the moment they leave,
    // rather than being kicked mid-session - completing the handoff only now that
    // they are actually logging out.
    $handoffStmt = $conn->prepare('SELECT deactivate_on_logout FROM users WHERE id = ? AND role = "super_admin"');
    $handoffStmt->bind_param('i', $loggingOutUserId);
    $handoffStmt->execute();
    $handoffRow = $handoffStmt->get_result()->fetch_assoc();
    if ($handoffRow && (int)$handoffRow['deactivate_on_logout'] === 1) {
        $deactivate = $conn->prepare('UPDATE users SET account_status = "blocked", deactivate_on_logout = 0 WHERE id = ?');
        $deactivate->bind_param('i', $loggingOutUserId);
        $deactivate->execute();
        audit('accounts.block', $loggingOutUserId, ['reason' => 'Automatically deactivated: stepped down after activating another Super Administrator account']);
    }
}

// Unset all session variables
$_SESSION = array();

// Delete the session cookie
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], 
        $params["domain"],
        $params["secure"], 
        $params["httponly"]
    );
}

// Destroy the session
session_destroy();

// Redirect to the public home page
header("Location: ../html/home.html");
exit();
?>