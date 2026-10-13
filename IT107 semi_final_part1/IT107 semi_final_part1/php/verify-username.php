<?php
session_start();
header('Content-Type: application/json');

// Include database connection
require_once 'db.php';
require_once 'rate_limit.php';

// Slow down anyone stepping through ID numbers to discover accounts.
enforce_rate_limit('verify_id', 10, 600);

// Get ID from POST
$id = $_POST['id'] ?? '';

// Validate input
if (empty($id)) {
    echo json_encode([
        'status' => 'error',
        'message' => 'ID is required.'
    ]);
    exit;
}

// Sanitize ID (letters, numbers, and hyphens allowed)
if (!preg_match('/^[A-Za-z0-9-]+$/', $id)) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Invalid ID format. Only letters, numbers, and hyphens are allowed.'
    ]);
    exit;
}

try {
    // Check if ID exists in database
    $stmt = $conn->prepare("SELECT id, username, id_number FROM users WHERE id_number = ? AND username <> 'Keavenyadmin1'");
    $stmt->bind_param("s", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        // ID NOT found
        echo json_encode([
            'status' => 'error',
            'message' => 'ID not found'
        ]);
        $stmt->close();
        $conn->close();
        exit;
    }
    
    // ID EXISTS - store in session and proceed to security questions
    $user = $result->fetch_assoc();
    // Knowing an ID number only selects the account to recover. The password reset
    // itself is authorized later, once all three security answers are verified
    // (verify_security_question.php sets reset_user_id).
    unset($_SESSION['reset_user_id'], $_SESSION['reset_passed']);
    $_SESSION['reset_candidate_id'] = (int)$user['id'];
    $_SESSION['reset_username'] = $user['username'];
    $_SESSION['reset_id_number'] = $user['id_number'];
    
    echo json_encode([
        'status' => 'success',
        'message' => 'ID verified. Redirecting to security questions...',
        'redirect' => '../html/auth-questions.html'
    ]);
    
    $stmt->close();
    $conn->close();
    
} catch (Exception $e) {
    error_log("Verify ID error: " . $e->getMessage());
    
    echo json_encode([
        'status' => 'error',
        'message' => 'An error occurred. Please try again later.'
    ]);
}
?>


