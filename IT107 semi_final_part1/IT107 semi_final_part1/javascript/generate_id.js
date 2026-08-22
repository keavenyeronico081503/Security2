window.onload = function () {
    fetch("../php/generate_id.php")
        .then(response => response.text())
        .then(data => {
            document.getElementById("idNumber").value = data;
        });
}