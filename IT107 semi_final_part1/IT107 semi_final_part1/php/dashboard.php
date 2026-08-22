<?php
// Start session
session_start();

// Simulate logged-in user
$_SESSION['username'] = $_SESSION['username'] ?? 'Coach John';

// Sample volleyball stats
$teamStats = [
    'total_players' => 12,
    'active_players' => 10,
    'injured_players' => 2,
    'team_ranking' => 3,
    'win_rate' => 75.5
];
?>

