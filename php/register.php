<?php
$conn = new mysqli("localhost", "root", "Ycpait24", "smart_campus");

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
else
    echo "Connection successfully"

Get form data
$name = $_POST['name'];
$email = $_POST['email'];
$password = $_POST['password'];
$confirm = $_POST['confirm_password'];

if ($password !== $confirm) {
    die("Passwords do not match!");
}



// Hash password
$hashedPassword = password_hash($password, PASSWORD_DEFAULT);

// Use Prepared Statements to prevent SQL Injection
$stmt = $conn->prepare("INSERT INTO users (full_name, email, password) VALUES (?, ?, ?)");
$stmt->bind_param("sss", $name, $email, $hashedPassword);

if ($stmt->execute()) {
    echo "Registration Successful! <a href='login.html'>Login here</a>";
} else {
    echo "Error: " . $stmt->error;
}

$stmt->close();
$conn->close();
?>