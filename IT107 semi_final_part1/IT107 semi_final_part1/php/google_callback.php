<?php
session_start();
require_once 'db.php';
require_once 'google_oauth.php';
require_once 'account_service.php';

$config = google_config();
if (!$config) {
    google_fail('Google sign-in is not set up yet. Please use your username and password.');
}

$pending = $_SESSION['google_oauth'] ?? null;
unset($_SESSION['google_oauth']);

if (isset($_GET['error'])) {
    google_fail('Google sign-in was cancelled.');
}
if (!$pending || !hash_equals($pending['state'], (string)($_GET['state'] ?? ''))) {
    google_fail('Your Google sign-in expired. Please try again.');
}
$code = (string)($_GET['code'] ?? '');
if ($code === '') {
    google_fail('Google did not return a sign-in code. Please try again.');
}

// Exchange the one-time code for tokens directly with Google (server to server).
$curl = curl_init('https://oauth2.googleapis.com/token');
curl_setopt_array($curl, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_POSTFIELDS => http_build_query([
        'code' => $code,
        'client_id' => $config['client_id'],
        'client_secret' => $config['client_secret'],
        'redirect_uri' => $config['redirect_uri'],
        'grant_type' => 'authorization_code',
    ]),
]);
$response = curl_exec($curl);
$httpCode = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
$curlError = curl_error($curl);
curl_close($curl);

$tokens = is_string($response) ? json_decode($response, true) : null;
if ($httpCode !== 200 || empty($tokens['id_token'])) {
    error_log('Google token exchange failed: HTTP ' . $httpCode . ' ' . ($curlError ?: (string)$response));
    google_fail('Could not complete Google sign-in. Please try again.');
}

// The ID token came straight from Google's token endpoint over TLS, so OpenID
// Connect lets us read its claims without a separate signature check. Every
// claim that matters is still validated below.
$parts = explode('.', $tokens['id_token']);
$claims = count($parts) === 3 ? json_decode(base64url_decode($parts[1]), true) : null;
$email = strtolower(trim((string)($claims['email'] ?? '')));
$valid = is_array($claims)
    && ($claims['aud'] ?? '') === $config['client_id']
    && in_array($claims['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)
    && (int)($claims['exp'] ?? 0) > time()
    && hash_equals($pending['nonce'], (string)($claims['nonce'] ?? ''));
if (!$valid) {
    google_fail('Google sign-in could not be verified. Please try again.');
}

if (empty($claims['email_verified'])) {
    google_fail('Your Google account email is not verified.');
}
// A school address only counts when Google says the account belongs to the
// school's Google Workspace (hd claim), not merely because of how it is spelled.
$isSchoolAccount = ($claims['hd'] ?? '') === INSTITUTIONAL_EMAIL_DOMAINS[0] && is_institutional_email($email);

deactivate_inactive_accounts();
$stmt = $conn->prepare('SELECT id, username, password, role, account_status, privileges, registration_status, must_change_password FROM users WHERE LOWER(email) = ? LIMIT 1');
$stmt->bind_param('s', $email);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();

// Regular users must sign in with their school Google account; administrators
// with the personal Google account on file. Anything else is refused.
if ($user && (!is_email_allowed_for_role($email, $user['role']) || ($user['role'] === 'user' && !$isSchoolAccount))) {
    audit('auth.login.failed', (int)$user['id'], ['method' => 'google'], null, null, false, 'Google account not allowed for this role.');
    google_fail(email_role_error_message($user['role']));
}
if (!$user && !$isSchoolAccount) {
    audit('auth.login.failed', null, ['method' => 'google', 'email' => $email], null, null, false, 'No account for this Google email.');
    google_fail('No account uses this Google email. Students sign up with their @' . INSTITUTIONAL_EMAIL_DOMAINS[0] . ' Google account; administrators sign in with the personal Google account on their profile.');
}

if (!$user) {
    // No account yet: start a normal registration with Google's details filled in.
    // register.php skips the email code for this address, since Google verified it.
    $_SESSION['google_signup'] = [
        'email' => $email,
        'first_name' => (string)($claims['given_name'] ?? ''),
        'last_name' => (string)($claims['family_name'] ?? ''),
    ];
    header('Location: ../html/register.html?google=1');
    exit;
}

$result = complete_login($user, false, 'google');
if ($result['status'] !== 'success') {
    google_fail($result['message']);
}
header('Location: ' . $result['redirect']);
exit;
