document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('eligibility-form');
    const resultDiv = document.getElementById('result');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Form submitted'); // Debug

        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        console.log('Sending data:', data); // Debug

        try {
            const response = await fetch('/check_eligibility', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            console.log('Response status:', response.status); // Debug

            const result = await response.json();
            console.log('Response data:', result); // Debug

            if (result.error) {
                resultDiv.textContent = `Error: ${result.error}`;
                resultDiv.style.background = '#f44336';
            } else {
                resultDiv.textContent = `Home Loan Eligibility: ${result.eligibility}`;
                resultDiv.style.background = result.eligibility === 'Eligible' ? '#1faeaa' : '#f44336';
            }
            resultDiv.style.display = 'block';
        } catch (error) {
            console.error('Fetch error:', error);
            resultDiv.textContent = 'Error connecting to server.';
            resultDiv.style.background = '#f44336';
            resultDiv.style.display = 'block';
        }
    });
});