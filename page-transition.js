(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const paper = "#fdfdfc";
  let overlay;
  let maskCircle;
  let overlayVisible = false;
  let navigating = false;
  let animationToken = 0;

  const pause = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));
  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

  function createOverlay() {
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.className = "page-transition-overlay";
    overlay.setAttribute("aria-hidden", "true");
    const maskId = `portfolio-orbit-mask-${Math.random().toString(36).slice(2)}`;
    overlay.innerHTML = `<svg preserveAspectRatio="none" aria-hidden="true"><defs><mask id="${maskId}" maskUnits="userSpaceOnUse"><rect class="transition-mask-base" fill="white"/><circle class="transition-mask-hole" fill="black"/></mask></defs><rect class="transition-paper" fill="${paper}" mask="url(#${maskId})"/></svg><span class="transition-ring"></span><span class="transition-ring transition-ring--inner"></span><span class="transition-marker"></span><span class="transition-status">Preparing next page…</span>`;
    document.body.append(overlay);
    maskCircle = overlay.querySelector(".transition-mask-hole");
    sizeOverlay();
    window.addEventListener("resize", sizeOverlay, { passive: true });
  }

  function sizeOverlay() {
    if (!overlay) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    overlay.querySelector("svg").setAttribute("viewBox", `0 0 ${width} ${height}`);
    for (const rect of overlay.querySelectorAll("rect")) {
      rect.setAttribute("width", width);
      rect.setAttribute("height", height);
    }
    maskCircle.setAttribute("cx", width / 2);
    maskCircle.setAttribute("cy", height / 2);
    maskCircle.setAttribute("r", overlayVisible ? 0 : Math.hypot(width / 2, height / 2) + 4);
  }

  function animateHole(from, to, duration) {
    const token = ++animationToken;
    overlay.classList.remove("is-animating");
    void overlay.offsetWidth;
    overlay.classList.add("is-animating");
    return new Promise((resolve) => {
      const start = performance.now();
      function frame(time) {
        if (token !== animationToken) return resolve();
        const fraction = Math.min(1, (time - start) / duration);
        const eased = fraction * fraction * (3 - 2 * fraction);
        maskCircle.setAttribute("r", String(from + (to - from) * eased));
        if (fraction < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  function imageReady(image) {
    if (!image.getAttribute("src") && !image.currentSrc) return Promise.resolve();
    if (image.complete && !image.naturalWidth) return Promise.resolve();
    if (image.decode) return image.decode().catch(() => {});
    if (image.complete) return Promise.resolve();
    return new Promise((resolve) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    });
  }

  function waitForCondition(predicate, timeout = 6000) {
    if (predicate()) return Promise.resolve();
    return new Promise((resolve) => {
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        observer.disconnect();
        window.clearTimeout(timer);
        resolve();
      };
      const observer = new MutationObserver(() => { if (predicate()) done(); });
      observer.observe(document.documentElement, { attributes: true, childList: true, subtree: true });
      const timer = window.setTimeout(done, timeout);
    });
  }

  async function readyForReveal() {
    if (document.readyState === "loading") {
      await new Promise((resolve) => document.addEventListener("DOMContentLoaded", resolve, { once: true }));
    }
    const path = window.location.pathname;
    if (path.endsWith("photography.html")) {
      await waitForCondition(() => document.querySelector("#loadStatus")?.hidden === true || document.querySelector("#loadStatus")?.textContent.includes("could not"));
    } else if (path.endsWith("videography.html")) {
      await waitForCondition(() => Boolean(document.querySelector(".dither-background[data-ready='true']")));
    } else if (path.endsWith("graphic-design.html")) {
      await waitForCondition(() => Boolean(document.querySelector(".book-stage.is-three-ready")) || document.querySelector("#pageStatus")?.textContent.includes("could not"));
    }
    await Promise.race([
      Promise.allSettled(Array.from(document.images, imageReady)),
      pause(6000),
    ]);
    if (document.fonts?.ready) await Promise.race([document.fonts.ready, pause(1500)]);
    await nextFrame();
    await nextFrame();
  }

  async function reveal() {
    createOverlay();
    overlayVisible = true;
    maskCircle.setAttribute("r", "0");
    document.documentElement.classList.remove("page-transition-pending");
    overlay.classList.add("is-waiting");
    try { await readyForReveal(); }
    catch (error) { console.warn("Page readiness check failed:", error); }
    overlay.classList.remove("is-waiting");
    if (reducedMotion.matches) {
      maskCircle.setAttribute("r", String(Math.hypot(window.innerWidth / 2, window.innerHeight / 2) + 4));
    } else {
      await animateHole(0, Math.hypot(window.innerWidth / 2, window.innerHeight / 2) + 4, 780);
    }
    overlayVisible = false;
    overlay.remove();
    overlay = null;
  }

  async function leave(url) {
    if (navigating) return;
    navigating = true;
    createOverlay();
    overlayVisible = false;
    const radius = Math.hypot(window.innerWidth / 2, window.innerHeight / 2) + 4;
    maskCircle.setAttribute("r", String(radius));
    if (!reducedMotion.matches) await animateHole(radius, 0, 510);
    window.location.assign(url);
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target && link.target !== "_self" || link.hasAttribute("download")) return;
    const target = new URL(link.href, window.location.href);
    if (target.origin !== window.location.origin || !/\.(?:html?)$/.test(target.pathname) || target.pathname === window.location.pathname && target.search === window.location.search) return;
    event.preventDefault();
    leave(target.href);
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      navigating = false;
      overlay?.remove();
      overlay = null;
      document.documentElement.classList.remove("page-transition-pending");
    }
  });

  reveal();
})();
