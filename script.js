if (window.gsap && window.CustomEase) {
  gsap.registerPlugin(CustomEase);
  CustomEase.create("hero-wipe", "0.625, 0.05, 0, 1");
}

if (window.gsap && window.SplitText) {
  gsap.registerPlugin(SplitText);
}

if (window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
}

let lenisInstance = null;
let lenisRafCallback = null;

function initLenisSmoothScroll() {
  if (!window.Lenis || !window.gsap || !window.ScrollTrigger) return;

  const desktopQuery = window.matchMedia("(min-width: 768px)");
  const reducedMotionQuery = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );

  function shouldUseLenis() {
    return desktopQuery.matches && !reducedMotionQuery.matches;
  }

  function createLenis() {
    if (lenisInstance) return;

    lenisInstance = new Lenis({
      anchors: true,
    });

    lenisInstance.on("scroll", ScrollTrigger.update);

    lenisRafCallback = (time) => {
      if (lenisInstance) {
        lenisInstance.raf(time * 1000);
      }
    };

    gsap.ticker.add(lenisRafCallback);
    gsap.ticker.lagSmoothing(0);

    window.lenis = lenisInstance;
    ScrollTrigger.refresh();
  }

  function destroyLenis() {
    if (!lenisInstance) return;

    if (lenisRafCallback) {
      gsap.ticker.remove(lenisRafCallback);
      lenisRafCallback = null;
    }

    lenisInstance.destroy();
    lenisInstance = null;
    window.lenis = null;

    document.documentElement.classList.remove("lenis");
    document.documentElement.classList.remove("lenis-smooth");
    document.documentElement.classList.remove("lenis-scrolling");
    document.documentElement.classList.remove("lenis-stopped");

    ScrollTrigger.refresh();
  }

  function syncLenisState() {
    if (shouldUseLenis()) {
      createLenis();
    } else {
      destroyLenis();
    }
  }

  syncLenisState();

  if (desktopQuery.addEventListener) {
    desktopQuery.addEventListener("change", syncLenisState);
    reducedMotionQuery.addEventListener("change", syncLenisState);
  } else {
    desktopQuery.addListener(syncLenisState);
    reducedMotionQuery.addListener(syncLenisState);
  }
}

function initHeroLoadingAnimation() {
  const container = document.querySelector(".hero-showcase");

  if (!container || !window.gsap) return;

  const heading = container.querySelectorAll(".hero-showcase__heading");
  const revealImages = container.querySelectorAll(".intro-reveal__group > *");
  const isScaleUp = container.querySelectorAll(".intro-reveal__media");
  const isScaleDown = container.querySelectorAll(
    ".intro-reveal__media .is-shrunk",
  );
  const smallElements = document.querySelectorAll(
    ".site-header, .hero-showcase__info",
  );
  const sliderNav = container.querySelectorAll(".hero-showcase__nav > *");

  gsap.set(smallElements, {
    opacity: 0,
  });

  const tl = gsap.timeline({
    defaults: {
      ease: "expo.inOut",
    },
    onStart: () => {
      container.classList.remove("is-hidden");
    },
  });

  let split;

  if (heading.length && window.SplitText) {
    split = new SplitText(heading, {
      type: "words",
      mask: "words",
      wordsClass: "hero-showcase__word",
    });

    gsap.set(split.words, {
      yPercent: 150,
    });
  }

  if (revealImages.length) {
    tl.fromTo(
      revealImages,
      {
        xPercent: 500,
      },
      {
        xPercent: -500,
        duration: 2.5,
        stagger: 0.05,
      },
    );
  }

  if (isScaleDown.length) {
    tl.to(
      isScaleDown,
      {
        scale: 0.5,
        duration: 2,
        stagger: {
          each: 0.05,
          from: "edges",
          ease: "none",
        },
      },
      "-=0.1",
    );
  }

  if (isScaleUp.length) {
    tl.fromTo(
      isScaleUp,
      {
        width: "10em",
        height: "10em",
      },
      {
        width: "100vw",
        height: "100vh",
        duration: 2,
      },
      "< 0.5",
    );
  }

  if (sliderNav.length) {
    tl.from(
      sliderNav,
      {
        yPercent: 150,
        stagger: 0.05,
        ease: "expo.out",
        duration: 1,
      },
      "-=0.9",
    );
  }

  if (split && split.words.length) {
    tl.to(
      split.words,
      {
        yPercent: 0,
        stagger: 0.075,
        ease: "expo.out",
        duration: 1,
      },
      "< 0.1",
    );
  }

  if (smallElements.length) {
    tl.to(
      smallElements,
      {
        opacity: 1,
        ease: "power1.inOut",
        duration: 0.2,
      },
      "< 0.15",
    );
  }

  tl.call(
    function () {
      container.classList.remove("is-loading");
      window.dispatchEvent(new CustomEvent("heroIntroComplete"));
    },
    null,
    "+=0.45",
  );
}

function initHeroSlideshow(el) {
  if (!el || !window.gsap) return;

  const ui = {
    el,
    slides: Array.from(el.querySelectorAll('[data-slideshow="slide"]')),
    inner: Array.from(el.querySelectorAll('[data-slideshow="parallax"]')),
    thumbs: Array.from(el.querySelectorAll('[data-slideshow="thumb"]')),
    nav: el.querySelector(".hero-showcase__nav"),
  };

  if (!ui.slides.length || !ui.inner.length || !ui.thumbs.length) return;

  let current = 0;
  const length = ui.slides.length;
  let animating = false;
  let autoplayTimer = null;
  let autoplayReady = false;
  let autoplayPaused = false;

  const animationDuration = 1.5;
  const wipeEase = window.CustomEase ? "hero-wipe" : "power2.inOut";
  const desktopQuery = window.matchMedia("(min-width: 768px)");
  const reducedMotionQuery = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );

  const firstAutoplayDelay = 3500;
  const autoplayDelay = 6500;
  const autoplayDelayAfterInteraction = 9000;

  function canAutoplay() {
    return (
      length > 1 &&
      !reducedMotionQuery.matches &&
      !document.hidden &&
      !autoplayPaused
    );
  }

  function clearAutoplayTimer() {
    if (!autoplayTimer) return;

    window.clearTimeout(autoplayTimer);
    autoplayTimer = null;
  }

  function scheduleAutoplay(delay = autoplayDelay) {
    clearAutoplayTimer();

    if (!autoplayReady || !canAutoplay()) return;

    autoplayTimer = window.setTimeout(() => {
      if (!canAutoplay()) return;

      navigate(1);
      scheduleAutoplay(autoplayDelay);
    }, delay);
  }

  function pauseAutoplay() {
    autoplayPaused = true;
    clearAutoplayTimer();
  }

  function resumeAutoplay(delay = autoplayDelayAfterInteraction) {
    autoplayPaused = false;
    scheduleAutoplay(delay);
  }

  function startAutoplay() {
    autoplayReady = true;
    scheduleAutoplay(firstAutoplayDelay);
  }

  ui.slides.forEach((slide, index) => {
    slide.setAttribute("data-index", index);
  });

  ui.thumbs.forEach((thumb, index) => {
    thumb.setAttribute("data-index", index);
  });

  ui.slides[current].classList.add("is-active");
  ui.thumbs[current].classList.add("is-active");

  function navigate(direction, targetIndex = null) {
    if (animating) return;

    animating = true;

    const previous = current;

    current =
      targetIndex !== null && targetIndex !== undefined
        ? targetIndex
        : direction === 1
          ? current < length - 1
            ? current + 1
            : 0
          : current > 0
            ? current - 1
            : length - 1;

    const currentSlide = ui.slides[previous];
    const currentInner = ui.inner[previous];
    const upcomingSlide = ui.slides[current];
    const upcomingInner = ui.inner[current];

    gsap
      .timeline({
        defaults: {
          duration: animationDuration,
          ease: wipeEase,
        },
        onStart() {
          upcomingSlide.classList.add("is-active");
          ui.thumbs[previous].classList.remove("is-active");
          ui.thumbs[current].classList.add("is-active");
        },
        onComplete() {
          currentSlide.classList.remove("is-active");
          animating = false;
        },
      })
      .to(currentSlide, { xPercent: -direction * 100 }, 0)
      .to(currentInner, { xPercent: direction * 75 }, 0)
      .fromTo(upcomingSlide, { xPercent: direction * 100 }, { xPercent: 0 }, 0)
      .fromTo(upcomingInner, { xPercent: -direction * 75 }, { xPercent: 0 }, 0);
  }

  ui.thumbs.forEach((thumb) => {
    thumb.addEventListener("click", (event) => {
      const targetIndex = parseInt(
        event.currentTarget.getAttribute("data-index"),
        10,
      );

      if (targetIndex === current || animating) return;

      const direction = targetIndex > current ? 1 : -1;

      navigate(direction, targetIndex);
      scheduleAutoplay(autoplayDelayAfterInteraction);
    });

    thumb.addEventListener("focusin", pauseAutoplay);
    thumb.addEventListener("focusout", () => resumeAutoplay());
  });

  if (ui.nav) {
    ui.nav.addEventListener("mouseenter", pauseAutoplay);
    ui.nav.addEventListener("mouseleave", () => resumeAutoplay());
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearAutoplayTimer();
    } else {
      scheduleAutoplay(autoplayDelayAfterInteraction);
    }
  });

  function syncAutoplayState() {
    if (canAutoplay()) {
      scheduleAutoplay(autoplayDelayAfterInteraction);
    } else {
      clearAutoplayTimer();
    }
  }

  if (desktopQuery.addEventListener) {
    desktopQuery.addEventListener("change", syncAutoplayState);
    reducedMotionQuery.addEventListener("change", syncAutoplayState);
  } else {
    desktopQuery.addListener(syncAutoplayState);
    reducedMotionQuery.addListener(syncAutoplayState);
  }

  window.addEventListener("heroIntroComplete", startAutoplay, { once: true });
}

function initHeroContentFadeOnScroll() {
  if (!window.gsap || !window.ScrollTrigger) return;

  const headline = document.querySelector(".hero-showcase__headline-wrap");
  const heroContent = document.querySelectorAll(
    ".hero-showcase__info, .hero-showcase__bottom",
  );

  const panel = document.querySelector("#more");

  if (!headline || !heroContent.length || !panel) return;

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: panel,
      start: "top bottom",
      end: "top 48%",
      scrub: 0.9,
    },
  });

  tl.to(
    headline,
    {
      autoAlpha: 0,
      yPercent: 4,
      ease: "expo.out",
    },
    0,
  );

  tl.to(
    heroContent,
    {
      autoAlpha: 0,
      stagger: 0.025,
      ease: "expo.out",
    },
    0,
  );

  ScrollTrigger.create({
    trigger: panel,
    start: "top 12%",
    end: "bottom top",
    onEnter: () => document.body.classList.add("is-light-header"),
    onLeaveBack: () => document.body.classList.remove("is-light-header"),
  });
}

function initNav() {
  const btn = document.querySelector(".site-header__menu");
  const overlay = document.getElementById("nav-overlay");
  if (!btn || !overlay || !window.gsap) return;

  const linkInners = Array.from(overlay.querySelectorAll(".nav-overlay__link-inner"));
  const footer = overlay.querySelector(".nav-overlay__footer");
  let isOpen = false;
  let animating = false;

  // Returns inset() clip-path matching the burger button's bounding box
  function btnClipPath() {
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // inset(top right bottom left) — each value = distance inward from that edge
    return `inset(${r.top}px ${vw - r.right}px ${vh - r.bottom}px ${r.left}px)`;
  }

  // Set initial clip to button position (safe: nothing visible outside the button area)
  gsap.set(overlay, { clipPath: btnClipPath() });

  function openNav() {
    if (animating) return;
    isOpen = true;
    animating = true;
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    btn.setAttribute("aria-expanded", "true");
    btn.setAttribute("aria-label", "Menü schließen");
    document.body.classList.add("nav-is-open");

    // Reset links before animating
    gsap.killTweensOf([...linkInners, footer]);
    gsap.set(linkInners, { y: "110%" });
    if (footer) gsap.set(footer, { opacity: 0 });

    // Expand overlay from button → fullscreen
    gsap.to(overlay, {
      clipPath: "inset(0px 0px 0px 0px)",
      duration: 0.85,
      ease: "expo.inOut",
      onComplete: () => { animating = false; },
    });

    // Links cascade in after overlay starts expanding
    gsap.to(linkInners, {
      y: "0%",
      duration: 1,
      ease: "expo.out",
      stagger: 0.07,
      delay: 0.25,
    });
    if (footer) {
      gsap.to(footer, { opacity: 1, duration: 0.5, ease: "power2.out", delay: 0.65 });
    }
  }

  function closeNav() {
    if (animating) return;
    isOpen = false;
    animating = true;
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Menü öffnen");
    document.body.classList.remove("nav-is-open");

    // Links out first
    gsap.killTweensOf([...linkInners, footer]);
    gsap.to(linkInners, {
      y: "110%",
      duration: 0.35,
      ease: "expo.in",
      stagger: { each: 0.04, from: "end" },
    });
    if (footer) {
      gsap.to(footer, { opacity: 0, duration: 0.2, ease: "power2.in" });
    }

    // Shrink overlay back to button position
    gsap.to(overlay, {
      clipPath: btnClipPath(),
      duration: 0.75,
      ease: "expo.inOut",
      delay: 0.1,
      onComplete: () => {
        overlay.classList.remove("is-open");
        overlay.setAttribute("aria-hidden", "true");
        animating = false;
      },
    });
  }

  btn.addEventListener("click", () => (isOpen ? closeNav() : openNav()));

  overlay.querySelectorAll(".nav-overlay__link").forEach((link) => {
    link.addEventListener("click", closeNav);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) closeNav();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const startAnimation = () => {
    initLenisSmoothScroll();
    initNav();
    initHeroLoadingAnimation();

    document
      .querySelectorAll('[data-slideshow="wrap"]')
      .forEach((wrap) => initHeroSlideshow(wrap));

    initHeroContentFadeOnScroll();

    if (window.ScrollTrigger) {
      ScrollTrigger.refresh();
    }
  };

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(startAnimation);
  } else {
    startAnimation();
  }
});
