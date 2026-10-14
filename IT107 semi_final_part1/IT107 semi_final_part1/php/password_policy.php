<?php
// Password safety checks that never reveal anything about other accounts:
// - breached passwords, via Have I Been Pwned's k-anonymity range API (only the
//   first 5 characters of the SHA-1 hash leave the server);
// - reuse of the same account's own recent passwords.
// This replaces the old "password already used by another account" check, which
// let anyone confirm that some account uses a guessed password.

const PASSWORD_HISTORY_DEPTH = 5;

// How many times the password appears in known breaches, or null when the
// service can't be reached (fail-open, so an outage never blocks signups).
function password_breach_count(string $password): ?int
{
    if ($password === '' || !function_exists('curl_init')) {
        return null;
    }
    $hash = strtoupper(sha1($password));
    $prefix = substr($hash, 0, 5);
    $suffix = substr($hash, 5);

    $curl = curl_init('https://api.pwnedpasswords.com/range/' . $prefix);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 3,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_HTTPHEADER => ['Add-Padding: true', 'User-Agent: Security2-password-check'],
    ]);
    $response = curl_exec($curl);
    $status = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    if (!is_string($response) || $status !== 200) {
        error_log('Breached-password check unavailable (HTTP ' . $status . ').');
        return null;
    }

    foreach (preg_split('/\r?\n/', $response) as $line) {
        [$lineSuffix, $count] = array_pad(explode(':', trim($line)), 2, '0');
        if ($lineSuffix === $suffix) {
            return (int)$count;
        }
    }
    return 0;
}

// A message explaining why the password can't be used, or null when it's fine.
function password_problem(string $password): ?string
{
    $count = password_breach_count($password);
    if ($count !== null && $count > 0) {
        return 'This password has appeared in ' . number_format($count) . ' data breaches. Please choose a different one.';
    }
    return null;
}

function record_password_history(int $userId, string $passwordHash): void
{
    global $conn;
    if ($userId < 1) {
        return;
    }
    $stmt = $conn->prepare('INSERT INTO password_history (user_id, password_hash) VALUES (?, ?)');
    $stmt->bind_param('is', $userId, $passwordHash);
    $stmt->execute();
}

// True when the password matches this account's current or recent passwords.
function password_recently_used(int $userId, string $password): bool
{
    global $conn;
    $current = $conn->prepare('SELECT password FROM users WHERE id = ?');
    $current->bind_param('i', $userId);
    $current->execute();
    $row = $current->get_result()->fetch_assoc();
    if ($row && password_verify($password, $row['password'])) {
        return true;
    }
    $depth = PASSWORD_HISTORY_DEPTH;
    $history = $conn->prepare("SELECT password_hash FROM password_history WHERE user_id = ? ORDER BY changed_at DESC, id DESC LIMIT $depth");
    $history->bind_param('i', $userId);
    $history->execute();
    $result = $history->get_result();
    while ($old = $result->fetch_assoc()) {
        if (password_verify($password, $old['password_hash'])) {
            return true;
        }
    }
    return false;
}

// Same as password_problem(), for final submits (signup, setup, password change,
// account creation): a refused breached password is also recorded in the audit
// log (never the password itself) so the Security monitor can count them.
// The live check while typing (password_check.php) is not logged.
function password_problem_on_submit(string $password, string $context): ?string
{
    $problem = password_problem($password);
    if ($problem !== null && function_exists('audit')) {
        audit('security.password.breached', null, ['context' => $context], null, null, false, 'Breached password refused.');
    }
    return $problem;
}
