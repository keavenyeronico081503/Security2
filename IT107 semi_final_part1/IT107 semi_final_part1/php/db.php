<?php

require_once __DIR__ . '/env.php';
load_env(__DIR__ . '/../.env');

$host = getenv('DB_HOST') ?: "localhost";
$username = getenv('DB_USERNAME') ?: "root";
$password = getenv('DB_PASSWORD') ?: "";
$dbname = getenv('DB_NAME') ?: "registration_db";


$conn = mysqli_connect($host, $username, $password, $dbname);

if(!$conn){
    die("Connection failed: " . mysqli_connect_error());
}
?>