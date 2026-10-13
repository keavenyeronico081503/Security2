<?php
// Server-side checks for the fields shared by the student registration wizard
// (register.php) and the administrator setup wizard (complete_account.php).
// The browser validates as people type; these repeat the rules because anything
// sent from a browser can be altered.
require_once __DIR__ . '/address_service.php';

// Returns [$clean, null] on success or [null, 'message'] for the first problem.
function validate_personal_and_address(array $input): array
{
    $field = fn(string $name) => trim((string)($input[$name] ?? ''));
    $namePattern = "/^[\\p{L}][\\p{L} .'\\-]{1,24}$/u";

    $clean = [
        'first_name' => $field('first_name'),
        'middle_name' => $field('middle_name'),
        'last_name' => $field('last_name'),
        'suffix' => $field('suffix'),
        'birthday' => $field('birthday'),
        'gender' => $field('gender'),
        'street' => $field('street'),
        'zip_code' => $field('zip_code'),
        'country' => 'Philippines',
    ];

    if (!preg_match($namePattern, $clean['first_name'])) return [null, 'Please enter a valid first name (letters only, 2-25 characters).'];
    if (!preg_match($namePattern, $clean['last_name'])) return [null, 'Please enter a valid last name (letters only, 2-25 characters).'];
    if ($clean['middle_name'] !== '' && !preg_match($namePattern, $clean['middle_name'])) return [null, 'Please enter a valid middle name or leave it blank.'];
    if ($clean['suffix'] !== '' && !preg_match("/^[\\p{L}][\\p{L}.]{0,9}$/u", $clean['suffix'])) return [null, 'Please enter a valid suffix (e.g. Jr., III) or leave it blank.'];

    $birthday = DateTime::createFromFormat('Y-m-d', $clean['birthday']);
    if (!$birthday || $birthday->format('Y-m-d') !== $clean['birthday'] || $birthday > new DateTime('today')) {
        return [null, 'Please enter a valid birthday (not in the future).'];
    }
    $clean['age'] = $birthday->diff(new DateTime('today'))->y;
    if ($clean['age'] < 10 || $clean['age'] > 120) return [null, 'Please check your birthday; the age must be between 10 and 120.'];

    $clean['gender'] = ucfirst(strtolower($clean['gender']));
    if (!in_array($clean['gender'], ['Male', 'Female'], true)) return [null, 'Please select a valid sex.'];

    $address = resolve_address($field('region_code'), $field('province_code'), $field('city_code'), $field('barangay_code'));
    if (!$address) return [null, 'Please choose your region, province, city/municipality and barangay from the lists.'];
    $clean += $address; // region, province, city, barangay, barangay_code (names from the official list)

    if (mb_strlen($clean['street']) < 2 || mb_strlen($clean['street']) > 100) return [null, 'Please enter your purok / street (2-100 characters).'];
    if (!preg_match('/^\d{4}$/', $clean['zip_code'])) return [null, 'Please enter a 4-digit ZIP code.'];

    return [$clean, null];
}

// The project's password rules (the strength meter in the browser mirrors them).
function password_rule_problem(string $password, string $confirm): ?string
{
    if (strlen($password) < 8 || strlen($password) > 20) return 'Password must be 8-20 characters.';
    if (preg_match('/\s/', $password)) return 'Password must not contain spaces.';
    if (!preg_match('/[A-Z]/', $password) || !preg_match('/[a-z]/', $password) || !preg_match('/\d/', $password) || !preg_match('/[^A-Za-z0-9]/', $password)) {
        return 'Password needs an uppercase letter, a lowercase letter, a number and a symbol.';
    }
    if ($password !== $confirm) return 'Passwords do not match.';
    return null;
}

// Names edited later (profile page, admin edit dialog) follow the same rules as
// signup, so nothing like "<img onerror=...>" can be saved and later rendered.
// Returns an error message or null. Pass only the fields being saved.
function validate_name_fields(array $fields): ?string
{
    $pattern = "/^[\p{L}][\p{L} .'\-]{1,24}$/u";
    $labels = ['first_name' => 'first name', 'middle_name' => 'middle name', 'last_name' => 'last name'];
    foreach ($labels as $key => $label) {
        if (!array_key_exists($key, $fields)) continue;
        $value = trim((string)$fields[$key]);
        if ($value === '' && $key === 'middle_name') continue;
        if (!preg_match($pattern, $value)) return "Please enter a valid $label (letters only, 2-25 characters).";
    }
    if (isset($fields['suffix']) && trim((string)$fields['suffix']) !== '' && !preg_match("/^[\p{L}][\p{L}.]{0,9}$/u", trim((string)$fields['suffix']))) {
        return 'Please enter a valid suffix (e.g. Jr., III) or leave it blank.';
    }
    if (isset($fields['username']) && !preg_match('/^[A-Za-z][A-Za-z0-9_]{5,24}$/', (string)$fields['username'])) {
        return 'Username must be 6-25 letters, numbers or underscores, starting with a letter.';
    }
    return null;
}
