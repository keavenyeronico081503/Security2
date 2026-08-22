<?php
session_start();
header('Content-Type: application/json');

// Include database connection
require_once 'db.php';

// Get user ID from session (either from login or from forgot password flow)
$userId = $_SESSION['user_id'] ?? $_SESSION['reset_user_id'] ?? null;

if (!$userId) {
    echo json_encode([
        'success' => false,
        'message' => 'User session not found. Please try again.'
    ]);
    exit;
}

// Get form data
$newPassword = $_POST['new_password'] ?? '';
$confirmPassword = $_POST['confirm_password'] ?? '';

// Validate input
if (empty($newPassword) || empty($confirmPassword)) {
    echo json_encode([
        'success' => false,
        'message' => 'All fields are required.'
    ]);
    exit;
}

// Check if new password matches confirmation
if ($newPassword !== $confirmPassword) {
    echo json_encode([
        'success' => false,
        'message' => 'New password and confirmation do not match.'
    ]);
    exit;
}

// Validate password strength
if (strlen($newPassword) < 8) {
    echo json_encode([
        'success' => false,
        'message' => 'Password must be at least 8 characters long.'
    ]);
    exit;
}

// Check for password requirements
if (!preg_match('/[A-Z]/', $newPassword) || 
    !preg_match('/[a-z]/', $newPassword) || 
    !preg_match('/\d/', $newPassword) || 
    !preg_match('/[^A-Za-z0-9]/', $newPassword)) {
    echo json_encode([
        'success' => false,
        'message' => 'Password must include at least one uppercase letter, one lowercase letter, one number, and one special character.'
    ]);
    exit;
}

try {
    // Verify user exists
    $stmt = $conn->prepare("SELECT id FROM users WHERE id = ?");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode([
            'success' => false,
            'message' => 'User not found.'
        ]);
        exit;
    }
    
    $stmt->close();
    
    // Check if password already exists in database (used by another user)
    $checkPasswordStmt = $conn->prepare("SELECT password FROM users WHERE id != ?");
    $checkPasswordStmt->bind_param("i", $userId);
    $checkPasswordStmt->execute();
    $passwordResult = $checkPasswordStmt->get_result();
    
    while ($row = $passwordResult->fetch_assoc()) {
        if (password_verify($newPassword, $row['password'])) {
            $checkPasswordStmt->close();
            echo json_encode([
                'success' => false,
                'message' => 'Password already exists!'
            ]);
            $conn->close();
            exit;
        }
    }
    $checkPasswordStmt->close();
    
    // Hash the new password
    $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
    
    // Update password in database
    $updateStmt = $conn->prepare("UPDATE users SET password = ? WHERE id = ?");
    $updateStmt->bind_param("si", $hashedPassword, $userId);
    
    if ($updateStmt->execute()) {
        // Clear reset session if it exists
        if (isset($_SESSION['reset_user_id'])) {
            unset($_SESSION['reset_user_id']);
            unset($_SESSION['reset_username']);
        }
        
        // Log out the user after password change (if logged in)
        if (isset($_SESSION['user_id'])) {
            session_unset();
            session_destroy();
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'Password changed successfully. Redirecting to login...',
            'redirect' => '../html/login.html'
        ]);
    } else {
        throw new Exception("Failed to update password.");
    }
    
    $updateStmt->close();
    $conn->close();
    
} catch (Exception $e) {
    error_log("Password change error: " . $e->getMessage());
    
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred while changing your password. Please try again.'
    ]);
}