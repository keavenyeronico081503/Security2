<?php
// get-user-data.php - Fetch user email and username by ID
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

// Include database connection
require_once 'db.php';

// Get ID from URL parameter
$id = $_GET['id'] ?? '';

if (empty($id)) {
    echo json_encode([
        'status' => 'error',
        'message' => 'ID parameter is required'
    ]);
    exit;
}

try {
    // Fetch user data from database using the correct column names
    $stmt = $conn->prepare("SELECT email, username FROM users WHERE id_number = ?");
    $stmt->bind_param("s", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        $user = $result->fetch_assoc();
        echo json_encode([
            'status' => 'success',
            'user' => [
                'email' => $user['email'],
                'username' => $user['username']
            ]
        ]);
    } else {
        echo json_encode([
            'status' => 'error',
            'message' => 'User not found'
        ]);
    }
    
    $stmt->close();
    $conn->close();
    
} catch (Exception $e) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Database error: ' . $e->getMessage()
    ]);
}
?>
