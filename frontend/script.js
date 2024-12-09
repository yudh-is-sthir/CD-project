document.getElementById("translate-btn").addEventListener("click", async () => {
    const jsCode = document.getElementById("js-code").value;

    if (!jsCode.trim()) {
        alert("Please enter valid JavaScript code.");
        return;
    }

    try {
        const response = await fetch("http://localhost:5000/translate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ code: jsCode }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to generate SIL and Python code.");
        }

        const { sil, python, cpp } = await response.json();

        // Update the output sections
        document.getElementById("sil-code").innerText = sil;
        document.getElementById("python-code").innerText = python;
        document.getElementById("cpp-code").innerText = cpp;
    } catch (error) {
        alert("An error occurred: " + error.message);
        console.error(error);
    }
});
