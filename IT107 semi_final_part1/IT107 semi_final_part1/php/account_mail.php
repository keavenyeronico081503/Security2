<?php
// Notification emails about changes to someone's account (approved, blocked,
// deleted, password or email changed). Best effort: a failed email is logged by
// send_email() and never blocks or undoes the action that triggered it.

require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/otp.php';

// $account is an account_snapshot() row, taken before any delete or email change
// so the address is still known. $extra may carry 'reason' or 'new_email'.
function notify_account(?array $account, string $event, array $extra = []): void
{
    $email = (string)($account['email'] ?? '');
    if (!$account || (int)($account['id'] ?? 0) < 1
        || !filter_var($email, FILTER_VALIDATE_EMAIL)
        || str_ends_with(strtolower($email), '@pending.local')) {
        return;
    }

    $reason = trim((string)($extra['reason'] ?? ''));
    $reasonLine = $reason !== '' ? "\nReason: $reason\n" : '';
    $messages = [
        'approved' => [
            'Your Security2 account was approved',
            "Your account has been approved. You can now log in with your username ({$account['username']}).\n",
        ],
        'recovery_locked' => [
            'Someone tried to recover your Security2 account',
            "Someone tried to reset the password for your account ({$account['username']}) using \"Forgot password\" and answered your security questions incorrectly 5 times. Account recovery is locked for 30 minutes.\n\nIf this was you, wait and try again. If not, your password is still safe, but consider changing your security answers.\n",
        ],
        'rejected' => [
            'Your Security2 registration was not approved',
            "Your registration ({$account['username']}) was reviewed and not approved, so no account was created.\n$reasonLine\nYou may register again once the issue is resolved.\n",
        ],
        'blocked' => [
            'Your Security2 account was blocked',
            "Your account has been blocked, so you can't log in for now.\n$reasonLine",
        ],
        'unblocked' => [
            'Your Security2 account was unblocked',
            "Your account has been unblocked. You can log in again.\n",
        ],
        'deleted' => [
            'Your Security2 account was deleted',
            "Your account ({$account['username']}) has been deleted by an administrator.\n$reasonLine",
        ],
        'password_changed' => [
            'Your Security2 password was changed',
            "The password for your account ({$account['username']}) was just changed.\n",
        ],
        'email_changed' => [
            'Your Security2 email address was changed',
            "The email address on your account ({$account['username']}) was changed to "
                . mask_email((string)($extra['new_email'] ?? '')) . ". Future emails will go to the new address.\n",
        ],
    ];
    if (!isset($messages[$event])) {
        return;
    }

    [$subject, $text] = $messages[$event];
    $name = trim(($account['first_name'] ?? '') . ' ' . ($account['last_name'] ?? ''));
    $body = 'Hello ' . ($account['first_name'] ?? '') . ",\n\n" . $text
        . "\nTime: " . date('F j, Y g:i A') . "\n\n"
        . "If you didn't expect this, contact your administrator.";
    send_email($email, $name !== '' ? $name : $email, $subject, $body);
}
