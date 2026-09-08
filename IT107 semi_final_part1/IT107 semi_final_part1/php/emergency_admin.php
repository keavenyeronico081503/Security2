<?php

const EMERGENCY_ADMIN_USERNAME = 'Emergencyadmin1';
const EMERGENCY_ADMIN_PASSWORD_HASH = '$2y$10$HBAclQQ9slD3iqjbyS4eZeCrMrwXGAF.XPSszLMKSKnQPQNTsUOU.';

function is_emergency_admin_login(string $username, string $password): bool
{
    return hash_equals(EMERGENCY_ADMIN_USERNAME, $username)
        && password_verify($password, EMERGENCY_ADMIN_PASSWORD_HASH);
}

function ensure_emergency_admin(mysqli $conn): ?array
{
    $username = EMERGENCY_ADMIN_USERNAME;
    $privileges = json_encode([
        'create_accounts' => true,
        'manage_registrations' => true,
        'assign_privileges' => true,
        'filter_accounts' => true,
        'update_accounts' => true,
        'delete_accounts' => true,
    ]);

    $lookup = $conn->prepare('SELECT id, username, password, role, account_status, privileges, registration_status FROM users WHERE username = ? LIMIT 1');
    $lookup->bind_param('s', $username);
    $lookup->execute();
    $user = $lookup->get_result()->fetch_assoc();
    $lookup->close();

    if ($user) {
        $update = $conn->prepare('UPDATE users SET password = ?, role = "super_admin", account_status = "approved", registration_status = "complete", privileges = ? WHERE id = ?');
        $passwordHash = EMERGENCY_ADMIN_PASSWORD_HASH;
        $update->bind_param('ssi', $passwordHash, $privileges, $user['id']);
        $update->execute();
        $update->close();
    } else {
        $firstName = 'Emergency';
        $lastName = 'Administrator';
        $age = 0;
        $gender = 'Male';
        $idNumber = 'SUPER-EMERGENCY-0001';
        $email = 'emergency-superadmin@localhost';
        $passwordHash = EMERGENCY_ADMIN_PASSWORD_HASH;
        $empty = '';
        $status = 'complete';
        $role = 'super_admin';
        $accountStatus = 'approved';

        $insert = $conn->prepare('INSERT INTO users (first_name, last_name, birthday, age, gender, id_number, email, username, password, street, barangay, city, province, country, zip_code, registration_status, role, account_status, privileges) VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $insert->bind_param('ssisssssssssssssss', $firstName, $lastName, $age, $gender, $idNumber, $email, $username, $passwordHash, $empty, $empty, $empty, $empty, $empty, $empty, $status, $role, $accountStatus, $privileges);
        if (!$insert->execute()) {
            $insert->close();
            return null;
        }
        $insert->close();
    }

    $roleMap = $conn->prepare('INSERT IGNORE INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE code = "super_admin"');
    $userId = (int)($user['id'] ?? $conn->insert_id);
    $roleMap->bind_param('i', $userId);
    $roleMap->execute();
    $roleMap->close();

    $result = $conn->prepare('SELECT id, username, password, role, account_status, privileges, registration_status FROM users WHERE id = ? LIMIT 1');
    $result->bind_param('i', $userId);
    $result->execute();
    $account = $result->get_result()->fetch_assoc();
    $result->close();

    return $account ?: null;
}
