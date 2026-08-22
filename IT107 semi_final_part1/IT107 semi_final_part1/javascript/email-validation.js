// Helper function to show error messages
function showError(field, message) {
    const errorElement = document.getElementById('email-error');
    if (errorElement) {
        errorElement.textContent = message;
        field.classList.add('input-error');
        field.classList.remove('input-success');
    }
}

// Helper function to show success
function showSuccess(field) {
    const errorElement = document.getElementById('email-error');
    if (errorElement) {
        errorElement.textContent = '';
        field.classList.remove('input-error');
        field.classList.add('input-success');
    }
}

// Helper function for trailing space validation
function shouldRunTrailingSpaceValidation(eventType) {
    return eventType === 'blur';
}

function validateEmail(rawValue, field, eventType = 'input') {
    if (!rawValue) {
        showError(field, 'Email is required');
        return;
    }

    const value = rawValue.trim();
    const allowTrailingCheck = shouldRunTrailingSpaceValidation(eventType);

    // Earliest-index prioritization: find the first error position in the string
    let earliestIdx = Infinity;
    let earliestMsg = '';

    // Helper function to consider an error at a specific index
    const consider = (idx, msg) => {
        if (idx !== -1 && idx < earliestIdx) {
            earliestIdx = idx;
            earliestMsg = msg;
        }
    };

    // Check for two or more capital letters in the input
    const capitalCount = (rawValue.match(/[A-Z]/g) || []).length;
    if (capitalCount >= 2) {
        consider(0, 'All capital letters are not allowed');
    }
    
    // Leading character checks (all at index 0)
    if (/^\s/.test(rawValue)) {
        consider(0, 'Spaces are not allowed at the beginning.');
    }
    if (/^[0-9]/.test(rawValue)) {
        consider(0, 'Email must not start with a number');
    }
    if (/^[^a-zA-Z0-9]/.test(rawValue) && !rawValue.startsWith('@')) {
        consider(0, 'Email must not start with a special character');
    }
    if (rawValue.startsWith('@')) {
        consider(0, 'Email cannot start with "@"');
    }

    // Scan through the string for other errors
    // Check for any spaces in the email
    const spaceMatch = rawValue.match(/\s/);
    if (spaceMatch) {
        consider(spaceMatch.index, 'Email cannot contain spaces');
    }

    // Second @ symbol
    const atIndex = rawValue.indexOf('@');
    const secondAtPos = atIndex !== -1 ? rawValue.indexOf('@', atIndex + 1) : -1;
    consider(secondAtPos, 'Email cannot contain more than one "@" symbol');

    // Check for consecutive periods (..)
    const consecutivePeriodsMatch = rawValue.match(/\.{2,}/);
    if (consecutivePeriodsMatch) {
        consider(consecutivePeriodsMatch.index, 'Email cannot contain consecutive periods (..)');
    }
    
    // Check for other consecutive special characters (except periods and spaces)
    const consecSpecialMatch = rawValue.match(/[^A-Za-z0-9\s.]{2,}/);
    if (consecSpecialMatch) {
        consider(consecSpecialMatch.index, 'Email cannot contain consecutive special characters');
    }

    // If @ exists, check local and domain parts
    if (atIndex !== -1 && earliestIdx === Infinity) {
        const emailLocalPart = rawValue.substring(0, atIndex);
        const domainPart = rawValue.substring(atIndex + 1);

        // Invalid characters in local part (only dot allowed)
        for (let i = 0; i < emailLocalPart.length; i++) {
            const ch = emailLocalPart[i];
            if (!/[A-Za-z0-9.]/.test(ch)) {
                consider(i, 'Dot "." is the only allowed special character in the local part');
                break;
            }
        }

        // Invalid characters in domain part (only dot allowed)
        const domainStart = atIndex + 1;
        for (let i = 0; i < domainPart.length; i++) {
            const ch = domainPart[i];
            if (!/[A-Za-z0-9.]/.test(ch)) {
                consider(domainStart + i, 'Dot "." is the only allowed special character in the domain part');
                break;
            }
        }

        // Local part validation
        if (!emailLocalPart) {
            consider(atIndex, 'Email must have text before "@"');
        } else {
            if (emailLocalPart.length < 6) {
                consider(0, 'At least 6 characters before the @');
            }
            if (/^[0-9]/.test(emailLocalPart)) {
                consider(0, 'Email must not start with a number');
            }
            if (/^[^a-zA-Z0-9]/.test(emailLocalPart)) {
                consider(0, 'Email must not start with a special character');
            }
            // Local part must not end with special character
            if (emailLocalPart.length > 0 && !/[A-Za-z0-9]$/.test(emailLocalPart)) {
                consider(emailLocalPart.length - 1, 'Local part must not end with a special character');
            }
        }

        // Domain part validation
        if (!domainPart) {
            consider(atIndex + 1, 'Email must have text after "@"');
        } else {
            if (domainPart.startsWith('.')) {
                consider(atIndex + 1, 'Domain part cannot start with a period (.)');
            }
            if (!domainPart.includes('.')) {
                consider(atIndex + 1, 'Email must contain a period (.)');
            }
            // Check for period after .com
            // New rule: if domain contains ".com." followed by a letter (e.g. "gmail.com.sad"),
            // show the specific message requested by the user.
            const lowerDomain = domainPart.toLowerCase();
            const comDotIndex = lowerDomain.indexOf('.com.');
            if (comDotIndex !== -1) {
                const nextChar = domainPart[comDotIndex + 5]; // char after '.com.'
                if (nextChar && /[A-Za-z]/.test(nextChar)) {
                    // position of that letter in the whole rawValue
                    const msgIdx = atIndex + 1 + comDotIndex + 5;
                    consider(msgIdx, "Please don’t add letters after the dot in '.com'.");
                } else {
                    // Generic dot-after-.com message (keeps previous behavior)
                    consider(rawValue.length - 1, 'A dot (.) is not allowed after .com');
                }
            } else if (domainPart.toLowerCase().endsWith('.com.') || domainPart.toLowerCase().endsWith('.com..')) {
                consider(rawValue.length - 1, 'A dot (.) is not allowed after .com');
            } else if (domainPart.endsWith('.')) {
                consider(rawValue.length - 1, 'Email cannot end with a period (.)');
            }
            // Domain labels must be non-empty
            const labels = domainPart.split('.');
            let labelOffset = atIndex + 1;
            for (let i = 0; i < labels.length; i++) {
                if (!labels[i]) {
                    consider(labelOffset, 'Email domain should not be empty');
                    break;
                }
                labelOffset += labels[i].length + 1;
            }
        }
    } else if (atIndex === -1 && earliestIdx === Infinity) {
        // No @ symbol found
        // Check if it's a valid local-part candidate (at least 6 chars)
        if (value.length > 0 && /^[A-Za-z0-9.]+$/.test(value) && value.length < 6) {
            consider(0, 'At least 6 characters before the @');
        } else {
            consider(0, 'Invalid email format use(@gmail.com)');
        }
    }

    // Ending character checks (at end of string)
    if (earliestIdx === Infinity && value.length > 0) {
        const lastChar = value[value.length - 1];
        if (/\d/.test(lastChar)) {
            consider(rawValue.length - 1, 'Email must not end with a number');
        } else if (!/[A-Za-z]/.test(lastChar)) {
            consider(rawValue.length - 1, 'Email must not end with a special character');
        }
    }

    // Trailing space check (second-to-last - only if no earlier errors found)
    if (allowTrailingCheck && earliestIdx === Infinity && rawValue.endsWith(' ') && !rawValue.endsWith('  ')) {
        const trailingIdx = rawValue.length - 1;
        consider(trailingIdx, 'Spaces are not allowed at the end.');
    }

    // Double spaces at the end (very last check - only if no earlier errors found)
    if (earliestIdx === Infinity && rawValue.endsWith('  ')) {
        const doubleSpaceEndIdx = rawValue.lastIndexOf('  ');
        consider(doubleSpaceEndIdx, 'Email cannot contain spaces');
    }

    // Show the earliest error if found
    if (earliestIdx !== Infinity) {
        showError(field, earliestMsg);
        return;
    }

    // Final validation checks (only if no earlier errors found)
    const atIdx = value.indexOf('@');
    if (atIdx !== -1) {
        const emailLocalPart = value.substring(0, atIdx);
        const domainPart = value.substring(atIdx + 1);

        // Basic pattern validation
        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!pattern.test(value)) {
            showError(field, 'Please enter a valid email address');
            return;
        }

        // Domain capitalization check
        if (domainPart !== domainPart.toLowerCase()) {
            showError(field, 'Domain should not be capitalized');
            return;
        }

        // All format validations passed - check database in real-time
        checkEmailExists(value, field);
        return;
    }

    // All validations passed
    showSuccess(field);
}

// Function to check if email already exists in database using check_user.php (real-time)
function checkEmailExists(email, field) {
    fetch('../php/check_user.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `email=${encodeURIComponent(email)}`
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'email_exists') {
            showError(field, 'Email already exists!');
            field.classList.add('input-error');
            field.classList.remove('input-success');
        } else if (data.status === 'available') {
            showSuccess(field);
            field.classList.remove('input-error');
            field.classList.add('input-success');
        }
    })
    .catch(error => {
        console.error('Error checking email:', error);
        showSuccess(field); // Allow if there's an error
    });
}

