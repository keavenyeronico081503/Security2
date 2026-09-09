<?php
require_once 'auth.php';
header('Content-Type: application/json; charset=utf-8');

require_permission('audit.view');

const BUCKET_SECONDS = 300; // 5 minutes

$actorEmployeeId = trim($_GET['actor_employee_id'] ?? '');
$search = trim($_GET['search'] ?? '');
$actionCode = trim($_GET['action'] ?? '');
$dateFrom = trim($_GET['date_from'] ?? '');
$dateTo = trim($_GET['date_to'] ?? '');
$page = max((int)($_GET['page'] ?? 1), 1);
$bucketsPerPage = 15;

// A row counts as the emergency account's activity only when it is actually the
// actor or target — NULL (e.g. a failed login before a session exists) must not be
// excluded by this check, so every comparison here is NULL-safe.
$where = ' WHERE (actor_username IS NULL OR actor_username <> "Keavenyadmin1")'
    . ' AND (target_username IS NULL OR target_username <> "Keavenyadmin1")'
    . ' AND (? = "" OR actor_employee_id = ?)'
    . ' AND (? = "" OR action_code = ?)'
    . ' AND (? = "" OR actor_username LIKE CONCAT("%", ?, "%")'
    . ' OR actor_employee_id LIKE CONCAT("%", ?, "%")'
    . ' OR target_username LIKE CONCAT("%", ?, "%")'
    . ' OR target_employee_id LIKE CONCAT("%", ?, "%"))'
    . ' AND (? = "" OR created_at >= ?)'
    . ' AND (? = "" OR created_at < DATE_ADD(?, INTERVAL 1 DAY))';
$filterTypes = 'sssssssssssss';
$filterValues = [$actorEmployeeId, $actorEmployeeId, $actionCode, $actionCode, $search, $search, $search, $search, $search, $dateFrom, $dateFrom, $dateTo, $dateTo];

// Cap the raw row scan so a very large history can't blow up the bucketing pass;
// generous enough that a course-project-scale audit trail is never truncated.
$stmt = $conn->prepare('SELECT id, actor_user_id, actor_username, actor_employee_id, actor_role, action_code, target_username, target_employee_id, target_role, details, old_values, new_values, success, failure_reason, created_at FROM audit_logs' . $where . ' ORDER BY created_at DESC, id DESC LIMIT 2000');
$stmt->bind_param($filterTypes, ...$filterValues);
$stmt->execute();
$result = $stmt->get_result();
$rows = [];
while ($row = $result->fetch_assoc()) {
    $row['details'] = json_decode($row['details'] ?: '{}', true) ?: [];
    $row['old_values'] = json_decode($row['old_values'] ?: 'null', true);
    $row['new_values'] = json_decode($row['new_values'] ?: 'null', true);
    $rows[] = $row;
}

// Failed logins have no session yet, so they carry no actor identity in the
// database — resolve one from the attempted username so they still group under
// the right employee instead of being lost or lumped into an "unknown" bucket.
$usernameLookup = [];
$userRows = $conn->query('SELECT username, id_number, first_name, last_name FROM users');
while ($userRow = $userRows->fetch_assoc()) {
    $usernameLookup[$userRow['username']] = $userRow;
}
foreach ($rows as &$row) {
    if ($row['actor_employee_id'] !== null || $row['action_code'] !== 'auth.login.failed') {
        continue;
    }
    // A wrong-password attempt against a real account records that account as the
    // target (login.php knows exactly who was targeted); only a genuinely unknown
    // username falls back to the attempted-username string captured in details.
    if ($row['target_employee_id']) {
        $row['actor_employee_id'] = $row['target_employee_id'];
        $row['actor_username'] = $row['target_username'];
    } else {
        $attempted = $row['details']['username'] ?? null;
        if ($attempted !== null && isset($usernameLookup[$attempted])) {
            $row['actor_employee_id'] = $usernameLookup[$attempted]['id_number'];
            $row['actor_username'] = $attempted;
        }
    }
}
unset($row);

// Pair every login with the next logout that follows it for the same actor, so we
// know whether that session is still open ("Active") or has since ended, and when.
// This must come from the FULL history, independent of the current search/action/
// date filters — whether a session is still open is a fact, not a filtered view.
$loginResolution = [];
$byActor = [];
$authEvents = $conn->query('SELECT id, actor_user_id, action_code, created_at FROM audit_logs WHERE action_code IN ("auth.login.success", "auth.logout") AND success = 1 AND actor_user_id IS NOT NULL AND (actor_username IS NULL OR actor_username <> "Keavenyadmin1") ORDER BY created_at ASC LIMIT 5000');
while ($event = $authEvents->fetch_assoc()) {
    $byActor[$event['actor_user_id']][] = $event;
}
foreach ($byActor as $events) {
    // Already ordered by created_at ASC from the query, per actor.
    $openLogins = [];
    foreach ($events as $event) {
        if ($event['action_code'] === 'auth.login.success') {
            $openLogins[] = $event['id'];
        } elseif ($event['action_code'] === 'auth.logout' && $openLogins) {
            $loginId = array_shift($openLogins);
            $loginResolution[$loginId] = ['status' => 'logged_out', 'logout_time' => $event['created_at']];
        }
    }
    foreach ($openLogins as $loginId) {
        $loginResolution[$loginId] = ['status' => 'active', 'logout_time' => null];
    }
}

function format_action_label(array $row): string
{
    $details = $row['details'] ?? [];
    $moduleNames = [
        'overview' => 'Overview', 'accounts' => 'Accounts', 'create-account' => 'Create account',
        'requests' => 'Deletion requests', 'audit' => 'Audit log', 'privileges' => 'Assign privileges',
        'dashboard' => 'Dashboard', 'calendar' => 'Calendar & Events', 'profile' => 'Profile',
        'notifications' => 'Notifications', 'block-requests' => 'Block requests',
        'posts' => 'Announcements', 'events' => 'Events'
    ];
    if ($row['action_code'] === 'module.open') {
        $module = (string)($details['module'] ?? 'module');
        return 'Opened ' . ($moduleNames[$module] ?? ucfirst(str_replace('-', ' ', $module)));
    }
    $labels = [
        'auth.login.success' => 'Logged in',
        'auth.login.failed' => 'Failed login attempt',
        'auth.logout' => 'Logged out',
        'accounts.create' => 'Created account',
        'accounts.update' => 'Edited account',
        'accounts.approve' => 'Approved account',
        'accounts.block' => 'Blocked account',
        'accounts.unblock' => 'Unblocked account',
        'accounts.delete.request' => 'Requested account deletion',
        'accounts.delete.approve' => 'Accepted deletion request',
        'accounts.delete.reject' => 'Rejected deletion request',
        'accounts.block.request' => 'Sent block request',
        'accounts.block.approved' => 'Accepted block request',
        'accounts.block.rejected' => 'Rejected block request',
        'accounts.password_reset' => 'Reset account password',
        'accounts.role_change' => 'Changed account role',
        'permissions.assign' => 'Updated account privileges',
        'profile.update' => 'Updated profile',
        'password.change' => 'Changed password',
        'content.post.create' => 'Published a post',
        'content.post.update' => 'Edited a post',
        'content.post.delete' => 'Deleted a post',
        'content.event.create' => 'Added an event',
        'content.event.update' => 'Edited an event',
        'content.event.delete' => 'Deleted an event'
    ];
    return $labels[$row['action_code']] ?? ucfirst(str_replace(['.', '_'], ' ', $row['action_code']));
}

function format_action_target(array $row): string
{
    if ($row['target_username']) {
        return $row['target_username'] . ($row['target_employee_id'] ? " ({$row['target_employee_id']})" : '');
    }
    if ($row['target_role'] || $row['target_employee_id']) {
        return 'Deleted account';
    }
    return '—';
}

function is_system_action(array $row): bool
{
    return $row['actor_employee_id'] === null && str_starts_with((string)($row['details']['reason'] ?? ''), 'Automatically');
}

function format_position(?string $role): string
{
    $labels = ['user' => 'User', 'admin' => 'Administrator', 'data_administrator' => 'Data Administrator', 'super_admin' => 'Super Administrator'];
    return $role ? ($labels[$role] ?? ucfirst(str_replace('_', ' ', $role))) : '—';
}

// Group into 5-minute windows per actor so a burst of clicks (each "module.open")
// collapses into one reviewable row instead of flooding the table.
$buckets = [];
foreach ($rows as $row) {
    $timestamp = strtotime($row['created_at']);
    $bucketStart = $timestamp - ($timestamp % BUCKET_SECONDS);
    $isSystem = is_system_action($row);
    $actorKey = $row['actor_employee_id'] ?? ($isSystem ? 'system' : 'actor:' . ($row['actor_username'] ?? 'unknown'));
    $bucketKey = $actorKey . '|' . $bucketStart;

    if (!isset($buckets[$bucketKey])) {
        $person = $row['actor_username'] !== null ? ($usernameLookup[$row['actor_username']] ?? null) : null;
        $name = $person ? trim($person['first_name'] . ' ' . $person['last_name']) : null;
        $buckets[$bucketKey] = [
            'employee_id' => $row['actor_employee_id'] ?? ($isSystem ? 'System' : 'Unknown'),
            'actor_username' => $row['actor_username'] ?? ($isSystem ? 'System (automated)' : 'Unknown'),
            'actor_role' => $row['actor_role'],
            'name' => $name ?? ($isSystem ? 'System' : ($row['actor_username'] !== null ? 'Deleted account' : '—')),
            'position' => $isSystem ? 'Automated' : format_position($row['actor_role']),
            'bucket_start' => $bucketStart,
            'date_text' => date('F j, Y', $bucketStart),
            'time_text' => date('g:i A', $bucketStart),
            'login_status' => null,
            'logout_time_text' => null,
            'actions' => []
        ];
    }

    $action = [
        'time_text' => date('g:i A', $timestamp),
        'label' => format_action_label($row),
        'target' => format_action_target($row),
        'detail' => $row['details']['reason'] ?? null,
        'success' => (bool)$row['success'],
        'failure_reason' => $row['failure_reason']
    ];
    $buckets[$bucketKey]['actions'][] = $action;

    // Only a login whose actor account still exists gets resolved above (it needs a
    // non-null actor_user_id to be paired against a logout) — if the account was
    // since deleted, there is no reliable way to know whether it was ever logged
    // out, so this deliberately leaves login_status unset rather than guessing "Active".
    if ($row['action_code'] === 'auth.login.success' && $row['success'] && isset($loginResolution[$row['id']])) {
        $resolution = $loginResolution[$row['id']];
        $buckets[$bucketKey]['login_status'] = $resolution['status'];
        $buckets[$bucketKey]['logout_time_text'] = $resolution['logout_time'] ? date('g:i A', strtotime($resolution['logout_time'])) : null;
    }
}

// Buckets were built while walking rows newest-first, so they already come out
// most-recent-first; PHP's associative arrays preserve that insertion order.
$allBuckets = array_values($buckets);
$total = count($allBuckets);
$totalPages = max((int)ceil($total / $bucketsPerPage), 1);
$page = min($page, $totalPages);
$pageBuckets = array_slice($allBuckets, ($page - 1) * $bucketsPerPage, $bucketsPerPage);

echo json_encode([
    'status' => 'success',
    'buckets' => $pageBuckets,
    'pagination' => ['page' => $page, 'total' => $total, 'total_pages' => $totalPages]
]);
