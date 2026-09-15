<?php

const REGISTRATION_OTP_LENGTH = 6;
const REGISTRATION_OTP_TTL_SECONDS = 600;
const REGISTRATION_OTP_RESEND_COOLDOWN_SECONDS = 60;
const REGISTRATION_OTP_MAX_ATTEMPTS = 5;

function generate_otp_code(): string
{
    return str_pad((string) random_int(0, 999999), REGISTRATION_OTP_LENGTH, '0', STR_PAD_LEFT);
}

function issue_registration_otp(string $email): string
{
    $code = generate_otp_code();
    $_SESSION['registration_otp'] = [
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
        . "Enter this code to confirm your institutional email address. It expires in $minutes minutes.\n\n"
        . "If you did not request this, you can safely ignore this email.";
    return send_email($email, $name !== '' ? $name : $email, $subject, $body);
}
