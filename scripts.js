(function () {
  'use strict';

  // ----- Deferred-hash scroll -----
  // Set in the inline <head> script on index.html when the page is
  // loaded with a hash (e.g. coming from a project page's "Work" link).
  // The hash is stripped from the URL early so the browser doesn't
  // auto-jump; we now smooth-scroll to the section after a brief pause
  // so the user sees the top of the page first.
  if (window.__deferredHash) {
    const hash = window.__deferredHash;
    delete window.__deferredHash;
    const target = document.querySelector(hash);
    if (target) {
      window.scrollTo(0, 0);
      setTimeout(function () {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search + hash
        );
      }, 500);
    }
  }

  // ----- Custom cursor (surface-aware solid circle) -----
  // Color flips by what's underneath:
  //   • Orange hero  → white cursor
  //   • Dark surfaces (nav, footer, .bg-dark sections, overlay)
  //                  → orange cursor
  //   • Everything else (white / cream / off-white)
  //                  → dark-blue cursor (default)
  // Only on devices with a precise pointer; skipped on touch.
  if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
    const cursor = document.createElement('div');
    cursor.className = 'cursor';
    document.body.appendChild(cursor);

    function surfaceOf(el, y) {
      // The bobblehead is positioned absolute inside .hero but bleeds
      // visually past the hero's bottom edge into the section below.
      // When the cursor is on the illustration but its y position is
      // already below the hero, treat it as the next section instead
      // of inheriting the hero's orange surface.
      if (el && el.classList && el.classList.contains('hero-illustration')) {
        const hero = document.querySelector('.hero');
        if (hero && y >= hero.getBoundingClientRect().bottom) {
          return 'light';
        }
      }

      let node = el;
      while (node && node !== document.body) {
        // Dark surfaces (hero, nav, footer, overlay, .bg-dark sections)
        if (
          node.tagName === 'NAV' ||
          node.classList.contains('footer') ||
          node.classList.contains('nav-overlay') ||
          (node.tagName === 'HEADER' && node.classList.contains('hero')) ||
          (node.classList.contains('cs-section') &&
            node.classList.contains('bg-dark'))
        ) {
          return 'dark';
        }
        node = node.parentElement;
      }
      return 'light';
    }

    function setSurface(name) {
      cursor.classList.remove('surface-orange', 'surface-dark');
      if (name === 'orange') cursor.classList.add('surface-orange');
      else if (name === 'dark') cursor.classList.add('surface-dark');
    }

    document.addEventListener('mousemove', function (e) {
      cursor.style.transform =
        'translate(' + (e.clientX - 16) + 'px, ' + (e.clientY - 16) + 'px)';

      const under = document.elementFromPoint(e.clientX, e.clientY);
      setSurface(surfaceOf(under, e.clientY));

      if (!cursor.classList.contains('is-active')) {
        cursor.classList.add('is-active');
      }
    });

    document.addEventListener('mouseleave', function () {
      cursor.classList.remove('is-active');
    });

    document.addEventListener('mouseenter', function () {
      cursor.classList.add('is-active');
    });

    // Click feedback — only when pressing while hovering an interactive
    // element (i.e. .is-hover is already on the cursor). Shrinks back to
    // the non-hover size while keeping the ring + dot visible.
    document.addEventListener('mousedown', function () {
      if (cursor.classList.contains('is-hover')) {
        cursor.classList.add('is-click');
      }
    });

    document.addEventListener('mouseup', function () {
      cursor.classList.remove('is-click');
    });

    // Grow over interactive elements
    const interactiveSelector =
      'a, button, [role="button"], .work-card, .work-feature';
    document.querySelectorAll(interactiveSelector).forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        cursor.classList.add('is-hover');
      });
      el.addEventListener('mouseleave', function () {
        cursor.classList.remove('is-hover');
      });
    });
  }

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

  // ----- Active section highlight (index only) -----
  // Scroll-position based: the section whose top has just passed the
  // trigger line (100px below viewport top — clear of the 56px fixed nav)
  // wins. Iterating in document order means the latest section scrolled
  // past becomes the active one.
  const sections = document.querySelectorAll('section[id], footer[id]');
  const navLinks = document.querySelectorAll('.nav-overlay-links a[href*="#"]');

  if (sections.length && navLinks.length) {
    const linkMap = {};
    navLinks.forEach(function (link) {
      const href = link.getAttribute('href') || '';
      const hashIndex = href.indexOf('#');
      if (hashIndex !== -1) {
        const id = href.slice(hashIndex + 1);
        if (id) linkMap[id] = link;
      }
    });

    function updateActiveSection() {
      let activeId = null;

      // If the page has bottomed out, force the last section (the footer
      // can't always be scrolled high enough to cross the trigger line).
      const nearBottom = window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 10;

      if (nearBottom) {
        activeId = sections[sections.length - 1].id;
      } else {
        sections.forEach(function (section) {
          if (section.getBoundingClientRect().top <= 100) {
            activeId = section.id;
          }
        });
      }

      navLinks.forEach(function (l) { l.classList.remove('active'); });
      if (activeId && linkMap[activeId]) {
        linkMap[activeId].classList.add('active');
      }
    }

    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);
    updateActiveSection();
  }
})();
