<?php
// Shared helpers for "Continue with Google" (google_login.php, google_callback.php).
// Credentials come from .env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI.

require_once __DIR__ . '/env.php';
require_once __DIR__ . '/email_policy.php';
load_env(__DIR__ . '/../.env');

function google_config(): ?array
{
    $clientId = getenv('GOOGLE_CLIENT_ID') ?: '';
    $clientSecret = getenv('GOOGLE_CLIENT_SECRET') ?: '';
    // Unset, or still the FILL-IN placeholder from .env, means not configured yet.
    if ($clientId === '' || $clientSecret === '' || str_starts_with($clientId, 'FILL-IN') || str_starts_with($clientSecret, 'FILL-IN')) {
        return null;
    }
    return [
        'client_id' => $clientId,
        'client_secret' => $clientSecret,
        'redirect_uri' => getenv('GOOGLE_REDIRECT_URI') ?: 'http://localhost/security2/php/google_callback.php',
    ];
}

// Every Google sign-in problem ends on the login page with a readable message.
function google_fail(string $message): void
{
    header('Location: ../html/login.html?google_error=' . rawurlencode($message));
    exit;
}

function base64url_decode(string $value): string
{
    return (string)base64_decode(strtr($value, '-_', '+/') . str_repeat('=', (4 - strlen($value) % 4) % 4));
}
