<?php
$conn = new mysqli("localhost", "root", "Ycpait24", "smart_campus");

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

$email = $_POST['email'];
$password = $_POST['password'];

// Use Prepared Statement
$stmt = $conn->prepare("SELECT password FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    $user = $result->fetch_assoc();
    if (password_verify($password, $user['password'])) {
        echo "Login Successful! Welcome to Smart Campus.";
        // Here you would normally start a session: session_start(); $_SESSION['user'] = $email;
    } else {
        echo "Invalid Password!";
    }
} else {
    echo "User not found!";
}

$stmt->close();
$conn->close();
?>