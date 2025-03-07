const API_URL = "https://loan-web-app-orcin.vercel.app"; // No extra "/api/server"

fetch(`${API_URL}/api/data`)
  .then(res => res.json())
  .then(data => console.log(data))
  .catch(error => console.error("Error fetching data:", error));



function toggleMenu() {
    const navLinks = document.getElementById('navLinks');
    const hamburger = document.getElementById('hamburger');
    navLinks.classList.toggle('active'); 
    hamburger.classList.toggle('active');  

    if (navLinks.classList.contains('active')) {
        const links = navLinks.querySelectorAll('a');
        links.forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                hamburger.classList.remove('active');  
            });
        });
        window.addEventListener('scroll', closeMenuOnScroll);
    } else {
        window.removeEventListener('scroll', closeMenuOnScroll);
    }
}

function toggleAnswer(element) {
    let answer = element.nextElementSibling;
    answer.style.display = (answer.style.display === "block") ? "none" : "block";
}

document.getElementById("chatButton").onclick = function() {
    window.location.href = "assistant.html";
  };