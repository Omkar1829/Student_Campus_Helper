<?php

$host = "dpg-d77lipqdbo4c73arvtv0-a.singapore-postgres.render.com";
$port = "5432";
$dbname = "unisphere_h4rb";
$user = "root";
$password = "eA4dn3XSdHcuo99MljBnLq1AOnZxpIUY";

try {
    $conn = new PDO(
        "pgsql:host=$host;port=$port;dbname=$dbname;sslmode=require",
        $user,
        $password
    );

    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

} catch (PDOException $e) {
    die(json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]));
}
?>