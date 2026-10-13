<?php
// Cascading address dropdown data: ?level=regions|provinces|cities|barangays&parent=CODE
require_once 'db.php';
require_once 'address_service.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=86400');

$level = (string)($_GET['level'] ?? 'regions');
$parent = (string)($_GET['parent'] ?? '');
if ($level !== 'regions' && !preg_match('/^[0-9X]{9,12}$/', $parent)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'A valid parent code is required.']);
    exit;
}
echo json_encode(['status' => 'success', 'options' => address_options($level, $parent)]);
