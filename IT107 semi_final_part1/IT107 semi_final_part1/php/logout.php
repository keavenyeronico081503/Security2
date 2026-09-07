<?php
// Start the session
session_start();
include 'db.php';
require_once 'audit_service.php';

if (!empty($_SESSION['user_id'])) {
    audit('auth.logout', (int)$_SESSION['user_id']);
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