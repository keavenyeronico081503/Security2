<?php
include 'db.php';

// Create user_questions table
$sql = "CREATE TABLE IF NOT EXISTS user_questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    question VARCHAR(255) NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)";

if ($conn->query($sql) === TRUE) {
    echo "Table 'user_questions' created successfully!";
} else {
    echo "Error creating table: " . $conn->error;
}

$conn->close();
?>
