document.addEventListener("DOMContentLoaded", () => {
    const usernameInput = document.getElementById("Username"); 
    const passwordInput = document.getElementById("Password"); 
    const confirmPasswordInput = document.getElementById("RePassword");
    const emailInput = document.getElementById("email");

    const userMsg = document.getElementById("usernameError");
    const hintMsg = document.getElementById("UsernameHint");
    const passMsg = document.getElementById("passwordError");
    const confirmPassMsg = document.getElementById("confirmPasswordError");
    const passStrengthMsg = document.getElementById("passwordStrength");
    const emailMsg = document.getElementById("emailError");

    const form = document.getElementById("registerForm");
    if (form) {
        form.noValidate = true;
    }

    let userExists = false;
    let emailExists = false;
    let passwordExists = false;
    let passwordMatch = true;
    let emailSpaceCount = 0;

    // Restricted words list - offensive, misleading, and system-related terms
    const restrictedWords = [
        // Admin and staff-related terms
        'admin', 'administrator', 'staff', 'moderator', 'mod', 'official', 'official_page',
        'support', 'support_team', 'support_staff', 'helpdesk', 'help_desk',
        // System-related terms
        'root', 'system', 'kernel', 'sudo', 'superuser', 'system_admin',
        // Common offensive/inappropriate terms (sample list - can be expanded)
        'badword', 'offensive', 'inappropriate', 'vulgar',
        // Impersonation attempts
        'owner', 'founder', 'ceo', 'president', 'director', 'manager',
        'staff_member', 'team_member', 'official_account', 'verified_account'
    ];

    function checkPasswordStrength(password) {
        const hasLower = /[a-z]/.test(password);
        const hasUpper = /[A-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
        const length = password.length;

        // Weak: Less than 8 characters OR only one type of character
        if (length < 8 || [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length <= 1) {
            return { strength: "weak", color: "#dc3545", message: "Weak" }; // Bright, high-contrast red
        }

        // Medium: At least 8 characters with combination of letters and numbers, limited special chars
        if (length >= 8 && length < 12 && (hasLower || hasUpper) && hasNumber && !hasSpecial) {
            return { strength: "medium", color: "#fd7e14", message: "Medium" }; // Bright, high-contrast orange
        }

        // Strong: 8-12+ characters with uppercase, lowercase, numbers, and special characters
        if (length >= 8 && hasLower && hasUpper && hasNumber && hasSpecial) {
            return { strength: "strong", color: "#28a745", message: "Strong" }; // Bright, high-contrast green
        }

        // Default to Medium for other combinations that meet basic requirements
        if (length >= 8 && [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length >= 2) {
            return { strength: "medium", color: "#fd7e14", message: "Medium" }; // Bright, high-contrast orange
        }

        return { strength: "weak", color: "#dc3545", message: "Weak" }; // Bright, high-contrast red
    }

    // ✅ Helper function to find first error in Username (left to right)
    function findFirstErrorUsername(raw, value, min, max, restrictedWords) {
        const errors = [];
        
        // Check if empty
        if (raw === "" || value === "") {
            errors.push({ position: 0, message: "Username is required." });
        }
        
        // Check for leading space (position 0)
        if (raw.length > 0 && raw[0] === ' ') {
            errors.push({ position: 0, message: "Spaces are not allowed at the beginning." });
        }
        
        // Check for double spaces (find first position)
        const multipleSpacesMatch = raw.match(/\s{2,}/);
        if (multipleSpacesMatch) {
            errors.push({ position: raw.indexOf(multipleSpacesMatch[0]), message: "Double spaces are not allowed." });
        }
        
        // Check for trailing space
        if (raw.endsWith(' ') && raw.trim().length > 0) {
            errors.push({ position: raw.length - 1, message: "Spaces are not allowed." });
        }
        
        // Check for any spaces (find first position)
        for (let i = 0; i < raw.length; i++) {
            if (/\s/.test(raw[i])) {
                errors.push({ position: i, message: "Remove the space." });
                break;
            }
        }
        
        // Check for numbers - must have at least 6 letters before numbers are allowed
        // Check if number is at the beginning (position 0) - not allowed
        if (value.length > 0 && /\d/.test(value[0])) {
            errors.push({ position: 0, message: "A number cannot be placed at the beginning." });
        }
        
        // Check if number appears before 6 letters are entered
        for (let i = 0; i < value.length; i++) {
            if (/\d/.test(value[i])) {
                // Count letters before this number
                const lettersBeforeNumber = (value.substring(0, i).match(/[a-zA-Z]/g) || []).length;
                if (lettersBeforeNumber < 6) {
                    errors.push({ position: i, message: "You must enter at least six letters before adding any numbers." });
                    break;
                }
            }
        }
        
        // Check for special characters (find first position)
        // Reject any non-letter, non-number character (underscores, dots, hyphens, and all special characters)
        for (let i = 0; i < value.length; i++) {
            if (!/[a-zA-Z0-9]/.test(value[i])) {
                errors.push({ position: i, message: "Special characters are not allowed." });
                break;
            }
        }
        
        // Check if doesn't start with uppercase letter (position 0)
        if (value.length > 0) {
            if (/^[a-z]/.test(value)) {
                // Starts with lowercase letter
                errors.push({ position: 0, message: "Must start with a capital letter." });
            } else if (!/^[A-Z]/.test(value) && !/\d/.test(value[0])) {
                // Doesn't start with a letter or number (but number at start is already checked above)
                errors.push({ position: 0, message: "Must start with a letter." });
            }
        }
        
        // Check for uppercase letters after first character (mixed case detection)
        // Show "All capital letters are not allowed." only when there are 2 or more letters
        const lettersArr = (value.match(/[a-zA-Z]/g) || []);
        if (lettersArr.length >= 2) {
            const lettersJoined = lettersArr.join('');
            if (lettersJoined === lettersJoined.toUpperCase()) {
                errors.push({ position: 0, message: "All capital letters are not allowed." });
            } else {
                // Provide a character-specific message like "'C' should be lowercase." to match first-name behavior
                if (value.length > 1) {
                    for (let i = 1; i < value.length; i++) {
                        if (/[A-Z]/.test(value[i])) {
                            const ch = value[i];
                            errors.push({ position: i, message: `'${ch}' should be lowercase.` });
                            break;
                        }
                    }
                }
            }
        } else {
            // If there's fewer than 2 letters, still flag any uppercase letter after the first character
            if (value.length > 1) {
                for (let i = 1; i < value.length; i++) {
                    if (/[A-Z]/.test(value[i])) {
                        const ch = value[i];
                        errors.push({ position: i, message: `'${ch}' should be lowercase.` });
                        break;
                    }
                }
            }
        }
        
        // Check for restricted words (affects whole string)
        if (restrictedWords.some(word => value.toLowerCase() === word)) {
            errors.push({ position: 0, message: "This username is not allowed. Please choose a different username." });
        }
        
        // Check for consecutive letters (find first position)
        const consecutiveMatch = value.match(/(.)\1{2,}/i);
        if (consecutiveMatch) {
            errors.push({ position: value.indexOf(consecutiveMatch[0]), message: "Three (3) consecutive letters are not allowed." });
        }
        
        // Check if username ends with a number (required format: Sachin123)
        if (value.length > 0 && !/\d$/.test(value)) {
            // Check if there are at least 6 letters (to ensure format is valid before checking for number at end)
            const letterCount = (value.match(/[a-zA-Z]/g) || []).length;
            if (letterCount >= 6) {
                errors.push({ position: value.length, message: "Please follow the format (e.g.Sachin123)" });
            }
        }
        
        // Check minimum length
        if (value.length > 0 && value.length < min) {
            errors.push({ position: value.length, message: `Username must be at least ${min} characters long.` });
        }
        
        // Check maximum length
        if (value.length >= max) {
            errors.push({ position: max, message: `Maximum ${max} characters reached.` });
        }
        
        // Return the error with the smallest position (leftmost error)
        if (errors.length > 0) {
            errors.sort((a, b) => a.position - b.position);
            return errors[0].message;
        }
        
        return null;
    }
    
    // ✅ Email validation functions moved to email-validation.js (separate file)

    function validatePasswordStrength() {
        const password = passwordInput.value.trim();
        
        if (password === "") {
            if (passStrengthMsg) {
                passStrengthMsg.textContent = "";
                passStrengthMsg.style.color = "";
            }
            return;
        }

        const strengthResult = checkPasswordStrength(password);
        
        if (passStrengthMsg) {
            passStrengthMsg.textContent = strengthResult.message;
            passStrengthMsg.style.color = strengthResult.color;
        }
    }

    function validateConfirmPassword() {
        const password = passwordInput.value.trim();
        const confirmPasswordRaw = confirmPasswordInput.value; // don't trim yet to catch spaces
        
        // ✅ Only show "required" error if field was touched (has been focused or has value before)
        const wasTouched = confirmPasswordInput.classList.contains('touched') || confirmPasswordInput.dataset.wasTouched === 'true';
        
        // ✅ Show error when confirm password is empty ONLY if field was touched
        if ((confirmPasswordRaw === "" || confirmPasswordRaw.trim() === "") && wasTouched) {
            if (confirmPassMsg) {
                confirmPassMsg.style.color = "red";
                confirmPassMsg.textContent = "Confirm password is required.";
            }
            confirmPasswordInput.style.borderColor = "red";
            confirmPasswordInput.classList.add("input-error");
            confirmPasswordInput.classList.remove("input-success");
            passwordMatch = false;
            return;
        }
        
        // ✅ If empty and not touched, clear any errors and return
        if (confirmPasswordRaw === "" || confirmPasswordRaw.trim() === "") {
            if (confirmPassMsg) {
                confirmPassMsg.textContent = "";
            }
            confirmPasswordInput.style.borderColor = "";
            confirmPasswordInput.classList.remove("input-error");
            confirmPasswordInput.classList.remove("input-success");
            passwordMatch = true; // Don't block form if field hasn't been touched
            return;
        }

        // Check for leading space FIRST
        if (confirmPasswordRaw.length > 0 && confirmPasswordRaw[0] === ' ') {
            if (confirmPassMsg) {
                confirmPassMsg.style.color = "red";
                confirmPassMsg.textContent = "Spaces are not allowed at the beginning.";
            }
            confirmPasswordInput.style.borderColor = "red";
            confirmPasswordInput.classList.add("input-error");
            confirmPasswordInput.classList.remove("input-success");
            passwordMatch = false;
            return;
        }

        // Disallow any spaces in confirm password
        if (/\s/.test(confirmPasswordRaw)) {
            if (confirmPassMsg) {
                confirmPassMsg.style.color = "red";
                confirmPassMsg.textContent = "Spaces are not allowed in password.";
            }
            confirmPasswordInput.style.borderColor = "red";
            confirmPasswordInput.classList.add("input-error");
            confirmPasswordInput.classList.remove("input-success");
            passwordMatch = false;
            return;
        }

        const confirmPassword = confirmPasswordRaw.trim();

        if (password === confirmPassword) {
            if (confirmPassMsg) {
                confirmPassMsg.style.color = "green";
                confirmPassMsg.textContent = "Passwords match!";
            }
            confirmPasswordInput.style.borderColor = "green";
            confirmPasswordInput.classList.remove("input-error");
            confirmPasswordInput.classList.add("input-success");
            passwordMatch = true;
        } else {
            if (confirmPassMsg) {
                confirmPassMsg.style.color = "red";
                confirmPassMsg.textContent = "Passwords do not match!";
            }
            confirmPasswordInput.style.borderColor = "red";
            confirmPasswordInput.classList.add("input-error");
            confirmPasswordInput.classList.remove("input-success");
            passwordMatch = false;
        }
    }

    function validateAndCheckPassword() {
        const passwordRaw = passwordInput.value; // don't trim to catch spaces immediately
        const min = 8;
        
        // ✅ PRIORITY 1: Check for leading space FIRST - show error message immediately
        if (passwordRaw.length > 0 && passwordRaw[0] === ' ') {
            if (passMsg) {
                passMsg.style.color = "red";
                passMsg.textContent = "Spaces are not allowed in the password.";
            }
            passwordInput.style.borderColor = "red";
            passwordInput.classList.add("input-error");
            passwordInput.classList.remove("input-success");
            // Clear strength indicator
            if (passStrengthMsg) {
                passStrengthMsg.textContent = "";
                passStrengthMsg.style.color = "";
            }
            passwordExists = true;
            return; // Stop here - don't proceed with other validations
        }
        
        // ✅ PRIORITY 2: Show error IMMEDIATELY when password is empty - MUST clear strength indicator
        if (passwordRaw === "" || passwordRaw.trim() === "") {
            // Set error message immediately
            if (passMsg) {
                passMsg.style.color = "red";
                passMsg.textContent = "Password is required.";
            }
            passwordInput.style.borderColor = "red";
            passwordInput.classList.add("input-error");
            passwordInput.classList.remove("input-success");
            // Force clear strength indicator IMMEDIATELY from all sources
            if (passStrengthMsg) {
                passStrengthMsg.textContent = "";
                passStrengthMsg.style.color = "";
                passStrengthMsg.style.display = "";
            }
            // Also clear via register.js strength element if it exists
            const registerStrength = document.getElementById("passwordStrength");
            if (registerStrength) {
                registerStrength.textContent = "";
                registerStrength.style.color = "";
                registerStrength.style.display = "";
            }
            // Reset passwordExists flag
            passwordExists = false;
            return; // STOP IMMEDIATELY - don't proceed with any other checks
        }

        // Disallow any spaces immediately
        if (/\s/.test(passwordRaw)) {
            passMsg.style.color = "red";
            passMsg.textContent = "Spaces are not allowed in password.";
            passwordInput.style.borderColor = "red";
            passwordInput.classList.add("input-error");
            passwordInput.classList.remove("input-success");
            return;
        }

        // Check minimum length requirement
        if (passwordRaw.length < min) {
            passMsg.style.color = "red";
            passMsg.textContent = `Password must be at least ${min} characters.`;
            passwordInput.style.borderColor = "red";
            passwordInput.classList.add("input-error");
            passwordInput.classList.remove("input-success");
            if (passStrengthMsg) {
                passStrengthMsg.textContent = "";
                passStrengthMsg.style.color = "";
            }
            return;
        }

        // Check maximum length requirement (20 characters)
        const max = 20;
        if (passwordRaw.length === max) {
            // Show clear, visible message when exactly 20 characters
            if (passMsg) {
                passMsg.style.color = "#dc3545"; // Bright, high-contrast red
                passMsg.textContent = "Maximum 20 characters reached.";
                passMsg.style.fontWeight = "700";
                passMsg.style.opacity = "1";
            }
            passwordInput.style.borderColor = "#dc3545";
            passwordInput.classList.add("input-error");
            passwordInput.classList.remove("input-success");
            // Clear strength indicator when at max
            if (passStrengthMsg) {
                passStrengthMsg.textContent = "";
                passStrengthMsg.style.color = "";
            }
            return;
        } else if (passwordRaw.length > max) {
            // Truncate if somehow exceeds max (shouldn't happen with maxlength attribute, but safety check)
            passwordInput.value = passwordRaw.substring(0, max);
            // Show clear, visible error message
            if (passMsg) {
                passMsg.style.color = "#dc3545"; // Bright, high-contrast red
                passMsg.textContent = "Maximum 20 characters reached.";
                passMsg.style.fontWeight = "700";
                passMsg.style.opacity = "1";
            }
            passwordInput.style.borderColor = "#dc3545";
            passwordInput.classList.add("input-error");
            passwordInput.classList.remove("input-success");
            // Clear strength indicator
            if (passStrengthMsg) {
                passStrengthMsg.textContent = "";
                passStrengthMsg.style.color = "";
            }
            return;
        }

        const password = passwordRaw.trim();

        fetch("../php/check_user.php", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `password=${encodeURIComponent(password)}`
        })
        .then(res => res.json())
        .then(data => {
            // ✅ IMPORTANT: Check if password is still not empty before processing response
            const currentPassword = passwordInput.value.trim();
            if (currentPassword === "" || currentPassword.length === 0) {
                // Password was cleared while waiting for response - show error instead
                if (passMsg) {
                    passMsg.style.color = "red";
                    passMsg.textContent = "Password is required.";
                }
                passwordInput.style.borderColor = "red";
                passwordInput.classList.add("input-error");
                passwordInput.classList.remove("input-success");
                if (passStrengthMsg) {
                    passStrengthMsg.textContent = "";
                    passStrengthMsg.style.color = "";
                }
                return; // Don't process the response
            }
            
            if (data.status === "password_exists") {
                passMsg.style.color = "red";
                passMsg.textContent = data.message;
                passwordInput.style.borderColor = "red";
                passwordInput.classList.add("input-error");
                passwordInput.classList.remove("input-success");
                passwordExists = true;
                if (passStrengthMsg) {
                    passStrengthMsg.textContent = "";
                    passStrengthMsg.style.color = "";
                }
            } else if (data.status === "available") {
                // Double-check password is still valid before showing strength
                const max = 20;
                // If password is exactly 20 characters, show max message instead of strength
                if (currentPassword.length === max) {
                    if (passMsg) {
                        passMsg.style.color = "#dc3545"; // Bright, high-contrast red
                        passMsg.textContent = "Maximum 20 characters reached.";
                        passMsg.style.fontWeight = "700";
                        passMsg.style.opacity = "1";
                    }
                    passwordInput.style.borderColor = "#dc3545";
                    passwordInput.classList.add("input-error");
                    passwordInput.classList.remove("input-success");
                    if (passStrengthMsg) {
                        passStrengthMsg.textContent = "";
                        passStrengthMsg.style.color = "";
                    }
                } else if (currentPassword.length >= min && currentPassword.length < max) {
                    // Password is valid (between min and max) - show strength indicator
                    passwordExists = false;
                    const strengthResult = checkPasswordStrength(currentPassword);
                    passMsg.textContent = "";
                    // Set border color based on strength - green for strong, orange for medium, red for weak
                    passwordInput.style.borderColor = strengthResult.color;
                    passwordInput.classList.remove("input-error");
                    // Only add success class if password is strong (green)
                    if (strengthResult.strength === "strong") {
                    passwordInput.classList.add("input-success");
                    } else {
                        passwordInput.classList.remove("input-success");
                    }
                    if (passStrengthMsg) {
                        passStrengthMsg.textContent = strengthResult.message;
                        passStrengthMsg.style.color = strengthResult.color;
                    }
                } else {
                    // Password became too short - show error
                    if (passMsg) {
                        passMsg.style.color = "red";
                        passMsg.textContent = `Password must be at least ${min} characters.`;
                    }
                    passwordInput.style.borderColor = "red";
                    passwordInput.classList.add("input-error");
                    passwordInput.classList.remove("input-success");
                    if (passStrengthMsg) {
                        passStrengthMsg.textContent = "";
                        passStrengthMsg.style.color = "";
                    }
                }
            }
        })
        .catch(err => {
            passMsg.style.color = "red";
            passMsg.textContent = "Error checking password.";
            passwordInput.style.borderColor = "red";
            console.error(err);
        });
    }

    // ✅ Enhanced Username Validation (allows numbers, blocks special chars)
    function validateAndCheckUsername() {
        const rawUsername = usernameInput.value;
        const username = rawUsername.trim();
        const min = parseInt(usernameInput.getAttribute("minlength")) || 6;
        const max = parseInt(usernameInput.getAttribute("maxlength")) || 25;
        const specialOnlyPattern = /[^a-zA-Z0-9\s._-]/; // Only allow letters, numbers, spaces, dots, underscores, hyphens
        const multipleSpacesPattern = /\s{2,}/;
        const consecutiveLettersInsensitive = /(.)\1{2,}/i;

        // Clear DB message first
        if (userMsg) userMsg.textContent = "";

        // ✅ Check if leading space first (before other validations)
        if (rawUsername.length > 0 && rawUsername[0] === ' ') {
            // Don't override the leading space error message set by input listener
            return;
        }

        // ✅ Find first error from left to right
        const firstError = findFirstErrorUsername(rawUsername, username, min, max, restrictedWords);
        
        if (firstError) {
            hintMsg.textContent = firstError;
            usernameInput.classList.add("input-error");
            usernameInput.classList.remove("input-success");
            userExists = true;
            return;
        }

        if (username === "") {
            hintMsg.textContent = "";
            usernameInput.classList.remove("input-error", "input-success");
            usernameInput.style.borderColor = "";
            userExists = false;
            return;
        }

        // Handle max length truncation
        if (username.length >= max) {
            usernameInput.value = username.substring(0, max);
            hintMsg.textContent = `Maximum ${max} characters reached.`;
            usernameInput.classList.add("input-error");
            usernameInput.classList.remove("input-success");
            userExists = true;
            return;
        }
        
        // Passed all local validations
        hintMsg.textContent = "";
        usernameInput.classList.remove("input-error");
        usernameInput.classList.add("input-success");

        // Database check (only if local validation passed)
        fetch("../php/check_user.php", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `username=${encodeURIComponent(username)}`
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === "username_exists") {
                userMsg.style.color = "red";
                userMsg.textContent = data.message;
                usernameInput.style.borderColor = "red";
                usernameInput.classList.add("input-error");
                usernameInput.classList.remove("input-success");
                userExists = true;
            } 
            else if (data.status === "available") {
                if (usernameInput.classList.contains('input-error') || (hintMsg && hintMsg.textContent)) {
                    return;
                }
                userMsg.style.color = "green";
                userMsg.textContent = "Username is available.";
                usernameInput.style.borderColor = "green";
                usernameInput.classList.remove("input-error");
                usernameInput.classList.add("input-success");
                userExists = false;
            }
        })
        .catch(err => {
            userMsg.style.color = "red";
            userMsg.textContent = "Error checking username.";
            usernameInput.style.borderColor = "red";
            usernameInput.classList.add("input-error");
            usernameInput.classList.remove("input-success");
            userExists = true;
            console.error(err);
        });
    }

    // ✅ Email validation is now in email-validation.js (separate file to prevent conflicts)
    
    // ✅ Username: Prevent leading space - show error immediately at the bottom
    usernameInput.addEventListener('input', function() {
        if (this.value.length > 0 && this.value[0] === ' ') {
            hintMsg.textContent = 'Spaces are not allowed at the beginning.';
            usernameInput.classList.add('input-error');
            usernameInput.classList.remove('input-success');
        } else {
            // Clear this specific error when space is removed
            if (hintMsg.textContent === 'Spaces are not allowed at the beginning.') {
                hintMsg.textContent = '';
                usernameInput.classList.remove('input-error');
            }
        }
        // Also run full validation
        validateAndCheckUsername();
    });
    passwordInput.addEventListener("input", validateAndCheckPassword);
    passwordInput.addEventListener("blur", validateAndCheckPassword); // ✅ Show error when field is cleared and loses focus
    // ✅ Removed passwordInput.addEventListener("input", validateConfirmPassword) - don't validate confirm password when typing in password field
    // Mark confirm password field as touched when user interacts with it
    confirmPasswordInput.addEventListener("focus", function() {
        this.classList.add('touched');
        this.dataset.wasTouched = 'true';
    });
    confirmPasswordInput.addEventListener("input", function() {
        this.classList.add('touched');
        this.dataset.wasTouched = 'true';
        validateConfirmPassword();
    });
    confirmPasswordInput.addEventListener("blur", validateConfirmPassword); // ✅ Show error when confirm password is cleared and loses focus

    // Password visibility toggle
    const toggleRegPassword = document.getElementById('toggleRegPassword');
    if (toggleRegPassword) {
        toggleRegPassword.addEventListener('click', function() {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleRegPassword.classList.remove('fa-eye');
                toggleRegPassword.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                toggleRegPassword.classList.remove('fa-eye-slash');
                toggleRegPassword.classList.add('fa-eye');
            }
        });
    }

    // Confirm password visibility toggle
    const toggleRegRePassword = document.getElementById('toggleRegRePassword');
    if (toggleRegRePassword) {
        toggleRegRePassword.addEventListener('click', function() {
            if (confirmPasswordInput.type === 'password') {
                confirmPasswordInput.type = 'text';
                toggleRegRePassword.classList.remove('fa-eye');
                toggleRegRePassword.classList.add('fa-eye-slash');
            } else {
                confirmPasswordInput.type = 'password';
                toggleRegRePassword.classList.remove('fa-eye-slash');
                toggleRegRePassword.classList.add('fa-eye');
            }
        });
    }

    form.addEventListener("submit", (e) => {
        const rawEmail = emailInput.value;
        const rawUsername = usernameInput.value;
        const rawPassword = passwordInput.value;
        let block = false;
        let hasEmpty = false;

        // Check for leading space first
        if (rawEmail.length > 0 && rawEmail[0] === ' ') {
            emailMsg.style.color = "#dc3545";
            emailMsg.textContent = "Email cannot start with a space.";
            emailMsg.style.fontWeight = "700";
            emailMsg.style.opacity = "1";
            emailInput.style.borderColor = "#dc3545";
            emailExists = true;
            block = true;
        } else if (rawEmail.length > 0 && rawEmail[rawEmail.length - 1] === ' ') {
            // Check for trailing space
            emailMsg.style.color = "#dc3545";
            emailMsg.textContent = "Email cannot end with a space.";
            emailMsg.style.fontWeight = "700";
            emailMsg.style.opacity = "1";
            emailInput.style.borderColor = "#dc3545";
            emailExists = true;
            block = true;
        } else if (/\s{2,}/.test(rawEmail)) {
            // Check for multiple consecutive spaces
            emailMsg.style.color = "red";
            emailMsg.textContent = "Double spaces are not allowed.";
            emailInput.style.borderColor = "red";
            emailExists = true;
            block = true;
        } else if (rawEmail.trim() === "") {
            // Check if empty (after trimming)
            emailMsg.style.color = "red";
            emailMsg.textContent = "Email is required.";
            emailInput.style.borderColor = "red";
            emailExists = true;
            block = true;
            hasEmpty = true;
        } else if (/\s/.test(rawEmail)) {
            // Check for any other spaces
            emailMsg.style.color = "#dc3545";
            emailMsg.textContent = "Spaces are not allowed in an email address.";
            emailMsg.style.fontWeight = "700";
            emailMsg.style.opacity = "1";
            emailInput.style.borderColor = "#dc3545";
            emailExists = true;
            block = true;
        }

        if (rawUsername.length === 1 && /\s/.test(rawUsername)) {
            hintMsg.textContent = "Username is required.";
            usernameInput.classList.add("input-error");
            usernameInput.classList.remove("input-success");
            userExists = true;
            block = true;
            hasEmpty = true;
        } else if (/\s{2,}/.test(rawUsername)) {
            hintMsg.textContent = "Double spaces are not allowed.";
            usernameInput.classList.add("input-error");
            usernameInput.classList.remove("input-success");
            userExists = true;
            block = true;
        } else if (rawUsername.trim() === "") {
            hintMsg.textContent = "Username is required.";
            usernameInput.classList.add("input-error");
            usernameInput.classList.remove("input-success");
            userExists = true;
            block = true;
            hasEmpty = true;
        }

        if (rawPassword.trim() === "") {
            passMsg.style.color = "red";
            passMsg.textContent = "Password is required.";
            passwordInput.style.borderColor = "red";
            block = true;
            hasEmpty = true;
        }

        // ✅ Block if password starts with a space
        if (rawPassword.length > 0 && rawPassword[0] === ' ') {
            passMsg.style.color = "red";
            passMsg.textContent = "Spaces are not allowed in the password.";
            passwordInput.style.borderColor = "red";
            passwordInput.classList.add("input-error");
            passwordInput.classList.remove("input-success");
            passwordExists = true;
            block = true;
        }
        // Block if password contains any spaces
        else if (/\s/.test(rawPassword)) {
            passMsg.style.color = "red";
            passMsg.textContent = "Space is not allowed in password.";
            passwordInput.style.borderColor = "red";
            passwordExists = true;
            block = true;
        }

        if (block || userExists || emailExists || passwordExists || !passwordMatch) {
            e.preventDefault();
            if (!hasEmpty && (userExists || emailExists || passwordExists || !passwordMatch)) {
                alert("Fix the errors before submitting!");
            }
        }
    });
});