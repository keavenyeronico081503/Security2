<?php
// Simple fixed-window rate limiting for public lookup endpoints, so nobody can
// fire thousands of "is this taken?" probes. Needs $conn (db.php).

// Records one hit for $bucket and returns false once more than $max hits
// arrived within the current $seconds-long window.
function rate_limit(string $bucket, int $max, int $seconds): bool
{
    global $conn;
    // One atomic statement: start a new window when the old one has expired,
    // otherwise count the hit in the current window.
    $stmt = $conn->prepare('INSERT INTO rate_limits (bucket, hits, window_start) VALUES (?, 1, NOW())
        ON DUPLICATE KEY UPDATE
            hits = IF(window_start < NOW() - INTERVAL ? SECOND, 1, hits + 1),
            window_start = IF(window_start < NOW() - INTERVAL ? SECOND, NOW(), window_start)');
    $stmt->bind_param('sii', $bucket, $seconds, $seconds);
    $stmt->execute();

    $read = $conn->prepare('SELECT hits FROM rate_limits WHERE bucket = ?');
    $read->bind_param('s', $bucket);
    $read->execute();
    return (int)($read->get_result()->fetch_assoc()['hits'] ?? 0) <= $max;
}

// Ends the request with HTTP 429 when the caller's IP is over the limit.
function enforce_rate_limit(string $endpoint, int $max, int $seconds): void
{
    $bucket = $endpoint . ':' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    if (!rate_limit($bucket, $max, $seconds)) {
        http_response_code(429);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['status' => 'rate_limited', 'message' => 'Too many checks. Please wait a moment and try again.']);
        exit;
    }
}

// How many hits $bucket has in its current window (0 once the window expired),
// without counting a new one. Used for failure counters such as login lockout.
function rate_limit_count(string $bucket, int $seconds): int
{
    global $conn;
    $stmt = $conn->prepare('SELECT hits FROM rate_limits WHERE bucket = ? AND window_start >= NOW() - INTERVAL ? SECOND');
    $stmt->bind_param('si', $bucket, $seconds);
    $stmt->execute();
    return (int)($stmt->get_result()->fetch_assoc()['hits'] ?? 0);
}

// Minutes until $bucket's window ends (at least 1), for "try again in N minutes".
function rate_limit_minutes_left(string $bucket, int $seconds): int
{
    global $conn;
    $stmt = $conn->prepare('SELECT GREATEST(1, CEIL(TIMESTAMPDIFF(SECOND, NOW(), window_start + INTERVAL ? SECOND) / 60)) AS minutes FROM rate_limits WHERE bucket = ?');
    $stmt->bind_param('is', $seconds, $bucket);
    $stmt->execute();
    return (int)($stmt->get_result()->fetch_assoc()['minutes'] ?? 1);
}

function rate_limit_clear(string $bucket): void
{
    global $conn;
    $stmt = $conn->prepare('DELETE FROM rate_limits WHERE bucket = ?');
    $stmt->bind_param('s', $bucket);
    $stmt->execute();
}
