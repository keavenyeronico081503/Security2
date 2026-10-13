<?php
require_once 'auth.php';
require_once 'email_policy.php';
require_once 'mailer.php';
require_once 'account_mail.php';
require_once 'password_policy.php';
require_once 'profile_validation.php';

// A fresh one-time password for each reset: 12 characters with at least one
// upper, lower, digit and symbol, skipping look-alikes (0/O, 1/l/I).
function generate_temporary_password(): string
{
    $sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%'];
    $all = implode('', $sets);
    $chars = [];
    foreach ($sets as $set) {
        $chars[] = $set[random_int(0, strlen($set) - 1)];
    }
    while (count($chars) < 12) {
        $chars[] = $all[random_int(0, strlen($all) - 1)];
    }
    for ($i = count($chars) - 1; $i > 0; $i--) {
        $j = random_int(0, $i);
        [$chars[$i], $chars[$j]] = [$chars[$j], $chars[$i]];
    }
    return implode('', $chars);
}

function next_employee_id(): string
{
    global $conn;
    $year = date('Y');
    // Pending registrations already hold ID numbers too, so count both tables.
    $stmt = $conn->prepare('SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(id_number, "-", -1) AS UNSIGNED)), 0) AS last_number FROM (SELECT id_number FROM users UNION ALL SELECT id_number FROM pending_registrations) ids WHERE id_number LIKE CONCAT(?, "-%")');
    $stmt->bind_param('s', $year);
    $stmt->execute();
    $lastNumber = (int)$stmt->get_result()->fetch_assoc()['last_number'];
    return $year . '-' . str_pad((string)($lastNumber + 1), 4, '0', STR_PAD_LEFT);
}

function deactivate_inactive_accounts(): void
{
    global $conn;
    $candidates = $conn->query('SELECT id FROM users WHERE username <> "Keavenyadmin1" AND account_status = "approved" AND COALESCE(last_login_at, created_at) < NOW() - INTERVAL 7 DAY');
    while ($row = $candidates->fetch_assoc()) {
        $stmt = $conn->prepare('UPDATE users SET account_status = "blocked" WHERE id = ?');
        $stmt->bind_param('i', $row['id']);
        $stmt->execute();
        audit('accounts.block', (int)$row['id'], ['reason' => 'Automatically deactivated after 7 days of inactivity']);
        notify_account(account_snapshot((int)$row['id']), 'blocked', ['reason' => 'No login for 7 days. Ask an administrator to unblock your account.']);
    }
}

function list_accounts(string $employeeId = ''): array
{
    global $conn;
    deactivate_inactive_accounts();
    $like = "%$employeeId%";
    $stmt = $conn->prepare('SELECT id, first_name, middle_name, last_name, suffix, birthday, age, gender, id_number, email, username, role, account_status, is_online, privileges, created_at FROM users WHERE id_number LIKE ? AND username <> "Keavenyadmin1" ORDER BY created_at DESC');
    $stmt->bind_param('s', $like);
    $stmt->execute();
    $users = [];
    $result = $stmt->get_result();
    while ($user = $result->fetch_assoc()) {
        $user['privileges'] = json_decode($user['privileges'] ?: '{}', true) ?: [];
        $users[] = $user;
    }
    return $users;
}

function update_account(int $userId, array $data): void
{
    global $conn;
    $oldValues = account_snapshot($userId);
    if (!$oldValues) {
        throw new RuntimeException('Account was not found.');
    }
    if ($oldValues['role'] === 'super_admin') {
        throw new RuntimeException('Super Administrator accounts cannot be edited here.');
    }
    $username = trim((string)($data['username'] ?? ''));
    $problem = validate_name_fields(['first_name' => $data['first_name'] ?? '', 'last_name' => $data['last_name'] ?? '', 'username' => $username]);
    if ($problem !== null) {
        throw new InvalidArgumentException($problem);
    }
    $pendingCheck = $conn->prepare('SELECT 1 FROM pending_registrations WHERE username = ? OR email = ? LIMIT 1');
    $pendingEmail = trim((string)($data['email'] ?? ''));
    $pendingCheck->bind_param('ss', $username, $pendingEmail);
    $pendingCheck->execute();
    if ($pendingCheck->get_result()->fetch_row()) {
        throw new InvalidArgumentException('That username or email belongs to a registration waiting for approval.');
    }
    $email = trim((string)($data['email'] ?? ''));
    if (!is_email_allowed_for_role($email, (string)$oldValues['role'])) {
        throw new InvalidArgumentException(email_role_error_message((string)$oldValues['role']));
    }
    $usernameCheck = $conn->prepare('SELECT id FROM users WHERE username = ? AND id <> ? LIMIT 1');
    $usernameCheck->bind_param('si', $username, $userId);
    $usernameCheck->execute();
    if ($usernameCheck->get_result()->fetch_assoc()) {
        throw new InvalidArgumentException('That username is already taken.');
    }
    $stmt = $conn->prepare('UPDATE users SET first_name = ?, last_name = ?, id_number = ?, email = ?, username = ? WHERE id = ? AND role <> "super_admin"');
    $stmt->bind_param('sssssi', $data['first_name'], $data['last_name'], $data['id_number'], $email, $username, $userId);
    if (!$stmt->execute()) {
        throw new RuntimeException('Account was not updated: ' . $conn->error);
    }
    $newValues = account_snapshot($userId);
    audit('accounts.update', $userId, [], $oldValues, $newValues);
    if (strcasecmp((string)$oldValues['email'], $email) !== 0) {
        notify_account($oldValues, 'email_changed', ['new_email' => $email]);
    }
}

function reset_account_password(int $userId): void
{
    global $conn;
    $oldValues = account_snapshot($userId);
    if (!$oldValues) {
        throw new RuntimeException('Account was not found.');
    }
    if ($oldValues['role'] === 'super_admin') {
        throw new RuntimeException('Super Administrator accounts cannot be reset here.');
    }
    if (!is_email_allowed_for_role((string)$oldValues['email'], (string)$oldValues['role'])) {
        throw new RuntimeException('This account has no valid email on file for its role. Update its email before resetting the password.');
    }

    $temporaryPassword = generate_temporary_password();
    $subject = 'Your Security2 account password was reset';
    $body = "Hello {$oldValues['first_name']},\n\n"
        . "An administrator reset your Security2 account password.\n\n"
        . "Your temporary password is: $temporaryPassword\n\n"
        . "Log in with this password — you will be asked to choose your own password immediately, and this temporary one stops working once you do. If you did not expect this, contact your administrator immediately.";

    // Send before persisting: if the email fails, the account keeps its old working
    // password instead of being locked out with a password nobody received.
    if (!send_email($oldValues['email'], $oldValues['first_name'] . ' ' . $oldValues['last_name'], $subject, $body)) {
        throw new RuntimeException('Could not send the reset email. The password was not changed.');
    }

    $hashed = password_hash($temporaryPassword, PASSWORD_DEFAULT);
    $stmt = $conn->prepare('UPDATE users SET password = ?, must_change_password = 1 WHERE id = ? AND role <> "super_admin"');
    $stmt->bind_param('si', $hashed, $userId);
    if (!$stmt->execute()) {
        throw new RuntimeException('Password was not reset: ' . $conn->error);
    }
    audit('accounts.password_reset', $userId);
}

function request_account_deletion(int $requesterId, int $targetUserId, string $reason): void
{
    global $conn;
    if ($requesterId === $targetUserId || trim($reason) === '') {
        throw new InvalidArgumentException('A valid deletion reason and target account are required.');
    }
    $stmt = $conn->prepare('INSERT INTO admin_delete_requests (requested_by, target_user_id, reason) SELECT ?, id, ? FROM users WHERE id = ? AND role <> "super_admin" AND account_status <> "blocked" AND NOT EXISTS (SELECT 1 FROM admin_delete_requests WHERE target_user_id = ? AND status = "pending")');
    $stmt->bind_param('isii', $requesterId, $reason, $targetUserId, $targetUserId);
    if (!$stmt->execute() || $stmt->affected_rows < 1) {
        throw new RuntimeException('A deletion request for this account is already pending, or the account can\'t be deleted.');
    }
    audit('accounts.delete.request', $targetUserId, ['reason' => $reason]);
}

// Shared by password login (login.php) and Google login (google_callback.php):
// everything that happens once the person has proven who they are. Returns the
// JSON-style result ['status', 'message', 'redirect'?] for the caller to deliver.
function complete_login(array $user, bool $isEmergencyLogin = false, string $method = 'password'): array
{
    global $conn;
    $details = $method === 'password' ? [] : ['method' => $method];

    if ($user['account_status'] === 'blocked') {
        return ['status' => 'error', 'message' => 'This account is blocked.'];
    }

    if ($user['registration_status'] === 'incomplete') {
        // Managed accounts must finish onboarding before entering their dashboard.
        session_regenerate_id(true);
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['role'] = $user['role'];
        audit('auth.login.success', (int)$user['id'], $details);
        $touchStmt = $conn->prepare('UPDATE users SET last_login_at = NOW(), is_online = 1 WHERE id = ?');
        $touchStmt->bind_param('i', $user['id']);
        $touchStmt->execute();
        return ['status' => 'success', 'message' => 'Complete your account setup.', 'redirect' => '../html/onboarding.html'];
    }

    if ($user['role'] !== 'user' && $user['account_status'] !== 'approved') {
        return ['status' => 'error', 'message' => 'This administrator account is awaiting approval.'];
    }

    if (!$isEmergencyLogin && $user['role'] === 'user' && $user['account_status'] === 'pending') {
        audit('auth.login.failed', (int)$user['id'], $details, null, null, false, 'Account pending approval.');
        return ['status' => 'pending', 'message' => 'This account is waiting for administrator approval.'];
    }

    session_regenerate_id(true);
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['role'] = $user['role'];
    $_SESSION['privileges'] = json_decode($user['privileges'] ?: '{}', true) ?: [];
    $_SESSION['is_emergency_admin'] = $isEmergencyLogin;
    audit('auth.login.success', (int)$user['id'], $details);
    if (!$isEmergencyLogin) {
        $touchStmt = $conn->prepare('UPDATE users SET last_login_at = NOW(), is_online = 1 WHERE id = ?');
        $touchStmt->bind_param('i', $user['id']);
        $touchStmt->execute();
    }

    $redirect = match ($user['role']) {
        'super_admin' => '../html/super-admin.html',
        'admin' => '../html/admin.html',
        default => '../html/dashboard.html'
    };
    if (!empty($user['must_change_password'])) {
        $redirect = '../html/change-password.html';
    }
    return ['status' => 'success', 'message' => 'Login successful!', 'redirect' => $redirect];
}

// ---- Pending registrations -------------------------------------------------
// Accounts waiting for approval live only in `pending_registrations`, never in
// `users`. Approving moves a row into `users`; rejecting deletes it.

// Runs $fn while holding one database-wide lock, so "is this username/email/ID
// free?" and the insert that claims it happen as one step. Two windows (or two
// people) submitting the same identity at the same moment are queued, and the
// second one sees the first one's row instead of slipping past the check.
function with_identity_lock(callable $fn)
{
    global $conn;
    $got = (int)($conn->query("SELECT GET_LOCK('security2_identity', 10) AS got")->fetch_assoc()['got'] ?? 0);
    if ($got !== 1) {
        throw new RuntimeException('The system is busy. Please try again in a moment.');
    }
    try {
        return $fn();
    } finally {
        $conn->query("SELECT RELEASE_LOCK('security2_identity')");
    }
}

// MySQL error 1062 = a UNIQUE key refused a duplicate (the database's own last line of defence).
function is_duplicate_key_error(): bool
{
    global $conn;
    return (int)$conn->errno === 1062;
}

// Returns which identity field is already used by an account or a pending
// registration ('email', 'username' or 'id_number'), or null when all are free.
function identity_taken(string $email, string $username, string $idNumber): ?string
{
    global $conn;
    foreach (['users', 'pending_registrations'] as $table) {
        foreach (['email' => $email, 'username' => $username, 'id_number' => $idNumber] as $field => $value) {
            if ($value === '') {
                continue;
            }
            $stmt = $conn->prepare("SELECT 1 FROM $table WHERE $field = ? LIMIT 1");
            $stmt->bind_param('s', $value);
            $stmt->execute();
            if ($stmt->get_result()->fetch_row()) {
                return $field;
            }
        }
    }
    return null;
}

function identity_taken_message(string $field): string
{
    return [
        'email' => 'That email address is already registered or waiting for approval.',
        'username' => 'That username is already taken or waiting for approval.',
        'id_number' => 'That ID number is already registered or waiting for approval.',
    ][$field] ?? 'That account already exists.';
}

function list_pending_registrations(): array
{
    global $conn;
    $result = $conn->query('SELECT p.id, p.first_name, p.middle_name, p.last_name, p.suffix, p.id_number, p.email, p.username, p.submitted_at, creator.username AS created_by FROM pending_registrations p LEFT JOIN users creator ON creator.id = p.created_by ORDER BY p.submitted_at ASC');
    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
    return $rows;
}

function approve_pending_registration(int $pendingId): void
{
    with_identity_lock(fn() => approve_pending_registration_locked($pendingId));
}

function approve_pending_registration_locked(int $pendingId): void
{
    global $conn;
    $conn->begin_transaction();
    try {
        $stmt = $conn->prepare('SELECT * FROM pending_registrations WHERE id = ? FOR UPDATE');
        $stmt->bind_param('i', $pendingId);
        $stmt->execute();
        $pending = $stmt->get_result()->fetch_assoc();
        if (!$pending) {
            throw new RuntimeException('This registration is no longer waiting for approval.');
        }
        foreach (['email', 'username', 'id_number'] as $field) {
            $check = $conn->prepare("SELECT 1 FROM users WHERE $field = ? LIMIT 1");
            $check->bind_param('s', $pending[$field]);
            $check->execute();
            if ($check->get_result()->fetch_row()) {
                throw new RuntimeException("Cannot approve: another account already uses this $field.");
            }
        }

        // Accounts an Administrator created have no address or security questions
        // yet, so they start "incomplete": the first login with the temporary
        // password opens the setup wizard (onboarding.html) before the dashboard.
        $registrationStatus = $pending['question1'] === null ? 'incomplete' : 'complete';
        $insert = $conn->prepare('INSERT INTO users (first_name, middle_name, last_name, suffix, birthday, age, gender, id_number, email, username, password, street, region, barangay, barangay_code, city, province, country, zip_code, role, registration_status, account_status, privileges) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "user", ?, "approved", "{}")');
        $insert->bind_param('sssssi' . str_repeat('s', 14),
            $pending['first_name'], $pending['middle_name'], $pending['last_name'], $pending['suffix'],
            $pending['birthday'], $pending['age'], $pending['gender'], $pending['id_number'], $pending['email'],
            $pending['username'], $pending['password'], $pending['street'], $pending['region'], $pending['barangay'],
            $pending['barangay_code'], $pending['city'], $pending['province'], $pending['country'], $pending['zip_code'],
            $registrationStatus);
        if (!$insert->execute()) {
            throw new RuntimeException(is_duplicate_key_error()
                ? 'Cannot approve: another account already uses this username, email or ID number.'
                : 'Account could not be created: ' . $conn->error);
        }
        $userId = (int)$conn->insert_id;
        record_password_history($userId, $pending['password']);

        $role = $conn->prepare('INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE code = "user"');
        $role->bind_param('i', $userId);
        if (!$role->execute() || $role->affected_rows < 1) {
            throw new RuntimeException('Account permissions could not be assigned.');
        }

        if ($pending['question1'] !== null) {
            $questions = $conn->prepare('INSERT INTO security_questions (user_id, authQuestion1, authAnswer1, authQuestion2, authAnswer2, authQuestion3, authAnswer3) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $questions->bind_param('issssss', $userId, $pending['question1'], $pending['answer1'], $pending['question2'], $pending['answer2'], $pending['question3'], $pending['answer3']);
            if (!$questions->execute()) {
                throw new RuntimeException('Recovery questions could not be saved.');
            }
        }

        $remove = $conn->prepare('DELETE FROM pending_registrations WHERE id = ?');
        $remove->bind_param('i', $pendingId);
        $remove->execute();

        audit('accounts.approve', $userId, ['pending_id' => $pendingId]);
        $conn->commit();
    } catch (Throwable $error) {
        $conn->rollback();
        throw $error;
    }
    notify_account(account_snapshot($userId), 'approved');
}

function reject_pending_registration(int $pendingId, string $reason): void
{
    global $conn;
    $reason = trim($reason);
    if ($reason === '') {
        throw new InvalidArgumentException('A reason is required to reject a registration.');
    }
    $stmt = $conn->prepare('SELECT id, first_name, last_name, email, username FROM pending_registrations WHERE id = ?');
    $stmt->bind_param('i', $pendingId);
    $stmt->execute();
    $pending = $stmt->get_result()->fetch_assoc();
    if (!$pending) {
        throw new RuntimeException('This registration is no longer waiting for approval.');
    }
    $remove = $conn->prepare('DELETE FROM pending_registrations WHERE id = ?');
    $remove->bind_param('i', $pendingId);
    $remove->execute();
    if ($remove->affected_rows < 1) {
        throw new RuntimeException('This registration is no longer waiting for approval.');
    }
    audit('accounts.registration.reject', null, ['username' => $pending['username'], 'email' => $pending['email'], 'reason' => $reason]);
    notify_account($pending, 'rejected', ['reason' => $reason]);
}

// Saves a student's completed registration into pending_registrations (never
// `users`). $data holds already-validated fields; the password is a hash and the
// answers are hashed here. Duplicate-proof: the "is it taken?" check, the
// server-assigned ID number and the insert run under one lock.
function create_pending_registration(array $data, array $questions, array $answers): array
{
    global $conn;
    return with_identity_lock(function () use ($conn, $data, $questions, $answers) {
        $taken = identity_taken($data['email'], $data['username'], '');
        if ($taken !== null) {
            return ['status' => 'error', 'message' => identity_taken_message($taken)];
        }
        $idNumber = next_employee_id();
        $hashed = array_map(fn($answer) => password_hash(trim($answer), PASSWORD_DEFAULT), $answers);
        $stmt = $conn->prepare('INSERT INTO pending_registrations
            (first_name, middle_name, last_name, suffix, birthday, age, gender, id_number, email, username, password,
             street, region, barangay, barangay_code, city, province, country, zip_code,
             question1, answer1, question2, answer2, question3, answer3)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->bind_param('sssssi' . str_repeat('s', 19),
            $data['first_name'], $data['middle_name'], $data['last_name'], $data['suffix'],
            $data['birthday'], $data['age'], $data['gender'], $idNumber,
            $data['email'], $data['username'], $data['password_hash'],
            $data['street'], $data['region'], $data['barangay'], $data['barangay_code'],
            $data['city'], $data['province'], $data['country'], $data['zip_code'],
            $questions[0], $hashed[0], $questions[1], $hashed[1], $questions[2], $hashed[2]);
        if (!$stmt->execute()) {
            if (is_duplicate_key_error()) {
                return ['status' => 'error', 'message' => identity_taken_message(identity_taken($data['email'], $data['username'], '') ?? '')];
            }
            error_log('Pending registration insert failed: ' . $stmt->error);
            return ['status' => 'error', 'message' => 'Your registration could not be saved. Please try again.'];
        }
        return [
            'status' => 'success',
            'message' => "Registration submitted. Your ID number is $idNumber. You can log in once an administrator approves your account.",
            'redirect' => '../html/login.html',
        ];
    });
}
