(function () {
  'use strict';

  // ----- Hamburger toggle (animates into X, also doubles as close) -----
  const hamburger = document.querySelector('.nav-hamburger');
  const overlay = document.querySelector('.nav-overlay');

  if (hamburger && overlay) {
    hamburger.addEventListener('click', function () {
      const isOpen = overlay.classList.toggle('is-open');
      hamburger.classList.toggle('is-open', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    document.querySelectorAll('.nav-overlay a').forEach(function (link) {
      link.addEventListener('click', function () {
        overlay.classList.remove('is-open');
        hamburger.classList.remove('is-open');
        document.body.style.overflow = '';
      });
    });
  }

  // ----- Scroll-to-top button -----
  const scrollTopBtn = document.querySelector('.scroll-top');
  if (scrollTopBtn) {
    function toggleScrollTop() {
      if (window.scrollY > window.innerHeight * 0.5) {
        scrollTopBtn.classList.add('visible');
      } else {
        scrollTopBtn.classList.remove('visible');
      }
    }
    window.addEventListener('scroll', toggleScrollTop, { passive: true });
    toggleScrollTop();

    scrollTopBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ----- Active section observer (index only) -----
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-overlay-links a[href*="#"]');

  if (sections.length && navLinks.length && 'IntersectionObserver' in window) {
    const linkMap = {};
    navLinks.forEach(function (link) {
      const href = link.getAttribute('href') || '';
      const hashIndex = href.indexOf('#');
      if (hashIndex !== -1) {
        const id = href.slice(hashIndex + 1);
        if (id) linkMap[id] = link;
      }
    });

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        const id = entry.target.id;
        const link = linkMap[id];
        if (!link) return;
        if (entry.isIntersecting) {
          navLinks.forEach(function (l) { l.classList.remove('active'); });
          link.classList.add('active');
        }
      });
    }, { threshold: 0.4 });

    sections.forEach(function (s) { observer.observe(s); });
  }
})();
