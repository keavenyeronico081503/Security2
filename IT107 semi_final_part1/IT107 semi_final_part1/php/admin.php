<?php
require_once 'account_service.php';
header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? 'list';
$data = request_json();
$user = null;

try {
    if ($action === 'list') {
        require_permission('accounts.view');
        echo json_encode(['status' => 'success', 'users' => list_accounts(trim($_GET['employee_id'] ?? ''))]);
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
        $review->bind_param('sisi', $decision, $user['id'], $reason, $requestId);
        $review->execute();
        if ($decision === 'approved') {
            $status = 'blocked';
            $block = $conn->prepare('UPDATE users SET account_status = ? WHERE id = ? AND role <> "super_admin"');
            $block->bind_param('si', $status, $request['target_user_id']);
            $block->execute();
        }
        audit("accounts.block.$decision", (int)$request['target_user_id'], ['request_id' => $requestId, 'reason' => $reason]);
        $conn->commit();
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
            echo json_encode(['status' => 'success', 'message' => 'Block request sent to the Data Administrator.']);
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
        $required = ['first_name', 'last_name', 'id_number', 'email', 'username', 'password'];
        foreach ($required as $field) {
            if (trim((string)($data[$field] ?? '')) === '') {
                throw new InvalidArgumentException('All account fields are required.');
            }
        }
        if (strlen((string)$data['password']) < 8) {
            throw new InvalidArgumentException('Password must be at least 8 characters long.');
        }
        if (!is_institutional_email((string)$data['email'])) {
            throw new InvalidArgumentException(institutional_email_error_message());
        }
        $employeeId = next_employee_id();
        $password = password_hash((string)$data['password'], PASSWORD_DEFAULT);
        $role = 'user';
        $status = 'pending';
        $stmt = $conn->prepare('INSERT INTO users (first_name, last_name, birthday, age, gender, id_number, email, username, password, street, barangay, city, province, country, zip_code, registration_status, role, account_status, privileges) VALUES (?, ?, CURDATE(), 0, "Male", ?, ?, ?, ?, "", "", "", "", "", "", "complete", ?, ?, "{}")');
        $stmt->bind_param('ssssssss', $data['first_name'], $data['last_name'], $employeeId, $data['email'], $data['username'], $password, $role, $status);
        if (!$stmt->execute()) {
            throw new RuntimeException('Could not create account: ' . $conn->error);
        }
        $createdUserId = $conn->insert_id;
        $roleStmt = $conn->prepare('INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE code = "user"');
        $roleStmt->bind_param('i', $createdUserId);
        if (!$roleStmt->execute()) {
            $conn->query('DELETE FROM users WHERE id = ' . (int)$createdUserId);
            throw new RuntimeException('Account role could not be assigned.');
        }
        audit('accounts.create', $createdUserId, ['role' => $role, 'username' => $data['username']]);
        echo json_encode(['status' => 'success', 'message' => 'User account created and sent for approval.']);
        exit;
    }

    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Unknown Administrator action.']);
} catch (Throwable $error) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => $error->getMessage()]);
}
