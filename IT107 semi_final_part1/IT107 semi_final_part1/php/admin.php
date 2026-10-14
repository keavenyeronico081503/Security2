<?php
require_once 'account_service.php';
header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? 'list';
$data = request_json();
$user = null;

try {
    if ($action === 'list') {
        require_permission('accounts.view');
        echo json_encode(['status' => 'success', 'users' => list_accounts(trim($_GET['employee_id'] ?? ''), (string)($_GET['role'] ?? ''))]);
        exit;
    }

    // Registrations waiting for approval (stored outside `users`). The Super
    // Administrator page uses these same endpoints.
    if ($action === 'pending-list') {
        require_permission('accounts.approve');
        echo json_encode(['status' => 'success', 'registrations' => list_pending_registrations()]);
        exit;
    }

    if ($action === 'approve-registration') {
        require_permission('accounts.approve');
        approve_pending_registration((int)($data['pending_id'] ?? 0));
        echo json_encode(['status' => 'success', 'message' => 'Registration approved. The account can now log in.']);
        exit;
    }

    if ($action === 'reject-registration') {
        require_permission('accounts.approve');
        reject_pending_registration((int)($data['pending_id'] ?? 0), (string)($data['reason'] ?? ''));
        echo json_encode(['status' => 'success', 'message' => 'Registration rejected.']);
        exit;
    }

    if ($action === 'update') {
        $user = require_permission('accounts.update');
        update_account((int)($data['user_id'] ?? 0), $data);
        echo json_encode(['status' => 'success', 'message' => 'Account information updated.']);
        exit;
    }

    if ($action === 'reset-password') {
        $user = require_permission('accounts.update');
        reset_account_password((int)($data['user_id'] ?? 0));
        echo json_encode(['status' => 'success', 'message' => 'Password reset. An email with the new temporary password was sent to the account holder.']);
        exit;
    }

    if ($action === 'block-requests') {
        $user = require_permission('accounts.block.review');
        $result = $conn->query('SELECT r.id, r.reason, r.status, r.created_at, requester.username AS requested_by, target.id AS target_id, target.first_name, target.last_name, target.username, target.id_number FROM admin_block_requests r JOIN users requester ON requester.id = r.requested_by JOIN users target ON target.id = r.target_user_id ORDER BY r.created_at DESC');
        $requests = [];
        while ($request = $result->fetch_assoc()) $requests[] = $request;
        echo json_encode(['status' => 'success', 'requests' => $requests]);
        exit;
    }

    if ($action === 'review-block-request') {
        $user = require_permission('accounts.block.review');
        $requestId = (int)($data['request_id'] ?? 0);
        $decision = ($data['decision'] ?? '') === 'approve' ? 'approved' : 'rejected';
        $reason = trim((string)($data['reason'] ?? ''));
        $stmt = $conn->prepare('SELECT target_user_id, status FROM admin_block_requests WHERE id = ?');
        $stmt->bind_param('i', $requestId);
        $stmt->execute();
        $request = $stmt->get_result()->fetch_assoc();
        if (!$request || $request['status'] !== 'pending') throw new RuntimeException('This block request is no longer pending.');
        $conn->begin_transaction();
        $review = $conn->prepare('UPDATE admin_block_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW(), decision_reason = ? WHERE id = ?');
        // The emergency Super Administrator has no `users` row (id 0), so store NULL.
        $reviewerId = (int)$user['id'] > 0 ? (int)$user['id'] : null;
        $review->bind_param('sisi', $decision, $reviewerId, $reason, $requestId);
        $review->execute();
        $blocked = false;
        if ($decision === 'approved') {
            $status = 'blocked';
            $block = $conn->prepare('UPDATE users SET account_status = ? WHERE id = ? AND role <> "super_admin"');
            $block->bind_param('si', $status, $request['target_user_id']);
            $block->execute();
            $blocked = $block->affected_rows > 0;
        }
        audit("accounts.block.$decision", (int)$request['target_user_id'], ['request_id' => $requestId, 'reason' => $reason]);
        $conn->commit();
        if ($blocked) {
            notify_account(account_snapshot((int)$request['target_user_id']), 'blocked', ['reason' => $reason]);
        }
        echo json_encode(['status' => 'success', 'message' => "Block request $decision."]);
        exit;
    }

    if (in_array($action, ['approve', 'block', 'unblock'], true)) {
        $user = require_permission($action === 'unblock' ? 'accounts.block' : "accounts.$action");
        $targetId = (int)($data['user_id'] ?? 0);
        if ($action === 'block' && $user['role_code'] === 'admin') {
            $reason = trim((string)($data['reason'] ?? ''));
            if ($reason === '') throw new InvalidArgumentException('A reason is required for a block request.');
            $request = $conn->prepare('INSERT INTO admin_block_requests (requested_by, target_user_id, reason) SELECT ?, id, ? FROM users WHERE id = ? AND role <> "super_admin" AND account_status <> "blocked"');
            $request->bind_param('isi', $user['id'], $reason, $targetId);
            if (!$request->execute() || $request->affected_rows < 1) throw new RuntimeException('Block request could not be created.');
            audit('accounts.block.request', $targetId, ['reason' => $reason]);
            echo json_encode(['status' => 'success', 'message' => 'Block request sent to the Super Administrator.']);
            exit;
        }
        $oldValues = account_snapshot($targetId);
        $status = $action === 'approve' ? 'approved' : ($action === 'unblock' ? 'approved' : 'blocked');
        $stmt = $conn->prepare('UPDATE users SET account_status = ? WHERE id = ? AND role <> "super_admin"');
        $stmt->bind_param('si', $status, $targetId);
        if (!$stmt->execute() || $stmt->affected_rows < 1) {
            throw new RuntimeException('Account status was not changed.');
        }
        $newValues = account_snapshot($targetId);
        audit("accounts.$action", $targetId, ['reason' => trim((string)($data['reason'] ?? ''))], $oldValues, $newValues);
        notify_account($newValues, $action === 'approve' ? 'approved' : ($action === 'unblock' ? 'unblocked' : 'blocked'), ['reason' => trim((string)($data['reason'] ?? ''))]);
        echo json_encode(['status' => 'success', 'message' => "Account $status."]);
        exit;
    }

    if ($action === 'request-delete') {
        $user = require_permission('accounts.delete.request');
        request_account_deletion((int)$user['id'], (int)($data['user_id'] ?? 0), (string)($data['reason'] ?? ''));
        echo json_encode(['status' => 'success', 'message' => 'Deletion request sent to Super Administrator.']);
        exit;
    }

    if ($action === 'create') {
        $user = require_permission('accounts.create');
        foreach (['first_name', 'last_name', 'email', 'username', 'password'] as $field) {
            $data[$field] = trim((string)($data[$field] ?? ''));
            if ($data[$field] === '') {
                throw new InvalidArgumentException('All account fields are required.');
            }
        }
        if (!is_institutional_email($data['email'])) {
            throw new InvalidArgumentException(institutional_email_error_message());
        }
        $problem = validate_name_fields(['first_name' => $data['first_name'], 'last_name' => $data['last_name'], 'username' => $data['username']])
            ?? password_rule_problem($data['password'], $data['password'])
            ?? password_problem_on_submit($data['password'], 'admin_create_user');
        if ($problem !== null) {
            throw new InvalidArgumentException($problem);
        }
        // Like self-registrations, admin-created users wait in pending_registrations
        // (not `users`) until an Admin or Super Admin approves them. The duplicate
        // check, the ID number and the insert run under one lock (see with_identity_lock).
        $password = password_hash((string)$data['password'], PASSWORD_DEFAULT);
        $creatorId = (int)$user['id'] > 0 ? (int)$user['id'] : null;
        $employeeId = with_identity_lock(function () use ($conn, $data, $password, $creatorId) {
            $taken = identity_taken((string)$data['email'], (string)$data['username'], '');
            if ($taken !== null) {
                throw new InvalidArgumentException(identity_taken_message($taken));
            }
            $employeeId = next_employee_id();
            $stmt = $conn->prepare('INSERT INTO pending_registrations (first_name, last_name, birthday, age, gender, id_number, email, username, password, street, barangay, city, province, country, zip_code, created_by) VALUES (?, ?, CURDATE(), 0, "Male", ?, ?, ?, ?, "", "", "", "", "", "", ?)');
            $stmt->bind_param('ssssssi', $data['first_name'], $data['last_name'], $employeeId, $data['email'], $data['username'], $password, $creatorId);
            if (!$stmt->execute()) {
                throw new RuntimeException(is_duplicate_key_error()
                    ? identity_taken_message(identity_taken((string)$data['email'], (string)$data['username'], '') ?? '')
                    : 'Could not create account: ' . $conn->error);
            }
            return $employeeId;
        });
        audit('accounts.create', null, ['role' => 'user', 'username' => $data['username'], 'pending' => true]);
        echo json_encode([
            'status' => 'success',
            'message' => 'User account created and sent for approval.',
            'credentials' => ['employee_id' => $employeeId, 'username' => $data['username']],
        ]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Unknown Administrator action.']);
} catch (Throwable $error) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => $error->getMessage()]);
}
