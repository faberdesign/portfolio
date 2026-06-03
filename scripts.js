(function () {
  'use strict';

  // ----- Page transition (asymmetric lift) -----
  // Inline head script may have set data-page-fade="covering" on <html>
  // if we arrived via an internal link. Two requestAnimationFrames flush
  // the layout and the initial-paint frame, then we swap to "revealing"
  // so the CSS settle-in transition runs. After the enter completes we
  // strip the attribute so the body returns to its idle state.
  //
  // Asymmetric timings: exit is brisk (the user already committed by
  // clicking), enter is longer with a stronger deceleration so the
  // new page arrives with weight. CSS owns the durations; JS just
  // matches them for the navigation/teardown timeouts.
  const PAGE_EXIT_MS = 160;
  const PAGE_ENTER_MS = 320;

  if (document.documentElement.dataset.pageFade === 'covering') {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.documentElement.dataset.pageFade = 'revealing';
        setTimeout(function () {
          delete document.documentElement.dataset.pageFade;
        }, PAGE_ENTER_MS);
      });
    });
  }

  // ----- Touch tap feedback -----
  // Hover styles are gated behind @media (hover: hover), so touch users
  // get no orange/lift response from CSS hover. :active fires only while
  // the finger is physically pressed, which is too brief on a quick tap.
  // This adds `.is-tapped` to the nearest interactive element on
  // touchstart and removes it after TAP_FLASH_MS, holding the
  // hover-equivalent treatment long enough to be clearly seen.
  // Cancelled on touchmove (so a scroll swipe doesn't leave a stale
  // highlight) and on touchcancel.
  const tappableSelector = [
    '.work-card', '.work-feature', '.cv-item', '.video-frame',
    '.proto-link', '.hero-cta', '.scroll-top', '.nav-logo',
    '.nav-hamburger', '.nav-overlay-links a', '.footer-contact-link',
    '.back-link', '.impressum-section a', '.footer-bottom-link',
  ].join(', ');
  const TAP_FLASH_MS = 200;
  const TAP_MOVE_CANCEL_PX = 10;

  let tappedEl = null;
  let tapTimer = null;
  let tapStartX = 0;
  let tapStartY = 0;

  function clearTapped() {
    if (tappedEl) {
      tappedEl.classList.remove('is-tapped');
      tappedEl = null;
    }
    if (tapTimer) {
      clearTimeout(tapTimer);
      tapTimer = null;
    }
  }

  document.addEventListener('touchstart', function (e) {
    const el = e.target.closest(tappableSelector);
    if (!el) return;
    // Any previous flash from a rapid double-tap is dropped immediately
    // so we don't leave a stale highlight on the prior element.
    if (tappedEl && tappedEl !== el) {
      tappedEl.classList.remove('is-tapped');
    }
    if (tapTimer) clearTimeout(tapTimer);
    tappedEl = el;
    const t = e.touches[0];
    tapStartX = t.clientX;
    tapStartY = t.clientY;
    el.classList.add('is-tapped');
    tapTimer = setTimeout(function () {
      if (tappedEl) tappedEl.classList.remove('is-tapped');
      tappedEl = null;
      tapTimer = null;
    }, TAP_FLASH_MS);
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    if (!tappedEl) return;
    const t = e.touches[0];
    if (
      Math.abs(t.clientX - tapStartX) > TAP_MOVE_CANCEL_PX ||
      Math.abs(t.clientY - tapStartY) > TAP_MOVE_CANCEL_PX
    ) {
      clearTapped();
    }
  }, { passive: true });

  document.addEventListener('touchcancel', clearTapped, { passive: true });

  // When a page is restored from the bfcache (back/forward navigation),
  // its DOM state is frozen exactly as we left it — including
  // data-page-fade="exiting" set right before we navigated away.
  // Without this reset, the restored page would appear faded out.
  // Also clear the sessionStorage flag so a follow-up fresh-load
  // doesn't try to play a phantom fade-in.
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      delete document.documentElement.dataset.pageFade;
      try { sessionStorage.removeItem('pageFadeIn'); } catch (err) { /* ignore */ }
    }
  });

  // Intercept same-origin link clicks: fade the body out, then navigate.
  // Hash links, mailto/tel, external URLs, target=_blank, modifier-keyed
  // clicks, and non-left-button clicks all fall through to default
  // browser behavior. Reduced-motion users also bypass the fade.
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

      // External destinations skip the fade.
      if (url.origin !== window.location.origin) return;

      // Same path — same-page anchor scroll, smooth-scroll-to-top from
      // the logo on index, or any other intra-page link. These never
      // navigate away, so they should never trigger the fade.
      if (url.pathname === window.location.pathname) {
        return;
      }

      e.preventDefault();

      try {
        sessionStorage.setItem('pageFadeIn', 'true');
      } catch (err) { /* private mode etc. — fade-in just won't show on next page */ }

      document.documentElement.dataset.pageFade = 'exiting';

      setTimeout(function () {
        window.location.href = link.href;
      }, PAGE_EXIT_MS);
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
  // For each frame the user is scrolling, pick the section whose top is
  // closest to (but at or above) the 100px trigger line and mark its nav
  // link active.
  //
  // Earlier this was IntersectionObserver-based — IO fired only when a
  // section entered or left a thin "active band," then we read its top
  // from inside the callback. That broke for sections taller than the
  // band (.work has four cards stacked vertically): once the section
  // started intersecting, the observer didn't fire again as the top
  // slid down past 100px, so Work never got highlighted until About
  // finally entered the band hundreds of pixels later. A scroll listener
  // catches every frame, so the active link tracks the section the user
  // is actually reading.
  //
  // The work it does each frame is cheap: a getBoundingClientRect() per
  // section (three on this page) and a couple of classList operations.
  // rAF throttling keeps it to at most one run per paint.
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

    // The trigger line: a section becomes "active" when its top crosses
    // above this many px from the viewport top. 100px clears the 56px nav
    // with a little breathing room so the highlight feels anchored to the
    // content under the nav, not pinned to the nav line itself.
    const ACTIVE_TRIGGER_PX = 100;

    // "Near the bottom" override — within this many px of the page
    // bottom forces the last section (Contact) active even if earlier
    // sections technically still own the trigger line. Necessary because
    // the footer can be shorter than the band, so its own top never
    // crosses the 100px line on tall viewports.
    const NEAR_BOTTOM_PX = 120;

    function isNearBottom() {
      return window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - NEAR_BOTTOM_PX;
    }

    function updateActiveLink() {
      if (isNearBottom()) {
        const lastSection = sections[sections.length - 1];
        navLinks.forEach(function (l) { l.classList.remove('active'); });
        if (lastSection && linkMap[lastSection.id]) {
          linkMap[lastSection.id].classList.add('active');
        }
        return;
      }

      // Pick the section whose top is closest to (but at or above) the
      // trigger line. Iterating every section each call — between scroll
      // frames a section's top can slide past the line without any
      // observer-style notification (sections taller than the trigger
      // band remain "in view" the whole time).
      let activeId = null;
      let bestTop = -Infinity;
      sections.forEach(function (section) {
        const top = section.getBoundingClientRect().top;
        if (top <= ACTIVE_TRIGGER_PX && top > bestTop) {
          bestTop = top;
          activeId = section.id;
        }
      });

      navLinks.forEach(function (l) { l.classList.remove('active'); });
      if (activeId && linkMap[activeId]) {
        linkMap[activeId].classList.add('active');
      }
    }

    // rAF-throttled scroll handler. At most one updateActiveLink per
    // paint. Resize uses the same path so the active link stays correct
    // if the viewport or content reflows.
    let activeLinkTicking = false;
    function scheduleActiveLinkUpdate() {
      if (activeLinkTicking) return;
      activeLinkTicking = true;
      requestAnimationFrame(function () {
        updateActiveLink();
        activeLinkTicking = false;
      });
    }
    window.addEventListener('scroll', scheduleActiveLinkUpdate, { passive: true });
    window.addEventListener('resize', scheduleActiveLinkUpdate, { passive: true });

    // Initial pass — handles direct loads (e.g., /#about) and the very
    // first paint before the user has scrolled.
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

    // JS owns the transform from here on; hint the compositor.
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
