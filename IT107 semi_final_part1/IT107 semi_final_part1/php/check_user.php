<?php
include 'db.php'; // make sure correct connection

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = trim($_POST['password'] ?? '');
    $email    = trim($_POST['email'] ?? ''); //  new email
    $suffix   = trim($_POST['suffix'] ?? ''); //  new suffix

    //  If walay sulod tanan
    if ($username === '' && $password === '' && $email === '' && $suffix === '') {
        echo json_encode(["status" => "error", "message" => "No input provided."]);
        exit;
    }

    //  Check kung naa na ang Email
    if ($email !== '') {
        $stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        $stmt->store_result();
        if ($stmt->num_rows > 0) {
            echo json_encode(["status" => "email_exists", "message" => "Email already exists!"]);
            exit;
        }
        $stmt->close();
    }

    //  Check kung naa nay existing Password maski lahi ug Username (PRIORITY - check password first)
    if ($password !== '') {
        $stmt = $conn->prepare("SELECT password FROM users");
        $stmt->execute();
        $result = $stmt->get_result();

        while ($row = $result->fetch_assoc()) {
            if (password_verify($password, $row['password'])) {
                echo json_encode(["status" => "password_exists", "message" => "Password already exists!"]);
                exit;
            }
        }
        $stmt->close();
    }

    //  Check kung naa na ang Username
    if ($username !== '') {
        $stmt = $conn->prepare("SELECT id FROM users WHERE username = ?");
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $stmt->store_result();
        if ($stmt->num_rows > 0) {
            echo json_encode(["status" => "username_exists", "message" => "Username already exists!"]);
            exit;
        }
        $stmt->close();
    }

    // Check kung naa na ang Suffix
    if ($suffix !== '') {
        $stmt = $conn->prepare("SELECT id FROM users WHERE suffix = ?");
        $stmt->bind_param("s", $suffix);
        $stmt->execute();
        $stmt->store_result();
        if ($stmt->num_rows > 0) {
            echo json_encode(["status" => "suffix_exists", "message" => "Suffix already exists!"]);
            exit;
        }
        $stmt->close();
    }

    //  If walay conflict
    echo json_encode(["status" => "available", "message" => "All available."]);
}
?>
