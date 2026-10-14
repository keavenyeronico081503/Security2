<?php
// Readable labels for audit_logs rows, shared by the Activity log (audit.php)
// and the deletion Review Account popup (super-admin.php).

function format_action_label(array $row): string
{
    $details = $row['details'] ?? [];
    $moduleNames = [
        'overview' => 'Overview', 'accounts' => 'Accounts', 'create-account' => 'Create account',
        'requests' => 'Deletion requests', 'audit' => 'Audit log', 'privileges' => 'Manage access',
        'dashboard' => 'Dashboard', 'calendar' => 'Calendar & Events', 'profile' => 'Profile',
        'notifications' => 'Notifications', 'block-requests' => 'Block requests',
        'posts' => 'Announcements', 'events' => 'Events'
    ];
    if ($row['action_code'] === 'module.open') {
        $module = (string)($details['module'] ?? 'module');
        return 'Opened ' . ($moduleNames[$module] ?? ucfirst(str_replace('-', ' ', $module)));
    }
    if ($row['action_code'] === 'report.print') {
        $reportNames = ['overview' => 'Super Admin overview', 'admin_overview' => 'Administrator overview', 'login_report' => 'account login'];
        $reportType = (string)($details['report'] ?? 'report');
        $label = 'Printed the ' . ($reportNames[$reportType] ?? $reportType) . ' report';
        if (!empty($details['employee_id'])) {
            $label .= ' for ' . $details['employee_id'];
        }
        return $label;
    }
    $labels = [
        'auth.login.success' => 'Logged in',
        'auth.login.failed' => 'Failed login attempt',
        'auth.logout' => 'Logged out',
        'auth.recovery.failed' => 'Wrong security answer (password recovery)',
        'auth.recovery.locked' => 'Password recovery locked',
        'auth.recovery.verified' => 'Passed security questions (password recovery)',
        'accounts.registration.submit' => 'Submitted registration',
        'accounts.registration.reject' => 'Rejected registration',
        'security.password.breached' => 'Refused a breached password',
        'accounts.create' => 'Created account',
        'accounts.update' => 'Edited account',
        'accounts.approve' => 'Approved account',
        'accounts.block' => 'Blocked account',
        'accounts.unblock' => 'Unblocked account',
        'accounts.delete' => 'Deleted account',
        'accounts.delete.request' => 'Requested account deletion',
        'accounts.delete.approve' => 'Accepted deletion request',
        'accounts.delete.reject' => 'Rejected deletion request',
        'accounts.review' => 'Reviewed account before deletion',
        'accounts.delete.review' => 'Reviewed account before deletion',
        'accounts.block.request' => 'Sent block request',
        'accounts.block.approved' => 'Accepted block request',
        'accounts.block.rejected' => 'Rejected block request',
        'accounts.password_reset' => 'Reset account password',
        'accounts.role_change' => 'Changed account role',
        'permissions.assign' => 'Changed account access',
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

function format_position(?string $role): string
{
    $labels = ['user' => 'User', 'admin' => 'Administrator', 'data_administrator' => 'Data Administrator', 'super_admin' => 'Super Administrator'];
    return $role ? ($labels[$role] ?? ucfirst(str_replace('_', ' ', $role))) : '—';
}
