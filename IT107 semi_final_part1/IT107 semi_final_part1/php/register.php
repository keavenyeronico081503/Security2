<?php
session_start();
include 'db.php';

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    // Collect form inputs
    $fname      = $_POST['fname'] ?? '';
    $middleName = $_POST['MiddleName'] ?? '';
    $lastName   = $_POST['LastName'] ?? '';
    $suffix     = $_POST['suffix'] ?? '';
    $birthday   = $_POST['birthday'] ?? '';
    $age        = $_POST['Age'] ?? '';
    $gender     = $_POST['gender'] ?? '';
    $idNumber   = $_POST['ID'] ?? '';
    $email      = $_POST['email'] ?? '';
    $username   = $_POST['Username'] ?? '';
    $password   = $_POST['password'] ?? '';
    $repassword = $_POST['repassword'] ?? '';
    $street     = $_POST['Street'] ?? '';
    $barangay   = $_POST['barangay'] ?? '';
    $city       = $_POST['City'] ?? '';
    $province   = $_POST['Province'] ?? '';
    $country    = $_POST['Country'] ?? '';
    $zipCode    = $_POST['ZipCode'] ?? '';

    // Validate passwords
    if (empty($password) || empty($repassword)) {
        die("Password fields cannot be empty!");
    }
    if ($password !== $repassword) {
        die("Passwords do not match!");
    }

    // Hash password
    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    // Store user data in session instead of saving to database
    $_SESSION['temp_user_data'] = [
        'fname' => $fname,
        'middleName' => $middleName,
        'lastName' => $lastName,
        'suffix' => $suffix,
        'birthday' => $birthday,
        'age' => $age,
        'gender' => $gender,
        'idNumber' => $idNumber,
        'email' => $email,
        'username' => $username,
        'password' => $hashedPassword,
        'street' => $street,
        'barangay' => $barangay,
        'city' => $city,
        'province' => $province,
        'country' => $country,
        'zipCode' => $zipCode
    ];

    // Redirect to question page without saving to database yet
    header("Location: ../html/question.html");
    exit();

    $stmt->close(); // Close statement after insertion

    // ID Generation Script (use same connection)
    $year = date("Y");
    $result = $conn->query("SELECT COUNT(*) as total FROM users");
    $row = $result->fetch_assoc();
    $count = $row['total'] + 1;

    // Format: YYYY-0001
    $generatedId = $year . '-' . str_pad($count, 4, "0", STR_PAD_LEFT);

    echo $generatedId;

    $conn->close(); // Close connection **only once** at the end
}
