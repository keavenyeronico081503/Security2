<?php
session_start();
header('Content-Type: application/json');

// Database connection
$servername = getenv('DB_HOST') ?: "localhost";
$username = getenv('DB_USERNAME') ?: "root";
$password = getenv('DB_PASSWORD') ?: "";
$dbname = getenv('DB_NAME') ?: "registration_db";

$conn = new mysqli($servername, $username, $password, $dbname);

if ($conn->connect_error) {
    die(json_encode([
        'error' => 'Database connection failed: ' . $conn->connect_error
    ]));
}

// Get POST data
$data = json_decode(file_get_contents('php://input'), true);
$password = $data['password'] ?? '';
$username = $data['username'] ?? '';

if (empty($password) || empty($username)) {
    echo json_encode([
        'error' => 'Missing required fields',
        'exists' => false
    ]);
    exit;
}

try {
    // Check if password exists for this user
    $stmt = $conn->prepare("SELECT password FROM users WHERE username = ?");
    if (!$stmt) {
        throw new Exception("Database error: " . $conn->error);
    }
    
    $stmt->bind_param('s', $username);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($user = $result->fetch_assoc()) {
        // Verify if the provided password matches the stored hash
        $exists = password_verify($password, $user['password']);
        echo json_encode([
            'exists' => $exists,
            'message' => $exists ? 'Password exists' : 'Password does not match'
        ]);
    } else {
        echo json_encode([
            'exists' => false,
            'message' => 'User not found'
        ]);
    }
} catch (Exception $e) {
    error_log("Error in check_password.php: " . $e->getMessage());
    echo json_encode([
        'error' => 'An error occurred while checking password',
        'exists' => false
    ]);
} finally {
    if (isset($stmt)) $stmt->close();
    $conn->close();
}
?>