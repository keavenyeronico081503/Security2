// Authentication Questions JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('form[name="authForm"]');
    const usernameDisplay = document.getElementById('usernameDisplay');
    const usernameFieldDisplay = document.getElementById('usernameFieldDisplay');
    const question1Display = document.getElementById('question1Display');
    const question2Display = document.getElementById('question2Display');
    const question3Display = document.getElementById('question3Display');
    const questionSelect = document.getElementById('securityQuestion'); // hidden input
    const answerInput = document.getElementById('securityAnswer');
    const questionError = document.getElementById('questionError');
    const answerError = document.getElementById('answerError');
    const messageDiv = document.getElementById('message');
    const prevBtn = document.getElementById('prevBtn');

    // Second question elements
    const questionSelect2 = document.getElementById('securityQuestion2'); // hidden input
    const answerInput2 = document.getElementById('securityAnswer2');
    const questionError2 = document.getElementById('questionError2');
    const answerError2 = document.getElementById('answerError2');

    // Third question elements
    const questionSelect3 = document.getElementById('securityQuestion3'); // hidden input
    const answerInput3 = document.getElementById('securityAnswer3');
    const questionError3 = document.getElementById('questionError3');
    const answerError3 = document.getElementById('answerError3');

    // Store the loaded questions (both text for display and values for verification)
    let loadedQuestion1Text = '';
    let loadedQuestion2Text = '';
    let loadedQuestion3Text = '';
    let loadedQuestion1Value = '';
    let loadedQuestion2Value = '';
    let loadedQuestion3Value = '';

    // Function to verify answer with real database
    async function verifyAnswer(id, question, answer) {
        try {
            const response = await fetch('../php/verify_security_question.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `id=${encodeURIComponent(id)}&question=${encodeURIComponent(question)}&answer=${encodeURIComponent(answer)}`
            });
            
            const data = await response.json();
            return data.status === 'success';
        } catch (error) {
            console.error('Error verifying answer:', error);
            return false;
        }
    }

    // Function to fetch user data (email, username) from database
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
            // Don't show error for user data, just use fallback
            return null;
        }
    }

    // Function to fetch user's security questions from database
    async function fetchUserQuestions(id) {
        try {
            const response = await fetch(`../php/get-user-questions.php?id=${encodeURIComponent(id)}`);
            const data = await response.json();
            
            if (data.status === 'success' && data.questions) {
                return data.questions;
            } else {
                throw new Error(data.message || 'Failed to load security questions');
            }
        } catch (error) {
            console.error('Error fetching questions:', error);
            messageDiv.className = 'message error';
            messageDiv.textContent = 'Failed to load security questions. Please try again.';
            return null;
        }
    }

    // Get ID from URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id') || localStorage.getItem('forgotPasswordID');
    
    if (!id) {
        // Redirect back if no ID
        window.location.href = 'forgot-password.html';
        return;
    }

    // Display ID
    usernameDisplay.textContent = id;

    // Load and display user data (Username)
    fetchUserData(id).then(userData => {
        if (userData) {
            usernameFieldDisplay.textContent = userData.username || 'Not available';
        } else {
            usernameFieldDisplay.textContent = 'Loading...';
        }
    });

    // Load and display security questions
    fetchUserQuestions(id).then(questions => {
        if (questions) {
            // Store both text (for display) and values (for verification)
            loadedQuestion1Text = questions.question1; // Full text for display
            loadedQuestion2Text = questions.question2; // Full text for display
            loadedQuestion3Text = questions.question3; // Full text for display
            loadedQuestion1Value = questions.question1Value; // Value like "petName" for verification
            loadedQuestion2Value = questions.question2Value; // Value like "hobby" for verification
            loadedQuestion3Value = questions.question3Value; // Value like "travel" for verification
            
            // Display the questions (full text)
            question1Display.textContent = questions.question1;
            question2Display.textContent = questions.question2;
            question3Display.textContent = questions.question3;
            
            // Set the hidden inputs with the question values (for verification)
            questionSelect.value = questions.question1Value;
            questionSelect2.value = questions.question2Value;
            questionSelect3.value = questions.question3Value;
        }
    });

    // Answer validation - Question 1
    answerInput.addEventListener('input', function() {
        const value = this.value.trim();
        const currentQuestion = loadedQuestion1Text; // Use text for comparison
        
        if (value.length === 0) {
            answerError.textContent = "Answer is required.";
        } else if (currentQuestion === "What was your previous password?" && value.length < 8) {
            // If it's the previous password question, require minimum 8 characters
            answerError.textContent = "Password must be at least 8 characters.";
        } else if (value.length < 2) {
            answerError.textContent = "Please enter at least 2 characters.";
        } else {
            answerError.textContent = "";
        }
    });

    // Answer validation - Question 2
    answerInput2.addEventListener('input', function() {
        const value = this.value.trim();
        const currentQuestion = loadedQuestion2Text; // Use text for comparison
        
        if (value.length === 0) {
            answerError2.textContent = "Answer is required.";
        } else if (currentQuestion === "What was your previous password?" && value.length < 8) {
            // If it's the previous password question, require minimum 8 characters
            answerError2.textContent = "Password must be at least 8 characters.";
        } else if (value.length < 2) {
            answerError2.textContent = "Please enter at least 2 characters.";
        } else {
            answerError2.textContent = "";
        }
    });

    // Answer validation - Question 3
    answerInput3.addEventListener('input', function() {
        const value = this.value.trim();
        const currentQuestion = loadedQuestion3Text; // Use text for comparison
        
        if (value.length === 0) {
            answerError3.textContent = "Answer is required.";
        } else if (currentQuestion === "What was your previous password?" && value.length < 8) {
            // If it's the previous password question, require minimum 8 characters
            answerError3.textContent = "Password must be at least 8 characters.";
        } else if (value.length < 2) {
            answerError3.textContent = "Please enter at least 2 characters.";
        } else {
            answerError3.textContent = "";
        }
    });

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const question = questionSelect.value; // Question value like "petName" (from hidden input)
        const answer = answerInput.value.trim();
        
        // Second question values
        const question2 = questionSelect2.value; // Question value like "hobby" (from hidden input)
        const answer2 = answerInput2.value.trim();
        
        // Third question values
        const question3 = questionSelect3.value; // Question value like "travel" (from hidden input)
        const answer3 = answerInput3.value.trim();
        
        // Validate all fields
        let hasErrors = false;
        
        // First question validation
        if (!question) {
            questionError.textContent = "Security question not loaded.";
            hasErrors = true;
        }
        
        if (!answer) {
            answerError.textContent = "Answer is required.";
            hasErrors = true;
        } else if (loadedQuestion1Text === "What was your previous password?" && answer.length < 8) {
            answerError.textContent = "Password must be at least 8 characters.";
            hasErrors = true;
        } else if (answer.length < 2) {
            answerError.textContent = "Please enter at least 2 characters.";
            hasErrors = true;
        }
        
        // Second question validation
        if (!question2) {
            questionError2.textContent = "Security question not loaded.";
            hasErrors = true;
        }
        
        if (!answer2) {
            answerError2.textContent = "Answer is required.";
            hasErrors = true;
        } else if (loadedQuestion2Text === "What was your previous password?" && answer2.length < 8) {
            answerError2.textContent = "Password must be at least 8 characters.";
            hasErrors = true;
        } else if (answer2.length < 2) {
            answerError2.textContent = "Please enter at least 2 characters.";
            hasErrors = true;
        }
        
        // Third question validation
        if (!question3) {
            questionError3.textContent = "Security question not loaded.";
            hasErrors = true;
        }
        
        if (!answer3) {
            answerError3.textContent = "Answer is required.";
            hasErrors = true;
        } else if (loadedQuestion3Text === "What was your previous password?" && answer3.length < 8) {
            answerError3.textContent = "Password must be at least 8 characters.";
            hasErrors = true;
        } else if (answer3.length < 2) {
            answerError3.textContent = "Please enter at least 2 characters.";
            hasErrors = true;
        }
        
        if (hasErrors) {
            return;
        }

        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Verifying...';
        submitBtn.disabled = true;
        
        // Verify all three answers with database
        const currentId = usernameDisplay.textContent;
        console.log('Verifying:', { id: currentId, question, answer, question2, answer2, question3, answer3 }); // Debug info
        
        const isValid1 = await verifyAnswer(currentId, question, answer);
        const isValid2 = await verifyAnswer(currentId, question2, answer2);
        const isValid3 = await verifyAnswer(currentId, question3, answer3);
        
        // Count how many answers are correct
        const correctCount = [isValid1, isValid2, isValid3].filter(Boolean).length;
        
        // Require at least 2 correct answers out of 3
        if (correctCount < 2) {
            messageDiv.className = 'message error';
            if (correctCount === 1) {
                messageDiv.textContent = 'Only 1 answer is correct. You need at least 2 correct answers to proceed.';
            } else {
                messageDiv.textContent = 'All answers are incorrect. Please try again.';
            }
            messageDiv.style.fontSize = '18px'; // Bigger text
            messageDiv.style.fontWeight = '600'; // Bold text
            messageDiv.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.3)'; // Text shadow for visibility
            
            // Reset button
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            
            // Clear any previous success messages
            setTimeout(() => {
                messageDiv.className = '';
                messageDiv.textContent = '';
                messageDiv.style.fontSize = '';
                messageDiv.style.fontWeight = '';
                messageDiv.style.textShadow = '';
            }, 5000);
            return;
        }

        // Show success message
        messageDiv.className = 'message success';
        messageDiv.textContent = `Security questions verified! (${correctCount} out of 3 correct) Redirecting to change password...`;
        messageDiv.style.color = '#00ff88'; // Brighter, clearer green
        messageDiv.style.fontWeight = '700'; // Bold text
        messageDiv.style.fontSize = '18px'; // Bigger text
        messageDiv.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.3)'; // Text shadow for visibility
        
        // Store verification data and redirect
        setTimeout(() => {
            localStorage.setItem('securityQuestion', question);
            localStorage.setItem('securityAnswer', answer);
            localStorage.setItem('securityQuestion2', question2);
            localStorage.setItem('securityAnswer2', answer2);
            localStorage.setItem('securityQuestion3', question3);
            localStorage.setItem('securityAnswer3', answer3);
            
            // Redirect to change password page
            window.location.href = `change-password.html?id=${encodeURIComponent(id)}`;
        }, 2000);
    });

    // Previous button functionality - Go back to Forgot Password page
    if (prevBtn) {
        prevBtn.addEventListener('click', function() {
            // Redirect back to forgot password page
            window.location.href = 'forgot-password.html';
        });
    }
});
