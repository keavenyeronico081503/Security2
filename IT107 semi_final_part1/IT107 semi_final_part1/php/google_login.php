<?php
session_start();
require_once 'google_oauth.php';

$config = google_config();
if (!$config) {
    google_fail('Google sign-in is not set up yet. Please use your username and password.');
}

// state guards against forged callbacks; nonce ties the returned ID token to this attempt.
$_SESSION['google_oauth'] = [
    'state' => bin2hex(random_bytes(16)),
    'nonce' => bin2hex(random_bytes(16)),
];

$params = [
    'client_id' => $config['client_id'],
    'redirect_uri' => $config['redirect_uri'],
    'response_type' => 'code',
    'scope' => 'openid email profile',
    // No hd (domain) hint: staff sign in with personal Google accounts, regular
    // users with school ones. google_callback.php enforces which is allowed.
    'state' => $_SESSION['google_oauth']['state'],
    'nonce' => $_SESSION['google_oauth']['nonce'],
    'prompt' => 'select_account',
];
header('Location: https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query($params));
exit;
