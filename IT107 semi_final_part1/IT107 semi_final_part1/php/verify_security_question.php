<?php
session_start();
include 'db.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $id = trim($_POST['id'] ?? '');
    $question = trim($_POST['question'] ?? '');
    $answer = trim($_POST['answer'] ?? '');
    
    // Validate input
    if (empty($id) || empty($question) || empty($answer)) {
        echo json_encode([
            "status" => "error", 
            "message" => "All fields are required."
        ]);
        exit();
    }
    
    try {
        // First, get the user ID from id_number
        $userSql = "SELECT id FROM users WHERE id_number = ?";
        $userStmt = $conn->prepare($userSql);
        $userStmt->bind_param("s", $id);
        $userStmt->execute();
        $userResult = $userStmt->get_result();
        
        if ($userResult->num_rows === 0) {
            echo json_encode([
                "status" => "error", 
                "message" => "User not found."
            ]);
            exit();
        }
        
        $user = $userResult->fetch_assoc();
        $userId = $user['id'];
        
        // Check if the user has security questions from security_questions table
        $questionSql = "SELECT authQuestion1, authAnswer1, authQuestion2, authAnswer2, authQuestion3, authAnswer3 FROM security_questions WHERE user_id = ?";
        $questionStmt = $conn->prepare($questionSql);
        $questionStmt->bind_param("i", $userId);
        $questionStmt->execute();
        $questionResult = $questionStmt->get_result();
        
        if ($questionResult->num_rows === 0) {
            echo json_encode([
                "status" => "error", 
                "message" => "Security questions not found for this user."
            ]);
            exit();
        }
        
        $questionData = $questionResult->fetch_assoc();
        
        // Find which question matches and verify its answer
        $isValid = false;
        $found = false;
        
        // Check question 1
        if ($questionData['authQuestion1'] === $question) {
            $found = true;
            // Answers are hashed, so use password_verify
            $isValid = password_verify($answer, $questionData['authAnswer1']);
        }
        // Check question 2
        elseif ($questionData['authQuestion2'] === $question) {
            $found = true;
            $isValid = password_verify($answer, $questionData['authAnswer2']);
        }
        // Check question 3
        elseif ($questionData['authQuestion3'] === $question) {
            $found = true;
            $isValid = password_verify($answer, $questionData['authAnswer3']);
        }
        
        if (!$found) {
            echo json_encode([
                "status" => "error", 
                "message" => "Security question not found for this user."
            ]);
            exit();
        }
        
        if ($isValid) {
            echo json_encode([
                "status" => "success", 
                "message" => "Security question verified successfully."
            ]);
        } else {
            echo json_encode([
                "status" => "error", 
                "message" => "The answer provided is incorrect. Please try again."
            ]);
        }
        
    } catch (Exception $e) {
        echo json_encode([
            "status" => "error", 
            "message" => "Database error: " . $e->getMessage()
        ]);
    }
    
    $conn->close();
} else {
    echo json_encode([
        "status" => "error", 
        "message" => "Invalid request method."
    ]);
}
?>
