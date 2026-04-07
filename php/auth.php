<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once 'dbconn.php';

$secretKey = 'CampusHelperSecret26';
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
$rawInput = file_get_contents('php://input');
$input = stripos($contentType, 'multipart/form-data') !== false
    ? $_POST
    : (json_decode($rawInput, true) ?: []);
$action = $input['action'] ?? '';

function respond($success, $message = '', $data = [], $statusCode = 200)
{
    http_response_code($statusCode);
    echo json_encode(array_merge([
        'success' => $success,
        'message' => $message
    ], $data));
    exit;
}

function base64UrlEncode($value)
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function base64UrlDecode($value)
{
    return base64_decode(strtr($value . str_repeat('=', (4 - strlen($value) % 4) % 4), '-_', '+/'));
}

function createJWT($data, $secretKey, $expiryHours = 24)
{
    $header = base64UrlEncode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload = base64UrlEncode(json_encode([
        'iat' => time(),
        'exp' => time() + ($expiryHours * 3600),
        'data' => $data
    ]));
    $signature = base64UrlEncode(hash_hmac('sha256', $header . '.' . $payload, $secretKey, true));

    return $header . '.' . $payload . '.' . $signature;
}

function decodeJWT($token, $secretKey)
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        throw new Exception('Invalid token format.');
    }

    [$header, $payload, $signature] = $parts;
    $expected = base64UrlEncode(hash_hmac('sha256', $header . '.' . $payload, $secretKey, true));

    if (!hash_equals($expected, $signature)) {
        throw new Exception('Invalid token signature.');
    }

    $payloadData = json_decode(base64UrlDecode($payload), true);
    if (!$payloadData || !isset($payloadData['data']['id'])) {
        throw new Exception('Invalid token payload.');
    }

    if (($payloadData['exp'] ?? 0) < time()) {
        throw new Exception('Session expired. Please log in again.');
    }

    return $payloadData['data'];
}

function getTokenFromRequest($input)
{
    $token = trim($input['token'] ?? '');
    if ($token !== '') {
        return $token;
    }

    $headers = function_exists('getallheaders') ? getallheaders() : [];
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

    if (stripos($authHeader, 'Bearer ') === 0) {
        return trim(substr($authHeader, 7));
    }

    return '';
}

function authenticateUser($input, $conn, $secretKey)
{
    $token = getTokenFromRequest($input);
    if ($token === '') {
        respond(false, 'Authentication required.', [], 401);
    }

    try {
        $tokenData = decodeJWT($token, $secretKey);
        $stmt = $conn->prepare('SELECT id, name, email, course, semester, role, created_at FROM users WHERE id = ?');
        $stmt->execute([$tokenData['id']]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            respond(false, 'User not found.', [], 404);
        }

        return $user;
    } catch (Exception $exception) {
        respond(false, $exception->getMessage(), [], 401);
    }
}

function isAdmin($user)
{
    return strtolower($user['role'] ?? 'user') === 'admin';
}

function authenticateAdmin($input, $conn, $secretKey)
{
    $user = authenticateUser($input, $conn, $secretKey);
    if (!isAdmin($user)) {
        respond(false, 'Admin access required.', [], 403);
    }

    return $user;
}

function tableExists($conn, $tableName)
{
    $stmt = $conn->prepare("SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = ?
    )");
    $stmt->execute([$tableName]);
    return (bool) $stmt->fetchColumn();
}

function columnExists($conn, $tableName, $columnName)
{
    $stmt = $conn->prepare(
        "SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = ? AND column_name = ?
        )"
    );
    $stmt->execute([$tableName, $columnName]);

    return (bool) $stmt->fetchColumn();
}

function requireTable($conn, $tableName, $featureLabel)
{
    if (!tableExists($conn, $tableName)) {
        respond(false, $featureLabel . ' table is not added in the database yet.', [], 400);
    }
}

function requireColumns($conn, $tableName, $featureLabel, $columns)
{
    foreach ($columns as $columnName) {
        if (!columnExists($conn, $tableName, $columnName)) {
            respond(false, $featureLabel . ' table is missing required column: ' . $columnName, [], 400);
        }
    }
}

function normalizeUploadedFileName($fileName)
{
    $baseName = preg_replace('/[^A-Za-z0-9._-]/', '-', pathinfo($fileName, PATHINFO_FILENAME));
    $baseName = trim($baseName, '-');
    $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));

    return [
        'name' => $baseName !== '' ? $baseName : 'file',
        'extension' => $extension
    ];
}

function saveUploadedFile($fieldName, $targetDirectory, $allowedExtensions, $maxBytes = 10485760)
{
    if (empty($_FILES[$fieldName]) || !is_array($_FILES[$fieldName])) {
        return null;
    }

    $file = $_FILES[$fieldName];
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return null;
    }

    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        respond(false, 'Upload failed. Please try again.', [], 422);
    }

    if (($file['size'] ?? 0) <= 0 || ($file['size'] ?? 0) > $maxBytes) {
        respond(false, 'Uploaded file is too large.', [], 422);
    }

    $normalized = normalizeUploadedFileName($file['name'] ?? 'upload');
    if (!in_array($normalized['extension'], $allowedExtensions, true)) {
        respond(false, 'Unsupported file type uploaded.', [], 422);
    }

    $rootPath = dirname(__DIR__);
    $absoluteDirectory = $rootPath . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $targetDirectory);
    if (!is_dir($absoluteDirectory) && !mkdir($absoluteDirectory, 0775, true) && !is_dir($absoluteDirectory)) {
        respond(false, 'Unable to prepare upload directory.', [], 500);
    }

    $fileName = sprintf(
        '%s-%s.%s',
        date('YmdHis'),
        bin2hex(random_bytes(5)),
        $normalized['extension']
    );
    $absolutePath = $absoluteDirectory . DIRECTORY_SEPARATOR . $fileName;

    if (!move_uploaded_file($file['tmp_name'], $absolutePath)) {
        respond(false, 'Unable to store uploaded file.', [], 500);
    }

    return str_replace('\\', '/', trim($targetDirectory, '/\\') . '/' . $fileName);
}

function getLostFoundImageColumn($conn)
{
    if (columnExists($conn, 'lost_found', 'image_path')) {
        return 'image_path';
    }

    if (columnExists($conn, 'lost_found', 'file_path')) {
        return 'file_path';
    }

    return null;
}

function buildInsertFromColumns($conn, $tableName, $valuesByColumn)
{
    $columns = [];
    $placeholders = [];
    $params = [];

    foreach ($valuesByColumn as $column => $value) {
        if (columnExists($conn, $tableName, $column)) {
            $columns[] = $column;
            $placeholders[] = '?';
            $params[] = $value;
        }
    }

    return [
        'sql' => sprintf(
            'INSERT INTO %s (%s) VALUES (%s)',
            $tableName,
            implode(', ', $columns),
            implode(', ', $placeholders)
        ),
        'params' => $params
    ];
}

function buildUpdateFromColumns($conn, $tableName, $valuesByColumn, $whereSql, $whereParams)
{
    $assignments = [];
    $params = [];

    foreach ($valuesByColumn as $column => $value) {
        if (columnExists($conn, $tableName, $column)) {
            $assignments[] = "{$column} = ?";
            $params[] = $value;
        }
    }

    return [
        'sql' => sprintf(
            'UPDATE %s SET %s %s',
            $tableName,
            implode(', ', $assignments),
            $whereSql
        ),
        'params' => array_merge($params, $whereParams)
    ];
}

function deleteStoredFile($relativePath)
{
    if (!$relativePath) {
        return;
    }

    $normalizedPath = str_replace('\\', '/', ltrim($relativePath, '/\\'));
    $allowedPrefixes = ['notes/', 'images/lost-found/'];
    $isAllowed = false;

    foreach ($allowedPrefixes as $prefix) {
        if (stripos($normalizedPath, $prefix) === 0) {
            $isAllowed = true;
            break;
        }
    }

    if (!$isAllowed) {
        return;
    }

    $absolutePath = dirname(__DIR__) . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $normalizedPath);
    if (is_file($absolutePath)) {
        @unlink($absolutePath);
    }
}

function logActivity($conn, $userId, $action, $details)
{
    if (!tableExists($conn, 'activity_logs')) {
        return;
    }

    $stmt = $conn->prepare('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)');
    $stmt->execute([$userId, $action, $details]);
}

function getTableCount($conn, $tableName)
{
    if (!tableExists($conn, $tableName)) {
        return 0;
    }

    return (int) $conn->query("SELECT COUNT(*) FROM {$tableName}")->fetchColumn();
}

function getUserStats($conn, $userId)
{
    $notesCount = 0;
    $timetableCount = 0;
    $itemsCount = 0;
    $eventsCount = 0;

    if (tableExists($conn, 'notes')) {
        $notesStmt = $conn->prepare('SELECT COUNT(*) FROM notes WHERE user_id = ?');
        $notesStmt->execute([$userId]);
        $notesCount = (int) $notesStmt->fetchColumn();
    }

    if (tableExists($conn, 'timetable')) {
        $timetableStmt = $conn->prepare('SELECT COUNT(*) FROM timetable WHERE user_id = ?');
        $timetableStmt->execute([$userId]);
        $timetableCount = (int) $timetableStmt->fetchColumn();
    }

    if (tableExists($conn, 'lost_found')) {
        $itemsStmt = $conn->prepare('SELECT COUNT(*) FROM lost_found WHERE user_id = ?');
        $itemsStmt->execute([$userId]);
        $itemsCount = (int) $itemsStmt->fetchColumn();
    }

    if (tableExists($conn, 'events')) {
        $eventsCount = (int) $conn->query("SELECT COUNT(*) FROM events WHERE event_date >= CURRENT_DATE")->fetchColumn();
    }

    return [
        'notes_count' => $notesCount,
        'timetable_count' => $timetableCount,
        'items_reported' => $itemsCount,
        'upcoming_events' => $eventsCount
    ];
}

try {
    switch ($action) {
        case 'register':
            $name = trim($input['name'] ?? '');
            $email = strtolower(trim($input['email'] ?? ''));
            $password = (string) ($input['password'] ?? '');
            $confirmPassword = (string) ($input['confirm_password'] ?? '');
            $course = trim($input['course'] ?? '');
            $semester = trim($input['semester'] ?? '');

            if ($name === '' || $email === '' || $password === '' || $confirmPassword === '' || $course === '' || $semester === '') {
                respond(false, 'All registration fields are required.', [], 422);
            }

            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                respond(false, 'Please enter a valid email address.', [], 422);
            }

            if ($password !== $confirmPassword) {
                respond(false, 'Passwords do not match.', [], 422);
            }

            if (strlen($password) < 6) {
                respond(false, 'Password must be at least 6 characters long.', [], 422);
            }

            $check = $conn->prepare('SELECT id FROM users WHERE email = ?');
            $check->execute([$email]);
            if ($check->fetchColumn()) {
                respond(false, 'An account with this email already exists.', [], 409);
            }

            $stmt = $conn->prepare('INSERT INTO users (name, email, password, course, semester) VALUES (?, ?, ?, ?, ?)');
            $stmt->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT), $course, $semester]);

            respond(true, 'Registration successful. Please log in.');

        case 'login':
            $email = strtolower(trim($input['email'] ?? ''));
            $password = (string) ($input['password'] ?? '');
            $ipAddress = trim($input['ip_address'] ?? ($_SERVER['REMOTE_ADDR'] ?? 'Unknown'));

            if ($email === '' || $password === '') {
                respond(false, 'Email and password are required.', [], 422);
            }

            $stmt = $conn->prepare('SELECT * FROM users WHERE email = ?');
            $stmt->execute([$email]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user || !password_verify($password, $user['password'])) {
                respond(false, 'Invalid email or password.', [], 401);
            }

            if (tableExists($conn, 'login_logs')) {
                $logStmt = $conn->prepare('INSERT INTO login_logs (user_id, ip_address) VALUES (?, ?)');
                $logStmt->execute([$user['id'], $ipAddress]);
            }

            $safeUser = [
                'id' => (int) $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'course' => $user['course'],
                'semester' => $user['semester'],
                'role' => $user['role']
            ];

            respond(true, 'Login successful.', [
                'token' => createJWT($safeUser, $secretKey),
                'user' => $safeUser
            ]);

        case 'getUser':
            $user = authenticateUser($input, $conn, $secretKey);
            respond(true, 'User loaded successfully.', [
                'user' => $user,
                'stats' => getUserStats($conn, $user['id'])
            ]);

        case 'updateUser':
            $user = authenticateUser($input, $conn, $secretKey);
            $name = trim($input['name'] ?? '');
            $email = strtolower(trim($input['email'] ?? ''));
            $course = trim($input['course'] ?? '');
            $semester = trim($input['semester'] ?? '');

            if ($name === '' || $email === '' || $course === '' || $semester === '') {
                respond(false, 'Name, email, course, and semester are required.', [], 422);
            }

            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                respond(false, 'Please enter a valid email address.', [], 422);
            }

            $emailCheck = $conn->prepare('SELECT id FROM users WHERE email = ? AND id <> ?');
            $emailCheck->execute([$email, $user['id']]);
            if ($emailCheck->fetchColumn()) {
                respond(false, 'That email address is already in use.', [], 409);
            }

            $stmt = $conn->prepare('UPDATE users SET name = ?, email = ?, course = ?, semester = ? WHERE id = ?');
            $stmt->execute([$name, $email, $course, $semester, $user['id']]);
            logActivity($conn, $user['id'], 'profile_updated', 'Updated profile details');

            $fresh = authenticateUser(['token' => $input['token']], $conn, $secretKey);
            respond(true, 'Profile updated successfully.', ['user' => $fresh]);

        case 'getNotes':
            $user = authenticateUser($input, $conn, $secretKey);
            requireTable($conn, 'notes', 'Notes');
            $stmt = $conn->query(
                'SELECT n.id, n.user_id, n.title, n.description, n.file_path, n.downloads, n.created_at, u.name AS owner_name
                 FROM notes n
                 LEFT JOIN users u ON u.id = n.user_id
                 ORDER BY n.created_at DESC'
            );
            $notes = array_map(function ($note) use ($user) {
                $note['can_delete'] = isAdmin($user) || (int) $note['user_id'] === (int) $user['id'];
                return $note;
            }, $stmt->fetchAll(PDO::FETCH_ASSOC));

            respond(true, 'Notes loaded successfully.', ['notes' => $notes]);

        case 'addNote':
            $user = authenticateUser($input, $conn, $secretKey);
            requireTable($conn, 'notes', 'Notes');
            $title = trim($input['title'] ?? '');
            $description = trim($input['description'] ?? '');
            $uploadedNotePath = saveUploadedFile('note_file', 'notes', ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'zip'], 15728640);
            $filePath = trim($input['file_path'] ?? '');
            $resolvedFilePath = $uploadedNotePath ?? ($filePath !== '' ? $filePath : null);

            if ($title === '' || $description === '') {
                respond(false, 'Title and description are required.', [], 422);
            }

            $stmt = $conn->prepare('INSERT INTO notes (user_id, title, description, file_path, downloads) VALUES (?, ?, ?, ?, 0)');
            $stmt->execute([$user['id'], $title, $description, $resolvedFilePath]);
            logActivity($conn, $user['id'], 'note_added', 'Added note: ' . $title);
            respond(true, 'Note added successfully.');

        case 'deleteNote':
            $user = authenticateUser($input, $conn, $secretKey);
            requireTable($conn, 'notes', 'Notes');
            $noteId = (int) ($input['id'] ?? 0);
            if ($noteId <= 0) {
                respond(false, 'Invalid note selected.', [], 422);
            }

            $pathStmt = $conn->prepare('SELECT file_path, user_id FROM notes WHERE id = ?');
            $pathStmt->execute([$noteId]);
            $note = $pathStmt->fetch(PDO::FETCH_ASSOC);

            if (!$note) {
                respond(false, 'Note not found.', [], 404);
            }

            if ((int) $note['user_id'] !== (int) $user['id'] && !isAdmin($user)) {
                respond(false, 'You can only delete notes uploaded by you.', [], 403);
            }

            $stmt = $conn->prepare('DELETE FROM notes WHERE id = ?');
            $stmt->execute([$noteId]);
            if ($stmt->rowCount() > 0) {
                deleteStoredFile($note['file_path']);
                logActivity($conn, $user['id'], 'note_deleted', 'Deleted note ID: ' . $noteId);
            }
            respond($stmt->rowCount() > 0, $stmt->rowCount() > 0 ? 'Note deleted successfully.' : 'Note not found.', []);

        case 'downloadNote':
            authenticateUser($input, $conn, $secretKey);
            requireTable($conn, 'notes', 'Notes');
            $noteId = (int) ($input['id'] ?? 0);

            if ($noteId <= 0) {
                respond(false, 'Invalid note selected.', [], 422);
            }

            $stmt = $conn->prepare('UPDATE notes SET downloads = COALESCE(downloads, 0) + 1 WHERE id = ? RETURNING id, file_path, downloads');
            $stmt->execute([$noteId]);
            $note = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$note || empty($note['file_path'])) {
                respond(false, 'No downloadable file is attached to this note.', [], 404);
            }

            respond(true, 'Download counted.', ['file_path' => $note['file_path'], 'downloads' => (int) $note['downloads']]);

        case 'getTimetable':
            authenticateUser($input, $conn, $secretKey);
            requireTable($conn, 'timetable', 'Timetable');
            requireColumns($conn, 'timetable', 'Timetable', ['user_id', 'day_of_week', 'start_time', 'end_time', 'subject', 'teacher', 'room']);
            $classDateOrder = columnExists($conn, 'timetable', 'class_date') ? 'class_date NULLS LAST,' : '';
            $stmt = $conn->query(
                "SELECT *
                 FROM timetable
                 ORDER BY
                    {$classDateOrder}
                    CASE day_of_week
                        WHEN 'Monday' THEN 1
                        WHEN 'Tuesday' THEN 2
                        WHEN 'Wednesday' THEN 3
                        WHEN 'Thursday' THEN 4
                        WHEN 'Friday' THEN 5
                        WHEN 'Saturday' THEN 6
                        WHEN 'Sunday' THEN 7
                        ELSE 8
                    END,
                    start_time,
                    id"
            );
            respond(true, 'Timetable loaded successfully.', ['entries' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

        case 'addTimetable':
            $admin = authenticateAdmin($input, $conn, $secretKey);
            requireTable($conn, 'timetable', 'Timetable');
            requireColumns($conn, 'timetable', 'Timetable', ['user_id', 'day_of_week', 'start_time', 'end_time', 'subject', 'teacher', 'room']);
            $dayOfWeek = trim($input['day_of_week'] ?? '');
            $startTime = trim($input['start_time'] ?? '');
            $endTime = trim($input['end_time'] ?? '');
            $subject = trim($input['subject'] ?? '');
            $teacher = trim($input['teacher'] ?? '');
            $room = trim($input['room'] ?? '');
            $classDate = trim($input['class_date'] ?? '');

            if ($classDate !== '') {
                $parsedClassDate = strtotime($classDate);
                if ($parsedClassDate === false) {
                    respond(false, 'Select a valid class date.', [], 422);
                }
                $dayOfWeek = date('l', $parsedClassDate);
            }

            if ($dayOfWeek === '' || $startTime === '' || $endTime === '' || $subject === '' || $teacher === '') {
                respond(false, 'All timetable fields except room are required.', [], 422);
            }

            if (!in_array($dayOfWeek, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], true)) {
                respond(false, 'Select a valid weekly timetable day.', [], 422);
            }

            $targetUserId = (int) ($input['user_id'] ?? $admin['id']);
            $timetableInsertValues = [
                'user_id' => $targetUserId,
                'day_of_week' => $dayOfWeek,
                'start_time' => $startTime,
                'end_time' => $endTime,
                'subject' => $subject,
                'teacher' => $teacher,
                'room' => $room,
                'class_date' => $classDate !== '' ? $classDate : null
            ];
            $insert = buildInsertFromColumns($conn, 'timetable', $timetableInsertValues);
            $stmt = $conn->prepare($insert['sql']);
            $stmt->execute($insert['params']);
            logActivity($conn, $admin['id'], 'admin_created_timetable', 'Created timetable entry for user ID ' . $targetUserId);
            respond(true, 'Timetable entry added successfully.');

        case 'updateTimetable':
            $admin = authenticateAdmin($input, $conn, $secretKey);
            requireTable($conn, 'timetable', 'Timetable');
            requireColumns($conn, 'timetable', 'Timetable', ['day_of_week', 'start_time', 'end_time', 'subject', 'teacher', 'room']);
            $entryId = (int) ($input['id'] ?? 0);
            $dayOfWeek = trim($input['day_of_week'] ?? '');
            $startTime = trim($input['start_time'] ?? '');
            $endTime = trim($input['end_time'] ?? '');
            $subject = trim($input['subject'] ?? '');
            $teacher = trim($input['teacher'] ?? '');
            $room = trim($input['room'] ?? '');
            $classDate = trim($input['class_date'] ?? '');

            if ($classDate !== '') {
                $parsedClassDate = strtotime($classDate);
                if ($parsedClassDate === false) {
                    respond(false, 'Select a valid class date.', [], 422);
                }
                $dayOfWeek = date('l', $parsedClassDate);
            }

            if ($entryId <= 0 || $dayOfWeek === '' || $startTime === '' || $endTime === '' || $subject === '' || $teacher === '') {
                respond(false, 'Complete all required timetable fields.', [], 422);
            }

            if (!in_array($dayOfWeek, ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], true)) {
                respond(false, 'Select a valid weekly timetable day.', [], 422);
            }

            $timetableUpdateValues = [
                'day_of_week' => $dayOfWeek,
                'start_time' => $startTime,
                'end_time' => $endTime,
                'subject' => $subject,
                'teacher' => $teacher,
                'room' => $room,
                'class_date' => $classDate !== '' ? $classDate : null
            ];
            if (columnExists($conn, 'timetable', 'updated_at')) {
                $timetableUpdateValues['updated_at'] = date('Y-m-d H:i:s');
            }
            $update = buildUpdateFromColumns($conn, 'timetable', $timetableUpdateValues, 'WHERE id = ?', [$entryId]);
            $stmt = $conn->prepare($update['sql']);
            $stmt->execute($update['params']);
            logActivity($conn, $admin['id'], 'admin_updated_timetable', 'Updated timetable entry ID ' . $entryId);
            respond($stmt->rowCount() > 0, $stmt->rowCount() > 0 ? 'Timetable entry updated successfully.' : 'Timetable entry not found.');

        case 'deleteTimetable':
            $admin = authenticateAdmin($input, $conn, $secretKey);
            requireTable($conn, 'timetable', 'Timetable');
            requireColumns($conn, 'timetable', 'Timetable', ['id']);
            $entryId = (int) ($input['id'] ?? 0);
            $stmt = $conn->prepare('DELETE FROM timetable WHERE id = ?');
            $stmt->execute([$entryId]);
            logActivity($conn, $admin['id'], 'admin_deleted_timetable', 'Deleted timetable entry ID ' . $entryId);
            respond($stmt->rowCount() > 0, $stmt->rowCount() > 0 ? 'Timetable entry deleted successfully.' : 'Timetable entry not found.');

        case 'getEvents':
            requireTable($conn, 'events', 'Events');
            $stmt = $conn->query(
                "SELECT
                    id,
                    title,
                    description,
                    event_date,
                    event_time,
                    location,
                    type AS category,
                    type,
                    CASE
                        WHEN LOWER(COALESCE(type, '')) IN ('important', 'imp', 'exam', 'placement') THEN TRUE
                        ELSE FALSE
                    END AS is_important,
                    CASE
                        WHEN LOWER(COALESCE(type, '')) = 'announcement' THEN event_date
                        ELSE NULL
                    END AS notice_expires_at,
                    created_at
                 FROM events
                 WHERE event_date >= CURRENT_DATE - INTERVAL '14 day'
                 ORDER BY event_date ASC, created_at DESC"
            );
            respond(true, 'Events loaded successfully.', ['events' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

        case 'addEvent':
            $user = authenticateUser($input, $conn, $secretKey);
            requireTable($conn, 'events', 'Events');
            if (!isAdmin($user)) {
                respond(false, 'Admin access required to create events.', [], 403);
            }

            $title = trim($input['title'] ?? '');
            $description = trim($input['description'] ?? '');
            $eventDate = trim($input['event_date'] ?? '');
            $eventTime = trim($input['event_time'] ?? '');
            $location = trim($input['location'] ?? '');
            $category = trim($input['category'] ?? 'General');

            if ($title === '' || $description === '' || $eventDate === '') {
                respond(false, 'Title, description, and date are required for events.', [], 422);
            }

            $stmt = $conn->prepare(
                'INSERT INTO events (title, description, event_date, event_time, location, type)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );
            $stmt->execute([$title, $description, $eventDate, $eventTime !== '' ? $eventTime : null, $location, $category]);
            respond(true, 'Event added successfully.');

        case 'getLostFound':
            requireTable($conn, 'lost_found', 'Lost and found');
            $lostFoundImageColumn = getLostFoundImageColumn($conn);
            $lostFoundTypeSelect = columnExists($conn, 'lost_found', 'report_type') ? 'lf.report_type' : "'lost'";
            $lostFoundContactSelect = columnExists($conn, 'lost_found', 'contact_info') ? 'lf.contact_info' : "''";
            $lostFoundDateSelect = columnExists($conn, 'lost_found', 'reported_date') ? 'lf.reported_date' : 'lf.created_at::date';
            $stmt = $conn->query(
                "SELECT lf.*,
                    {$lostFoundTypeSelect} AS report_type,
                    {$lostFoundContactSelect} AS contact_info,
                    {$lostFoundDateSelect} AS reported_date,
                    " . ($lostFoundImageColumn ? "lf.{$lostFoundImageColumn} AS image_path," : "NULL AS image_path,") . " u.name AS reported_by
                 FROM lost_found lf
                 JOIN users u ON u.id = lf.user_id
                 ORDER BY {$lostFoundDateSelect} DESC, lf.created_at DESC"
            );
            respond(true, 'Lost and found items loaded successfully.', ['items' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

        case 'addLostFound':
            $user = authenticateUser($input, $conn, $secretKey);
            requireTable($conn, 'lost_found', 'Lost and found');
            $lostFoundImageColumn = getLostFoundImageColumn($conn);
            $reportType = strtolower(trim($input['report_type'] ?? ''));
            $itemName = trim($input['item_name'] ?? '');
            $description = trim($input['description'] ?? '');
            $location = trim($input['location'] ?? '');
            $contactInfo = trim($input['contact_info'] ?? '');
            $reportedDate = trim($input['reported_date'] ?? '');
            $status = trim($input['status'] ?? 'open');
            $uploadedImagePath = saveUploadedFile('item_image', 'images/lost-found', ['jpg', 'jpeg', 'png', 'gif', 'webp'], 5242880);

            if (!in_array($reportType, ['lost', 'found'], true)) {
                respond(false, 'Report type must be lost or found.', [], 422);
            }

            if ($itemName === '' || $description === '' || $location === '' || $contactInfo === '' || $reportedDate === '') {
                respond(false, 'Please complete all lost and found fields.', [], 422);
            }

            if ($uploadedImagePath !== null && !$lostFoundImageColumn) {
                respond(false, 'Add an image_path column to the lost_found table to store uploaded item images.', [], 422);
            }

            $lostFoundInsertValues = [
                'user_id' => $user['id'],
                'report_type' => $reportType,
                'item_name' => $itemName,
                'description' => $description,
                'location' => $location,
                'contact_info' => $contactInfo,
                'reported_date' => $reportedDate,
                'status' => $status
            ];
            if ($lostFoundImageColumn) {
                $lostFoundInsertValues[$lostFoundImageColumn] = $uploadedImagePath;
            }
            $insert = buildInsertFromColumns($conn, 'lost_found', $lostFoundInsertValues);
            $stmt = $conn->prepare($insert['sql']);
            $stmt->execute($insert['params']);
            respond(true, 'Item reported successfully.');

        case 'updateLostFound':
            $user = authenticateUser($input, $conn, $secretKey);
            requireTable($conn, 'lost_found', 'Lost and found');
            $lostFoundImageColumn = getLostFoundImageColumn($conn);
            $itemId = (int) ($input['id'] ?? 0);
            $reportType = strtolower(trim($input['report_type'] ?? ''));
            $itemName = trim($input['item_name'] ?? '');
            $description = trim($input['description'] ?? '');
            $location = trim($input['location'] ?? '');
            $contactInfo = trim($input['contact_info'] ?? '');
            $reportedDate = trim($input['reported_date'] ?? '');
            $status = trim($input['status'] ?? 'open');
            $uploadedImagePath = saveUploadedFile('item_image', 'images/lost-found', ['jpg', 'jpeg', 'png', 'gif', 'webp'], 5242880);

            $ownerStmt = $conn->prepare('SELECT user_id FROM lost_found WHERE id = ?');
            $ownerStmt->execute([$itemId]);
            $ownerId = (int) $ownerStmt->fetchColumn();

            if ($ownerId <= 0) {
                respond(false, 'Item not found.', [], 404);
            }

            if ($ownerId !== (int) $user['id'] && !isAdmin($user)) {
                respond(false, 'You can only edit your own items.', [], 403);
            }

            $existingImagePath = null;
            if ($lostFoundImageColumn) {
                $existingImageStmt = $conn->prepare("SELECT {$lostFoundImageColumn} FROM lost_found WHERE id = ?");
                $existingImageStmt->execute([$itemId]);
                $existingImagePath = $existingImageStmt->fetchColumn() ?: null;
            }

            if ($uploadedImagePath !== null && !$lostFoundImageColumn) {
                respond(false, 'Add an image_path column to the lost_found table to store uploaded item images.', [], 422);
            }

            $lostFoundUpdateValues = [
                'report_type' => $reportType,
                'item_name' => $itemName,
                'description' => $description,
                'location' => $location,
                'contact_info' => $contactInfo,
                'reported_date' => $reportedDate,
                'status' => $status
            ];

            if ($lostFoundImageColumn && $uploadedImagePath !== null) {
                $lostFoundUpdateValues[$lostFoundImageColumn] = $uploadedImagePath;
            }

            if (columnExists($conn, 'lost_found', 'updated_at')) {
                $lostFoundUpdateValues['updated_at'] = date('Y-m-d H:i:s');
            }

            $update = buildUpdateFromColumns($conn, 'lost_found', $lostFoundUpdateValues, 'WHERE id = ?', [$itemId]);
            $stmt = $conn->prepare($update['sql']);
            $stmt->execute($update['params']);
            if ($uploadedImagePath !== null && $existingImagePath && $existingImagePath !== $uploadedImagePath) {
                deleteStoredFile($existingImagePath);
            }
            respond(true, 'Item updated successfully.');

        case 'deleteLostFound':
            $user = authenticateUser($input, $conn, $secretKey);
            requireTable($conn, 'lost_found', 'Lost and found');
            $lostFoundImageColumn = getLostFoundImageColumn($conn);
            $itemId = (int) ($input['id'] ?? 0);

            $ownerStmt = $conn->prepare('SELECT user_id FROM lost_found WHERE id = ?');
            $ownerStmt->execute([$itemId]);
            $ownerId = (int) $ownerStmt->fetchColumn();

            if ($ownerId <= 0) {
                respond(false, 'Item not found.', [], 404);
            }

            if ($ownerId !== (int) $user['id'] && !isAdmin($user)) {
                respond(false, 'You can only delete your own items.', [], 403);
            }

            $existingImagePath = null;
            if ($lostFoundImageColumn) {
                $imageStmt = $conn->prepare("SELECT {$lostFoundImageColumn} FROM lost_found WHERE id = ?");
                $imageStmt->execute([$itemId]);
                $existingImagePath = $imageStmt->fetchColumn() ?: null;
            }

            $stmt = $conn->prepare('DELETE FROM lost_found WHERE id = ?');
            $stmt->execute([$itemId]);
            if ($stmt->rowCount() > 0) {
                deleteStoredFile($existingImagePath);
            }
            respond(true, 'Item deleted successfully.');

        case 'adminGetDashboard':
            authenticateAdmin($input, $conn, $secretKey);

            $summary = [
                'students' => getTableCount($conn, 'users'),
                'notes' => getTableCount($conn, 'notes'),
                'events' => getTableCount($conn, 'events'),
                'lost_found' => getTableCount($conn, 'lost_found'),
                'login_logs' => getTableCount($conn, 'login_logs'),
                'activity_logs' => getTableCount($conn, 'activity_logs')
            ];

            $recentEvents = [];
            $recentNotes = [];
            $recentLogs = [];

            if (tableExists($conn, 'events')) {
                $stmt = $conn->query('SELECT id, title, event_date, type FROM events ORDER BY event_date DESC, created_at DESC LIMIT 5');
                $recentEvents = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }

            if (tableExists($conn, 'notes')) {
                $stmt = $conn->query(
                    'SELECT n.id, n.title, n.created_at, u.name AS owner_name
                     FROM notes n
                     LEFT JOIN users u ON u.id = n.user_id
                     ORDER BY n.created_at DESC
                     LIMIT 5'
                );
                $recentNotes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }

            if (tableExists($conn, 'activity_logs')) {
                $stmt = $conn->query(
                    'SELECT a.id, a.action, a.details, a.created_at, u.name
                     FROM activity_logs a
                     LEFT JOIN users u ON u.id = a.user_id
                     ORDER BY a.created_at DESC
                     LIMIT 8'
                );
                $recentLogs = $stmt->fetchAll(PDO::FETCH_ASSOC);
            } elseif (tableExists($conn, 'login_logs')) {
                $stmt = $conn->query(
                    'SELECT l.id, \'login\' AS action, l.ip_address AS details, l.login_time AS created_at, u.name
                     FROM login_logs l
                     LEFT JOIN users u ON u.id = l.user_id
                     ORDER BY l.login_time DESC
                     LIMIT 8'
                );
                $recentLogs = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }

            respond(true, 'Admin dashboard loaded.', [
                'summary' => $summary,
                'recent_events' => $recentEvents,
                'recent_notes' => $recentNotes,
                'recent_logs' => $recentLogs
            ]);

        case 'adminGetUsers':
            authenticateAdmin($input, $conn, $secretKey);
            requireTable($conn, 'users', 'Users');

            $stmt = $conn->query('SELECT id, name, email, course, semester, role, created_at FROM users ORDER BY created_at DESC');
            respond(true, 'Users loaded successfully.', ['users' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

        case 'adminCreateUser':
            $admin = authenticateAdmin($input, $conn, $secretKey);
            requireTable($conn, 'users', 'Users');

            $name = trim($input['name'] ?? '');
            $email = strtolower(trim($input['email'] ?? ''));
            $course = trim($input['course'] ?? '');
            $semester = trim($input['semester'] ?? '');
            $role = strtolower(trim($input['role'] ?? 'user'));
            $password = (string) ($input['password'] ?? '');

            if ($name === '' || $email === '' || $course === '' || $semester === '' || $password === '') {
                respond(false, 'Name, email, course, semester, and password are required.', [], 422);
            }

            if (!in_array($role, ['user', 'admin', 'student'], true)) {
                $role = 'user';
            }

            $check = $conn->prepare('SELECT id FROM users WHERE email = ?');
            $check->execute([$email]);
            if ($check->fetchColumn()) {
                respond(false, 'A user with this email already exists.', [], 409);
            }

            $normalizedRole = $role === 'student' ? 'user' : $role;
            $stmt = $conn->prepare('INSERT INTO users (name, email, password, course, semester, role) VALUES (?, ?, ?, ?, ?, ?)');
            $stmt->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT), $course, $semester, $normalizedRole]);
            logActivity($conn, $admin['id'], 'admin_created_user', 'Created user ' . $email);
            respond(true, 'User created successfully.');

        case 'adminUpdateUser':
            $admin = authenticateAdmin($input, $conn, $secretKey);
            requireTable($conn, 'users', 'Users');

            $userId = (int) ($input['id'] ?? 0);
            $name = trim($input['name'] ?? '');
            $email = strtolower(trim($input['email'] ?? ''));
            $course = trim($input['course'] ?? '');
            $semester = trim($input['semester'] ?? '');
            $role = strtolower(trim($input['role'] ?? 'user'));

            if ($userId <= 0 || $name === '' || $email === '' || $course === '' || $semester === '') {
                respond(false, 'Complete all required user fields.', [], 422);
            }

            $normalizedRole = $role === 'student' ? 'user' : $role;
            $check = $conn->prepare('SELECT id FROM users WHERE email = ? AND id <> ?');
            $check->execute([$email, $userId]);
            if ($check->fetchColumn()) {
                respond(false, 'A different user already uses this email.', [], 409);
            }

            if (!empty($input['password'])) {
                $stmt = $conn->prepare('UPDATE users SET name = ?, email = ?, course = ?, semester = ?, role = ?, password = ? WHERE id = ?');
                $stmt->execute([$name, $email, $course, $semester, $normalizedRole, password_hash((string) $input['password'], PASSWORD_DEFAULT), $userId]);
            } else {
                $stmt = $conn->prepare('UPDATE users SET name = ?, email = ?, course = ?, semester = ?, role = ? WHERE id = ?');
                $stmt->execute([$name, $email, $course, $semester, $normalizedRole, $userId]);
            }

            logActivity($conn, $admin['id'], 'admin_updated_user', 'Updated user ID ' . $userId);
            respond(true, 'User updated successfully.');

        case 'adminDeleteUser':
            $admin = authenticateAdmin($input, $conn, $secretKey);
            requireTable($conn, 'users', 'Users');

            $userId = (int) ($input['id'] ?? 0);
            if ($userId <= 0) {
                respond(false, 'Invalid user selected.', [], 422);
            }

            if ($userId === (int) $admin['id']) {
                respond(false, 'You cannot delete your own admin account.', [], 422);
            }

            $stmt = $conn->prepare('DELETE FROM users WHERE id = ?');
            $stmt->execute([$userId]);
            logActivity($conn, $admin['id'], 'admin_deleted_user', 'Deleted user ID ' . $userId);
            respond(true, 'User deleted successfully.');

        case 'adminGetNotes':
            authenticateAdmin($input, $conn, $secretKey);
            requireTable($conn, 'notes', 'Notes');

            $stmt = $conn->query(
                'SELECT n.id, n.user_id, n.title, n.description, n.file_path, n.downloads, n.created_at, u.name AS owner_name, u.email AS owner_email
                 FROM notes n
                 LEFT JOIN users u ON u.id = n.user_id
                 ORDER BY n.created_at DESC'
            );
            respond(true, 'Admin notes loaded successfully.', ['notes' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

        case 'adminCreateNote':
            $admin = authenticateAdmin($input, $conn, $secretKey);
            requireTable($conn, 'notes', 'Notes');

            $userId = (int) ($input['user_id'] ?? $admin['id']);
            if ($userId <= 0) {
                $userId = (int) $admin['id'];
            }
            $title = trim($input['title'] ?? '');
            $description = trim($input['description'] ?? '');
            $uploadedNotePath = saveUploadedFile('note_file', 'notes', ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'zip'], 15728640);
            $filePath = trim($input['file_path'] ?? '');
            $resolvedFilePath = $uploadedNotePath ?? ($filePath !== '' ? $filePath : null);
            $downloads = max(0, (int) ($input['downloads'] ?? 0));

            if ($title === '' || $description === '') {
                respond(false, 'Title and description are required.', [], 422);
            }

            $stmt = $conn->prepare('INSERT INTO notes (user_id, title, description, file_path, downloads) VALUES (?, ?, ?, ?, ?)');
            $stmt->execute([$userId, $title, $description, $resolvedFilePath, $downloads]);
            logActivity($conn, $admin['id'], 'admin_created_note', 'Created note ' . $title);
            respond(true, 'Note created successfully.');

        case 'adminUpdateNote':
            $admin = authenticateAdmin($input, $conn, $secretKey);
            requireTable($conn, 'notes', 'Notes');

            $noteId = (int) ($input['id'] ?? 0);
            $userId = (int) ($input['user_id'] ?? 0);
            $title = trim($input['title'] ?? '');
            $description = trim($input['description'] ?? '');
            $uploadedNotePath = saveUploadedFile('note_file', 'notes', ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'zip'], 15728640);
            $filePath = trim($input['file_path'] ?? '');
            $resolvedFilePath = $uploadedNotePath ?? ($filePath !== '' ? $filePath : null);
            $downloads = max(0, (int) ($input['downloads'] ?? 0));

            if ($noteId <= 0 || $userId <= 0 || $title === '' || $description === '') {
                respond(false, 'Complete all required note fields.', [], 422);
            }

            $existingNotePathStmt = $conn->prepare('SELECT file_path FROM notes WHERE id = ?');
            $existingNotePathStmt->execute([$noteId]);
            $existingNotePath = $existingNotePathStmt->fetchColumn();

            $stmt = $conn->prepare('UPDATE notes SET user_id = ?, title = ?, description = ?, file_path = ?, downloads = ? WHERE id = ?');
            $stmt->execute([$userId, $title, $description, $resolvedFilePath, $downloads, $noteId]);
            if ($uploadedNotePath !== null && $existingNotePath && $existingNotePath !== $uploadedNotePath) {
                deleteStoredFile($existingNotePath);
            }
            logActivity($conn, $admin['id'], 'admin_updated_note', 'Updated note ID ' . $noteId);
            respond(true, 'Note updated successfully.');

        case 'adminDeleteNote':
            $admin = authenticateAdmin($input, $conn, $secretKey);
            requireTable($conn, 'notes', 'Notes');

            $noteId = (int) ($input['id'] ?? 0);
            $existingNotePathStmt = $conn->prepare('SELECT file_path FROM notes WHERE id = ?');
            $existingNotePathStmt->execute([$noteId]);
            $existingNotePath = $existingNotePathStmt->fetchColumn();
            $stmt = $conn->prepare('DELETE FROM notes WHERE id = ?');
            $stmt->execute([$noteId]);
            if ($stmt->rowCount() > 0) {
                deleteStoredFile($existingNotePath);
            }
            logActivity($conn, $admin['id'], 'admin_deleted_note', 'Deleted note ID ' . $noteId);
            respond(true, 'Note deleted successfully.');

        case 'adminGetEvents':
            authenticateAdmin($input, $conn, $secretKey);
            requireTable($conn, 'events', 'Events');

            $stmt = $conn->query('SELECT id, title, description, event_date, event_time, location, type, created_at FROM events ORDER BY event_date DESC, created_at DESC');
            respond(true, 'Admin events loaded successfully.', ['events' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

        case 'adminUpdateEvent':
            $admin = authenticateAdmin($input, $conn, $secretKey);
            requireTable($conn, 'events', 'Events');

            $eventId = (int) ($input['id'] ?? 0);
            $title = trim($input['title'] ?? '');
            $description = trim($input['description'] ?? '');
            $eventDate = trim($input['event_date'] ?? '');
            $eventTime = trim($input['event_time'] ?? '');
            $location = trim($input['location'] ?? '');
            $type = trim($input['type'] ?? 'General');

            if ($eventId <= 0 || $title === '' || $description === '' || $eventDate === '') {
                respond(false, 'Complete all required event fields.', [], 422);
            }

            $stmt = $conn->prepare('UPDATE events SET title = ?, description = ?, event_date = ?, event_time = ?, location = ?, type = ? WHERE id = ?');
            $stmt->execute([$title, $description, $eventDate, $eventTime !== '' ? $eventTime : null, $location, $type, $eventId]);
            logActivity($conn, $admin['id'], 'admin_updated_event', 'Updated event ID ' . $eventId);
            respond(true, 'Event updated successfully.');

        case 'adminDeleteEvent':
            $admin = authenticateAdmin($input, $conn, $secretKey);
            requireTable($conn, 'events', 'Events');

            $eventId = (int) ($input['id'] ?? 0);
            $stmt = $conn->prepare('DELETE FROM events WHERE id = ?');
            $stmt->execute([$eventId]);
            logActivity($conn, $admin['id'], 'admin_deleted_event', 'Deleted event ID ' . $eventId);
            respond(true, 'Event deleted successfully.');

        case 'adminGetLostFound':
            authenticateAdmin($input, $conn, $secretKey);
            requireTable($conn, 'lost_found', 'Lost and found');
            $lostFoundImageColumn = getLostFoundImageColumn($conn);
            $lostFoundTypeSelect = columnExists($conn, 'lost_found', 'report_type') ? 'lf.report_type' : "'lost'";
            $lostFoundContactSelect = columnExists($conn, 'lost_found', 'contact_info') ? 'lf.contact_info' : "''";
            $lostFoundDateSelect = columnExists($conn, 'lost_found', 'reported_date') ? 'lf.reported_date' : 'lf.created_at::date';

            $stmt = $conn->query(
                'SELECT lf.*, ' . $lostFoundTypeSelect . ' AS report_type, ' . $lostFoundContactSelect . ' AS contact_info, ' . $lostFoundDateSelect . ' AS reported_date, ' . ($lostFoundImageColumn ? "lf.{$lostFoundImageColumn} AS image_path," : 'NULL AS image_path,') . ' u.name AS owner_name, u.email AS owner_email
                 FROM lost_found lf
                 LEFT JOIN users u ON u.id = lf.user_id
                 ORDER BY ' . $lostFoundDateSelect . ' DESC, lf.created_at DESC'
            );
            respond(true, 'Admin lost and found loaded successfully.', ['items' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);

        case 'adminCreateLostFound':
            $admin = authenticateAdmin($input, $conn, $secretKey);
            requireTable($conn, 'lost_found', 'Lost and found');
            $lostFoundImageColumn = getLostFoundImageColumn($conn);

            $userId = (int) ($input['user_id'] ?? 0);
            $reportType = strtolower(trim($input['report_type'] ?? ''));
            $itemName = trim($input['item_name'] ?? '');
            $description = trim($input['description'] ?? '');
            $location = trim($input['location'] ?? '');
            $contactInfo = trim($input['contact_info'] ?? '');
            $reportedDate = trim($input['reported_date'] ?? '');
            $status = trim($input['status'] ?? 'open');
            $uploadedImagePath = saveUploadedFile('item_image', 'images/lost-found', ['jpg', 'jpeg', 'png', 'gif', 'webp'], 5242880);

            if ($userId <= 0 || !in_array($reportType, ['lost', 'found'], true) || $itemName === '' || $description === '' || $location === '' || $contactInfo === '' || $reportedDate === '') {
                respond(false, 'Complete all required lost and found fields.', [], 422);
            }

            if ($uploadedImagePath !== null && !$lostFoundImageColumn) {
                respond(false, 'Add an image_path column to the lost_found table to store uploaded item images.', [], 422);
            }

            $adminLostFoundInsertValues = [
                'user_id' => $userId,
                'report_type' => $reportType,
                'item_name' => $itemName,
                'description' => $description,
                'location' => $location,
                'contact_info' => $contactInfo,
                'reported_date' => $reportedDate,
                'status' => $status
            ];
            if ($lostFoundImageColumn) {
                $adminLostFoundInsertValues[$lostFoundImageColumn] = $uploadedImagePath;
            }
            $insert = buildInsertFromColumns($conn, 'lost_found', $adminLostFoundInsertValues);
            $stmt = $conn->prepare($insert['sql']);
            $stmt->execute($insert['params']);
            logActivity($conn, $admin['id'], 'admin_created_lost_found', 'Created lost/found item ' . $itemName);
            respond(true, 'Lost and found item created successfully.');

        case 'adminUpdateLostFound':
            $admin = authenticateAdmin($input, $conn, $secretKey);
            requireTable($conn, 'lost_found', 'Lost and found');
            $lostFoundImageColumn = getLostFoundImageColumn($conn);

            $itemId = (int) ($input['id'] ?? 0);
            $userId = (int) ($input['user_id'] ?? 0);
            $reportType = strtolower(trim($input['report_type'] ?? ''));
            $itemName = trim($input['item_name'] ?? '');
            $description = trim($input['description'] ?? '');
            $location = trim($input['location'] ?? '');
            $contactInfo = trim($input['contact_info'] ?? '');
            $reportedDate = trim($input['reported_date'] ?? '');
            $status = trim($input['status'] ?? 'open');
            $uploadedImagePath = saveUploadedFile('item_image', 'images/lost-found', ['jpg', 'jpeg', 'png', 'gif', 'webp'], 5242880);

            if ($itemId <= 0 || $userId <= 0 || !in_array($reportType, ['lost', 'found'], true) || $itemName === '' || $description === '' || $location === '' || $contactInfo === '' || $reportedDate === '') {
                respond(false, 'Complete all required lost and found fields.', [], 422);
            }

            $existingImagePath = null;
            if ($lostFoundImageColumn) {
                $existingImageStmt = $conn->prepare("SELECT {$lostFoundImageColumn} FROM lost_found WHERE id = ?");
                $existingImageStmt->execute([$itemId]);
                $existingImagePath = $existingImageStmt->fetchColumn() ?: null;
            }

            if ($uploadedImagePath !== null && !$lostFoundImageColumn) {
                respond(false, 'Add an image_path column to the lost_found table to store uploaded item images.', [], 422);
            }

            $adminLostFoundUpdateValues = [
                'user_id' => $userId,
                'report_type' => $reportType,
                'item_name' => $itemName,
                'description' => $description,
                'location' => $location,
                'contact_info' => $contactInfo,
                'reported_date' => $reportedDate,
                'status' => $status
            ];

            if ($lostFoundImageColumn && $uploadedImagePath !== null) {
                $adminLostFoundUpdateValues[$lostFoundImageColumn] = $uploadedImagePath;
            }

            $update = buildUpdateFromColumns($conn, 'lost_found', $adminLostFoundUpdateValues, 'WHERE id = ?', [$itemId]);
            $stmt = $conn->prepare($update['sql']);
            $stmt->execute($update['params']);
            if ($uploadedImagePath !== null && $existingImagePath && $existingImagePath !== $uploadedImagePath) {
                deleteStoredFile($existingImagePath);
            }
            logActivity($conn, $admin['id'], 'admin_updated_lost_found', 'Updated lost/found item ID ' . $itemId);
            respond(true, 'Lost and found item updated successfully.');

        case 'adminDeleteLostFound':
            $admin = authenticateAdmin($input, $conn, $secretKey);
            requireTable($conn, 'lost_found', 'Lost and found');
            $lostFoundImageColumn = getLostFoundImageColumn($conn);

            $itemId = (int) ($input['id'] ?? 0);
            $existingImagePath = null;
            if ($lostFoundImageColumn) {
                $existingImageStmt = $conn->prepare("SELECT {$lostFoundImageColumn} FROM lost_found WHERE id = ?");
                $existingImageStmt->execute([$itemId]);
                $existingImagePath = $existingImageStmt->fetchColumn() ?: null;
            }
            $stmt = $conn->prepare('DELETE FROM lost_found WHERE id = ?');
            $stmt->execute([$itemId]);
            if ($stmt->rowCount() > 0) {
                deleteStoredFile($existingImagePath);
            }
            logActivity($conn, $admin['id'], 'admin_deleted_lost_found', 'Deleted lost/found item ID ' . $itemId);
            respond(true, 'Lost and found item deleted successfully.');

        case 'adminGetLogs':
            authenticateAdmin($input, $conn, $secretKey);

            $loginLogs = [];
            $activityLogs = [];

            if (tableExists($conn, 'login_logs')) {
                $stmt = $conn->query(
                    'SELECT l.id, l.user_id, l.ip_address, l.login_time, u.name, u.email
                     FROM login_logs l
                     LEFT JOIN users u ON u.id = l.user_id
                     ORDER BY l.login_time DESC
                     LIMIT 100'
                );
                $loginLogs = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }

            if (tableExists($conn, 'activity_logs')) {
                $stmt = $conn->query(
                    'SELECT a.id, a.user_id, a.action, a.details, a.created_at, u.name, u.email
                     FROM activity_logs a
                     LEFT JOIN users u ON u.id = a.user_id
                     ORDER BY a.created_at DESC
                     LIMIT 100'
                );
                $activityLogs = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }

            respond(true, 'Logs loaded successfully.', [
                'login_logs' => $loginLogs,
                'activity_logs' => $activityLogs
            ]);

        case 'adminDeleteLoginLog':
            $admin = authenticateAdmin($input, $conn, $secretKey);
            requireTable($conn, 'login_logs', 'Login logs');

            $logId = (int) ($input['id'] ?? 0);
            $stmt = $conn->prepare('DELETE FROM login_logs WHERE id = ?');
            $stmt->execute([$logId]);
            logActivity($conn, $admin['id'], 'admin_deleted_login_log', 'Deleted login log ID ' . $logId);
            respond(true, 'Login log deleted successfully.');

        case 'adminDeleteActivityLog':
            $admin = authenticateAdmin($input, $conn, $secretKey);
            requireTable($conn, 'activity_logs', 'Activity logs');

            $logId = (int) ($input['id'] ?? 0);
            $stmt = $conn->prepare('DELETE FROM activity_logs WHERE id = ?');
            $stmt->execute([$logId]);
            respond(true, 'Activity log deleted successfully.');

        default:
            respond(false, 'Invalid action requested.', [], 400);
    }
} catch (PDOException $exception) {
    respond(false, 'Request failed: ' . $exception->getMessage(), [], 500);
}
