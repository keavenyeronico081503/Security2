<?php
session_start();
include 'db.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';

    if (empty($username) || empty($password)) {
        echo json_encode(["status" => "error", "message" => "Username and password are required."]);
        exit();
    }

    // Check if user exists and get their info
    $sql = "SELECT id, username, password, registration_status FROM users WHERE username = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        echo json_encode(["status" => "error", "message" => "Invalid password or username."]);
        exit();
    }

    $user = $result->fetch_assoc();

    // Check if registration is incomplete
    if ($user['registration_status'] === 'incomplete') {
        echo json_encode([
            "status" => "error", 
            "message" => "Registration incomplete. Please complete your security question first.",
            "redirect" => "../html/question.html"
        ]);
        exit();
    }

    // Verify password
    if (password_verify($password, $user['password'])) {
        // Set session variables
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        
        echo json_encode([
            "status" => "success", 
            "message" => "Login successful!",
            "redirect" => "../html/dashboard.html"
        ]);
    } else {
        echo json_encode(["status" => "error", "message" => "Invalid password or username."]);
    }

    $stmt->close();
} else {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
}

$conn->close();
?>
