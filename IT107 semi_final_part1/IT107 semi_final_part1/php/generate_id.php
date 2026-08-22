<?php
// Return a generated ID like YYYY-0001 as plain text so JS can set the input value.
header('Content-Type: text/plain; charset=utf-8');

$host = getenv('DB_HOST') ?: 'localhost';
$user = getenv('DB_USERNAME') ?: 'root';
$pass = getenv('DB_PASSWORD') ?: '';
$db   = getenv('DB_NAME') ?: 'registration_db';

$mysqli = new mysqli($host, $user, $pass, $db);
if ($mysqli->connect_error) {
    http_response_code(500);
    echo 'ERROR';
    exit;
}

$year = date('Y');
$result = $mysqli->query("SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(id_number, '-', -1) AS UNSIGNED)), 0) AS last_number FROM users WHERE id_number LIKE CONCAT('" . $mysqli->real_escape_string($year) . "', '-%')");
if ($result) {
    $row = $result->fetch_assoc();
    $count = (int)($row['last_number'] ?? 0) + 1;
    $generatedId = $year . '-' . str_pad($count, 4, '0', STR_PAD_LEFT);
    echo $generatedId;
    $result->free();
} else {
    // If table does not exist yet, start at 1
    $generatedId = $year . '-0001';
    echo $generatedId;
}

$mysqli->close();
