// Forgot Password JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('form[name="forgotForm"]');
    const idInput = document.getElementById('ID');
    const idError = document.getElementById('idError');
    const prevBtn = document.getElementById('prevBtn');

    // ID validation - allows format: YYYY-#### (e.g., 2025-0002)
    idInput.addEventListener('input', function() {
        const value = this.value;
        
        // Allow numbers and hyphens only, format: YYYY-####
        // Remove any characters that are not numbers or hyphens
        const cleanedValue = value.replace(/[^0-9-]/g, '');
        if (value !== cleanedValue) {
            this.value = cleanedValue;
        }
        
        const trimmedValue = cleanedValue.trim();
        if (trimmedValue.length === 0) {
            idError.textContent = "ID is required.";
        } else if (trimmedValue.length < 2) {
            idError.textContent = "Please enter at least 2 characters.";
        } else if (!/^\d+(-\d+)?$/.test(trimmedValue)) {
            idError.textContent = "ID format should be numbers or YYYY-#### (e.g., 2025-0002).";
        } else {
            idError.textContent = "";
        }
    });

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const id = idInput.value.trim();
        
        // Validate ID
        if (!id) {
            idError.textContent = "ID is required.";
            return;
        }
        
        if (id.length < 2) {
            idError.textContent = "Please enter at least 2 characters.";
            return;
        }
        
        if (!/^\d+(-\d+)?$/.test(id)) {
            idError.textContent = "ID format should be numbers or YYYY-#### (e.g., 2025-0002).";
            return;
        }

        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Checking...';
        submitBtn.disabled = true;
        idError.textContent = '';
        
        // Verify ID with database
        const formData = new FormData();
        formData.append('id', id);
        
        fetch('../php/verify-username.php', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // ID exists - store for next page and redirect
                localStorage.setItem('forgotPasswordID', id);
                window.location.href = `auth-questions.html?id=${encodeURIComponent(id)}`;
            } else {
                // ID not found or error
                idError.textContent = data.message || 'ID not found';
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            idError.textContent = 'An error occurred. Please try again later.';
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        });
    });

    // Previous button functionality - Go back to Login page
    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            // Redirect back to login page
            window.location.href = 'login.html';
        });
    }
});
