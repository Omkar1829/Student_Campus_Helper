<?php
header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}
include 'dbconn.php';

// Simple JWT functions
function createJWT($data, $secretKey, $expiryHours = 24) {
    $headers = json_encode(['alg' => 'HS256', 'typ' => 'JWT']);
    $issuedAt = time();
    $expire = $issuedAt + ($expiryHours * 3600);
    $payload = json_encode([
        'iat' => $issuedAt,
        'exp' => $expire,
        'data' => $data
    ]);
    
    $headers_encoded = base64_encode($headers);
    $payload_encoded = base64_encode($payload);
    $signature = hash_hmac('sha256', "$headers_encoded.$payload_encoded", $secretKey, true);
    $signature_encoded = base64_encode($signature);
    
    return "$headers_encoded.$payload_encoded.$signature_encoded";
}

function verifyJWT($token, $secretKey) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }
    
    list($headers_encoded, $payload_encoded, $signature_encoded) = $parts;
    
    $signature = base64_decode($signature_encoded);
    $expected_signature = hash_hmac('sha256', "$headers_encoded.$payload_encoded", $secretKey, true);
    
    if ($signature !== $expected_signature) {
        return null;
    }
    
    $payload = json_decode(base64_decode($payload_encoded), true);
    
    if ($payload['exp'] < time()) {
        return null;
    }
    
    return $payload['data'];
}

// Get request data
$input = json_decode(file_get_contents('php://input'), true);
$action = isset($input['action']) ? $input['action'] : '';

// REGISTER
if ($action === 'register') {
    $name = isset($input['name']) ? trim($input['name']) : '';
    $email = isset($input['email']) ? trim($input['email']) : '';
    $password = isset($input['password']) ? $input['password'] : '';
    $confirm_password = isset($input['confirm_password']) ? $input['confirm_password'] : '';
    $branch = isset($input['branch']) ? trim($input['branch']) : '';
    $semester = isset($input['semester']) ? trim($input['semester']) : '';
    
    // Validation
    if (!$name || !$email || !$password || !$confirm_password || !$branch || !$semester) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'All fields are required']);
        exit;
    }
    
    if ($password !== $confirm_password) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Passwords do not match']);
        exit;
    }
    
    if (!preg_match('/^(?=.*[A-Z])(?=.*[0-9]).{6,}$/', $password)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Password must be at least 6 characters']);
        exit;
    }
    
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid email format']);
        exit;
    }
    
    try {
        // Check if user already exists
        $check = $conn->prepare("SELECT id FROM users WHERE email = ?");
        $check->execute([$email]);
        
        if ($check->rowCount() > 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Email already registered']);
            exit;
        }
        
        // Create users table if it doesn't exist
        $conn->exec("
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                branch VARCHAR(100),
                semester VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ");
        
        // Insert new user
        $hashed_password = password_hash($password, PASSWORD_DEFAULT);
        $insert = $conn->prepare("INSERT INTO users (name, email, password, branch, semester) VALUES (?, ?, ?, ?, ?)");
        $insert->execute([$name, $email, $hashed_password, $branch, $semester]);
        
        echo json_encode(['success' => true, 'message' => 'User registered successfully. Please login.']);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Registration failed']);
    }
}

// LOGIN
else if ($action === 'login') {
    $email = isset($input['email']) ? trim($input['email']) : '';
    $password = isset($input['password']) ? $input['password'] : '';
    
    if (!$email || !$password) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Email and password required']);
        exit;
    }
    
    try {
        $stmt = $conn->prepare("SELECT id, name, email, password, branch, semester FROM users WHERE email = ?");
        $stmt->execute([$email]);
        
        if ($stmt->rowCount() === 0) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Invalid email or password']);
            exit;
        }
        
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!password_verify($password, $user['password'])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Invalid email or password']);
            exit;
        }
        
        // Create JWT token
        $token_data = [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'branch' => $user['branch'],
            'semester' => $user['semester']
        ];
        
        
        $secret_key = "your_super_secret_key_123";
        echo json_encode([
            'success' => true,
            'message' => 'Login successful',
            'token' => $token,
            'user' => $token_data
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Login failed']);
    }
}

// VERIFY TOKEN
else if ($action === 'verify') {
    $token = isset($input['token']) ? $input['token'] : '';
    
    if (!$token) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Token required']);
        exit;
    }
    
    $user_data = verifyJWT($token, $secret_key);
    
    if ($user_data === null) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired token']);
        exit;
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Token is valid',
        'user' => $user_data
    ]);
}

// GET USER DATA
else if ($action === 'getUser') {
    $token = isset($input['token']) ? $input['token'] : '';
    
    if (!$token) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Token required']);
        exit;
    }
    
    $user_data = verifyJWT($token, $secret_key);
    
    if ($user_data === null) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid or expired token']);
        exit;
    }
    
    try {
        $stmt = $conn->prepare("SELECT id, name, email, branch, semester, created_at FROM users WHERE id = ?");
        $stmt->execute([$user_data['id']]);
        
        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'User not found']);
            exit;
        }
        
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'user' => $user
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to fetch user data']);
    }
}

else {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid action']);
}
?>
