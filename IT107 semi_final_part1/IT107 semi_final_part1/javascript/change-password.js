// Load user data when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadUserData();
    document.querySelectorAll('.password-toggle').forEach(toggle => {
        toggle.addEventListener('click', function() {
            const input = document.getElementById(this.dataset.passwordTarget);
            const visible = input.type === 'password';
            input.type = visible ? 'text' : 'password';
            this.setAttribute('aria-pressed', String(visible));
            this.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} password`);
            this.querySelector('i').className = `fas fa-eye${visible ? '-slash' : ''}`;
        });
    });
});

// Function to fetch user data from database
async function fetchUserData(id) {
    try {
        const response = await fetch(`../php/get-user-data.php?id=${encodeURIComponent(id)}`);
        const data = await response.json();
        
        if (data.status === 'success' && data.user) {
            return data.user;
        } else {
            throw new Error(data.message || 'Failed to load user data');
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        return null;
    }
}

// Function to load and display user data
function loadUserData() {
    // Get ID from URL parameters or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id') || localStorage.getItem('forgotPasswordID') || localStorage.getItem('currentUserID');
    
    const idDisplay = document.getElementById('idDisplay');
    const usernameDisplay = document.getElementById('usernameDisplay');
    
    if (!id) {
        // If no ID found, show placeholder
        idDisplay.textContent = 'Not available';
        usernameDisplay.textContent = 'Not available';
        return;
    }
    
    // Display the ID
    idDisplay.textContent = id;
    
    // Fetch and display user data
    fetchUserData(id).then(userData => {
        if (userData) {
            usernameDisplay.textContent = userData.username || 'Not available';
        } else {
            usernameDisplay.textContent = 'Not available';
        }
    });
}

// Form validation functions
function validateNewPassword() {
    const input = document.getElementById("new_password");
    const error = document.getElementById("passwordError");
    const strength = document.getElementById("passwordStrength");
    const value = input.value;
    const min = 8;
    const max = 20;

    // Check for password requirements
    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasNum = /\d/.test(value);
    const hasSym = /[^A-Za-z0-9]/.test(value);
    
    if (value.length === 0) {
        error.textContent = "New password is required.";
        input.classList.add("input-error");
        input.classList.remove("input-success");
        strength.textContent = "";
        return false;
    } else if (value.length < min) {
        error.textContent = `Minimum ${min} characters required.`;
        input.classList.add("input-error");
        input.classList.remove("input-success");
        strength.textContent = "";
        return false;
    } else if (value.length > max) {
        error.textContent = `Maximum ${max} characters allowed.`;
        input.value = value.substring(0, max);
        input.classList.add("input-error");
        input.classList.remove("input-success");
        strength.textContent = "";
        return false;
    } else if (!hasUpper || !hasLower || !hasNum || !hasSym) {
        error.textContent = "Password must include uppercase, lowercase, number, and special character.";
        input.classList.add("input-error");
        input.classList.remove("input-success");
        strength.textContent = "";
        return false;
    } else {
        error.textContent = "";
        input.classList.remove("input-error");
        input.classList.add("input-success");
        // Clear strength indicator - avoid conflicts with main validation
        strength.textContent = "";
        strength.style.color = "";
        return true;
    }
}

function validateConfirmPassword() {
    const password = document.getElementById("new_password").value;
    const confirmPassword = document.getElementById("confirm_password").value;
    const error = document.getElementById("confirmPasswordError");
    const input = document.getElementById("confirm_password");
    
    if (confirmPassword.length === 0) {
        error.textContent = "Please confirm your new password.";
        input.classList.add("input-error");
        input.classList.remove("input-success");
        return false;
    } else if (password !== confirmPassword) {
        error.textContent = "Passwords do not match.";
        input.classList.add("input-error");
        input.classList.remove("input-success");
        return false;
    } else {
        error.textContent = "";
        input.classList.remove("input-error");
        input.classList.add("input-success");
        return true;
    }
}

// Form submission handler
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('changePasswordForm');
    const messageDiv = document.getElementById('message');
    const submitBtn = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Validate all fields
        const isNewValid = validateNewPassword();
        const isConfirmValid = validateConfirmPassword();
        
        if (!isNewValid || !isConfirmValid) {
            showMessage('Please fix the errors in the form.', 'error');
            return;
        }
        
        // Get form values
        const newPassword = document.getElementById('new_password').value;
        
        // Check if new password meets all requirements
        const hasUpper = /[A-Z]/.test(newPassword);
        const hasLower = /[a-z]/.test(newPassword);
        const hasNum = /\d/.test(newPassword);
        const hasSym = /[^A-Za-z0-9]/.test(newPassword);
        
        if (!hasUpper || !hasLower || !hasNum || !hasSym || newPassword.length < 8) {
            showMessage('Please ensure your new password meets all requirements.', 'error');
            return;
        }

        if (!confirm('Change your password now?')) return;
        
        // Disable submit button to prevent multiple submissions
        submitBtn.disabled = true;
        submitBtn.textContent = 'Changing Password...';
        
        // Submit form via AJAX
        const formData = new FormData(form);
        
        fetch(form.action, {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showMessage(data.message, 'success');
                form.reset();
                // Redirect after 2 seconds
                if (data.redirect) {
                    setTimeout(() => {
                        window.location.href = data.redirect;
                    }, 2000);
                }
            } else {
                showMessage(data.message || 'An error occurred while changing your password.', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showMessage('An error occurred while processing your request. Please try again.', 'error');
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Change Password';
        });
    });
    
    function showMessage(message, type) {
        messageDiv.textContent = message;
        messageDiv.className = 'message ' + type;
        messageDiv.style.display = 'block';
        
        // Auto-hide message after 5 seconds
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
});