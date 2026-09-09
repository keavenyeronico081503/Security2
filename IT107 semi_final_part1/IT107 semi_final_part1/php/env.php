<?php

function load_env(string $path): void
{
    static $loaded = false;
    if ($loaded || !is_file($path)) {
        return;
    }
    $loaded = true;
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }
        [$key, $value] = array_pad(explode('=', $line, 2), 2, '');
        $key = trim($key);
        $value = trim($value, " \t\"'");
        if ($key === '') {
            continue;
        }
        putenv("$key=$value");
        $_ENV[$key] = $value;
    }
}
