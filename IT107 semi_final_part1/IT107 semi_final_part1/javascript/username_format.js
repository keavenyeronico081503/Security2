// // Username Format Generator
// // Automatically creates username based on firstname.lastname format

// document.addEventListener('DOMContentLoaded', function() {
//     const firstNameInput = document.getElementById('fname');
//     const lastNameInput = document.getElementById('LastName');
//     const usernameInput = document.getElementById('Username');

//     // Function to generate username from first name and last name
//     function generateUsername() {
//         const firstName = firstNameInput.value.trim();
//         const lastName = lastNameInput.value.trim();
        
//         // Only generate if both fields have values
//         if (firstName && lastName) {
//             // Convert to lowercase and remove spaces
//             const cleanFirstName = firstName.toLowerCase().replace(/\s+/g, '');
//             const cleanLastName = lastName.toLowerCase().replace(/\s+/g, '');
            
//             // Create username in firstname.lastname format
//             const generatedUsername = `${cleanFirstName}.${cleanLastName}`;
            
//             // Set the username field
//             usernameInput.value = generatedUsername;
            
//             // Trigger validation if it exists
//             if (typeof validateAndCheckUsername === 'function') {
//                 validateAndCheckUsername();
//             }
//         }
//     }

//     // Function to clean and format name input (remove special characters, keep only letters and spaces)
//     function cleanNameInput(value) {
//         // Remove numbers and special characters, keep only letters and spaces
//         return value.replace(/[^a-zA-Z\s]/g, '');
//     }

//     // Add event listeners to first name and last name inputs
//     if (firstNameInput && lastNameInput && usernameInput) {
        
//         // Make username field read-only to prevent manual editing
//         usernameInput.setAttribute('readonly', true);
//         usernameInput.style.backgroundColor = '#f8f9fa';
//         usernameInput.style.cursor = 'not-allowed';
        
//         // Add a title attribute to explain why it's read-only
//         usernameInput.setAttribute('title', 'Username is automatically generated from your first and last name');
        
//         // Listen for input changes on first name
//         firstNameInput.addEventListener('input', function() {
//             // Clean the input
//             const cleanValue = cleanNameInput(this.value);
//             if (cleanValue !== this.value) {
//                 this.value = cleanValue;
//             }
            
//             // Generate username
//             generateUsername();
//         });

//         // Listen for input changes on last name
//         lastNameInput.addEventListener('input', function() {
//             // Clean the input
//             const cleanValue = cleanNameInput(this.value);
//             if (cleanValue !== this.value) {
//                 this.value = cleanValue;
//             }
            
//             // Generate username
//             generateUsername();
//         });

//         // Also generate on blur events (when user leaves the field)
//         firstNameInput.addEventListener('blur', generateUsername);
//         lastNameInput.addEventListener('blur', generateUsername);
        
//         // Prevent any attempts to manually edit the username field
//         usernameInput.addEventListener('keydown', function(e) {
//             e.preventDefault();
//             return false;
//         });
        
//         usernameInput.addEventListener('paste', function(e) {
//             e.preventDefault();
//             return false;
//         });
        
//         usernameInput.addEventListener('input', function(e) {
//             // If somehow the value was changed, regenerate it
//             generateUsername();
//         });
//     }

//     // Function to manually generate username (can be called from outside)
//     window.generateUsernameFromNames = function() {
//         generateUsername();
//     };

//     // Function to clear username field
//     window.clearGeneratedUsername = function() {
//         if (usernameInput) {
//             usernameInput.value = '';
//         }
//     };
// });
