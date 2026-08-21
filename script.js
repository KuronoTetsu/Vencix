/* ==== Script for Vencix Landing Page ==== */
document.addEventListener('DOMContentLoaded', () => {
    const header = document.getElementById('header');
    const navToggle = document.getElementById('nav-toggle');
    const nav = document.querySelector('.nav');
    const ctaHeader = document.getElementById('cta-header');
    const yearSpan = document.getElementById('year');
    const floatWs = document.querySelector('.float-ws');

    // ---- Year in footer ----
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // ---- Header scroll effect ----
    let lastScrollY = window.scrollY;
    const updateHeader = () => {
        const scrollY = window.pageYOffset;
        if (scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        lastScrollY = scrollY;
    };
    window.addEventListener('scroll', updateHeader);
    updateHeader(); // initial state

    // ---- Mobile menu toggle ----
    navToggle.addEventListener('click', () => {
        const isOpen = navToggle.classList.toggle('open');
        nav.classList.toggle('open', isOpen);
        // Update ARIA attributes
        navToggle.setAttribute('aria-expanded', isOpen);
        nav.setAttribute('aria-hidden', !isOpen);
    });

    // Close mobile menu when clicking a link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            if (nav.classList.contains('open')) {
                navToggle.click();
            }
        });
    });

    // ---- Smooth scroll for internal links (already via CSS, but ensure focus) ----
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', e => {
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
                // Close mobile if open
                if (nav.classList.contains('open')) navToggle.click();
            }
        });
    });

    // ---- Accordion functionality ----
    document.querySelectorAll('.accordion-header').forEach(btn => {
        btn.addEventListener('click', () => {
            const expanded = btn.getAttribute('aria-expanded') === 'true' || false;
            btn.setAttribute('aria-expanded', !expanded);
            const body = btn.nextElementSibling;
            if (body && body.classList.contains('accordion-body')) {
                if (!expanded) {
                    body.removeAttribute('hidden');
                    body.style.maxHeight = body.scrollHeight + 'px';
                } else {
                    body.style.maxHeight = '0';
                    // Wait for transition then hide
                    setTimeout(() => body.setAttribute('hidden', ''), 300);
                }
            }
        });
    });

    // ---- IntersectionObserver for fade-in animations ----
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Elements to animate
    const animateEls = document.querySelectorAll(
        '.hero-text, .hero-img, .problem .cards > *, .feature, .step, .benefits-text, .benefits-img, ' +
        '.forwhom .card, .result, .plan, .testimonial, .accordion-item, .cta-inner'
    );
    animateEls.forEach(el => {
        el.classList.add('fade-in-base');
        observer.observe(el);
    });

    // ---- WhatsApp float button pulsate effect (CSS handles) ----
    // Ensure click opens in new tab (already set via target="_blank")
    // Add ARIA label if missing
    if (floatWs && !floatWs.getAttribute('aria-label')) {
        floatWs.setAttribute('aria-label', 'Fale conosco no WhatsApp');
    }

    // ---- Focus visible polyfill (optional) ----
    // Add class for custom focus styles if needed
    document.addEventListener('keydown', e => {
        if (e.key === 'Tab') {
            document.body.classList.add('user-is-tabbing');
        }
    });
    document.addEventListener('mousedown', () => {
        document.body.classList.remove('user-is-tabbing');
    });
});

// ---- Optional: Add CSS for animation classes (could be in CSS, but add here to avoid edit) ----
const style = document.createElement('style');
style.textContent = `
.fade-in-base {
    opacity: 0;
    transform: translateY(20px);
    transition: opacity .6s ease, transform .6s ease;
}
.animate-in {
    opacity: 1 !important;
    transform: translateY(0) !important;
}
/* Focus visible */
.user-is-tabbing button:focus,
.user-is-tabbing a:focus,
.user-is-tabbing [tabindex]:focus {
    outline: 2px solid var(--color-emerald);
    outline-offset: 2px;
}
`;
document.head.appendChild(style);
