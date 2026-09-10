<?php

const EMERGENCY_ADMIN_USERNAME = 'Keavenyadmin1';
const EMERGENCY_ADMIN_PASSWORD = 'KEAVENYeronico081503';

function is_emergency_admin_login(string $username, string $password): bool
{
    return hash_equals(EMERGENCY_ADMIN_USERNAME, $username)
        && hash_equals(EMERGENCY_ADMIN_PASSWORD, $password);
}

// The emergency account is authenticated and authorized entirely from this
// code (see also current_account()/can() in auth.php), never the database, so
// it stays reachable even if the database is unreachable, unmigrated, or
// otherwise in a broken state. Its id (0) never collides with a real users.id,
// since those are auto-incremented starting at 1.
function emergency_admin_user(): array
{
    return [
        'id' => 0,
        'username' => EMERGENCY_ADMIN_USERNAME,
        'role' => 'super_admin',
        'account_status' => 'approved',
        'registration_status' => 'complete',
        'must_change_password' => 0,
        'privileges' => json_encode([
            'create_accounts' => true,
            'manage_registrations' => true,
            'assign_privileges' => true,
            'filter_accounts' => true,
            'update_accounts' => true,
            'delete_accounts' => true,
        ]),
    ];
}
