<?php
session_start();
include 'db.php';

// ✅ Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// ✅ Ensure we're sending JSON response
header('Content-Type: application/json');

try {
    if ($_SERVER["REQUEST_METHOD"] == "POST") {
        
        // ✅ DEBUG: Log what we received
        error_log("POST Data: " . print_r($_POST, true));
        error_log("Session Data: " . print_r($_SESSION, true));
        
        // Check if user data is in session (came from registration)
        if (!isset($_SESSION['temp_user_data'])) {
            echo json_encode([
                "status" => "error", 
                "message" => "No registration data found. Please register first.",
                "debug" => "Session temp_user_data is missing. Please complete registration form first."
            ]);
            exit();
        }

        // Get all 3 questions and answers
        $question1 = $_POST['question1'] ?? '';
        $answer1 = trim($_POST['answer1'] ?? '');
        $question2 = $_POST['question2'] ?? '';
        $answer2 = trim($_POST['answer2'] ?? '');
        $question3 = $_POST['question3'] ?? '';
        $answer3 = trim($_POST['answer3'] ?? '');

        // ✅ DEBUG: Log received values
        error_log("Q1: $question1, A1: $answer1");
        error_log("Q2: $question2, A2: $answer2");
        error_log("Q3: $question3, A3: $answer3");

        // Validate all 3 questions
        if (empty($question1) || empty($answer1) || empty($question2) || empty($answer2) || empty($question3) || empty($answer3)) {
            echo json_encode([
                "status" => "error", 
                "message" => "Please select all 3 questions and provide answers.",
                "debug" => [
                    "q1" => !empty($question1),
                    "a1" => !empty($answer1),
                    "q2" => !empty($question2),
                    "a2" => !empty($answer2),
                    "q3" => !empty($question3),
                    "a3" => !empty($answer3)
                ]
            ]);
            exit();
        }

        // Check for duplicate questions
        $questions = [$question1, $question2, $question3];
        if (count($questions) !== count(array_unique($questions))) {
            echo json_encode([
                "status" => "error", 
                "message" => "Please select 3 different questions."
            ]);
            exit();
        }

        // Get user data from session
        $userData = $_SESSION['temp_user_data'];

        $genderValue = strtolower(trim((string) ($userData['gender'] ?? '')));
        if ($genderValue === 'male') {
            $userData['gender'] = 'Male';
        } elseif ($genderValue === 'female') {
            $userData['gender'] = 'Female';
        } else {
            echo json_encode([
                "status" => "error",
                "message" => "Please return to registration and select a valid sex."
            ]);
            exit();
        }

        // ✅ Validate userData structure
        $requiredFields = ['fname', 'lastName', 'birthday', 'age', 'gender', 'idNumber', 'email', 'username', 'password', 'street', 'barangay', 'city', 'province', 'country', 'zipCode'];
        foreach ($requiredFields as $field) {
            if (!isset($userData[$field])) {
                echo json_encode([
                    "status" => "error",
                    "message" => "Registration data incomplete. Missing field: $field",
                    "debug" => "Please complete registration form again"
                ]);
                exit();
            }
        }

        // ✅ Hash the answers (same as password hashing)
        $hashedAnswer1 = password_hash($answer1, PASSWORD_DEFAULT);
        $hashedAnswer2 = password_hash($answer2, PASSWORD_DEFAULT);
        $hashedAnswer3 = password_hash($answer3, PASSWORD_DEFAULT);

        // ✅ Handle optional fields (middleName and suffix can be empty)
        $middleName = $userData['middleName'] ?? '';
        $suffix = $userData['suffix'] ?? '';

        // First, save user to database
        $sql = "INSERT INTO users 
            (first_name, middle_name, last_name, suffix, birthday, age, gender, id_number, email, username, password, street, barangay, city, province, country, zip_code, registration_status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        $stmt = $conn->prepare($sql);
        if (!$stmt) {
            error_log("Prepare failed: " . $conn->error);
            echo json_encode([
                "status" => "error", 
                "message" => "Database error: " . $conn->error
            ]);
            exit();
        }

        $registrationStatus = 'complete';
        $stmt->bind_param("sssssiisssssssssss",
            $userData['fname'], 
            $middleName, 
            $userData['lastName'], 
            $suffix, 
            $userData['birthday'], 
            $userData['age'], 
            $userData['gender'], 
            $userData['idNumber'], 
            $userData['email'], 
            $userData['username'], 
            $userData['password'], 
            $userData['street'], 
            $userData['barangay'], 
            $userData['city'], 
            $userData['province'], 
            $userData['country'], 
            $userData['zipCode'], 
            $registrationStatus
        );

        if ($stmt->execute()) {
            $user_id = $conn->insert_id;

            $roleStmt = $conn->prepare('INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE code = "user"');
            $roleStmt->bind_param('i', $user_id);
            if (!$roleStmt->execute() || $roleStmt->affected_rows < 1) {
                $conn->query("DELETE FROM users WHERE id = " . (int)$user_id);
                echo json_encode(["status" => "error", "message" => "Could not initialize user permissions."]);
                exit();
            }
            
            // ✅ FIXED: Use correct table name 'security_questions'
                $questionSql = "INSERT INTO security_questions 
                    (user_id, authQuestion1, authAnswer1, authQuestion2, authAnswer2, authQuestion3, authAnswer3) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)";
                $questionStmt = $conn->prepare($questionSql);
            
            if (!$questionStmt) {
                error_log("Question prepare failed: " . $conn->error);
                echo json_encode([
                    "status" => "error", 
                    "message" => "Database error preparing security questions: " . $conn->error
                ]);
                exit();
            }

            $questionStmt->bind_param("issssss", 
            $user_id, 
            $question1, $hashedAnswer1, 
            $question2, $hashedAnswer2, 
            $question3, $hashedAnswer3
         );

            
            if ($questionStmt->execute()) {
                // ✅ Clear session data
                unset($_SESSION['temp_user_data']);
                
                echo json_encode([
                    "status" => "success", 
                    "message" => "Registration completed successfully! You can now login.",
                    "redirect" => "../html/login.html"
                ]);
            } else {
                error_log("Question execute failed: " . $questionStmt->error);
                echo json_encode([
                    "status" => "error", 
                    "message" => "Failed to save security questions: " . $questionStmt->error
                ]);
            }
            
            $questionStmt->close();
        } else {
            error_log("User insert failed: " . $stmt->error);
            echo json_encode([
                "status" => "error", 
                "message" => "Failed to save user: " . $stmt->error
            ]);
        }

        $stmt->close();
        $conn->close();
    } else {
        echo json_encode([
            "status" => "error", 
            "message" => "Invalid request method. Expected POST."
        ]);
    }
} catch (Exception $e) {
    error_log("Exception caught: " . $e->getMessage());
    echo json_encode([
        "status" => "error",
        "message" => "An error occurred: " . $e->getMessage(),
        "debug" => $e->getTraceAsString()
    ]);
}
?>