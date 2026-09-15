<?php

require_once __DIR__ . '/PHPMailer/Exception.php';
require_once __DIR__ . '/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as PHPMailerException;

function send_email(string $toEmail, string $toName, string $subject, string $bodyText): bool
{
    $host = getenv('SMTP_HOST') ?: '';
    $username = getenv('SMTP_USERNAME') ?: '';
    $password = getenv('SMTP_PASSWORD') ?: '';
    if ($host === '' || $username === '' || $password === '') {
        error_log('Mail send skipped: SMTP is not configured (missing SMTP_HOST/SMTP_USERNAME/SMTP_PASSWORD).');
        return false;
    }

    $mail = new PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host = $host;
        $mail->SMTPAuth = true;
        $mail->Username = $username;
        $mail->Password = $password;
        $mail->SMTPSecure = getenv('SMTP_ENCRYPTION') ?: PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = (int)(getenv('SMTP_PORT') ?: 587);

        $fromEmail = getenv('SMTP_FROM_EMAIL') ?: $username;
        $fromName = getenv('SMTP_FROM_NAME') ?: 'Security2';
        $mail->setFrom($fromEmail, $fromName);
        $mail->addAddress($toEmail, $toName);

        $mail->isHTML(false);
        $mail->Subject = $subject;
        $mail->Body = $bodyText;

        $mail->send();
        return true;
    } catch (PHPMailerException | Throwable $error) {
        error_log('Mail send failed: ' . $error->getMessage());
        return false;
    }
}
