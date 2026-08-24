/**
 * File: js/tvs.js
 * All site custom JS for tvshospitals.com — single source of truth,
 * served via jsDelivr (request tvs.min.js for the minified build).
 *
 * Load order is guaranteed by `defer` in webflow/_footer.html:
 * jQuery, the Webflow runtime and GSAP/ScrollTrigger are emitted by Webflow
 * earlier in the document and are not deferred, so they are ready first; then
 * flatpickr, then lenis, then this file — deferred scripts run in document order.
 * Swiper is not listed there because SmartSwiper loads it on demand.
 *
 * Sections:
 * 1) Legacy attribute helpers (kept as globals — see note)
 * 2) SmartSwiper
 * 3) Flatpickr date fields
 * 4) Lenis smooth scrolling
 * 5) Ad-click signal capture (gcl_aw)  ← conversion-critical, do not reorder
 * 6) Dynamic video loop
 */

/* ============================================================
   1) LEGACY ATTRIBUTE HELPERS

   These were top-level functions in the previous file, which made them
   globals. Nothing in this bundle uses them, but page-level code might,
   so they are still attached to `window` rather than scoped away.
   If a search of the Webflow custom code confirms nothing calls them,
   this whole section can be deleted.
   ============================================================ */
function readStrAttr(el, name, fallback) {
  var v = el.getAttribute(name);
  return v === null || v === "" ? fallback : v;
}

function readBoolAttr(el, name, fallback) {
  var v = el.getAttribute(name);
  if (v === null) return fallback;
  if (v === "" || v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return fallback;
}

var prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

/* ============================================================
   2) SMART SWIPER
   - Auto loads Swiper CSS/JS (v11)
   - Lazy init via IntersectionObserver
   - Repairs on tab clicks + resize
   - Supports optional thumbs slider per config
   - Properly scopes nav + thumbs + pagination within each wrapper

   RESPONSIVE NOTE:
   Swiper breakpoints are MIN-WIDTH (mobile-first) only. Desktop is the
   base config (top-level opts). To make that base behave responsively,
   mobile is pinned at the `0` breakpoint and the desktop values are
   mirrored at the largest breakpoint so they win above the tablet step.
   ============================================================ */
var SmartSwiper = (function () {
  var hasIO = "IntersectionObserver" in window;
  var reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------------------------------------------------------------------
  // CONFIGS — add slider class names here
  // ---------------------------------------------------------------------------
  var CONFIGS = [
    {
      selector: ".review-slider-w .swiper",
      wrapper: ".review-slider-w",
      opts: {
        // ---- DESKTOP = BASE ----
        slidesPerView: 3,
        spaceBetween: 16,
        centeredSlides: true,
        autoplay: { delay: 4000 },
        speed: 735,
        loop: true,
        touchReleaseOnEdges: true,
        simulateTouch: true,
        slidesOffsetAfter: 40,

        // ---- RESPONSIVE STEPS (min-width) ----
        breakpoints: {
          // mobile — pinned at 0 so it overrides the base below 768px
          0: {
            slidesPerView: 1.15,
            spaceBetween: 12,
            slidesOffsetAfter: 24,
          },
          // tablet
          768: {
            slidesPerView: 2,
            spaceBetween: 16,
            slidesOffsetAfter: 32,
          },
          // desktop — mirrors the base so it wins above the 768 step
          1200: {
            slidesPerView: 3,
            spaceBetween: 16,
            slidesOffsetAfter: 40,
          },
        },
      },
      navPrev: ".swiper-prev",
      navNext: ".swiper-next",
    },
  ];

  // ---------------------------------------------------------------------------
  // Utils
  // ---------------------------------------------------------------------------
  function isFn(v) {
    return typeof v === "function";
  }

  function isDisplayed(el) {
    if (!el) return false;
    if (!el.getClientRects || !el.getClientRects().length) return false;
    return true;
  }

  function ensureCSS() {
    if (document.querySelector('link[href*="swiper-bundle.min.css"]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css";
    document.head.appendChild(link);
  }

  function ensureJS(cb) {
    if (window.Swiper) return cb();

    var existing = document.querySelector(
      'script[src*="swiper-bundle.min.js"]'
    );
    if (existing) {
      var wait = function () {
        return window.Swiper ? cb() : setTimeout(wait, 40);
      };
      return wait();
    }

    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js";
    s.defer = true;
    s.onload = cb;
    s.onerror = function () {};
    document.body.appendChild(s);
  }

  function normalizeOpts(base) {
    var o = Object.assign(
      {
        touchReleaseOnEdges: true,
        simulateTouch: true,
        observer: true,
        observeParents: true,
        observeSlideChildren: true,
      },
      base || {}
    );

    if (reduceMotion) {
      if (o.autoplay) o.autoplay = false;
      o.speed = Math.min(o.speed || 400, 300);
    }

    return o;
  }

  function getInstance(el) {
    return el ? el._smartSwiperInstance || el.swiper || null : null;
  }

  function getRoot(mainEl, cfg) {
    return (
      (cfg.wrapper && mainEl.closest(cfg.wrapper)) ||
      mainEl.parentElement ||
      document
    );
  }

  function resolveScopedEl(mainEl, cfg, selector) {
    if (!selector) return null;
    var scope = getRoot(mainEl, cfg);
    return scope.querySelector(selector);
  }

  function resolveNav(el, cfg) {
    var scope = getRoot(el, cfg);

    var prev = cfg.navPrev
      ? scope.querySelector(cfg.navPrev)
      : scope.querySelector(".swiper-prev");

    var next = cfg.navNext
      ? scope.querySelector(cfg.navNext)
      : scope.querySelector(".swiper-next");

    return { scope: scope, prev: prev, next: next };
  }

  function withNav(el, cfg, opts) {
    var nav = resolveNav(el, cfg);
    if (nav.prev || nav.next) {
      opts.navigation = {
        prevEl: nav.prev || null,
        nextEl: nav.next || null,
      };
    }
    return opts;
  }

  function withPagination(el, cfg, opts) {
    if (!cfg.pagination) return opts;

    var paginationEl =
      typeof cfg.pagination.el === "string"
        ? resolveScopedEl(el, cfg, cfg.pagination.el)
        : cfg.pagination.el || null;

    if (!paginationEl) return opts;

    opts.pagination = Object.assign({}, cfg.pagination, { el: paginationEl });
    return opts;
  }

  function readDataOverrides(el, opts) {
    var over = Object.assign({}, opts);
    var dataset = el.dataset;

    if ("swiperLoop" in dataset) {
      over.loop = dataset.swiperLoop === "true";
    }

    if ("swiperSpeed" in dataset) {
      over.speed = Math.max(
        0,
        parseInt(dataset.swiperSpeed, 10) || over.speed || 400
      );
    }

    if ("swiperAutoplay" in dataset) {
      if (dataset.swiperAutoplay === "false") {
        over.autoplay = false;
      } else {
        var delay = Math.max(0, parseInt(dataset.swiperAutoplay, 10) || 0);
        over.autoplay = delay
          ? { delay: delay, disableOnInteraction: true }
          : false;
      }
    }

    return over;
  }

  function bindEdgeNavHiding(el, swiper, prevEl, nextEl) {
    if (!swiper || el.dataset.edgeNavBound) return;
    el.dataset.edgeNavBound = "1";

    var setHidden = function (btn, hidden) {
      if (!btn) return;
      btn.style.opacity = hidden ? "0.2" : "";
    };

    var update = function () {
      var locked = !!swiper.isLocked;
      setHidden(prevEl, locked || !!swiper.isBeginning);
      setHidden(nextEl, locked || !!swiper.isEnd);
    };

    update();

    [
      "slideChange",
      "reachBeginning",
      "reachEnd",
      "fromEdge",
      "resize",
      "update",
      "lock",
      "unlock",
    ].forEach(function (evt) {
      try {
        swiper.on(evt, update);
      } catch (_) {}
    });
  }

  function resolveThumbsEl(mainEl, cfg) {
    if (!cfg.thumbs || !cfg.thumbs.selector) return null;
    return resolveScopedEl(mainEl, cfg, cfg.thumbs.selector);
  }

  function ensureThumbsInit(mainEl, cfg) {
    var thumbsEl = resolveThumbsEl(mainEl, cfg);
    if (!thumbsEl) return null;

    var thumbsSwiper = getInstance(thumbsEl);
    if (thumbsSwiper) return thumbsSwiper;

    var thumbsOpts = normalizeOpts(
      readDataOverrides(thumbsEl, (cfg.thumbs && cfg.thumbs.opts) || {})
    );

    try {
      thumbsSwiper = new Swiper(thumbsEl, thumbsOpts);
      thumbsEl._smartSwiperInstance = thumbsSwiper;
      try {
        thumbsSwiper.update();
        thumbsSwiper.slideTo(0, 0);
      } catch (_) {}
      return thumbsSwiper;
    } catch (_) {
      return null;
    }
  }

  function syncThumbs(mainSwiper, thumbsSwiper) {
    if (!mainSwiper || !thumbsSwiper) return;

    try {
      if (!mainSwiper.thumbs) mainSwiper.thumbs = {};
      mainSwiper.thumbs.swiper = thumbsSwiper;

      if (typeof mainSwiper.thumbs.init === "function") {
        mainSwiper.thumbs.init();
      }
      if (typeof mainSwiper.thumbs.update === "function") {
        mainSwiper.thumbs.update();
      }

      mainSwiper.update();
      thumbsSwiper.update();
    } catch (_) {}
  }

  function repairIfNeeded(el) {
    var cfg = CONFIGS.find(function (c) {
      return el.matches(c.selector);
    });
    if (!cfg) return;

    var inst = getInstance(el);
    if (!inst) return;

    var nav = resolveNav(el, cfg);

    try {
      if (cfg.thumbs) {
        var thumbsEl = resolveThumbsEl(el, cfg);
        var thumbsInst =
          (thumbsEl && getInstance(thumbsEl)) || ensureThumbsInit(el, cfg);

        if (thumbsInst) {
          syncThumbs(inst, thumbsInst);
        }
      }
    } catch (_) {}

    if (isDisplayed(el)) {
      try {
        inst.update();

        if (inst.navigation && typeof inst.navigation.update === "function") {
          inst.navigation.update();
        }

        if (inst.pagination) {
          if (typeof inst.pagination.render === "function") {
            inst.pagination.render();
          }
          if (typeof inst.pagination.update === "function") {
            inst.pagination.update();
          }
        }
      } catch (_) {}
    }

    bindEdgeNavHiding(el, inst, nav.prev, nav.next);
  }

  function initOne(el) {
    if (!el) return;

    var cfg = CONFIGS.find(function (c) {
      return el.matches(c.selector);
    });
    if (!cfg) return;

    var existing = getInstance(el);
    if (existing) {
      repairIfNeeded(el);
      return;
    }

    if (!isDisplayed(el)) return;

    var opts = withPagination(
      el,
      cfg,
      withNav(el, cfg, normalizeOpts(readDataOverrides(el, cfg.opts)))
    );

    var nav = resolveNav(el, cfg);

    var thumbsSwiper = null;
    if (cfg.thumbs) {
      thumbsSwiper = ensureThumbsInit(el, cfg);
      if (thumbsSwiper) {
        opts.thumbs = { swiper: thumbsSwiper };
      }
    }

    el.dataset.swiperInited = "1";

    try {
      var swiper = new Swiper(el, opts);
      el._smartSwiperInstance = swiper;

      bindEdgeNavHiding(el, swiper, nav.prev, nav.next);

      if (thumbsSwiper) {
        syncThumbs(swiper, thumbsSwiper);
      }

      try {
        swiper.update();

        if (swiper.pagination) {
          if (typeof swiper.pagination.render === "function") {
            swiper.pagination.render();
          }
          if (typeof swiper.pagination.update === "function") {
            swiper.pagination.update();
          }
        }

        if (thumbsSwiper) thumbsSwiper.update();
      } catch (_) {}
    } catch (err) {
      delete el.dataset.swiperInited;
      throw err;
    }
  }

  function scan() {
    var sels = CONFIGS.map(function (c) {
      return c.selector;
    }).join(", ");
    if (!sels) return [];
    return Array.from(document.querySelectorAll(sels));
  }

  function observeAndInit(els) {
    if (!els.length) return;

    els.forEach(initOne);

    if (!hasIO) return;

    var io = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            initOne(e.target);
            obs.unobserve(e.target);
          }
        });
      },
      { rootMargin: "200px 0px" }
    );

    els.forEach(function (el) {
      io.observe(el);
    });
  }

  function boot() {
    var els = scan();
    if (!els.length) return;

    ensureCSS();
    ensureJS(function () {
      observeAndInit(els);
    });
  }

  var debounceT;
  function refresh() {
    clearTimeout(debounceT);
    debounceT = setTimeout(function () {
      boot();

      scan().forEach(function (el) {
        try {
          repairIfNeeded(el);
        } catch (_) {}
      });
    }, 100);
  }

  function init() {
    var start = function () {
      boot();

      document.addEventListener(
        "click",
        function (e) {
          var link =
            e.target && e.target.closest
              ? e.target.closest(".w-tab-link")
              : null;

          if (!link) return;

          setTimeout(refresh, 60);
          setTimeout(refresh, 180);
          setTimeout(refresh, 320);
        },
        true
      );

      window.addEventListener("resize", refresh, { passive: true });

      // Public handle. `tvsSwiper` is the name to use going forward;
      // `onyxSwiper` is kept as an alias to the same frozen object so any
      // existing page-level code calling onyxSwiper.refresh() keeps working.
      try {
        var handle = Object.freeze({ refresh: refresh });
        Object.defineProperty(window, "tvsSwiper", {
          value: handle,
          writable: false,
          configurable: false,
        });
        Object.defineProperty(window, "onyxSwiper", {
          value: handle,
          writable: false,
          configurable: false,
        });
      } catch (_) {}
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
  }

  return Object.freeze({ init: init, refresh: refresh });
})();

SmartSwiper.init();

/* ============================================================
   3) FLATPICKR DATE FIELDS
   Binds every [data-datetime] input. Guarded so a blocked or slow
   flatpickr load can't throw and take the sections below with it.
   ============================================================ */
(function () {
  function initFlatpickr() {
    if (typeof flatpickr === "undefined") return; // library missing — fail quiet
    if (!document.querySelector("[data-datetime]")) return;

    flatpickr("[data-datetime]", {
      dateFormat: "Y-m-d",
      disableMobile: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFlatpickr, {
      once: true,
    });
  } else {
    initFlatpickr();
  }
})();

/* ============================================================
   4) LENIS SMOOTH SCROLLING
   `lenis` is exposed on window so other code can scroll through it
   rather than fighting it. GSAP drives the rAF loop when present.
   ============================================================ */
(function () {
  if (typeof Lenis === "undefined") return; // library missing — fail quiet
  if (window.Webflow && window.Webflow.env && window.Webflow.env("editor")) {
    return; // never run inside the Editor
  }
  if (window.lenis) return; // already initialised

  var lenis = new Lenis({
    duration: 1.2,
    easing: function (t) {
      return Math.min(1, 1.001 - Math.pow(2, -10 * t));
    },
    direction: "vertical",
    gestureDirection: "vertical",
    smooth: true,
    mouseMultiplier: 1,
    smoothTouch: false,
    touchMultiplier: 2,
    infinite: false,
  });
  window.lenis = lenis;

  if (typeof ScrollTrigger !== "undefined") {
    lenis.on("scroll", ScrollTrigger.update);
  }

  if (typeof gsap !== "undefined") {
    gsap.ticker.add(function (time) {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
  } else {
    // No GSAP on this page — drive Lenis from its own rAF loop instead.
    var raf = function (time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }
})();

/* ============================================================
   5) AD-CLICK SIGNAL CAPTURE  —  CONVERSION-CRITICAL
   Writes the _gcl_aw cookie into a hidden gcl_aw field on every form
   submission. Empty value = organic, populated = ad-driven.

   The `true` on addEventListener is the load-bearing part: capture phase
   runs BEFORE Webflow serializes the form, so the field is guaranteed to
   be present and current when the lead is sent. Do not change it to
   bubble phase, and do not move this behind DOMContentLoaded — the
   listener is on `document` and must be attached as early as possible.
   ============================================================ */
(function () {
  function getCookie(name) {
    var m = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return m ? decodeURIComponent(m.pop()) : "";
  }

  document.addEventListener(
    "submit",
    function (e) {
      var form = e.target;
      if (!form || form.tagName !== "FORM") return;

      var gclAw = getCookie("_gcl_aw"); // same 90-day signal the conversion gate uses
      var field = form.querySelector('input[name="gcl_aw"]');

      if (!field) {
        field = document.createElement("input");
        field.type = "hidden";
        field.name = "gcl_aw";
        form.appendChild(field);
      }

      field.value = gclAw; // empty = organic, populated = ad-driven
    },
    true // <-- capture phase = the reliability-critical bit
  );
})();

/* ============================================================
   6) DYNAMIC VIDEO LOOP
   For <video class="dynamic-loop"> whose <source> src carries a
   "#t=start,end" fragment: loops back to `start` on reaching `end`.
   Accepts SS, MM:SS or HH:MM:SS in the fragment.
   ============================================================ */
(function () {
  function parseTimeToSeconds(timeStr) {
    var parts = timeStr.split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0];
  }

  function initDynamicLoops() {
    var videos = document.querySelectorAll(".dynamic-loop");

    videos.forEach(function (video) {
      if (video.dataset.loopBound) return; // idempotent
      var source = video.querySelector("source");
      if (!source) return;

      var urlMatch = source.src.match(/#t=([\d.:]+),([\d.:]+)/);
      if (!urlMatch) return;

      var startTime = parseTimeToSeconds(urlMatch[1]);
      var endTime = parseTimeToSeconds(urlMatch[2]);

      video.dataset.loopBound = "1";

      video.addEventListener("timeupdate", function () {
        if (video.currentTime >= endTime) {
          video.currentTime = startTime;
          video.play().catch(function () {}); // safely catch autoplay blocks
        }
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDynamicLoops, {
      once: true,
    });
  } else {
    initDynamicLoops();
  }
})();
