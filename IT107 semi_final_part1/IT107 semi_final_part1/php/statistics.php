<?php
include 'admin_auth.php';
require_permission('accounts.view');

$summary = [
    'total' => 0,
    'approved' => 0,
    'pending' => 0,
    'blocked' => 0,
    'admins' => 0,
    'super_admins' => 0,
    'users' => 0
];
$result = $conn->query('SELECT COUNT(*) AS total, SUM(account_status = "approved") AS approved, SUM(account_status = "pending") AS pending, SUM(account_status = "blocked") AS blocked, SUM(role = "admin") AS admins, SUM(role = "super_admin") AS super_admins, SUM(role = "user") AS users FROM users WHERE username <> "Keavenyadmin1"');
$row = $result->fetch_assoc();
foreach ($summary as $key => $value) $summary[$key] = (int)($row[$key] ?? 0);
// Accounts waiting for approval are kept in pending_registrations, not `users`.
$summary['pending'] = (int)$conn->query('SELECT COUNT(*) AS total FROM pending_registrations')->fetch_assoc()['total'];
$summary['total'] += $summary['pending'];

$status = [];
$result = $conn->query('SELECT account_status AS label, COUNT(*) AS total FROM users WHERE username <> "Keavenyadmin1" GROUP BY account_status ORDER BY FIELD(account_status, "approved", "pending", "blocked")');
while ($row = $result->fetch_assoc()) $status[] = ['label' => ucfirst($row['label']), 'count' => (int)$row['total']];
if ($summary['pending'] > 0) $status[] = ['label' => 'Pending', 'count' => $summary['pending']];

$roles = [];
$result = $conn->query('SELECT role AS label, COUNT(*) AS total FROM users WHERE username <> "Keavenyadmin1" GROUP BY role ORDER BY FIELD(role, "user", "admin", "super_admin")');
while ($row = $result->fetch_assoc()) $roles[] = ['label' => ucwords(str_replace('_', ' ', $row['label'])), 'count' => (int)$row['total']];

$deletionRequests = [];
$result = $conn->query('SELECT status AS label, COUNT(*) AS total FROM admin_delete_requests GROUP BY status ORDER BY FIELD(status, "pending", "approved", "rejected")');
while ($row = $result->fetch_assoc()) $deletionRequests[] = ['label' => ucfirst($row['label']), 'count' => (int)$row['total']];

$period = normalize_period($_GET['period'] ?? null);
[$bucketExpr, $sinceExpr] = period_bucket_sql($period);
// Helpers for the period charts: the same buckets as period_bucket_sql(), on any column.
$bucketOn = fn(string $column) => str_replace('created_at', $column, $bucketExpr);
$sinceOn = $sinceExpr;

// ---- Registration funnel ----------------------------------------------------
// Sign-ups are counted at the moment they were submitted: still pending, already
// approved (users.registered_at), or rejected (time kept in the rejection audit).
$signupTimes = "
    SELECT submitted_at AS t FROM pending_registrations
    UNION ALL SELECT COALESCE(registered_at, created_at) FROM users WHERE role = 'user'
    UNION ALL SELECT COALESCE(STR_TO_DATE(JSON_UNQUOTE(JSON_EXTRACT(details, '$.submitted_at')), '%Y-%m-%d %H:%i:%s'), created_at)
              FROM audit_logs WHERE action_code = 'accounts.registration.reject'";
$registrations = [];
$result = $conn->query('SELECT ' . $bucketOn('t') . " AS bucket, COUNT(*) AS total FROM ($signupTimes) s WHERE t >= $sinceOn GROUP BY bucket ORDER BY bucket");
while ($row = $result->fetch_assoc()) $registrations[] = ['date' => format_period_label($row['bucket'], $period), 'count' => (int)$row['total']];

$funnel = [
    'signed_up' => (int)$conn->query("SELECT COUNT(*) AS n FROM ($signupTimes) s WHERE t >= $sinceOn")->fetch_assoc()['n'],
    'approved' => (int)$conn->query("SELECT COUNT(*) AS n FROM audit_logs WHERE action_code = 'accounts.approve' AND JSON_EXTRACT(details, '$.pending_id') IS NOT NULL AND created_at >= $sinceOn")->fetch_assoc()['n'],
    'rejected' => (int)$conn->query("SELECT COUNT(*) AS n FROM audit_logs WHERE action_code = 'accounts.registration.reject' AND created_at >= $sinceOn")->fetch_assoc()['n'],
    'average_wait_hours' => null,
    'oldest_waiting' => null,
];
$wait = $conn->query("SELECT AVG(TIMESTAMPDIFF(MINUTE, registered_at, created_at)) AS minutes FROM users WHERE role = 'user' AND registered_at IS NOT NULL AND created_at > registered_at AND created_at >= $sinceOn")->fetch_assoc()['minutes'];
if ($wait !== null) $funnel['average_wait_hours'] = round(((float)$wait) / 60, 1);
$oldest = $conn->query('SELECT username, first_name, last_name, submitted_at, TIMESTAMPDIFF(HOUR, submitted_at, NOW()) AS hours FROM pending_registrations ORDER BY submitted_at ASC LIMIT 1')->fetch_assoc();
if ($oldest) {
    $funnel['oldest_waiting'] = [
        'name' => trim($oldest['first_name'] . ' ' . $oldest['last_name']),
        'username' => $oldest['username'],
        'submitted_at' => $oldest['submitted_at'],
        'hours' => (int)$oldest['hours'],
    ];
}

// ---- Security monitor --------------------------------------------------------
// Emergency-account activity stays out of statistics, as it does in the audit log.
$notEmergency = "COALESCE(actor_username, '') <> 'Keavenyadmin1' AND COALESCE(target_username, '') <> 'Keavenyadmin1'
    AND LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(details, '$.username')), '')) <> 'keavenyadmin1'";
$count = fn(string $where) => (int)$conn->query("SELECT COUNT(*) AS n FROM audit_logs WHERE $notEmergency AND $where")->fetch_assoc()['n'];
$targetedName = "COALESCE(target_username, JSON_UNQUOTE(JSON_EXTRACT(details, '$.username')))";
$security = [
    'failed_today' => $count("action_code = 'auth.login.failed' AND created_at >= CURRENT_DATE"),
    'failed_period' => $count("action_code = 'auth.login.failed' AND created_at >= $sinceOn"),
    'lockouts' => (int)$conn->query("SELECT COUNT(DISTINCT LOWER($targetedName), DATE(created_at)) AS n FROM audit_logs
        WHERE $notEmergency AND action_code = 'auth.login.failed' AND failure_reason = 'Locked: too many failed attempts.' AND created_at >= $sinceOn")->fetch_assoc()['n'],
    'recovery_lockouts' => $count("action_code = 'auth.recovery.locked' AND created_at >= $sinceOn"),
    'breached_refused' => $count("action_code = 'security.password.breached' AND created_at >= $sinceOn"),
    'logins' => [],
    'top_targets' => [],
    'top_ips' => [],
];
$result = $conn->query("SELECT $bucketExpr AS bucket, SUM(action_code = 'auth.login.success') AS ok, SUM(action_code = 'auth.login.failed') AS failed
    FROM audit_logs WHERE $notEmergency AND action_code IN ('auth.login.success', 'auth.login.failed') AND created_at >= $sinceOn GROUP BY bucket ORDER BY bucket");
while ($row = $result->fetch_assoc()) {
    $security['logins'][] = ['date' => format_period_label($row['bucket'], $period), 'successful' => (int)$row['ok'], 'failed' => (int)$row['failed']];
}
$result = $conn->query("SELECT MIN($targetedName) AS username, COUNT(*) AS attempts, MAX(created_at) AS last_attempt FROM audit_logs
    WHERE $notEmergency AND action_code = 'auth.login.failed' AND created_at >= $sinceOn AND $targetedName IS NOT NULL
    GROUP BY LOWER($targetedName) ORDER BY attempts DESC LIMIT 5");
while ($row = $result->fetch_assoc()) $security['top_targets'][] = ['username' => $row['username'], 'attempts' => (int)$row['attempts'], 'last_attempt' => $row['last_attempt']];
$result = $conn->query("SELECT ip_address, COUNT(*) AS attempts, COUNT(DISTINCT LOWER($targetedName)) AS accounts FROM audit_logs
    WHERE $notEmergency AND action_code = 'auth.login.failed' AND created_at >= $sinceOn AND ip_address IS NOT NULL
    GROUP BY ip_address ORDER BY attempts DESC LIMIT 5");
while ($row = $result->fetch_assoc()) $security['top_ips'][] = ['ip' => $row['ip_address'], 'attempts' => (int)$row['attempts'], 'accounts' => (int)$row['accounts']];

$pendingDeletions = 0;
$result = $conn->query('SELECT COUNT(*) AS total FROM admin_delete_requests WHERE status = "pending"');
$pendingDeletions = (int)$result->fetch_assoc()['total'];

$failedActions = 0;
$result = $conn->query('SELECT COUNT(*) AS total FROM audit_logs WHERE success = 0 AND created_at >= CURRENT_DATE - INTERVAL 29 DAY');
$failedActions = (int)$result->fetch_assoc()['total'];

echo json_encode([
    'status' => 'success',
    'summary' => $summary,
    'status_breakdown' => $status,
    'role_breakdown' => $roles,
    'deletion_requests' => $deletionRequests,
    'registrations' => $registrations,
    'security' => $security,
    'funnel' => $funnel,
    'registrations_period' => $period,
    'action_required' => [
        'pending_users' => $summary['pending'],
        'pending_deletions' => $pendingDeletions,
        'failed_actions' => $failedActions
    ]
]);