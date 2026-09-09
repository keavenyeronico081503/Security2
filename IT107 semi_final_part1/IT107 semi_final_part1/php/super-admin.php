<?php
include 'admin_auth.php';
require_once 'account_service.php';

$action = $_GET['action'] ?? 'list';

if ($action === 'permission-catalog') {
    require_permission('permissions.assign');
    $result = $conn->query('SELECT code, label FROM permissions ORDER BY code');
    $permissions = [];
    while ($permission = $result->fetch_assoc()) $permissions[] = $permission;
    echo json_encode(['status' => 'success', 'permissions' => $permissions]);
    exit;
}

if ($action === 'list') {
    require_permission('accounts.view');
    deactivate_inactive_accounts();
    $search = trim($_GET['employee_id'] ?? '');
    $like = "%$search%";
    $stmt = $conn->prepare('SELECT id, first_name, last_name, id_number, email, username, role, account_status, privileges, created_at FROM users WHERE id_number LIKE ? AND username <> "Keavenyadmin1" ORDER BY created_at DESC');
    $stmt->bind_param('s', $like);
    $stmt->execute();
    $result = $stmt->get_result();
    $users = [];
    while ($user = $result->fetch_assoc()) {
        $user['privileges'] = json_decode($user['privileges'] ?: '{}', true) ?: [];
        $users[] = $user;
    }
    echo json_encode(['status' => 'success', 'users' => $users]);
    exit;
}

if ($action === 'delete-requests') {
    require_permission('accounts.delete.approve');
    $result = $conn->query('SELECT r.id, r.reason, r.status, r.decision_reason, r.created_at, r.reviewed_at, requester.username AS requested_by, target.id AS target_id, target.first_name, target.last_name, target.id_number, target.email, target.username FROM admin_delete_requests r LEFT JOIN users requester ON requester.id = r.requested_by LEFT JOIN users target ON target.id = r.target_user_id WHERE requester.username <> "Keavenyadmin1" AND target.username <> "Keavenyadmin1" ORDER BY r.created_at DESC');
    $requests = [];
    while ($request = $result->fetch_assoc()) $requests[] = $request;
    echo json_encode(['status' => 'success', 'requests' => $requests]);
    exit;
}

$data = request_json();
$userId = (int)($data['user_id'] ?? 0);

    if (in_array($action, ['approve', 'block', 'unblock'], true)) {
        require_permission($action === 'unblock' ? 'accounts.block' : "accounts.$action");
    $status = $action === 'approve' ? 'approved' : ($action === 'unblock' ? 'approved' : 'blocked');
    $stmt = $conn->prepare('UPDATE users SET account_status = ? WHERE id = ? AND role <> "super_admin"');
    $stmt->bind_param('si', $status, $userId);
    $stmt->execute();
    audit("accounts.$action", $userId);
    echo json_encode(['status' => 'success', 'message' => "Account $status."]);
    exit;
}

if ($action === 'privileges') {
    require_permission('permissions.assign');
    $privileges = array_keys(array_filter($data['privileges'] ?? [], fn ($value) => $value === true || $value === 1 || $value === '1'));
    foreach ($privileges as $privilege) {
        $validation = $conn->prepare('SELECT id FROM permissions WHERE code = ?');
        $validation->bind_param('s', $privilege);
        $validation->execute();
        if (!$validation->get_result()->fetch_assoc()) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'One or more selected permissions are invalid.']);
            exit;
        }
    }
    $privilegeJson = json_encode(array_fill_keys($privileges, true));
    $conn->begin_transaction();
    try {
        $clear = $conn->prepare('DELETE FROM user_permission_overrides WHERE user_id = ?');
        $clear->bind_param('i', $userId);
        $clear->execute();
        $permissionStmt = $conn->prepare('INSERT INTO user_permission_overrides (user_id, permission_id, effect) SELECT ?, id, "allow" FROM permissions WHERE code = ?');
        foreach ($privileges as $privilege) {
            $permissionStmt->bind_param('is', $userId, $privilege);
            $permissionStmt->execute();
        }
        $stmt = $conn->prepare('UPDATE users SET privileges = ? WHERE id = ? AND role <> "super_admin"');
        $stmt->bind_param('si', $privilegeJson, $userId);
        $stmt->execute();
        $conn->commit();
    } catch (Throwable $error) {
        $conn->rollback();
        throw $error;
    }
    audit('permissions.assign', $userId, ['privileges' => $privileges]);
    echo json_encode(['status' => 'success', 'message' => 'Privileges updated.']);
    exit;
}

if ($action === 'update') {
    require_permission('accounts.update');
    try {
        update_account($userId, $data);
        if (array_key_exists('role', $data) && $data['role'] !== '') {
            require_permission('roles.assign');
            change_account_role($userId, (string)$data['role']);
        }
        echo json_encode(['status' => 'success', 'message' => 'Account information updated.']);
    } catch (Throwable $error) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => $error->getMessage()]);
    }
    exit;
}

if ($action === 'reset-password') {
    require_permission('accounts.update');
    try {
        reset_account_password($userId);
        echo json_encode(['status' => 'success', 'message' => 'Password reset. An email with the new temporary password was sent to the account holder.']);
    } catch (Throwable $error) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => $error->getMessage()]);
    }
    exit;
}

if ($action === 'delete') {
    require_permission('accounts.delete.approve');
    if ($userId === (int)$_SESSION['user_id']) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'You cannot delete your own account.']);
        exit;
    }
    audit('accounts.delete.approve', $userId);
    $stmt = $conn->prepare('DELETE FROM users WHERE id = ? AND role <> "super_admin"');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    if ($stmt->affected_rows < 1) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Account was not deleted.']);
        exit;
    }
    echo json_encode(['status' => 'success', 'message' => 'Account deleted.']);
    exit;
}

if ($action === 'review-delete') {
    $reviewer = require_permission('accounts.delete.approve');
    $requestId = (int)($data['request_id'] ?? 0);
    $decision = ($data['decision'] ?? '') === 'approve' ? 'approve' : 'reject';
    $decisionReason = trim((string)($data['reason'] ?? ''));
    $stmt = $conn->prepare('SELECT target_user_id, status FROM admin_delete_requests WHERE id = ? FOR UPDATE');
    $stmt->bind_param('i', $requestId);
    $stmt->execute();
    $request = $stmt->get_result()->fetch_assoc();
    if (!$request || $request['status'] !== 'pending' || !$decisionReason) {
        throw new RuntimeException('This request is not available for review.');
    }
    $conn->begin_transaction();
    try {
        $status = $decision === 'approve' ? 'approved' : 'rejected';
        $update = $conn->prepare('UPDATE admin_delete_requests SET status = ?, decision_reason = ?, reviewed_by = ?, reviewed_at = NOW(), executed_at = IF(? = "approved", NOW(), NULL) WHERE id = ?');
        $update->bind_param('ssisi', $status, $decisionReason, $reviewer['id'], $status, $requestId);
        $update->execute();
        audit("accounts.delete.$decision", $request['target_user_id'], ['request_id' => $requestId, 'reason' => $decisionReason]);
        if ($decision === 'approve') {
            $delete = $conn->prepare('DELETE FROM users WHERE id = ? AND role <> "super_admin"');
            $delete->bind_param('i', $request['target_user_id']);
            $delete->execute();
        }
        $conn->commit();
    } catch (Throwable $error) {
        $conn->rollback();
        throw $error;
    }
    echo json_encode(['status' => 'success', 'message' => "Deletion request $status."]);
    exit;
}

if ($action === 'data-administrator-status') {
    require_super_admin();
    require_permission('accounts.create');
    $activeDataAdminResult = $conn->query('SELECT COUNT(*) AS total FROM users WHERE role = "data_administrator" AND account_status = "approved" AND username <> "Keavenyadmin1"');
    $activeDataAdministrators = (int)($activeDataAdminResult->fetch_assoc()['total'] ?? 0);
    echo json_encode(['status' => 'success', 'active_data_administrators' => $activeDataAdministrators]);
    exit;
}

if ($action === 'create') {
    require_super_admin();
    require_permission('accounts.create');
    $allowedRoles = ['admin', 'data_administrator', 'super_admin'];
    $role = in_array($data['role'] ?? '', $allowedRoles, true) ? $data['role'] : 'admin';
    $employeeId = next_employee_id();
    $username = trim((string)($data['username'] ?? ''));
    $temporaryPassword = (string)($data['password'] ?? '');
    if ($username === '' || $temporaryPassword === '') {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Username and temporary password are required.']);
        exit;
    }
    $password = password_hash($temporaryPassword, PASSWORD_DEFAULT);
    $status = 'approved';
    $firstName = 'Pending';
    $lastName = 'Account';
    $email = $employeeId . '@pending.local';
    $stmt = $conn->prepare('INSERT INTO users (first_name, last_name, birthday, age, gender, id_number, email, username, password, street, barangay, city, province, country, zip_code, registration_status, role, account_status, privileges) VALUES (?, ?, CURDATE(), 0, "Male", ?, ?, ?, ?, "", "", "", "", "", "", "incomplete", ?, ?, ?)');
    $privileges = json_encode($data['privileges'] ?? []);
    $stmt->bind_param('sssssssss', $firstName, $lastName, $employeeId, $email, $username, $password, $role, $status, $privileges);
    if (!$stmt->execute()) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Could not create account: ' . $conn->error]);
        exit;
    }
    $createdUserId = $conn->insert_id;
    $roleStmt = $conn->prepare('INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE code = ?');
    $roleStmt->bind_param('is', $createdUserId, $role);
    if (!$roleStmt->execute()) {
        $conn->query("DELETE FROM users WHERE id = " . (int)$createdUserId);
        throw new RuntimeException('Account role could not be assigned.');
    }
    audit('accounts.create', null, ['role' => $role, 'username' => $data['username']]);

    // Only one created (non-emergency) Super Administrator account may be active at a
    // time. Creating a new one automatically deactivates any other, leaving the
    // hardcoded emergency account (Keavenyadmin1) as the only always-available account.
    if ($role === 'super_admin') {
        $existing = $conn->prepare('SELECT id FROM users WHERE role = "super_admin" AND username <> "Keavenyadmin1" AND id <> ? AND account_status = "approved"');
        $existing->bind_param('i', $createdUserId);
        $existing->execute();
        $result = $existing->get_result();
        while ($row = $result->fetch_assoc()) {
            $deactivate = $conn->prepare('UPDATE users SET account_status = "blocked" WHERE id = ?');
            $deactivate->bind_param('i', $row['id']);
            $deactivate->execute();
            audit('accounts.block', (int)$row['id'], ['reason' => 'Automatically deactivated: a new Super Administrator account was created']);
        }
    }

    echo json_encode([
        'status' => 'success',
        'message' => ucfirst(str_replace('_', ' ', $role)) . ' account created. Give the account holder these credentials.',
        'credentials' => ['employee_id' => $employeeId, 'username' => $username]
    ]);
    exit;
}

http_response_code(400);
echo json_encode(['status' => 'error', 'message' => 'Unknown action.']);
