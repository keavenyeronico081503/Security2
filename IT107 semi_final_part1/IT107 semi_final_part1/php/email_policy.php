<?php

const INSTITUTIONAL_EMAIL_DOMAINS = ['csucc.edu.ph'];

function is_institutional_email(string $email): bool
{
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    $domain = strtolower(substr(strrchr($email, '@'), 1));
    return in_array($domain, INSTITUTIONAL_EMAIL_DOMAINS, true);
}

function institutional_email_error_message(): string
{
    $domains = implode(' or ', array_map(fn($domain) => '@' . $domain, INSTITUTIONAL_EMAIL_DOMAINS));
    return "Please use your institutional email address ($domains).";
}
