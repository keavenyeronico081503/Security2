<?php
// Tells register.html whether this signup started from "Continue with Google",
// so it can prefill the name and lock the already-verified email.
session_start();
header('Content-Type: application/json; charset=utf-8');

$signup = $_SESSION['google_signup'] ?? null;
if (!$signup) {
    echo json_encode(['status' => 'none']);
    exit;
}
echo json_encode(['status' => 'success', 'signup' => $signup]);
