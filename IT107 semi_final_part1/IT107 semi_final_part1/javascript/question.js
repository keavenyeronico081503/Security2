document.addEventListener("DOMContentLoaded", function() {
    const followUpDiv = document.getElementById("followUpDiv");
    const messageDiv = document.getElementById("message");
    
    // Get all question elements
    const questionSelect1 = document.getElementById("questionSelect1");
    const answerInput1 = document.getElementById("answerInput1");
    const nextBtn1 = document.getElementById("nextBtn1");
    
    const questionSelect2 = document.getElementById("questionSelect2");
    const answerInput2 = document.getElementById("answerInput2");
    const nextBtn2 = document.getElementById("nextBtn2");
    
    const questionSelect3 = document.getElementById("questionSelect3");
    const answerInput3 = document.getElementById("answerInput3");
    const completeBtn = document.getElementById("completeBtn");
    
    // Previous buttons
    const prevBtn1 = document.getElementById("prevBtn1");
    const prevBtn2 = document.getElementById("prevBtn2");
    const prevBtn3 = document.getElementById("prevBtn3");
    
    const questionGroup1 = document.getElementById("questionGroup1");
    const questionGroup2 = document.getElementById("questionGroup2");
    const questionGroup3 = document.getElementById("questionGroup3");

    // ✅ Eye toggle buttons
    const toggleAnswer1 = document.getElementById("toggleAnswer1");
    const toggleAnswer2 = document.getElementById("toggleAnswer2");
    const toggleAnswer3 = document.getElementById("toggleAnswer3");

    // All available questions
    const allQuestions = [
        { value: "petName", text: "What is the name of your pet?" },
        { value: "hobby", text: "What's your favorite hobby?" },
        { value: "travel", text: "What's your favorite place you've visited?" },
        { value: "music", text: "Who's your favorite artist or band?" },
        { value: "movies", text: "Do you enjoy movies or TV shows?" }
    ];

    // Store selected questions
    let selectedQuestions = [];

    // Show welcome message
    if (messageDiv) {
        messageDiv.style.color = "blue";
        messageDiv.innerText = "Welcome! Please complete your registration by answering 3 security questions.";
    }

    // ✅ Toggle password visibility for Answer 1
    if (toggleAnswer1) {
        toggleAnswer1.addEventListener("click", function() {
            const type = answerInput1.type === "password" ? "text" : "password";
            answerInput1.type = type;
            this.textContent = type === "password" ? "👁️" : "🙈";
        });
    }

    // ✅ Toggle password visibility for Answer 2
    if (toggleAnswer2) {
        toggleAnswer2.addEventListener("click", function() {
            const type = answerInput2.type === "password" ? "text" : "password";
            answerInput2.type = type;
            this.textContent = type === "password" ? "👁️" : "🙈";
        });
    }

    // ✅ Toggle password visibility for Answer 3
    if (toggleAnswer3) {
        toggleAnswer3.addEventListener("click", function() {
            const type = answerInput3.type === "password" ? "text" : "password";
            answerInput3.type = type;
            this.textContent = type === "password" ? "👁️" : "🙈";
        });
    }

    // Function to populate dropdown with available questions
    function populateDropdown(selectElement, excludeValues = []) {
        selectElement.innerHTML = '<option value="">--Select a question--</option>';
        allQuestions.forEach(question => {
            if (!excludeValues.includes(question.value)) {
                const option = document.createElement('option');
                option.value = question.value;
                option.textContent = question.text;
                selectElement.appendChild(option);
            }
        });
    }

    // Initialize dropdowns
    populateDropdown(questionSelect1);
    populateDropdown(questionSelect2);
    populateDropdown(questionSelect3);

    // Question 1 - Next button
    nextBtn1.addEventListener("click", function() {
        const selectedQuestion = questionSelect1.value;
        const userAnswer = answerInput1.value.trim();
        const rawAnswer = answerInput1.value;

        if (!selectedQuestion) {
            if (messageDiv) {
                messageDiv.style.color = "red";
                messageDiv.innerText = "Please select a question for Question 1.";
            }
            return;
        }

        // Check for leading space
        if (rawAnswer.length > 0 && rawAnswer[0] === ' ') {
            if (messageDiv) {
                messageDiv.style.color = "red";
                messageDiv.innerText = "Spaces are not allowed at the beginning of your answer.";
            }
            return;
        }

        // Check for any spaces in answer
        if (/\s/.test(rawAnswer)) {
            if (messageDiv) {
                messageDiv.style.color = "red";
                messageDiv.innerText = "Spaces are not allowed in your answer.";
            }
            return;
        }

        if (!userAnswer) {
            if (messageDiv) {
                messageDiv.style.color = "red";
                messageDiv.innerText = "Please provide an answer for Question 1.";
            }
            return;
        }

        // Store selected question
        selectedQuestions.push(selectedQuestion);
        
        // Hide Question 1, show Question 2
        questionGroup1.style.display = "none";
        questionGroup2.style.display = "block";
        
        // Update Question 2 dropdown (exclude already selected)
        populateDropdown(questionSelect2, selectedQuestions);
        
        // Clear message
        if (messageDiv) {
            messageDiv.innerText = "";
        }
    });

    // Question 2 - Next button
    nextBtn2.addEventListener("click", function() {
        const selectedQuestion = questionSelect2.value;
        const userAnswer = answerInput2.value.trim();
        const rawAnswer = answerInput2.value;

        if (!selectedQuestion) {
            if (messageDiv) {
                messageDiv.style.color = "red";
                messageDiv.innerText = "Please select a question for Question 2.";
            }
            return;
        }

        // Check for leading space
        if (rawAnswer.length > 0 && rawAnswer[0] === ' ') {
            if (messageDiv) {
                messageDiv.style.color = "red";
                messageDiv.innerText = "Spaces are not allowed at the beginning of your answer.";
            }
            return;
        }

        // Check for any spaces in answer
        if (/\s/.test(rawAnswer)) {
            if (messageDiv) {
                messageDiv.style.color = "red";
                messageDiv.innerText = "Spaces are not allowed in your answer.";
            }
            return;
        }

        if (!userAnswer) {
            if (messageDiv) {
                messageDiv.style.color = "red";
                messageDiv.innerText = "Please provide an answer for Question 2.";
            }
            return;
        }

        // Store selected question
        selectedQuestions.push(selectedQuestion);
        
        // Hide Question 2, show Question 3
        questionGroup2.style.display = "none";
        questionGroup3.style.display = "block";
        
        // Update Question 3 dropdown (exclude already selected)
        populateDropdown(questionSelect3, selectedQuestions);
        
        // Clear message
        if (messageDiv) {
            messageDiv.innerText = "";
        }
    });

    // Previous button for Question 1 - Go back to Register page
    if (prevBtn1) {
        prevBtn1.addEventListener("click", function() {
            // Redirect back to register page
            window.location.href = "register.html";
        });
    }

    // Previous button for Question 2 - Go back to Question 1
    if (prevBtn2) {
        prevBtn2.addEventListener("click", function() {
            // Remove the last selected question from array
            selectedQuestions.pop();
            
            // Hide Question 2, show Question 1
            questionGroup2.style.display = "none";
            questionGroup1.style.display = "block";
            
            // Clear message
            if (messageDiv) {
                messageDiv.innerText = "";
            }
        });
    }

    // Previous button for Question 3 - Go back to Question 2
    if (prevBtn3) {
        prevBtn3.addEventListener("click", function() {
            // Remove the last selected question from array
            selectedQuestions.pop();
            
            // Hide Question 3, show Question 2
            questionGroup3.style.display = "none";
            questionGroup2.style.display = "block";
            
            // Update Question 2 dropdown (exclude currently selected)
            populateDropdown(questionSelect2, selectedQuestions);
            
            // Clear message
            if (messageDiv) {
                messageDiv.innerText = "";
            }
        });
    }

    // ✅ Question 3 - Complete Registration button (FIXED VERSION)
    completeBtn.addEventListener("click", function() {
        const selectedQuestion = questionSelect3.value;
        const userAnswer = answerInput3.value.trim();
        const rawAnswer = answerInput3.value;

        if (!selectedQuestion) {
            if (messageDiv) {
                messageDiv.style.color = "red";
                messageDiv.innerText = "Please select a question for Question 3.";
            }
            return;
        }

        // Check for leading space
        if (rawAnswer.length > 0 && rawAnswer[0] === ' ') {
            if (messageDiv) {
                messageDiv.style.color = "red";
                messageDiv.innerText = "Spaces are not allowed at the beginning of your answer.";
            }
            return;
        }

        // Check for any spaces in answer
        if (/\s/.test(rawAnswer)) {
            if (messageDiv) {
                messageDiv.style.color = "red";
                messageDiv.innerText = "Spaces are not allowed in your answer.";
            }
            return;
        }

        if (!userAnswer) {
            if (messageDiv) {
                messageDiv.style.color = "red";
                messageDiv.innerText = "Please provide an answer for Question 3.";
            }
            return;
        }

        // Store selected question
        selectedQuestions.push(selectedQuestion);

        // ✅ Create proper FormData
        const formData = new FormData();
        formData.append('question1', questionSelect1.value);
        formData.append('answer1', answerInput1.value.trim());
        formData.append('question2', questionSelect2.value);
        formData.append('answer2', answerInput2.value.trim());
        formData.append('question3', questionSelect3.value);
        formData.append('answer3', answerInput3.value.trim());

        // ✅ Show loading message
        if (messageDiv) {
            messageDiv.style.color = "blue";
            messageDiv.innerText = "Processing... Please wait.";
        }

        // ✅ FIXED: Correct filename is submit_question.php (NOT sumbit)
        fetch("../php/submit_question.php", {
            method: "POST",
            body: formData
        })
        .then(res => {
            // ✅ Check if response is OK
            if (!res.ok) {
                throw new Error('Network response was not ok');
            }
            return res.text(); // Get as text first to see raw response
        })
        .then(text => {
            console.log("Server response:", text); // ✅ Debug: see what server returns
            try {
                return JSON.parse(text); // Try to parse as JSON
            } catch (e) {
                throw new Error('Invalid JSON response: ' + text);
            }
        })
        .then(data => {
            console.log("Parsed data:", data); // ✅ Debug
            if (data.status === "success") {
                // Hide the question form
                if (followUpDiv) {
                    followUpDiv.style.display = "none";
                }
                
                // Show success message
                if (messageDiv) {
                    messageDiv.style.color = "green";
                    messageDiv.style.fontSize = "18px";
                    messageDiv.style.fontWeight = "bold";
                    messageDiv.style.textAlign = "center";
                    messageDiv.style.padding = "20px";
                    messageDiv.style.backgroundColor = "#d4edda";
                    messageDiv.style.border = "1px solid #c3e6cb";
                    messageDiv.style.borderRadius = "5px";
                    messageDiv.innerHTML = "✅ " + data.message;
                }
                
                // Redirect to login after 2 seconds
                setTimeout(() => {
                    window.location.href = data.redirect;
                }, 2000);
            } else {
                if (messageDiv) {
                    messageDiv.style.color = "red";
                    messageDiv.innerText = data.message || "Unknown error occurred.";
                }
            }
        })
        .catch(err => {
            console.error("Full error:", err); // ✅ Debug
            if (messageDiv) {
                messageDiv.style.color = "red";
                messageDiv.innerText = "Error: " + err.message;
            }
        });
    });
});