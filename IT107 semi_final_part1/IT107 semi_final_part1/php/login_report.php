<?php
require_once 'auth.php';
header('Content-Type: application/json; charset=utf-8');

require_permission('audit.view');

$employeeId = trim($_GET['employee_id'] ?? '');
if ($employeeId === '') {
    echo json_encode(['status' => 'error', 'message' => 'Employee ID is required.']);
    exit;
}
$period = normalize_period($_GET['period'] ?? null);
$periodStart = strtotime('-' . period_lookback_days($period) . ' days');

$stmt = $conn->prepare('SELECT id, first_name, last_name, id_number, username, role, account_status FROM users WHERE id_number = ? AND username <> "Keavenyadmin1" LIMIT 1');
$stmt->bind_param('s', $employeeId);
$stmt->execute();
$account = $stmt->get_result()->fetch_assoc();
if (!$account) {
    echo json_encode(['status' => 'error', 'message' => 'No account found with that Employee ID.']);
    exit;
}
$userId = (int)$account['id'];

// Pull this one account's full sign-in history (login/logout/failed attempts) — capped
// generously since this is a per-account report, not a system-wide feed.
$stmt = $conn->prepare('SELECT action_code, success, failure_reason, ip_address, created_at FROM audit_logs WHERE actor_user_id = ? AND action_code IN ("auth.login.success", "auth.login.failed", "auth.logout") ORDER BY created_at ASC LIMIT 3000');
$stmt->bind_param('i', $userId);
$stmt->execute();
$events = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

// A password or profile change made during a session is exactly the kind of thing an
// investigator needs surfaced against an odd-hour login, so pull those alongside.
$sensitiveLabels = ['password.change' => 'Changed password', 'profile.update' => 'Updated profile', 'accounts.update' => 'Account edited'];
$sensitiveCodes = array_keys($sensitiveLabels);
$placeholders = implode(',', array_fill(0, count($sensitiveCodes), '?'));
$types = 'i' . str_repeat('s', count($sensitiveCodes));
$stmt = $conn->prepare("SELECT action_code, created_at FROM audit_logs WHERE actor_user_id = ? AND action_code IN ($placeholders) ORDER BY created_at ASC LIMIT 2000");
$stmt->bind_param($types, $userId, ...$sensitiveCodes);
$stmt->execute();
$sensitiveEvents = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

$loginEvents = array_values(array_filter($events, fn($e) => $e['action_code'] === 'auth.login.success'));
$logoutQueue = array_values(array_filter($events, fn($e) => $e['action_code'] === 'auth.logout'));
$failedEvents = array_values(array_filter($events, fn($e) => $e['action_code'] === 'auth.login.failed'));

// Pair every login with the next logout that followed it (FIFO), same pairing logic
// used by the general audit log, just scoped to a single actor.
$sessions = [];
foreach ($loginEvents as $login) {
    while ($logoutQueue && strtotime($logoutQueue[0]['created_at']) < strtotime($login['created_at'])) {
        array_shift($logoutQueue);
    }
    $logout = $logoutQueue ? array_shift($logoutQueue) : null;
    $sessions[] = ['login' => $login, 'logout' => $logout, 'session_activity' => []];
}

foreach ($sessions as &$session) {
    $start = strtotime($session['login']['created_at']);
    $end = $session['logout'] ? strtotime($session['logout']['created_at']) : PHP_INT_MAX;
    foreach ($sensitiveEvents as $activity) {
        $time = strtotime($activity['created_at']);
        if ($time >= $start && $time <= $end) {
            $session['session_activity'][] = $sensitiveLabels[$activity['action_code']] ?? $activity['action_code'];
        }
    }
    $session['session_activity'] = array_values(array_unique($session['session_activity']));
}
unset($session);

// --- Hour-of-day anomaly baseline (always the account's FULL history) -------
// An hour is flagged when this specific account has historically logged in there only
// rarely (below a share of its own login history). This learns each person's own
// routine instead of assuming fixed office hours, and — unlike a plain outlier test on
// the raw hour values — still works when someone normally has two separate clusters
// (e.g. a morning arrival and an evening return), since each cluster's hours stay
// common relative to that account's own total.
// This baseline deliberately ignores the days/weeks/months filter below — flagging an
// odd-hour login only means something if "usual" reflects the account's real full
// history, not just whatever narrow window happens to be selected on screen.
$baselineHourCounts = array_fill(0, 24, 0);
foreach ($sessions as $session) {
    $hour = (int)date('G', strtotime($session['login']['created_at']));
    $baselineHourCounts[$hour]++;
}
$totalLoginsAll = count($sessions);
$minSamples = 5;
$rarityThreshold = 0.08;
$hasEnoughData = $totalLoginsAll >= $minSamples;
$anomalousHours = [];
if ($hasEnoughData) {
    foreach ($baselineHourCounts as $hour => $count) {
        if ($count > 0 && ($count / $totalLoginsAll) < $rarityThreshold) {
            $anomalousHours[$hour] = true;
        }
    }
}

function format_hour_label(int $hour): string
{
    $hour = (($hour % 24) + 24) % 24;
    $period = $hour < 12 ? 'AM' : 'PM';
    $display = $hour % 12;
    if ($display === 0) $display = 12;
    return $display . $period;
}

// Merge the account's common hours (everything not flagged as rare) into readable
// ranges, e.g. hours 7,8,9 -> "7AM-10AM".
$usualHours = [];
foreach ($baselineHourCounts as $hour => $count) {
    if ($count > 0 && !isset($anomalousHours[$hour])) $usualHours[] = $hour;
}
sort($usualHours);
$ranges = [];
foreach ($usualHours as $hour) {
    $last = end($ranges);
    if ($last !== false && $hour === $last[1] + 1) {
        $ranges[count($ranges) - 1][1] = $hour;
    } else {
        $ranges[] = [$hour, $hour];
    }
}
$usualHoursText = array_map(
    fn($range) => $range[0] === $range[1]
        ? format_hour_label($range[0])
        : format_hour_label($range[0]) . '-' . format_hour_label($range[1] + 1),
    $ranges
);

// --- Scope what's actually shown (chart bars, timeline, summary) to the selected
// days/weeks/months window. The anomaly baseline above stays full-history regardless.
$periodSessions = array_values(array_filter($sessions, fn($s) => strtotime($s['login']['created_at']) >= $periodStart));
$periodFailedEvents = array_values(array_filter($failedEvents, fn($e) => strtotime($e['created_at']) >= $periodStart));

$periodHourCounts = array_fill(0, 24, 0);
foreach ($periodSessions as $session) {
    $periodHourCounts[(int)date('G', strtotime($session['login']['created_at']))]++;
}

// --- Build a single chronological timeline (successful sessions + failed attempts) --
$timeline = [];
foreach ($periodSessions as $session) {
    $hour = (int)date('G', strtotime($session['login']['created_at']));
    $timeline[] = [
        'type' => 'login',
        'time' => $session['login']['created_at'],
        'logout_time' => $session['logout']['created_at'] ?? null,
        'is_anomaly' => isset($anomalousHours[$hour]),
        'ip_address' => $session['login']['ip_address'],
        'session_activity' => $session['session_activity'],
        'failure_reason' => null
    ];
}
foreach ($periodFailedEvents as $failed) {
    $timeline[] = [
        'type' => 'failed_attempt',
        'time' => $failed['created_at'],
        'logout_time' => null,
        'is_anomaly' => false,
        'ip_address' => $failed['ip_address'],
        'session_activity' => [],
        'failure_reason' => $failed['failure_reason']
    ];
}
usort($timeline, fn($a, $b) => strtotime($b['time']) <=> strtotime($a['time']));
$timeline = array_slice($timeline, 0, 300);

$firstSeen = $periodSessions ? $periodSessions[0]['login']['created_at'] : null;
$lastSeen = $periodSessions ? end($periodSessions)['login']['created_at'] : null;

echo json_encode([
    'status' => 'success',
    'account' => [
        'name' => trim($account['first_name'] . ' ' . $account['last_name']),
        'employee_id' => $account['id_number'],
        'username' => $account['username'],
        'role' => $account['role'],
        'account_status' => $account['account_status']
    ],
    'period' => $period,
    'summary' => [
        'total_logins' => count($periodSessions),
        'total_failed' => count($periodFailedEvents),
        'first_seen' => $firstSeen,
        'last_seen' => $lastSeen,
        'has_enough_data' => $hasEnoughData,
        'baseline_total_logins' => $totalLoginsAll
    ],
    'usual_hours_text' => $usualHoursText,
    'hourly_histogram' => array_map(fn($hour) => [
        'hour' => $hour,
        'label' => format_hour_label($hour),
        'count' => $periodHourCounts[$hour],
        'is_anomaly' => isset($anomalousHours[$hour])
    ], range(0, 23)),
    'timeline' => $timeline
]);
