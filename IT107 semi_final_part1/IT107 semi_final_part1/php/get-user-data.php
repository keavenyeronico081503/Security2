<?php
// get-user-data.php - Fetch user email and username by ID
header('Content-Type: application/json');

// Include database connection
require_once 'db.php';
require_once 'otp.php';
session_start();

// Get ID from URL parameter
$id = $_GET['id'] ?? '';

// Only for the account being recovered in this browser session (forgot-password
// flow) or the logged-in account itself: never an open lookup by ID number.
$ownLookup = false;
if (!empty($_SESSION['user_id'])) {
    $own = $conn->prepare('SELECT id_number FROM users WHERE id = ?');
    $own->bind_param('i', $_SESSION['user_id']);
    $own->execute();
    $ownLookup = ($own->get_result()->fetch_assoc()['id_number'] ?? null) === $id;
}
if (!$ownLookup && ($_SESSION['reset_id_number'] ?? null) !== $id) {
    http_response_code(403);
    echo json_encode(['status' => 'error', 'message' => 'Please start again from the Forgot Password page.']);
    exit;
}

if (empty($id)) {
    echo json_encode([
        'status' => 'error',
        'message' => 'ID parameter is required'
    ]);
    exit;
}

try {
    // Fetch user data from database using the correct column names
    $stmt = $conn->prepare("SELECT email, username FROM users WHERE id_number = ? AND username <> 'Keavenyadmin1'");
    $stmt->bind_param("s", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        $user = $result->fetch_assoc();
        echo json_encode([
            'status' => 'success',
            'user' => [
                'email' => mask_email($user['email']),
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
