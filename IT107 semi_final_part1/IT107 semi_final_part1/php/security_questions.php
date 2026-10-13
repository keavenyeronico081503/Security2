<?php
// The one list of recovery questions used by student registration and admin
// setup. Included by PHP for validation; requested directly, it returns the list
// as JSON so both wizards show exactly the same choices.

const SECURITY_QUESTIONS = [
    'petName' => 'What was the name of your first pet?',
    'favoriteColor' => 'What is your favorite color?',
    'favoriteFood' => 'What is your favorite food?',
    'birthCity' => 'In what city were you born?',
    'firstSchool' => 'What was the name of your first school?',
    'childhoodNickname' => 'What was your childhood nickname?',
    'favoriteTeacher' => 'What was the name of your favorite teacher?',
    'dreamJob' => 'What was your dream job as a child?',
    'memorablePlace' => 'What is a memorable place you have visited?',
];

// Three different questions from the list, each with a non-empty answer.
function valid_security_answers(array $questions, array $answers): bool
{
    return count($questions) === 3
        && count(array_unique($questions)) === 3
        && !array_diff($questions, array_keys(SECURITY_QUESTIONS))
        && !in_array('', array_map('trim', $answers), true);
}

if (realpath(__FILE__) === realpath($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: public, max-age=3600');
    $list = [];
    foreach (SECURITY_QUESTIONS as $value => $label) {
        $list[] = ['value' => $value, 'label' => $label];
    }
    echo json_encode(['status' => 'success', 'questions' => $list]);
}
