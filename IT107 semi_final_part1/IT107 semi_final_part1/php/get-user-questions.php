<?php
session_start();
header('Content-Type: application/json');

// Include database connection
require_once 'db.php';

// Get ID from POST or GET
$id = $_POST['id'] ?? $_GET['id'] ?? '';

// Validate input
if (empty($id)) {
    echo json_encode([
        'status' => 'error',
        'message' => 'ID is required.'
    ]);
    exit;
}

try {
    // Get user ID from id_number
    $stmt = $conn->prepare("SELECT id FROM users WHERE id_number = ?");
    $stmt->bind_param("s", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode([
            'status' => 'error',
            'message' => 'User not found.'
        ]);
        $stmt->close();
        $conn->close();
        exit;
    }
    
    $user = $result->fetch_assoc();
    $userId = $user['id'];
    $stmt->close();
    
    // Get security questions from security_questions table
    $questionStmt = $conn->prepare("SELECT authQuestion1, authQuestion2, authQuestion3 FROM security_questions WHERE user_id = ?");
    $questionStmt->bind_param("i", $userId);
    $questionStmt->execute();
    $questionResult = $questionStmt->get_result();
    
    if ($questionResult->num_rows === 0) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Security questions not found for this user.'
        ]);
        $questionStmt->close();
        $conn->close();
        exit;
    }
    
    $questionData = $questionResult->fetch_assoc();
    
    // Map question values to full question text
    $questionMap = [
        'petName' => 'What is the name of your pet?',
        'hobby' => 'What\'s your favorite hobby?',
        'travel' => 'What\'s your favorite place you\'ve visited?',
        'music' => 'Who\'s your favorite artist or band?',
        'movies' => 'Do you enjoy movies or TV shows?',
        'previousPassword' => 'What was your previous password?'
    ];
    
    // Convert question values to full text
    $question1Text = $questionMap[$questionData['authQuestion1']] ?? $questionData['authQuestion1'];
    $question2Text = $questionMap[$questionData['authQuestion2']] ?? $questionData['authQuestion2'];
    $question3Text = $questionMap[$questionData['authQuestion3']] ?? $questionData['authQuestion3'];
    
    // Return the 3 questions with both values and text (we'll use 2 for the form)
    echo json_encode([
        'status' => 'success',
        'questions' => [
            'question1' => $question1Text,
            'question1Value' => $questionData['authQuestion1'],
            'question2' => $question2Text,
            'question2Value' => $questionData['authQuestion2'],
            'question3' => $question3Text,
            'question3Value' => $questionData['authQuestion3']
        ]
    ]);
    
    $questionStmt->close();
    $conn->close();
    
} catch (Exception $e) {
    error_log("Get user questions error: " . $e->getMessage());
    
    echo json_encode([
        'status' => 'error',
        'message' => 'An error occurred. Please try again later.'
    ]);
}
?>

