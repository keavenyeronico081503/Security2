document.addEventListener("DOMContentLoaded", function() {
    const form = document.querySelector('form[name="myform"]');
    const loginError = document.getElementById("loginError");
    const passwordInput = document.getElementById("Password");
    const passwordError = document.getElementById("passwordError");
    const usernameInputLive = document.getElementById("Username");
    const usernameErrorLive = document.getElementById("usernameError");
    const forgotHint = document.getElementById("forgotHint");
    const toggleLoginPassword = document.getElementById("toggleLoginPassword");

    // Remove HTML5 validation attributes to disable browser default messages
    usernameInputLive.removeAttribute('required');
    passwordInput.removeAttribute('required');
    passwordInput.removeAttribute('minlength');

    let hasInteracted = false; // Track if user has attempted to submit

    // Lockout state in localStorage
    const STORAGE_KEY = "login_lockout_state";
    const STORAGE_INPUTS_KEY = "login_form_inputs";
    const state = loadState();
    
    // Restore saved input values FIRST before applying lockout
    restoreInputValues();
    
    applyLockoutIfNeeded();

    // Username: letters and numbers only
    usernameInputLive.addEventListener("input", function(){
        const value = usernameInputLive.value;
        const pattern = /^[A-Za-z0-9]*$/;
        const maxU = 16;
        
        // Save input value every time user types
        saveInputValues();
        
        // Clear login error when user starts typing
        clearLoginError();
        
        // Only show errors after first submit attempt
        if (!hasInteracted) {
            // Just enforce restrictions silently
            if (!pattern.test(value)){
                usernameInputLive.value = value.replace(/[^A-Za-z0-9]/g, "");
            }
            if (value.length >= maxU){
                usernameInputLive.value = value.substring(0, maxU);
            }
            return;
        }

        if (value.length === 0){
            showFieldError(usernameErrorLive, "Username is required.");
        } else if (value.length > 0){
            // Clear error when user starts typing
            clearFieldError(usernameErrorLive);
        }
        
        if (value.length > 0 && !pattern.test(value)){
            showFieldError(usernameErrorLive, "Only letters and numbers are allowed.");
            usernameInputLive.value = value.replace(/[^A-Za-z0-9]/g, "");
        } else if (value.length >= maxU){
            usernameInputLive.value = value.substring(0, maxU);
            showFieldError(usernameErrorLive, `Maximum ${maxU} characters reached.`);
        } else {
            // Just clear errors when user is typing valid input
            // Don't show format validation errors on keystroke - only on submit
            clearFieldError(usernameErrorLive);
            clearLoginError();
        }
    });

    // Live password validation
    passwordInput.addEventListener("input", function(){
        const min = 8, max = 20;
        const value = passwordInput.value;
        
        // Save input value every time user types
        saveInputValues();
        
        // Clear login error when user starts typing
        clearLoginError();
        
        // Only show errors after first submit attempt
        if (!hasInteracted) {
            // Just enforce max length silently
            if (value.length >= max){
                passwordInput.value = value.substring(0, max);
            }
            return;
        }

        if (value.length === 0){
            showFieldError(passwordError, "Password is required.");
        } else if (value.length < min){
            showFieldError(passwordError, `Please enter at least ${min} characters.`);
        } else if (value.length >= max){
            passwordInput.value = value.substring(0, max);
            showFieldError(passwordError, `Maximum ${max} characters reached.`);
        } else {
            clearFieldError(passwordError);
        }
    });

    // Toggle password visibility with eye icon
    if (toggleLoginPassword){
        toggleLoginPassword.addEventListener("click", function(){
            if (passwordInput.type === "password") {
                passwordInput.type = "text";
                toggleLoginPassword.classList.remove("fa-eye");
                toggleLoginPassword.classList.add("fa-eye-slash");
            } else {
                passwordInput.type = "password";
                toggleLoginPassword.classList.remove("fa-eye-slash");
                toggleLoginPassword.classList.add("fa-eye");
            }
        });
    }

    form.addEventListener("submit", function(e) {
        e.preventDefault();
        hasInteracted = true; // User has now attempted to submit
        
        const username = usernameInputLive.value.trim();
        const password = passwordInput.value.trim();
        let hasError = false;

        // ✅ VALIDATE PASSWORD FIRST (independent of username)
        if (!password) {
            showFieldError(passwordError, "Password is required.");
            hasError = true;
        } else if (password.length < 8) {
            showFieldError(passwordError, "Minimum 8 characters required.");
            hasError = true;
        } else if (password.length > 20) {
            showFieldError(passwordError, "Maximum 20 characters allowed.");
            hasError = true;
        } else {
            clearFieldError(passwordError);
        }

        // ✅ VALIDATE USERNAME (independent of password)
        if (!username) {
            showFieldError(usernameErrorLive, "Username is required.");
            hasError = true;
        } else if (!/^[A-Za-z0-9]+$/.test(username)){
            showFieldError(usernameErrorLive, "Only letters and numbers are allowed.");
            hasError = true;
        } else if (username.length > 16) {
            showFieldError(usernameErrorLive, "Maximum 16 characters allowed.");
            hasError = true;
        } else {
            // ✅ Validate username format matches register format: Sachin123
            // Must start with capital letter, rest lowercase, at least 6 letters, ends with number
            const letterCount = (username.match(/[a-zA-Z]/g) || []).length;
            const startsWithCapital = /^[A-Z]/.test(username);
            const hasUppercaseAfterFirst = /[A-Z]/.test(username.substring(1));
            const endsWithNumber = /\d$/.test(username);
            const hasAtLeast6Letters = letterCount >= 6;
            
            // Check if format matches register requirements
            // ✅ Only show "Invalid password or username" if password is also valid
            if (!startsWithCapital || hasUppercaseAfterFirst || !endsWithNumber || !hasAtLeast6Letters) {
                // Only trigger error if password is valid (not empty and correct length)
                if (password && password.length >= 8 && password.length <= 20) {
                    showMessage("Invalid password or username.", "error");
                    hasError = true;
                    // ✅ Trigger lockout timer for invalid username format
                    registerFailure();
                    applyLockoutIfNeeded();
                } else {
                    // Password is invalid, so don't show format error yet
                    hasError = true;
                }
            } else {
                clearFieldError(usernameErrorLive);
            }
        }

        // Stop if validation errors
        if (hasError) {
            return;
        }

        // Send login request
        fetch("../php/login.php", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === "success") {
                showMessage(data.message, "success");
                resetFailures();
                // Lock cursor during redirect countdown
                document.body.style.cursor = 'not-allowed';
                document.body.style.pointerEvents = 'none';
                document.documentElement.style.cursor = 'not-allowed';
                try {
                    localStorage.setItem('userLoggedIn', 'true');
                } catch (_) {}
                setTimeout(() => {
                    document.body.style.cursor = '';
                    document.body.style.pointerEvents = '';
                    document.documentElement.style.cursor = '';
                    // Replace history so Back won't return to login
                    window.location.replace(data.redirect);
                }, 1000);
            } else {
                showMessage(data.message, "error");
                registerFailure();
                if (data.redirect && data.redirect.includes("question.html")) {
                    // Lock cursor during redirect countdown
                    document.body.style.cursor = 'not-allowed';
                    document.body.style.pointerEvents = 'none';
                    document.documentElement.style.cursor = 'not-allowed';
                    setTimeout(() => {
                        document.body.style.cursor = '';
                        document.body.style.pointerEvents = '';
                        document.documentElement.style.cursor = '';
                        window.location.href = data.redirect;
                    }, 2000);
                }
            }
        })
        .catch(err => {
            showMessage("Login error. Please try again.", "error");
            registerFailure();
            console.error(err);
        });
    });

    function showFieldError(element, message) {
        if (element) {
            element.textContent = message;
            element.style.display = "block";
            element.style.color = "#d32f2f"; /* Softer, less harsh red */
            element.style.fontSize = "15px"; /* Bigger, clearer */
            element.style.marginTop = "6px";
            element.style.fontWeight = "500"; /* Lighter weight */
            element.style.opacity = "0.9"; /* Softer appearance */
            element.style.letterSpacing = "0.02em";
        }
    }

    function clearFieldError(element) {
        if (element) {
            element.textContent = "";
            element.style.display = "none";
            element.style.opacity = "";
            element.style.fontWeight = "";
        }
    }

    function showMessage(message, type) {
        if (!loginError) return;
        
        loginError.textContent = message;
        
        if (type === "success") {
            loginError.style.color = "#00ff88"; // Brighter, clearer green
            loginError.style.fontWeight = "700"; // Bold text
            loginError.style.textShadow = "0 2px 4px rgba(0, 0, 0, 0.3)"; // Text shadow for visibility
        } else if (type === "error") {
            loginError.style.color = "#d32f2f"; /* Softer, less harsh red */
            loginError.style.fontWeight = "500"; /* Lighter weight */
            loginError.style.textShadow = "0 2px 4px rgba(0, 0, 0, 0.3)";
            loginError.style.opacity = "0.9"; /* Softer appearance */
        } else {
            loginError.style.color = "#004085";
            loginError.style.fontWeight = "normal";
            loginError.style.textShadow = "none";
        }
        
        loginError.style.display = "block";
    }

    function clearLoginError() {
        if (loginError) {
            loginError.textContent = "";
            loginError.style.display = "none";
            loginError.style.fontWeight = "";
            loginError.style.textShadow = "";
        }
    }

    // Failure tracking and lockout logic
    function loadState(){
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : { failures: 0, lockUntil: 0 };
        } catch {
            return { failures: 0, lockUntil: 0 };
        }
    }

    function saveState(){
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function resetFailures(){
        state.failures = 0;
        saveState();
        clearInputValues(); // Clear saved inputs on successful login
        if (forgotHint) forgotHint.style.display = "none";
    }
    
    // Close modal functions

    function registerFailure(){
        state.failures = (state.failures || 0) + 1;
        
        // Show the hint text below password field on 2nd failure of each cycle
        if (forgotHint) {
            if (state.failures % 3 === 2) {
                // Show on 2nd failure of each cycle (2, 5, 8, 11, 14, 17, etc.)
                forgotHint.style.display = "block";
            }
        }
        
        // Lock after each set of 3 errors: 15s, 30s, 60s
        if (state.failures % 3 === 0){
            const streak = state.failures / 3;
            const durations = [15, 30, 60];
            const seconds = durations[Math.min(streak - 1, durations.length - 1)];
            state.lockUntil = Date.now() + seconds * 1000;
            saveState();
            applyLockoutIfNeeded();
        } else {
            saveState();
        }
    }

    function applyLockoutIfNeeded(){
        const now = Date.now();
        if (state.lockUntil && now < state.lockUntil){
            disableForm(true);
            startCountdown();
        } else {
            disableForm(false);
        }
    }

    function disableForm(disabled){
        const btn = form.querySelector('button[type="submit"]');
        const navButtons = document.querySelectorAll('.nav a');
        const forgotLink = document.querySelector('#forgotHint a');
        
        if (disabled){
            // Lock cursor - show not-allowed cursor and prevent interaction
            document.body.style.cursor = 'not-allowed';
            document.body.style.pointerEvents = 'none';
            document.documentElement.style.cursor = 'not-allowed';
            
            form.querySelectorAll('input').forEach(i => i.disabled = true);
            if (btn) btn.disabled = true;
            navButtons.forEach(navBtn => {
                navBtn.classList.add('disabled');
            });
            if (forgotLink) {
                forgotLink.classList.add('disabled');
            }
        } else {
            // Unlock cursor
            document.body.style.cursor = '';
            document.body.style.pointerEvents = '';
            document.documentElement.style.cursor = '';
            
            form.querySelectorAll('input').forEach(i => i.disabled = false);
            if (btn) btn.disabled = false;
            navButtons.forEach(navBtn => {
                navBtn.classList.remove('disabled');
            });
            if (forgotLink) {
                forgotLink.classList.remove('disabled');
            }
        }
    }

    function startCountdown(){
        const btn = form.querySelector('button[type="submit"]');
        const tick = () => {
            const remainingMs = state.lockUntil - Date.now();
            if (remainingMs <= 0){
                state.lockUntil = 0;
                saveState();
                disableForm(false);
                clearLoginError();
                if (forgotHint) forgotHint.style.display = "none"; // Hide "Forgot Password" message when countdown finishes
                if (btn) btn.textContent = "Login";
                return;
            }
            const secs = Math.ceil(remainingMs / 1000);
            showMessage(`Access denied for ${secs}s due to multiple failed attempts.`, "error");
            if (btn) btn.textContent = `Login (${secs}s)`;
            requestAnimationFrame(tick);
        };
        tick();
    }

    // Save and restore input values for persistence during lockout
    function saveInputValues(){
        try {
            const inputs = {
                username: usernameInputLive.value,
                password: passwordInput.value
            };
            localStorage.setItem(STORAGE_INPUTS_KEY, JSON.stringify(inputs));
        } catch(e) {
            console.error("Failed to save inputs:", e);
        }
    }

    function restoreInputValues(){
        try {
            const raw = localStorage.getItem(STORAGE_INPUTS_KEY);
            if (raw){
                const inputs = JSON.parse(raw);
                if (inputs.username) usernameInputLive.value = inputs.username;
                if (inputs.password) passwordInput.value = inputs.password;
            }
        } catch(e) {
            console.error("Failed to restore inputs:", e);
        }
    }

    function clearInputValues(){
        try {
            localStorage.removeItem(STORAGE_INPUTS_KEY);
        } catch(e) {
            console.error("Failed to clear inputs:", e);
        }
    }
});
