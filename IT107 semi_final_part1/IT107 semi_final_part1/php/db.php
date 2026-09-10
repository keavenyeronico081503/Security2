<?php

require_once __DIR__ . '/env.php';
load_env(__DIR__ . '/../.env');

date_default_timezone_set('Asia/Manila');

$host = getenv('DB_HOST') ?: "localhost";
$username = getenv('DB_USERNAME') ?: "root";
$password = getenv('DB_PASSWORD') ?: "";
$dbname = getenv('DB_NAME') ?: "registration_db";


$conn = mysqli_connect($host, $username, $password, $dbname);

if(!$conn){
    die("Connection failed: " . mysqli_connect_error());
}

// Lock the DB session to the same clock PHP uses above, so CURRENT_TIMESTAMP
// (what audit_logs.created_at is stamped with) always matches real time
// regardless of the MySQL server's own configured time zone.
$conn->query("SET time_zone = '+08:00'");
?>