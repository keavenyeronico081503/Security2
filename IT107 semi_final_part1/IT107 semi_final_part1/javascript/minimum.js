//backup lang code for minimum character validation

// function validateFname() {
//     const input = document.getElementById("fname");
//     const error = document.getElementById("fnameError");
//     const value = input.value.trim();
//     const min = parseInt(input.getAttribute("minlength"));
//     const max = parseInt(input.getAttribute("maxlength"));
//     const pattern = /^([A-Z][a-zA-Z0-9]*)([\s-][A-Z0-9][a-zA-Z0-9]*)*$/;

//     if (value === "") {
//         error.textContent = "First Name is required.";
//         input.classList.add("input-error");
//         input.classList.remove("input-success");
//     } 
//     else if (value.length < min) {
//         error.textContent = `Minimum ${min} characters required.`;
//         input.classList.add("input-error");
//         input.classList.remove("input-success");
//     } 
//     else if (value.length >= max) {
//         error.textContent = `Maximum ${max} characters reached.`;
//         input.value = value.substring(0, max); // ✨ dili na mosobra
//         input.classList.add("input-error");
//         input.classList.remove("input-success");
//     } 
//     else if (!pattern.test(value)) {
//         error.textContent = "Must start with a capital letter followed by lowercase letters.";
//         input.classList.add("input-error");
//         input.classList.remove("input-success");
//     } 
//     else {
//         error.textContent = "";
//         input.classList.remove("input-error");
//         input.classList.add("input-success");
//     }
// }

// function validateMiddleName() {
//     const input = document.getElementById("middleName");
//     const error = document.getElementById("middleNameError");
//     const value = input.value.trim();
//     const min = parseInt(input.getAttribute("minlength"));
//     const max = parseInt(input.getAttribute("maxlength"));
//     const pattern = /^([A-Z][a-zA-Z0-9]*)([\s-][A-Z0-9][a-zA-Z0-9]*)*$/;

//     if (value === "") {
//         error.textContent = "First Name is required.";
//         input.classList.add("input-error");
//         input.classList.remove("input-success");
//     } 
//     else if (value.length < min) {
//         error.textContent = `Minimum ${min} characters required.`;
//         input.classList.add("input-error");
//         input.classList.remove("input-success");
//     } 
//     else if (value.length >= max) {
//         error.textContent = `Maximum ${max} characters reached.`;
//         input.value = value.substring(0, max); // ✨ dili na mosobra
//         input.classList.add("input-error");
//         input.classList.remove("input-success");
//     } 
//     else if (!pattern.test(value)) {
//         error.textContent = "Must start with a capital letter followed by lowercase letters.";
//         input.classList.add("input-error");
//         input.classList.remove("input-success");
//     } 
//     else {
//         error.textContent = "";
//         input.classList.remove("input-error");
//         input.classList.add("input-success");
//     }
// }

// function validateLastName() {
//     const input = document.getElementById("LastName");
//     const error = document.getElementById("lastNameError");
//     const value = input.value.trim();
//     const min = parseInt(input.getAttribute("minlength"));
//     const max = parseInt(input.getAttribute("maxlength"));
//     const pattern = /^([A-Z][a-zA-Z0-9]*)([\s-][A-Z0-9][a-zA-Z0-9]*)*$/;

//     if (value === "") {
//         error.textContent = "First Name is required.";
//         input.classList.add("input-error");
//         input.classList.remove("input-success");
//     } 
//     else if (value.length < min) {
//         error.textContent = `Minimum ${min} characters required.`;
//         input.classList.add("input-error");
//         input.classList.remove("input-success");
//     } 
//     else if (value.length >= max) {
//         error.textContent = `Maximum ${max} characters reached.`;
//         input.value = value.substring(0, max); // ✨ dili na mosobra
//         input.classList.add("input-error");
//         input.classList.remove("input-success");
//     } 
//     else if (!pattern.test(value)) {
//         error.textContent = "Must start with a capital letter followed by lowercase letters.";
//         input.classList.add("input-error");
//         input.classList.remove("input-success");
//     } 
//     else {
//         error.textContent = "";
//         input.classList.remove("input-error");
//         input.classList.add("input-success");
//     }
// }

