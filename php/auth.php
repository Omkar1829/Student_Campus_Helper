<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

include 'dbconn.php';

$secret_key = "CampusHelperSecret26";

function createJWT($data, $secretKey, $expiryHours = 24)
{
    $headers = base64_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64_encode(json_encode([
        'iat' => time(),
        'exp' => time() + ($expiryHours * 3600),
        'data' => $data
    ]));

    $signature = base64_encode(hash_hmac('sha256', "$headers.$payload", $secretKey, true));

    return "$headers.$payload.$signature";
}

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';


if ($action === 'register') {

    $name = trim($input['name'] ?? '');
    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';
    $confirm_password = $input['confirm_password'] ?? '';
    $course = trim($input['course'] ?? '');
    $semester = trim($input['semester'] ?? '');

    if (!$name || !$email || !$password || !$confirm_password || !$course || !$semester) {
        echo json_encode(['success' => false, 'message' => 'All fields required']);
        exit;
    }

    if ($password !== $confirm_password) {
        echo json_encode(['success' => false, 'message' => 'Passwords do not match']);
        exit;
    }

    if (strlen($password) < 6) {
        echo json_encode(['success' => false, 'message' => 'Password must be 6+ chars']);
        exit;
    }

    try {
        $check = $conn->prepare("SELECT id FROM users WHERE email = ?");
        $check->execute([$email]);

        if ($check->rowCount() > 0) {
            echo json_encode(['success' => false, 'message' => 'Email already exists']);
            exit;
        }

        $hashed = password_hash($password, PASSWORD_DEFAULT);

        $stmt = $conn->prepare("INSERT INTO users (name, email, password, course, semester) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$name, $email, $hashed, $course, $semester]);

        echo json_encode(['success' => true]);

    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}


else if ($action === 'login') {

    $email = trim($input['email'] ?? '');
    $password = $input['password'] ?? '';
    $ip_address = $input['ip_address'] ?? $_SERVER['REMOTE_ADDR'];

    if (!$email || !$password) {
        echo json_encode(['success' => false, 'message' => 'Email & password required']);
        exit;
    }

    try {
        $stmt = $conn->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->execute([$email]);

        if ($stmt->rowCount() === 0) {
            echo json_encode(['success' => false, 'message' => 'User not found']);
            exit;
        }

        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!password_verify($password, $user['password'])) {
            echo json_encode(['success' => false, 'message' => 'Wrong password']);
            exit;
        }

        $log = $conn->prepare("INSERT INTO login_logs (user_id, ip_address) VALUES (?, ?)");
        $log->execute([$user['id'], $ip_address]);

        $token_data = [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email']
        ];

        $token = createJWT($token_data, $secret_key);

        echo json_encode([
            'success' => true,
            'token' => $token,
            'user' => $token_data
        ]);

    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}

else {
    echo json_encode(['success' => false, 'message' => 'Invalid action']);
}
?>