<?php
// Philippine address lookups (PSGC tables from database/023 + 024).

// Children of one level, for the cascading dropdowns.
function address_options(string $level, string $parent = ''): array
{
    global $conn;
    $queries = [
        'regions' => 'SELECT code, name FROM address_regions ORDER BY code',
        'provinces' => 'SELECT code, name FROM address_provinces WHERE region_code = ? ORDER BY name',
        'cities' => 'SELECT code, name FROM address_cities WHERE province_code = ? ORDER BY name',
        'barangays' => 'SELECT code, name FROM address_barangays WHERE city_code = ? ORDER BY name',
    ];
    if (!isset($queries[$level])) {
        return [];
    }
    $stmt = $conn->prepare($queries[$level]);
    if ($level !== 'regions') {
        $stmt->bind_param('s', $parent);
    }
    $stmt->execute();
    return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
}

// Checks that the chosen codes really belong together (barangay in city in
// province in region) and returns the readable names to store, or null.
function resolve_address(string $regionCode, string $provinceCode, string $cityCode, string $barangayCode): ?array
{
    global $conn;
    $stmt = $conn->prepare('SELECT r.name AS region, p.name AS province, c.name AS city, b.name AS barangay, b.code AS barangay_code
        FROM address_barangays b
        JOIN address_cities c ON c.code = b.city_code
        JOIN address_provinces p ON p.code = c.province_code
        JOIN address_regions r ON r.code = p.region_code
        WHERE b.code = ? AND c.code = ? AND p.code = ? AND r.code = ?');
    $stmt->bind_param('ssss', $barangayCode, $cityCode, $provinceCode, $regionCode);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) {
        return null;
    }
    // "Metro Manila"/"Independent cities" are dropdown groupings, not real provinces.
    if (str_starts_with($provinceCode, 'X')) {
        $row['province'] = $row['province'] === 'Metro Manila' ? 'Metro Manila' : $row['city'];
    }
    return $row;
}
