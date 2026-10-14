<?php
include 'admin_auth.php';
require_once 'account_service.php';

// Every action here is for the Super Administrator only. Administrators have some
// of the same permissions (block, approve, update) but must go through admin.php,
// where, for example, blocking is a request the Super Administrator reviews.
require_super_admin();

$action = $_GET['action'] ?? 'list';

if ($action === 'list') {
    require_permission('accounts.view');
    deactivate_inactive_accounts();
    $search = trim($_GET['employee_id'] ?? '');
    $like = "%$search%";
    $role = trim($_GET['role'] ?? '');
    $stmt = $conn->prepare('SELECT id, first_name, last_name, id_number, email, username, role, account_status, is_online, privileges, created_at FROM users WHERE id_number LIKE ? AND username <> "Keavenyadmin1" AND (? = "" OR role = ?) ORDER BY created_at DESC');
    $stmt->bind_param('sss', $like, $role, $role);
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
    $result = $conn->query('SELECT r.id, r.reason, r.status, r.decision_reason, r.created_at, r.reviewed_at, COALESCE(requester.username, r.requester_username) AS requested_by, target.id AS target_id, target.first_name, target.last_name, COALESCE(target.id_number, r.target_id_number) AS id_number, target.email, target.username, r.target_name FROM admin_delete_requests r LEFT JOIN users requester ON requester.id = r.requested_by LEFT JOIN users target ON target.id = r.target_user_id WHERE COALESCE(requester.username, r.requester_username, "") <> "Keavenyadmin1" AND COALESCE(target.username, "") <> "Keavenyadmin1" ORDER BY r.created_at DESC');
    $requests = [];
    while ($request = $result->fetch_assoc()) $requests[] = $request;
    echo json_encode(['status' => 'success', 'requests' => $requests]);
    exit;
}

// Review Account popup: everything a Super Administrator should see about an account
// before deciding a deletion request (identity, login record, privileges, most-used
// modules and recent activity). Opening it is itself audited.
if ($action === 'review-account') {
    require_permission('accounts.delete.approve');
    require_once 'audit_format.php';
    $requestId = (int)($_GET['request_id'] ?? 0);
    $stmt = $conn->prepare('SELECT r.id, r.reason, r.status, r.decision_reason, r.created_at, r.reviewed_at, r.target_user_id, r.target_name, r.target_id_number,
            COALESCE(requester.username, r.requester_username) AS requested_by, reviewer.username AS reviewed_by
        FROM admin_delete_requests r
        LEFT JOIN users requester ON requester.id = r.requested_by
        LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
        WHERE r.id = ?');
    $stmt->bind_param('i', $requestId);
    $stmt->execute();
    $request = $stmt->get_result()->fetch_assoc();
    if (!$request || strcasecmp((string)$request['requested_by'], 'Keavenyadmin1') === 0) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Deletion request not found.']);
        exit;
    }
    // A reviewed request with no reviewer row was decided by the emergency account.
    if ($request['status'] !== 'pending' && !$request['reviewed_by']) $request['reviewed_by'] = 'Super Administrator';

    $targetId = (int)$request['target_user_id'];
    $account = null;
    if ($targetId > 0) {
        $stmt = $conn->prepare('SELECT id, first_name, middle_name, last_name, suffix, username, id_number, email, role, account_status, is_online, created_at, registered_at, last_login_at FROM users WHERE id = ?');
        $stmt->bind_param('i', $targetId);
        $stmt->execute();
        $account = $stmt->get_result()->fetch_assoc();
    }
    if ($account && strcasecmp($account['username'], 'Keavenyadmin1') === 0) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Deletion request not found.']);
        exit;
    }
    audit('accounts.review', $targetId ?: null, ['request_id' => $requestId]);

    $response = ['status' => 'success', 'request' => $request, 'account' => $account];
    if (!$account) {
        // The account was deleted: its activity is no longer linked to it.
        echo json_encode($response);
        exit;
    }

    $one = function (string $sql, string $types, ...$params) use ($conn) {
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        return $stmt->get_result()->fetch_assoc();
    };
    $all = function (string $sql, string $types, ...$params) use ($conn) {
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    };
    // Failed logins are matched the same way as the login report: by target id, or by
    // the typed username when the attempt never resolved to an account (e.g. a lockout).
    $failedMatch = 'action_code = "auth.login.failed" AND (target_user_id = ? OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(details, "$.username"))) = LOWER(?))';
    $logins = $one('SELECT COUNT(*) AS total, SUM(created_at >= NOW() - INTERVAL 30 DAY) AS recent, MAX(created_at) AS last_at FROM audit_logs WHERE action_code = "auth.login.success" AND actor_user_id = ?', 'i', $targetId);
    $failed = $one("SELECT COUNT(*) AS total, SUM(created_at >= NOW() - INTERVAL 30 DAY) AS recent FROM audit_logs WHERE $failedMatch", 'is', $targetId, $account['username']);
    $failedRecent = $all("SELECT created_at, ip_address, failure_reason FROM audit_logs WHERE $failedMatch ORDER BY created_at DESC LIMIT 5", 'is', $targetId, $account['username']);

    $modules = array_map(function ($row) {
        $label = format_action_label(['action_code' => 'module.open', 'details' => ['module' => $row['module']]]);
        return ['module' => $row['module'], 'label' => preg_replace('/^Opened /', '', $label), 'count' => (int)$row['opens']];
    }, $all('SELECT JSON_UNQUOTE(JSON_EXTRACT(details, "$.module")) AS module, COUNT(*) AS opens FROM audit_logs WHERE action_code = "module.open" AND actor_user_id = ? GROUP BY module ORDER BY opens DESC LIMIT 5', 'i', $targetId));

    // Module opens are summarized above, so the timeline shows real transactions only.
    $activity = array_map(function ($row) use ($targetId) {
        $row['details'] = json_decode((string)$row['details'], true) ?: [];
        $byAccount = (int)$row['actor_user_id'] === $targetId;
        return [
            'created_at' => $row['created_at'],
            'label' => format_action_label($row),
            // A failed login has no actor: someone typed this username from an IP address.
            'by' => $byAccount ? 'This account' : ($row['action_code'] === 'auth.login.failed' ? 'Attempt from ' . ($row['ip_address'] ?: 'unknown IP') : ($row['actor_username'] ?: 'System')),
            'on' => $byAccount && $row['target_user_id'] && (int)$row['target_user_id'] !== $targetId ? format_action_target($row) : null,
            'success' => (bool)$row['success'],
            'failure_reason' => $row['failure_reason'],
        ];
    }, $all('SELECT action_code, actor_user_id, actor_username, target_user_id, target_username, target_employee_id, target_role, details, success, failure_reason, ip_address, created_at FROM audit_logs WHERE (actor_user_id = ? OR target_user_id = ?) AND action_code <> "module.open" AND COALESCE(actor_username, "") <> "Keavenyadmin1" ORDER BY created_at DESC, id DESC LIMIT 15', 'ii', $targetId, $targetId));

    $privileges = account_permissions($targetId);
    $pendingBlock = (int)$one('SELECT COUNT(*) AS n FROM admin_block_requests WHERE target_user_id = ? AND status = "pending"', 'i', $targetId)['n'];
    $lastLogin = $logins['last_at'] ?: $account['last_login_at'];
    $memberSince = $account['registered_at'] ?: $account['created_at'];
    $inactiveDays = $lastLogin ? (int)floor((time() - strtotime($lastLogin)) / 86400) : null;

    // Attention flags, most serious first; the popup only shows the ones that apply.
    $flags = [];
    if ((int)$failed['recent'] > 0) $flags[] = ['level' => (int)$failed['recent'] >= 5 ? 'danger' : 'warn', 'text' => $failed['recent'] . ' failed login' . ((int)$failed['recent'] === 1 ? '' : 's') . ' in the last 30 days'];
    if ($account['is_online']) $flags[] = ['level' => 'warn', 'text' => 'Currently online'];
    if ($privileges['extra']) $flags[] = ['level' => 'warn', 'text' => 'Has ' . count($privileges['extra']) . ' extra privilege' . (count($privileges['extra']) === 1 ? '' : 's') . ' beyond its role'];
    if ($account['account_status'] === 'blocked') $flags[] = ['level' => 'info', 'text' => 'Account is blocked'];
    if ($pendingBlock) $flags[] = ['level' => 'info', 'text' => 'Has a pending block request'];
    if (!$lastLogin) $flags[] = ['level' => 'info', 'text' => 'Never logged in'];
    elseif ($inactiveDays >= 14) $flags[] = ['level' => 'info', 'text' => "Inactive for $inactiveDays days"];

    $response += [
        'flags' => $flags,
        'stats' => [
            'logins_total' => (int)$logins['total'], 'logins_recent' => (int)$logins['recent'],
            'failed_total' => (int)$failed['total'], 'failed_recent' => (int)$failed['recent'],
            'last_login' => $lastLogin, 'member_since' => $memberSince,
        ],
        'role_label' => format_position($account['role']),
        'privileges' => $privileges,
        'modules' => $modules,
        'failed_logins' => $failedRecent,
        'activity' => $activity,
    ];
    echo json_encode($response);
    exit;
}

// ---- Manage access ----
// Administrators and Users with how far their access differs from their role, and
// who last changed it.
if ($action === 'access-list') {
    require_permission('permissions.assign');
    $rows = $conn->query('SELECT u.id, u.first_name, u.last_name, u.id_number, u.username, u.email, u.role, u.account_status,
            (SELECT COUNT(*) FROM user_permission_overrides o WHERE o.user_id = u.id AND o.effect = "allow") AS extra_count,
            (SELECT COUNT(*) FROM user_permission_overrides o WHERE o.user_id = u.id AND o.effect = "deny") AS removed_count,
            last.actor_username AS changed_by, last.created_at AS changed_at
        FROM users u
        LEFT JOIN audit_logs last ON last.id = (SELECT a.id FROM audit_logs a WHERE a.target_user_id = u.id AND a.action_code IN ("permissions.assign", "accounts.role_change") ORDER BY a.id DESC LIMIT 1)
        WHERE u.role IN ("admin", "user") AND u.username <> "Keavenyadmin1"
        ORDER BY FIELD(u.role, "admin", "user"), u.first_name, u.last_name')->fetch_all(MYSQLI_ASSOC);
    foreach ($rows as &$row) {
        // Changes made by the emergency account show as the role, not the hidden username.
        if ($row['changed_by'] !== null && strcasecmp($row['changed_by'], 'Keavenyadmin1') === 0) $row['changed_by'] = 'Super Administrator';
    }
    echo json_encode(['status' => 'success', 'accounts' => $rows]);
    exit;
}

// One account's access: role defaults, extras, removals, and what may be changed.
if ($action === 'access-detail') {
    require_permission('permissions.assign');
    $targetId = (int)($_GET['user_id'] ?? 0);
    $account = account_snapshot($targetId);
    if (!$account || !in_array($account['role'], ['admin', 'user'], true) || strcasecmp($account['username'], 'Keavenyadmin1') === 0) {
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Account not found.']);
        exit;
    }
    $catalog = $conn->query('SELECT code, label FROM permissions ORDER BY code')->fetch_all(MYSQLI_ASSOC);
    echo json_encode([
        'status' => 'success',
        'account' => $account,
        'permissions' => account_permissions($targetId),
        'role_defaults' => role_permission_codes($account['role']),
        'catalog' => $catalog,
        'grantable' => $account['role'] === 'admin' ? ADMIN_GRANTABLE : [],
        'locked' => ACCESS_LOCKED,
    ]);
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
    $changed = $stmt->affected_rows > 0;
    audit("accounts.$action", $userId);
    if ($changed) {
        notify_account(account_snapshot($userId), $action === 'approve' ? 'approved' : ($action === 'unblock' ? 'unblocked' : 'blocked'), ['reason' => trim((string)($data['reason'] ?? ''))]);
    }
    echo json_encode(['status' => 'success', 'message' => "Account $status."]);
    exit;
}

if ($action === 'reactivate') {
    // The generic approve/block/unblock action above deliberately excludes
    // role = "super_admin" (see its WHERE clause) since deactivating/reactivating a
    // Super Administrator has handoff consequences a plain admin
    // block does not. Only another Super Administrator may perform this.
    require_super_admin();
    require_permission('accounts.block');
    $target = $conn->prepare('SELECT id, account_status FROM users WHERE id = ? AND role = "super_admin" AND username <> "Keavenyadmin1"');
    $target->bind_param('i', $userId);
    $target->execute();
    $targetRow = $target->get_result()->fetch_assoc();
    if (!$targetRow || $targetRow['account_status'] !== 'blocked') {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Only a deactivated Super Administrator account can be reactivated.']);
        exit;
    }

    $reactivate = $conn->prepare('UPDATE users SET account_status = "approved", deactivate_on_logout = 0 WHERE id = ?');
    $reactivate->bind_param('i', $userId);
    $reactivate->execute();
    audit('accounts.approve', $userId, ['reason' => 'Reactivated as Super Administrator']);
    notify_account(account_snapshot($userId), 'unblocked');

    // As with creating a new Super Administrator, the account performing this
    // reactivation is flagged to step down once it logs out, so both accounts can
    // stay active during the handoff instead of one being kicked immediately.
    $actorId = (int)($_SESSION['user_id'] ?? 0);
    if ($actorId > 0) {
        $flagActor = $conn->prepare('UPDATE users SET deactivate_on_logout = 1 WHERE id = ?');
        $flagActor->bind_param('i', $actorId);
        $flagActor->execute();
    }

    echo json_encode(['status' => 'success', 'message' => 'Super Administrator account reactivated.']);
    exit;
}

if ($action === 'privileges') {
    require_permission('permissions.assign');
    try {
        $result = set_account_access($userId, (array)($data['enabled'] ?? []), (string)($data['reason'] ?? ''));
        $parts = [];
        if ($result['added']) $parts[] = count($result['added']) . ' added';
        if ($result['removed']) $parts[] = count($result['removed']) . ' removed';
        echo json_encode(['status' => 'success', 'message' => 'Access updated (' . implode(', ', $parts) . '). The account holder was notified by email.']);
    } catch (Throwable $error) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => $error->getMessage()]);
    }
    exit;
}

if ($action === 'change-role') {
    require_permission('permissions.assign');
    try {
        $result = change_account_role($userId, (string)($data['role'] ?? ''), (string)($data['email'] ?? ''), (string)($data['reason'] ?? ''), (int)($_SESSION['user_id'] ?? 0));
        $roleName = $result['role'] === 'admin' ? 'Administrator' : 'User';
        echo json_encode(['status' => 'success', 'message' => "Role changed to $roleName. A temporary password was emailed to {$result['email']}."]);
    } catch (Throwable $error) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => $error->getMessage()]);
    }
    exit;
}

if ($action === 'update') {
    require_permission('accounts.update');
    try {
        update_account($userId, $data);
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
    $reason = trim((string)($data['reason'] ?? ''));
    if ($reason === '') {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'A reason is required to delete this account.']);
        exit;
    }
    // Distinct from 'accounts.delete.approve' (used for accepting a pending deletion
    // request) so the audit log doesn't mislabel a direct delete as "Accepted deletion request".
    // The audit row is written first so it can still copy the target's username, but
    // it only commits together with the delete, so a failed delete leaves no record.
    $deletedAccount = account_snapshot($userId);
    $conn->begin_transaction();
    audit('accounts.delete', $userId, ['reason' => $reason]);
    $stmt = $conn->prepare('DELETE FROM users WHERE id = ? AND role <> "super_admin"');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    if ($stmt->affected_rows < 1) {
        $conn->rollback();
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Account was not deleted.']);
        exit;
    }
    $conn->commit();
    notify_account($deletedAccount, 'deleted', ['reason' => $reason]);
    echo json_encode(['status' => 'success', 'message' => 'Account deleted.']);
    exit;
}

if ($action === 'review-delete') {
    $reviewer = require_permission('accounts.delete.approve');
    $requestId = (int)($data['request_id'] ?? 0);
    $decision = ($data['decision'] ?? '') === 'approve' ? 'approve' : 'reject';
    $decisionReason = trim((string)($data['reason'] ?? ''));
    // Lock the request row inside the transaction so two reviewers can't both act on it.
    $conn->begin_transaction();
    $stmt = $conn->prepare('SELECT target_user_id, status FROM admin_delete_requests WHERE id = ? FOR UPDATE');
    $stmt->bind_param('i', $requestId);
    $stmt->execute();
    $request = $stmt->get_result()->fetch_assoc();
    if (!$request || $request['status'] !== 'pending' || !$decisionReason) {
        $conn->rollback();
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'This request is not available for review.']);
        exit;
    }
    try {
        $status = $decision === 'approve' ? 'approved' : 'rejected';
        // The emergency admin has no row in `users` (see emergency_admin.php), and
        // reviewed_by has a hard foreign key to users.id, so its placeholder id (0)
        // must be stored as NULL instead — same fix audit_service.php already
        // applies to actor_user_id for the same reason.
        $reviewerId = ((int)$reviewer['id']) > 0 ? (int)$reviewer['id'] : null;
        $update = $conn->prepare('UPDATE admin_delete_requests SET status = ?, decision_reason = ?, reviewed_by = ?, reviewed_at = NOW(), executed_at = IF(? = "approved", NOW(), NULL) WHERE id = ?');
        $update->bind_param('ssisi', $status, $decisionReason, $reviewerId, $status, $requestId);
        $update->execute();
        audit("accounts.delete.$decision", $request['target_user_id'], ['request_id' => $requestId, 'reason' => $decisionReason]);
        $deletedAccount = null;
        if ($decision === 'approve') {
            $deletedAccount = account_snapshot((int)$request['target_user_id']);
            $delete = $conn->prepare('DELETE FROM users WHERE id = ? AND role <> "super_admin"');
            $delete->bind_param('i', $request['target_user_id']);
            $delete->execute();
            if ($delete->affected_rows < 1) {
                // Keep the request pending instead of marking it approved for an
                // account that was never actually deleted.
                $conn->rollback();
                http_response_code(400);
                echo json_encode(['status' => 'error', 'message' => 'This account can no longer be deleted.']);
                exit;
            }
        }
        $conn->commit();
    } catch (Throwable $error) {
        $conn->rollback();
        throw $error;
    }
    notify_account($deletedAccount, 'deleted', ['reason' => $decisionReason]);
    echo json_encode(['status' => 'success', 'message' => "Deletion request $status."]);
    exit;
}

if ($action === 'create') {
    require_super_admin();
    require_permission('accounts.create');
    $allowedRoles = ['admin', 'super_admin'];
    $role = in_array($data['role'] ?? '', $allowedRoles, true) ? $data['role'] : 'admin';
    $username = trim((string)($data['username'] ?? ''));
    $temporaryPassword = (string)($data['password'] ?? '');
    $problem = validate_name_fields(['username' => $username])
        ?? password_rule_problem($temporaryPassword, $temporaryPassword)
        ?? password_problem_on_submit($temporaryPassword, 'create_administrator');
    if ($problem !== null) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => $problem]);
        exit;
    }
    $password = password_hash($temporaryPassword, PASSWORD_DEFAULT);
    $privileges = json_encode($data['privileges'] ?? []);
    // Duplicate check, ID number and insert run under one lock (see with_identity_lock()).
    $created = with_identity_lock(function () use ($conn, $username, $password, $role, $privileges) {
        $taken = identity_taken('', $username, '');
        if ($taken !== null) {
            return ['error' => identity_taken_message($taken)];
        }
        $employeeId = next_employee_id();
        $status = 'approved';
        $firstName = 'Pending';
        $lastName = 'Account';
        $email = $employeeId . '@pending.local';
        $stmt = $conn->prepare('INSERT INTO users (first_name, last_name, birthday, age, gender, id_number, email, username, password, street, barangay, city, province, country, zip_code, registration_status, role, account_status, privileges) VALUES (?, ?, CURDATE(), 0, "Male", ?, ?, ?, ?, "", "", "", "", "", "", "incomplete", ?, ?, ?)');
        $stmt->bind_param('sssssssss', $firstName, $lastName, $employeeId, $email, $username, $password, $role, $status, $privileges);
        if (!$stmt->execute()) {
            return ['error' => is_duplicate_key_error() ? identity_taken_message('username') : 'Could not create account: ' . $conn->error];
        }
        $createdUserId = (int)$conn->insert_id;
        $roleStmt = $conn->prepare('INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE code = ?');
        $roleStmt->bind_param('is', $createdUserId, $role);
        if (!$roleStmt->execute()) {
            $conn->query("DELETE FROM users WHERE id = " . $createdUserId);
            return ['error' => 'Account role could not be assigned.'];
        }
        return ['employee_id' => $employeeId];
    });
    if (isset($created['error'])) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => $created['error']]);
        exit;
    }
    $employeeId = $created['employee_id'];
    audit('accounts.create', null, ['role' => $role, 'username' => $username]);

    // Only one created (non-emergency) Super Administrator account is meant to stay
    // active long-term, but a brand-new one and the admin who created it may both be
    // active at once during the handoff. The creator is flagged to step down the
    // moment they log out (see logout.php), rather than being kicked immediately -
    // the emergency account (Keavenyadmin1) has no row here and is never flagged.
    if ($role === 'super_admin') {
        $creatorId = (int)($_SESSION['user_id'] ?? 0);
        if ($creatorId > 0) {
            $flagCreator = $conn->prepare('UPDATE users SET deactivate_on_logout = 1 WHERE id = ?');
            $flagCreator->bind_param('i', $creatorId);
            $flagCreator->execute();
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
