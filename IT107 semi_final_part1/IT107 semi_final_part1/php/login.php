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
    $sql = "SELECT id, username, password, role, account_status, privileges, registration_status FROM users WHERE username = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        echo json_encode(["status" => "error", "message" => "Invalid password or username."]);
        exit();
    }

    $user = $result->fetch_assoc();

    if ($user['account_status'] === 'blocked') {
        echo json_encode(["status" => "error", "message" => "This account is blocked."]);
        exit();
    }

    if ($user['role'] !== 'user' && $user['account_status'] !== 'approved') {
        echo json_encode(["status" => "error", "message" => "This administrator account is awaiting approval."]);
        exit();
    }

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
        session_regenerate_id(true);
        // Set session variables
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['role'] = $user['role'];
        $_SESSION['privileges'] = json_decode($user['privileges'] ?: '{}', true) ?: [];

        $redirect = $user['role'] === 'user' && $user['account_status'] === 'pending'
            ? "../html/pending.html"
            : match ($user['role']) {
            'super_admin' => "../html/super-admin.html",
            'admin' => "../html/admin.html",
            default => "../html/dashboard.html"
        };
        
        echo json_encode([
            "status" => "success", 
            "message" => "Login successful!",
            "redirect" => $redirect
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
