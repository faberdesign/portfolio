(function () {
  'use strict';

  // ----- Page transition (curtain) -----
  // Inline head script may have set data-curtain="covering" on <html>
  // if we arrived via an internal link. Two requestAnimationFrames flush
  // the layout and the initial-paint frame, then we swap to "revealing"
  // so the CSS opacity transition runs. After the fade completes we
  // strip the attribute so the curtain returns to its idle state.
  const CURTAIN_REVEAL_MS = 450;
  const CURTAIN_EXIT_MS = 600;

  if (document.documentElement.dataset.curtain === 'covering') {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.documentElement.dataset.curtain = 'revealing';
        setTimeout(function () {
          // Move to "hidden" rather than removing the attribute. The
          // hidden state snaps the curtain back off-screen (translateY
          // 100%) at full opacity with transition:none, so it doesn't
          // animate through "fade-to-blue + slide-down" on its way back
          // to the idle position. From here it's ready for the next
          // exit, which sets data-curtain="exiting" and gets a normal
          // 600ms rise transition again.
          document.documentElement.dataset.curtain = 'hidden';
        }, CURTAIN_REVEAL_MS);
      });
    });
  }

  // Intercept same-origin link clicks: raise the curtain, then navigate.
  // Hash links, mailto/tel, external URLs, target=_blank, modifier-keyed
  // clicks, and non-left-button clicks all fall through to default
  // browser behavior. Reduced-motion users also bypass the curtain.
  const prefersReducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!prefersReducedMotion) {
    document.addEventListener('click', function (e) {
      // Only main-button clicks without modifier keys; modifier keys
      // mean the user wants new tab / window / download.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      const link = e.target.closest('a');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href) return;

      if (
        href.charAt(0) === '#' ||
        href.indexOf('mailto:') === 0 ||
        href.indexOf('tel:') === 0 ||
        link.target === '_blank' ||
        link.hasAttribute('download')
      ) {
        return;
      }

      let url;
      try {
        url = new URL(link.href);
      } catch (err) {
        return;
      }

      // External destinations skip the curtain.
      if (url.origin !== window.location.origin) return;

      // Same path — same-page anchor scroll, smooth-scroll-to-top from
      // the logo on index, or any other intra-page link. These never
      // navigate away, so they should never trigger the curtain.
      if (url.pathname === window.location.pathname) {
        return;
      }

      e.preventDefault();

      try {
        sessionStorage.setItem('curtainCovering', 'true');
      } catch (err) { /* private mode etc. — curtain just won't show on next page */ }

      document.documentElement.dataset.curtain = 'exiting';

      setTimeout(function () {
        window.location.href = link.href;
      }, CURTAIN_EXIT_MS);
    });
  }

  // ----- Menu controller (hoisted so logo click + ESC handler can close it) -----
  // The hamburger setup further down attaches its toggle handler; this just
  // defines the state-setter once at the top so any other handler in this
  // IIFE can close the menu without reaching into a nested scope.
  const hamburger = document.querySelector('.nav-hamburger');
  const overlay = document.querySelector('.nav-overlay');
  const firstOverlayLink = overlay ? overlay.querySelector('a') : null;

  function setMenuOpen(isOpen) {
    if (!overlay || !hamburger) return;
    overlay.classList.toggle('is-open', isOpen);
    hamburger.classList.toggle('is-open', isOpen);
    hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    hamburger.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
    document.body.style.overflow = isOpen ? 'hidden' : '';
    if (isOpen && firstOverlayLink) {
      requestAnimationFrame(function () { firstOverlayLink.focus(); });
    }
  }

  // ----- Scroll reveal -----
  // Elements with .reveal start faded + offset and settle in when they
  // enter the viewport. Stagger between siblings is handled in CSS via
  // :nth-child rules, so JS just needs to flip the `is-visible` flag.
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal').forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    // No observer support — show everything immediately.
    document.querySelectorAll('.reveal').forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  // ----- Logo click — close menu if open, then smooth-scroll to top -----
  // On project pages the default navigation to "/" runs; on the index we
  // intercept and smooth-scroll back to the top instead. Either way, if
  // the menu happens to be open we close it first so the click registers
  // visually as well as functionally.
  const navLogo = document.querySelector('.nav-logo');
  if (navLogo) {
    navLogo.addEventListener('click', function (e) {
      if (overlay && overlay.classList.contains('is-open')) {
        setMenuOpen(false);
      }

      const path = window.location.pathname;
      const onRoot = path === '/' || path.endsWith('/index.html');
      if (onRoot) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (window.location.hash) {
          history.replaceState(
            null,
            '',
            window.location.pathname + window.location.search
          );
        }
      }
    });
  }

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
    // Inject the play-triangle SVG child for the video-hover state.
    // stroke-linejoin: round gives the rounded corners; same-color stroke
    // + fill makes the triangle read as a single chunky play button.
    cursor.innerHTML =
      '<svg class="cursor-play" viewBox="0 0 16 18" aria-hidden="true">' +
      '<path d="M2.5 2 L13.5 9 L2.5 16 Z" ' +
      'fill="currentColor" stroke="currentColor" stroke-width="2" ' +
      'stroke-linejoin="round" stroke-linecap="round"/>' +
      '</svg>';
    document.body.appendChild(cursor);

    function surfaceOf(el, y) {
      // The bobblehead is positioned absolute inside .hero but bleeds
      // visually past the hero's bottom edge into the section below.
      // When the cursor is on the illustration but its y position is
      // already below the hero, treat it as the next section instead
      // of inheriting the hero's dark surface.
      if (el && el.classList && el.classList.contains('hero-illustration')) {
        const hero = document.querySelector('.hero');
        if (hero && y >= hero.getBoundingClientRect().bottom) {
          return 'light';
        }
      }

      let node = el;
      while (node && node !== document.body) {
        // Dark surfaces (nav, hero, footer, overlay, .bg-dark case-study sections)
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

    // Click feedback — fires while hovering any interactive surface
    // (either the regular .is-hover state or the video .is-video-hover
    // state). Checking both is important: once a video starts playing,
    // its overlay button gets display: none, which strips .is-hover but
    // leaves .is-video-hover intact. Without the OR, subsequent clicks
    // wouldn't animate.
    document.addEventListener('mousedown', function () {
      if (
        cursor.classList.contains('is-hover') ||
        cursor.classList.contains('is-video-hover')
      ) {
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

    // Video frames swap the center dot for a play-triangle (.is-video-hover)
    // while still growing the ring (.is-hover). Both classes are added
    // together so the existing .is-hover sizing rules continue to apply.
    document.querySelectorAll('.video-frame').forEach(function (frame) {
      frame.addEventListener('mouseenter', function () {
        cursor.classList.add('is-hover', 'is-video-hover');
      });
      frame.addEventListener('mouseleave', function () {
        cursor.classList.remove('is-hover', 'is-video-hover');
      });
    });
  }

  // ----- Video frames: click to play/pause, hide CTA while playing -----
  document.querySelectorAll('.video-frame').forEach(function (frame) {
    const video = frame.querySelector('video');
    if (!video) return;

    frame.addEventListener('click', function () {
      if (video.paused) {
        const playPromise = video.play();
        // play() returns a promise in modern browsers; ignore rejection
        // (e.g., autoplay policy blocking) so the click still feels responsive.
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(function () { /* swallow */ });
        }
        frame.classList.add('is-playing');
      } else {
        video.pause();
        frame.classList.remove('is-playing');
      }
    });
  });

  // ----- Hamburger handlers (state setter is defined at the top) -----
  if (hamburger && overlay) {
    hamburger.addEventListener('click', function () {
      setMenuOpen(!overlay.classList.contains('is-open'));
    });

    document.querySelectorAll('.nav-overlay a').forEach(function (link) {
      link.addEventListener('click', function () {
        setMenuOpen(false);
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) {
        setMenuOpen(false);
        hamburger.focus();
      }
    });
  }

  // ----- Scroll-to-top button -----
  // A 1px sentinel parked at 50vh from the document top. When it scrolls
  // out the top of the viewport, scrollY has exceeded 50vh and we show
  // the button. Replaces a per-frame scroll listener with one IO callback
  // that fires only at the threshold crossing.
  const scrollTopBtn = document.querySelector('.scroll-top');
  if (scrollTopBtn) {
    const sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText =
      'position:absolute;top:50vh;left:0;width:1px;height:1px;pointer-events:none;';
    document.body.appendChild(sentinel);

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        // The sentinel sits at 50vh in document coordinates. It's only
        // ABOVE the viewport when the user has scrolled past 50vh.
        const isAbove =
          !entry.isIntersecting && entry.boundingClientRect.top < 0;
        scrollTopBtn.classList.toggle('visible', isAbove);
      });
    }, { threshold: 0 });
    observer.observe(sentinel);

    scrollTopBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ----- Active section highlight (index only) -----
  // Each section is observed against a thin "active band" near the top of
  // the viewport. When a section's top crosses into the band, IO fires and
  // we recompute which section currently leads. No per-frame scroll listener.
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

    const sectionsById = {};
    sections.forEach(function (s) { sectionsById[s.id] = s; });
    const intersecting = new Set();

    // Threshold for "near the bottom" — within this many px of the page
    // bottom counts as "at the footer", forcing the Contact link active.
    // Wider than 0 because the footer is often shorter than the viewport
    // (its top never crosses the active band's trigger line on this page).
    const NEAR_BOTTOM_PX = 120;

    function isNearBottom() {
      return window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - NEAR_BOTTOM_PX;
    }

    function updateActiveLink() {
      // Near-bottom override runs FIRST and unconditionally — when scrolled
      // close to the page bottom, force the last section (Contact) active
      // even if earlier sections still intersect the active band (About's
      // tall content does, near the page end).
      if (isNearBottom()) {
        const lastSection = sections[sections.length - 1];
        navLinks.forEach(function (l) { l.classList.remove('active'); });
        if (lastSection && linkMap[lastSection.id]) {
          linkMap[lastSection.id].classList.add('active');
        }
        return;
      }

      // Regular: pick the section whose top is closest to (but at or above)
      // the 100px trigger line. If multiple intersect the band, the one
      // with the largest negative-or-near-zero top wins (topmost).
      let activeId = null;
      let bestTop = -Infinity;
      intersecting.forEach(function (id) {
        const el = sectionsById[id];
        if (!el) return;
        const top = el.getBoundingClientRect().top;
        if (top <= 100 && top > bestTop) {
          bestTop = top;
          activeId = id;
        }
      });

      navLinks.forEach(function (l) { l.classList.remove('active'); });
      if (activeId && linkMap[activeId]) {
        linkMap[activeId].classList.add('active');
      }
    }

    const sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) intersecting.add(entry.target.id);
        else intersecting.delete(entry.target.id);
      });
      updateActiveLink();
    }, {
      // Active band: from the 56px-nav line down to the top 25% of the
      // viewport. A section "intersects" while its top is in this band.
      rootMargin: '-56px 0px -75% 0px',
      threshold: 0,
    });

    sections.forEach(function (section) {
      sectionObserver.observe(section);
    });

    // Bottom sentinel: fires updateActiveLink whenever the document's
    // bottom edge enters or leaves the "near-bottom" zone. Necessary
    // because the section observer may not fire at all once the user
    // reaches the footer (on this page About's tall content keeps
    // intersecting the active band until the user is well past it).
    //
    // Natural flow positioning — appended at the end of <body>, after
    // the footer, so it sits at the actual document bottom. Earlier
    // attempts used position:absolute;bottom:0 which (with body's
    // default static positioning) anchors to the initial containing
    // block, not the document end, so the sentinel never fired.
    const bottomSentinel = document.createElement('div');
    bottomSentinel.setAttribute('aria-hidden', 'true');
    bottomSentinel.style.cssText =
      'width:1px;height:1px;pointer-events:none;';
    document.body.appendChild(bottomSentinel);

    const bottomObserver = new IntersectionObserver(function () {
      updateActiveLink();
    }, {
      threshold: 0,
      // Expand the viewport bottom by NEAR_BOTTOM_PX so the sentinel
      // triggers before the user reaches the literal bottom edge.
      rootMargin: '0px 0px ' + NEAR_BOTTOM_PX + 'px 0px',
    });
    bottomObserver.observe(bottomSentinel);

    // Initial pass: handles the case where the page loads scrolled to
    // the bottom (e.g., via /#contact). IO observers fire asynchronously
    // and the section observer may not fire at all if About is the only
    // currently-intersecting section; the explicit call here makes sure
    // the active link is correct from the first frame.
    updateActiveLink();
  }

  // ----- Scroll-velocity marquee -----
  // Vanilla port of the React Bits ScrollVelocity component. Marquee
  // drifts at a base velocity; scroll velocity is smoothed via spring
  // and applied as a multiplier. Direction follows the sign of scroll
  // velocity, so scrolling reverses the marquee.
  //
  // Position is read off window.scrollY each rAF tick (not via a scroll
  // event listener) so the loop drives motion regardless of whether the
  // user scrolls.
  const marqueeTrack = document.querySelector('.marquee-track');
  const reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (marqueeTrack && !reducedMotion) {
    const BASE_VELOCITY = 60;           // px/sec drift at zero scroll
    const SPRING = 0.12;                // velocity smoothing per frame
    const INPUT_RANGE = 1000;           // scroll velocity (px/sec) input...
    const OUTPUT_RANGE = 5;             // ...mapped to this multiplier
    const NUM_COPIES = 6;

    // Clone marquee content up to NUM_COPIES so there's always a buffer
    // of repeated text on both sides — needed for bidirectional looping.
    const existingCopies = marqueeTrack.querySelectorAll('.marquee-content');
    if (existingCopies.length > 0 && existingCopies.length < NUM_COPIES) {
      const template = existingCopies[0];
      for (let i = existingCopies.length; i < NUM_COPIES; i++) {
        marqueeTrack.appendChild(template.cloneNode(true));
      }
    }

    // Direction is locked leftward; scroll velocity (in either sign)
    // only ever speeds the marquee up, never reverses it.
    const DIRECTION = -1;

    let lastScrollY = window.scrollY;
    let lastTime = performance.now();
    let smoothVelocity = 0;
    let baseX = 0;
    let copyWidth = 0;

    function measureCopy() {
      const firstCopy = marqueeTrack.querySelector('.marquee-content');
      copyWidth = firstCopy ? firstCopy.offsetWidth : 0;
    }

    function wrap(min, max, v) {
      const range = max - min;
      if (range <= 0) return min;
      const mod = (((v - min) % range) + range) % range;
      return mod + min;
    }

    measureCopy();
    window.addEventListener('resize', measureCopy);

    // Disable the CSS keyframe so JS owns the transform.
    marqueeTrack.style.animation = 'none';
    marqueeTrack.style.willChange = 'transform';

    function marqueeTick(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const currentScrollY = window.scrollY;
      const rawVelocity = dt > 0 ? (currentScrollY - lastScrollY) / dt : 0;
      lastScrollY = currentScrollY;

      smoothVelocity += (rawVelocity - smoothVelocity) * SPRING;

      let velocityFactor = (smoothVelocity / INPUT_RANGE) * OUTPUT_RANGE;
      velocityFactor = Math.max(-OUTPUT_RANGE, Math.min(OUTPUT_RANGE, velocityFactor));

      // Always-leftward formula: base leftward drift multiplied by
      // (1 + |velocityFactor|), so scrolling in either direction only
      // accelerates the marquee, never reverses it.
      const moveBy = DIRECTION * BASE_VELOCITY * dt * (1 + Math.abs(velocityFactor));

      baseX += moveBy;

      const x = copyWidth > 0 ? wrap(-copyWidth, 0, baseX) : 0;
      marqueeTrack.style.transform = 'translate3d(' + x + 'px, 0, 0)';

      requestAnimationFrame(marqueeTick);
    }

    requestAnimationFrame(marqueeTick);
  }
})();
