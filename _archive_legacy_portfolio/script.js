
// Menu toggle
const menuIcon = document.getElementById('menu-icon');
const navbar = document.getElementById('navbar');
const navLinks = navbar.querySelectorAll('a');

menuIcon.addEventListener('click', () => {
    navbar.classList.toggle('show');
});

navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navbar.classList.remove('show');
    });
});

// Scroll Reveal
ScrollReveal({
    distance: "80px",
    duration: 2000,
    delay: 200,
})

ScrollReveal().reveal('.home-content, heading', {origin: 'top'});
ScrollReveal().reveal('.home-img, .services-container, .portfolio-box, .contact-form',  {origin: 'top'});
ScrollReveal().reveal('.home-content h1, .about-img', {origin: 'left'});
ScrollReveal().reveal('.home-content p, .about-content', {origin: 'right'});

// Typed JS
const typed = new Typed('.multiple-text', {
    strings: ['Web Developer', 'Youtuber'],
    typeSpeed: 70,
    backSpeed: 70,
    backDelay: 1000,
    loop: true,
});
