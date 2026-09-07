<?php
session_start();
include 'db.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $id = trim($_POST['id'] ?? '');
    $question = trim($_POST['question'] ?? '');
    $answer = trim($_POST['answer'] ?? '');
    $position = (int)($_POST['position'] ?? 0);
    
    // Validate input
    if (empty($id) || empty($question) || empty($answer) || $position < 1 || $position > 3) {
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
        
        $storedQuestion = $questionData['authQuestion' . $position];
        $storedAnswer = $questionData['authAnswer' . $position];
        $isValid = hash_equals($storedQuestion, $question)
            && password_verify($answer, $storedAnswer);

        if ($isValid) {
            echo json_encode([
                "status" => "success", 
                "message" => "Security question verified successfully."
            ]);
        } else {
            echo json_encode([
                "status" => "error", 
                "message" => "The question order or answer is incorrect. Please try again."
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
