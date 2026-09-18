<?php
require_once 'auth.php';
header('Content-Type: application/json; charset=utf-8');

// Logged the moment "Print report" is clicked, before window.print() ever runs, so the
// attempt is recorded even if the print dialog is then cancelled or the print fails —
// what matters for the activity log is that this account pulled up the report to print,
// not whether a printer or PDF actually came out of it.
//
// Each report type requires the same permission its underlying data endpoint requires
// (statistics.php / admin-statistics.php need accounts.view, login_report.php needs
// audit.view) — this is a server-side check independent of which buttons the account's
// own dashboard happens to render, so a request straight to this endpoint can't log a
// "print" for a report that account was never actually allowed to view.
$reportPermissions = [
    'overview' => 'accounts.view',
    'admin_overview' => 'accounts.view',
    'login_report' => 'audit.view',
];

$report = trim((string)($_POST['report'] ?? ''));
if (!isset($reportPermissions[$report])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid report type.']);
    exit;
}

$user = require_permission($reportPermissions[$report]);

$details = ['report' => $report];
$period = trim((string)($_POST['period'] ?? ''));
if ($period !== '') {
    $details['period'] = $period;
}

$targetUserId = null;
$employeeId = trim((string)($_POST['employee_id'] ?? ''));
if ($employeeId !== '') {
    $details['employee_id'] = $employeeId;
    $stmt = $conn->prepare('SELECT id FROM users WHERE id_number = ? LIMIT 1');
    $stmt->bind_param('s', $employeeId);
    $stmt->execute();
    $target = $stmt->get_result()->fetch_assoc();
    if ($target) {
        $targetUserId = (int)$target['id'];
    }
}

audit('report.print', $targetUserId, $details);
echo json_encode(['status' => 'success']);
