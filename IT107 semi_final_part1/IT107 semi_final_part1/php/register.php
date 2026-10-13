<?php
session_start();
include 'db.php';
require_once 'email_policy.php';
require_once 'mailer.php';
require_once 'otp.php';

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

    $genderValue = strtolower(trim($gender));
    if ($genderValue === 'male') {
        $gender = 'Male';
    } elseif ($genderValue === 'female') {
        $gender = 'Female';
    } else {
        die('Please select a valid sex.');
    }

    if (!is_institutional_email($email)) {
        die(institutional_email_error_message());
    }

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
        'zipCode' => $zipCode,
        'email_verified' => false
    ];

    // Signups that started from "Continue with Google" already proved they own this
    // address through Google, so they skip the emailed code.
    $googleEmail = $_SESSION['google_signup']['email'] ?? '';
    if ($googleEmail !== '' && strcasecmp($googleEmail, trim($email)) === 0) {
        $_SESSION['temp_user_data']['email_verified'] = true;
        unset($_SESSION['google_signup'], $_SESSION['registration_otp']);
        header("Location: ../html/question.html");
        exit();
    }

    // Send a one-time code to the institutional email to confirm the user controls it
    // before letting them proceed to the rest of the registration flow.
    $otpCode = issue_registration_otp($email);
    $displayName = trim($fname . ' ' . $lastName);
    if (!send_registration_otp_email($email, $displayName, $otpCode)) {
        unset($_SESSION['temp_user_data'], $_SESSION['registration_otp']);
        header("Location: ../html/register.html?error=" . rawurlencode('We could not send a verification code to that email address. Please try again later.'));
        exit();
    }

    // Redirect to the email verification page; account is created only after
    // the code is confirmed and the security questions are answered.
    header("Location: ../html/verify-email.html");
    exit();
}
