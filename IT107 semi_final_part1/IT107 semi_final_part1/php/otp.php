<?php

const REGISTRATION_OTP_LENGTH = 6;
const REGISTRATION_OTP_TTL_SECONDS = 600;
const REGISTRATION_OTP_RESEND_COOLDOWN_SECONDS = 60;
const REGISTRATION_OTP_MAX_ATTEMPTS = 5;

function generate_otp_code(): string
{
    return str_pad((string) random_int(0, 999999), REGISTRATION_OTP_LENGTH, '0', STR_PAD_LEFT);
}

// $sessionKey keeps separate flows apart: 'registration_otp' for student signup,
// 'onboarding_otp' for administrator account setup.
function issue_registration_otp(string $email, string $sessionKey = 'registration_otp'): string
{
    $code = generate_otp_code();
    $_SESSION[$sessionKey] = [
        'email' => $email,
        'code_hash' => password_hash($code, PASSWORD_DEFAULT),
        'expires_at' => time() + REGISTRATION_OTP_TTL_SECONDS,
        'attempts' => 0,
        'last_sent_at' => time(),
    ];
    return $code;
}

function send_registration_otp_email(string $email, string $name, string $code): bool
{
    $minutes = (int) (REGISTRATION_OTP_TTL_SECONDS / 60);
    $subject = 'Your verification code';
    $body = "Hello $name,\n\n"
        . "Your verification code is: $code\n\n"
        . "Enter this code to confirm your email address. It expires in $minutes minutes.\n\n"
        . "If you did not request this, you can safely ignore this email.";
    return send_email($email, $name !== '' ? $name : $email, $subject, $body);
}

// Checks a submitted code against the one stored under $sessionKey. Returns null
// when it matches (and clears it), otherwise a message to show the user.
function check_otp_code(string $sessionKey, string $email, string $code): ?string
{
    $otpData = $_SESSION[$sessionKey] ?? null;
    if (!$otpData || !isset($otpData['email'], $otpData['code_hash'], $otpData['expires_at'])) {
        return 'No verification code was found. Please request a new one.';
    }
    if (strcasecmp($otpData['email'], $email) !== 0) {
        return 'The email address changed after the code was sent. Please request a new code.';
    }
    if (time() > $otpData['expires_at']) {
        unset($_SESSION[$sessionKey]);
        return 'Your verification code has expired. Please request a new one.';
    }
    if ($otpData['attempts'] >= REGISTRATION_OTP_MAX_ATTEMPTS) {
        unset($_SESSION[$sessionKey]);
        return 'Too many incorrect attempts. Please request a new code.';
    }
    if (!preg_match('/^\d{6}$/', $code)) {
        return 'Enter the 6-digit code sent to your email.';
    }
    if (!password_verify($code, $otpData['code_hash'])) {
        $_SESSION[$sessionKey]['attempts'] = $otpData['attempts'] + 1;
        $remaining = REGISTRATION_OTP_MAX_ATTEMPTS - $_SESSION[$sessionKey]['attempts'];
        if ($remaining <= 0) {
            unset($_SESSION[$sessionKey]);
            return 'Too many incorrect attempts. Please request a new code.';
        }
        return "Incorrect code. $remaining attempt(s) remaining.";
    }
    unset($_SESSION[$sessionKey]);
    return null;
}

function mask_email(string $email): string
{
    $atPos = strpos($email, '@');
    if ($atPos === false) {
        return $email;
    }
    $local = substr($email, 0, $atPos);
    $visible = min(2, strlen($local));
    return substr($local, 0, $visible) . str_repeat('*', max(strlen($local) - $visible, 3)) . substr($email, $atPos);
}
