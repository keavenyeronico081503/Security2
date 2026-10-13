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

// Regular users sign in with their school (@csucc.edu.ph) address; staff roles
// (admin, data administrator, super admin) must use a personal address instead.
function is_staff_role(string $role): bool
{
    return in_array($role, ['admin', 'data_administrator', 'super_admin'], true);
}

function is_email_allowed_for_role(string $email, string $role): bool
{
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    return is_staff_role($role) ? !is_institutional_email($email) : is_institutional_email($email);
}

function email_role_error_message(string $role): string
{
    if (is_staff_role($role)) {
        $domains = implode(' or ', array_map(fn($domain) => '@' . $domain, INSTITUTIONAL_EMAIL_DOMAINS));
        return "Administrator accounts must use a personal email address, not a school address ($domains).";
    }
    return institutional_email_error_message();
}
