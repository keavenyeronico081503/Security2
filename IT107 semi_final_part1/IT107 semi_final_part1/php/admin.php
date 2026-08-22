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

    if (in_array($action, ['approve', 'block'], true)) {
        $user = require_permission("accounts.$action");
        $targetId = (int)($data['user_id'] ?? 0);
        $oldValues = account_snapshot($targetId);
        $status = $action === 'approve' ? 'approved' : 'blocked';
        $stmt = $conn->prepare('UPDATE users SET account_status = ? WHERE id = ? AND role <> "super_admin"');
        $stmt->bind_param('si', $status, $targetId);
        if (!$stmt->execute() || $stmt->affected_rows < 1) {
            throw new RuntimeException('Account status was not changed.');
        }
        $newValues = account_snapshot($targetId);
        audit("accounts.$action", $targetId, [], $oldValues, $newValues);
        echo json_encode(['status' => 'success', 'message' => "Account $status."]);
        exit;
    }

    if ($action === 'request-delete') {
        $user = require_permission('accounts.delete.request');
        request_account_deletion((int)$user['id'], (int)($data['user_id'] ?? 0), (string)($data['reason'] ?? ''));
        echo json_encode(['status' => 'success', 'message' => 'Deletion request sent to Super Administrator.']);
        exit;
    }

    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Unknown Administrator action.']);
} catch (Throwable $error) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => $error->getMessage()]);
}
