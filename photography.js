(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const atlasView = $("#atlasView");
  const projectView = $("#projectView");
  const diagram = $("#orbitDiagram");
  const orbitingCovers = $("#orbitingCovers");
  const centerCover = $("#centerCover");
  const centerImage = $("#centerImage");
  const centerImages = [centerImage, $("#centerImageNext")];
  const atlasProjectList = $("#atlasProjectList");
  const detailProjectList = $("#detailProjectList");
  const loadStatus = $("#loadStatus");
  const imageDialog = $("#imageDialog");
  const lightboxImage = $("#lightboxImage");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const rings = [
    { x: 0.465, y: 0.445 },
    { x: 0.355, y: 0.359 },
    { x: 0.250, y: 0.2578125 },
  ];
  const degrees = (angle) => angle * Math.PI / 180;
  const orbitTilt = document.documentElement.classList.contains("alt-site") ? degrees(-14) : 0;
  const slotPatterns = [
    { ring: 0, angle: degrees(-120), speed: Math.PI * 2 / 180, size: 0.88 },
    { ring: 1, angle: degrees(-70), speed: Math.PI * 2 / 145, size: 0.88 },
    { ring: 2, angle: degrees(180), speed: Math.PI * 2 / 210, size: 0.68 },
    { ring: 1, angle: degrees(0), speed: Math.PI * 2 / 125, size: 1.03 },
    { ring: 0, angle: degrees(88), speed: Math.PI * 2 / 250, size: 1.04 },
    { ring: 1, angle: degrees(55), speed: Math.PI * 2 / 165, size: 0.9 },
    { ring: 0, angle: degrees(126), speed: Math.PI * 2 / 285, size: 0.77 },
  ];

  let projects = [];
  let activeIndex = 3;
  let slots = [];
  let animationFrame = 0;
  let lastFrameTime = 0;
  let swapToken = 0;
  let centerSlides = [];
  let centerSlideIndex = 0;
  let centerSlideTimer = 0;
  let centerFadeTimer = 0;
  let visibleCenterImage = 0;
  let viewerImages = [];
  let viewerIndex = 0;

  const number = (index) => String(index + 1).padStart(2, "0");

  function createHalftoneField(canvas, patches) {
    const context = canvas.getContext("2d", { alpha: true });
    const bayer = [
      [0, 48, 12, 60, 3, 51, 15, 63],
      [32, 16, 44, 28, 35, 19, 47, 31],
      [8, 56, 4, 52, 11, 59, 7, 55],
      [40, 24, 36, 20, 43, 27, 39, 23],
      [2, 50, 14, 62, 1, 49, 13, 61],
      [34, 18, 46, 30, 33, 17, 45, 29],
      [10, 58, 6, 54, 9, 57, 5, 53],
      [42, 26, 38, 22, 41, 25, 37, 21],
    ];
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastPaint = 0;
    let compact = false;
    let cellSize = 4;

    const smooth = (value) => {
      const clamped = Math.max(0, Math.min(1, value));
      return clamped * clamped * (3 - 2 * clamped);
    };

    function draw(time = 0) {
      if (!width || !height) return;
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#555";
      const activePatches = (compact ? patches.slice(0, 2) : patches).map(([x, y, radiusX, radiusY, phase]) => ({
        x: x + Math.sin(time * Math.PI * 2 / 14 + phase) * 0.012,
        y: y + Math.cos(time * Math.PI * 2 / 17 + phase) * 0.012,
        radiusX,
        radiusY,
        phase,
        breathing: 0.76 + 0.24 * Math.sin(time * Math.PI * 2 / (11 + phase) + phase),
      }));
      const columns = Math.ceil(width / cellSize);
      const rows = Math.ceil(height / cellSize);
      const dotSize = compact ? 1.1 : 0.9;
      const crossPixel = compact ? 0.9 : 0.75;
      const crossReach = crossPixel * 1.05;

      for (let row = 0; row < rows; row += 1) {
        const y = (row + 0.5) * cellSize / height;
        for (let column = 0; column < columns; column += 1) {
          const x = (column + 0.5) * cellSize / width;
          let density = 0;
          for (const patch of activePatches) {
            const dx = (x - patch.x) / patch.radiusX;
            const dy = (y - patch.y) / patch.radiusY;
            if (Math.abs(dx) > 1.35 || Math.abs(dy) > 1.35) continue;
            const roughness = 0.11 * Math.sin(x * 19 + y * 13 + patch.phase + time * 0.15)
              + 0.07 * Math.sin(x * 32 - y * 23 - patch.phase - time * 0.12);
            const edge = 1 - smooth((Math.hypot(dx, dy) + roughness - 0.34) / 0.78);
            density = Math.max(density, edge * patch.breathing * 0.64);
          }
          if (density <= 0) continue;
          const shimmer = 0.032 * Math.sin(time * 1.35 + column * 0.23 + row * 0.14)
            + 0.022 * Math.sin(time * 1.9 - column * 0.16 + row * 0.31);
          const threshold = (bayer[row & 7][column & 7] + 0.5) / 64;
          const difference = density + shimmer - threshold;
          if (difference <= 0) continue;
          const crossChance = 0.82 * smooth((density - 0.14) / 0.30);
          const motif = (bayer[(row + 3) & 7][(column + 5) & 7] + 0.5) / 64;
          const isCross = motif < crossChance;
          const alpha = (compact ? 0.75 : 1) * (0.055 + 0.18 * smooth(difference * 5));
          context.globalAlpha = isCross ? Math.min(0.30, alpha * 1.3) : alpha;
          const centerX = (column + 0.5) * cellSize;
          const centerY = (row + 0.5) * cellSize;
          if (isCross) {
            const arm = crossPixel / 2;
            context.fillRect(centerX - arm, centerY - arm, crossPixel, crossPixel);
            if ((column + row * 2) % 5 === 0) {
              context.fillRect(centerX - arm - crossReach, centerY - arm, crossPixel, crossPixel);
              context.fillRect(centerX - arm + crossReach, centerY - arm, crossPixel, crossPixel);
              context.fillRect(centerX - arm, centerY - arm - crossReach, crossPixel, crossPixel);
              context.fillRect(centerX - arm, centerY - arm + crossReach, crossPixel, crossPixel);
            } else {
              context.fillRect(centerX - arm - crossReach, centerY - arm - crossReach, crossPixel, crossPixel);
              context.fillRect(centerX - arm + crossReach, centerY - arm - crossReach, crossPixel, crossPixel);
              context.fillRect(centerX - arm - crossReach, centerY - arm + crossReach, crossPixel, crossPixel);
              context.fillRect(centerX - arm + crossReach, centerY - arm + crossReach, crossPixel, crossPixel);
            }
          } else {
            context.fillRect(centerX - dotSize / 2, centerY - dotSize / 2, dotSize, dotSize);
          }
        }
      }
      context.globalAlpha = 1;
    }

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      if (!width || !height) return;
      compact = width <= 700;
      cellSize = compact ? 5 : 4;
      const ratio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 1.5);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(reduceMotion.matches ? 0 : performance.now() / 1000);
    }

    function tick(timestamp) {
      frame = 0;
      if (document.hidden || reduceMotion.matches || canvas.closest("[hidden]")) return;
      if (timestamp - lastPaint >= (compact ? 250 : 160)) {
        draw(timestamp / 1000);
        lastPaint = timestamp;
      }
      frame = requestAnimationFrame(tick);
    }

    function start() {
      if (document.hidden || canvas.closest("[hidden]")) return;
      resize();
      if (!reduceMotion.matches && !frame) frame = requestAnimationFrame(tick);
    }

    function stop() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      lastPaint = 0;
    }

    return { resize, start, stop };
  }

  const atlasHalftone = createHalftoneField($("#atlasHalftone"), [
    [0.12, 0.22, 0.27, 0.33, 0.2],
    [0.91, 0.47, 0.26, 0.34, 1.8],
    [0.51, 0.92, 0.32, 0.27, 3.1],
  ]);
  const detailHalftone = createHalftoneField($("#detailHalftone"), [
    [0.14, 0.21, 0.32, 0.43, 0.5],
    [0.81, 0.67, 0.33, 0.39, 2.3],
  ]);

  function updateOrbitPositions() {
    for (const slot of slots) {
      const ring = rings[slot.ring];
      const x = Math.cos(slot.angle) * ring.x;
      const y = Math.sin(slot.angle) * ring.y;
      slot.button.style.left = `${(0.5 + x * Math.cos(orbitTilt) - y * Math.sin(orbitTilt)) * 100}%`;
      slot.button.style.top = `${(0.5 + x * Math.sin(orbitTilt) + y * Math.cos(orbitTilt)) * 100}%`;
    }
  }

  function updateOrbitSizes() {
    const base = Math.max(51, Math.min(98, diagram.clientWidth * 0.093));
    for (const slot of slots) {
      slot.button.style.setProperty("--diameter", `${Math.round(base * slot.size)}px`);
    }
    updateOrbitPositions();
  }

  function animateOrbit(time) {
    animationFrame = 0;
    if (atlasView.hidden || reduceMotion.matches || document.hidden) return;
    const elapsed = Math.min((time - lastFrameTime) / 1000 || 0, 0.05);
    lastFrameTime = time;
    for (const slot of slots) {
      if (!slot.paused) slot.angle += slot.speed * elapsed;
    }
    updateOrbitPositions();
    animationFrame = requestAnimationFrame(animateOrbit);
  }

  function startOrbit() {
    if (animationFrame || atlasView.hidden || reduceMotion.matches || document.hidden) return;
    lastFrameTime = 0;
    animationFrame = requestAnimationFrame(animateOrbit);
  }

  function stopOrbit() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    lastFrameTime = 0;
  }

  function makeOrbitNode(projectIndex, pattern) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "orbit-node photo-circle";
    button.innerHTML = '<span class="circle-image-wrap"><img alt="" decoding="async" /></span>';
    const slot = { ...pattern, projectIndex, button, paused: false };
    setSlotProject(slot, projectIndex);
    button.addEventListener("click", () => selectProject(slot.projectIndex));
    button.addEventListener("pointerenter", () => { slot.paused = true; button.classList.add("is-hovered"); });
    button.addEventListener("pointerleave", () => { slot.paused = false; button.classList.remove("is-hovered"); });
    button.addEventListener("focus", () => { slot.paused = true; button.classList.add("is-hovered"); });
    button.addEventListener("blur", () => { slot.paused = false; button.classList.remove("is-hovered"); });
    orbitingCovers.append(button);
    return slot;
  }

  function setSlotProject(slot, projectIndex) {
    const project = projects[projectIndex];
    slot.projectIndex = projectIndex;
    slot.button.querySelector("img").src = project.cover;
    slot.button.setAttribute("aria-label", `Select ${project.title}`);
    slot.button.title = project.title;
  }

  function makeIndex(list, detail = false) {
    list.replaceChildren();
    projects.forEach((project, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = project.title;
      button.dataset.projectIndex = String(index);
      button.addEventListener("click", () => {
        selectProject(index);
        if (detail) showProject(index);
      });
      list.append(button);
    });
  }

  function updateIndex() {
    for (const list of [atlasProjectList, detailProjectList]) {
      for (const button of list.querySelectorAll("button")) {
        const active = Number(button.dataset.projectIndex) === activeIndex;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-current", active ? "true" : "false");
      }
    }
    $("#atlasCurrent").textContent = number(activeIndex);
    $("#detailCurrent").textContent = number(activeIndex);
  }

  function updateCaption() {
    const project = projects[activeIndex];
    $("#activeNumber").textContent = number(activeIndex);
    $("#activeTitle").textContent = project.title;
    const subtitle = $("#activeSubtitle");
    subtitle.textContent = project.sections.length > 1
      ? project.sections.map((section) => section.title).join(" · ")
      : "";
    subtitle.hidden = !subtitle.textContent;
    centerCover.setAttribute("aria-label", `Open ${project.title}`);
  }

  function stopCenterSlideshow() {
    window.clearTimeout(centerSlideTimer);
    window.clearTimeout(centerFadeTimer);
    centerSlideTimer = 0;
    centerFadeTimer = 0;
    swapToken += 1;
    centerCover.classList.add("is-resetting");
    centerImages.forEach((image, index) => image.classList.toggle("is-visible", index === visibleCenterImage));
    requestAnimationFrame(() => centerCover.classList.remove("is-resetting"));
  }

  function scheduleCenterSlide() {
    window.clearTimeout(centerSlideTimer);
    centerSlideTimer = 0;
    if (atlasView.hidden || document.hidden || reduceMotion.matches || centerSlides.length < 2) return;
    centerSlideTimer = window.setTimeout(advanceCenterSlide, 3800);
  }

  function advanceCenterSlide() {
    centerSlideTimer = 0;
    centerSlideIndex = (centerSlideIndex + 1) % centerSlides.length;
    dissolveCenterImage(centerSlides[centerSlideIndex]);
  }

  function dissolveCenterImage(source) {
    const token = ++swapToken;
    const preloaded = new Image();
    preloaded.onload = () => {
      if (token !== swapToken || atlasView.hidden || document.hidden) return;
      const outgoing = centerImages[visibleCenterImage];
      const incomingIndex = 1 - visibleCenterImage;
      const incoming = centerImages[incomingIndex];
      incoming.src = source;
      incoming.classList.remove("is-visible");
      requestAnimationFrame(() => {
        if (token !== swapToken) return;
        centerCover.classList.remove("is-resetting");
        requestAnimationFrame(() => {
          if (token !== swapToken) return;
          incoming.classList.add("is-visible");
          visibleCenterImage = incomingIndex;
          centerFadeTimer = window.setTimeout(() => {
            if (token !== swapToken) return;
            outgoing.classList.remove("is-visible");
            centerFadeTimer = 0;
            scheduleCenterSlide();
          }, 1500);
        });
      });
    };
    preloaded.onerror = () => { if (token === swapToken) scheduleCenterSlide(); };
    preloaded.src = source;
  }

  function setCenterProject(project) {
    stopCenterSlideshow();
    centerSlides = project.sections.flatMap((section) => section.images);
    centerSlideIndex = 0;
    const firstImage = centerSlides[0] || project.cover;
    if (!centerImages[visibleCenterImage].getAttribute("src")) {
      centerImages[visibleCenterImage].src = firstImage;
      centerImages[visibleCenterImage].classList.add("is-visible");
      scheduleCenterSlide();
    } else {
      dissolveCenterImage(firstImage);
    }
  }

  function selectProject(index) {
    if (!projects[index] || index === activeIndex) return;
    const previous = activeIndex;
    const selectedSlot = slots.find((slot) => slot.projectIndex === index);
    if (selectedSlot) setSlotProject(selectedSlot, previous);
    activeIndex = index;
    setCenterProject(projects[index]);
    updateCaption();
    updateIndex();
  }

  function renderProject(project) {
    $("#projectViewTitle").textContent = project.title;
    const sectionLinks = $("#sectionLinks");
    const projectSections = $("#projectSections");
    sectionLinks.replaceChildren();
    projectSections.replaceChildren();

    const multiple = project.sections.length > 1;
    project.sections.forEach((section, sectionIndex) => {
      const sectionId = `section-${project.id}-${sectionIndex + 1}`;
      if (multiple) {
        const link = document.createElement("a");
        link.href = `#${sectionId}`;
        link.textContent = `${number(sectionIndex)} ${section.title}`;
        link.addEventListener("click", (event) => {
          event.preventDefault();
          document.getElementById(sectionId).scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth" });
        });
        sectionLinks.append(link);
      }

      const sectionElement = document.createElement("section");
      sectionElement.className = "project-section";
      sectionElement.id = sectionId;
      if (multiple) {
        const heading = document.createElement("div");
        heading.className = "project-section__heading";
        const title = document.createElement("h2");
        title.textContent = `${sectionIndex === 0 ? "I" : "II"} / ${section.title}`;
        heading.append(title);
        sectionElement.append(heading);
      }

      const grid = document.createElement("div");
      grid.className = "photo-grid";
      section.images.forEach((src, imageIndex) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "photo-item";
        item.setAttribute("aria-label", `Open photograph ${imageIndex + 1} from ${section.title || project.title}`);
        const image = document.createElement("img");
        image.src = src;
        image.alt = `Photograph ${imageIndex + 1} from ${section.title || project.title}`;
        image.loading = imageIndex < 3 && sectionIndex === 0 ? "eager" : "lazy";
        image.decoding = "async";
        const caption = document.createElement("span");
        caption.className = "photo-item__caption";
        caption.textContent = `Fig. ${multiple ? `${sectionIndex === 0 ? "I" : "II"}.` : ""}${number(imageIndex)}`;
        item.append(image, caption);
        item.addEventListener("click", () => openImage(project, sectionIndex, imageIndex));
        grid.append(item);
      });
      sectionElement.append(grid);
      projectSections.append(sectionElement);
    });
  }

  function showProject(index = activeIndex) {
    if (index !== activeIndex) selectProject(index);
    renderProject(projects[activeIndex]);
    stopOrbit();
    stopCenterSlideshow();
    atlasHalftone.stop();
    atlasView.hidden = true;
    projectView.hidden = false;
    detailHalftone.start();
    document.body.classList.add("project-open");
    window.scrollTo(0, 0);
    $("#backToAtlas").focus({ preventScroll: true });
  }

  function showAtlas() {
    detailHalftone.stop();
    projectView.hidden = true;
    atlasView.hidden = false;
    atlasHalftone.start();
    document.body.classList.remove("project-open");
    window.scrollTo(0, 0);
    updateOrbitSizes();
    startOrbit();
    scheduleCenterSlide();
    centerCover.focus({ preventScroll: true });
  }

  function displayImage() {
    const image = viewerImages[viewerIndex];
    lightboxImage.src = image.src;
    lightboxImage.alt = image.alt;
    $("#imageCount").textContent = `${String(viewerIndex + 1).padStart(2, "0")} / ${String(viewerImages.length).padStart(2, "0")}`;
  }

  function openImage(project, sectionIndex, imageIndex) {
    viewerImages = project.sections.flatMap((section) => section.images.map((src, index) => ({
      src,
      alt: `Photograph ${index + 1} from ${section.title || project.title}`,
    })));
    viewerIndex = project.sections.slice(0, sectionIndex).reduce((sum, section) => sum + section.images.length, 0) + imageIndex;
    displayImage();
    imageDialog.showModal();
  }

  function stepImage(direction) {
    if (!imageDialog.open || !viewerImages.length) return;
    viewerIndex = (viewerIndex + direction + viewerImages.length) % viewerImages.length;
    displayImage();
  }

  async function initialize() {
    try {
      const response = await fetch("photography-data.json?v=20261003-1");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      projects = await response.json();
      if (projects.length !== 8) throw new Error("The photography index needs eight projects.");
      const otherProjects = projects.map((_, index) => index).filter((index) => index !== activeIndex);
      slots = otherProjects.map((index, slotIndex) => makeOrbitNode(index, slotPatterns[slotIndex]));
      makeIndex(atlasProjectList);
      makeIndex(detailProjectList, true);
      setCenterProject(projects[activeIndex]);
      $("#atlasTotal").textContent = String(projects.length).padStart(2, "0");
      $("#detailTotal").textContent = String(projects.length).padStart(2, "0");
      updateCaption();
      updateIndex();
      updateOrbitSizes();
      loadStatus.hidden = true;
      startOrbit();
    } catch (error) {
      console.error("Photography portfolio could not load:", error);
      loadStatus.textContent = "Photography could not load. Please refresh the page.";
    }
  }

  centerCover.addEventListener("click", () => showProject());
  $("#backToAtlas").addEventListener("click", showAtlas);
  $("#closeImage").addEventListener("click", () => imageDialog.close());
  $("#previousImage").addEventListener("click", () => stepImage(-1));
  $("#nextImage").addEventListener("click", () => stepImage(1));
  imageDialog.addEventListener("click", (event) => { if (event.target === imageDialog) imageDialog.close(); });
  document.addEventListener("keydown", (event) => {
    if (imageDialog.open) {
      if (event.key === "ArrowLeft") stepImage(-1);
      if (event.key === "ArrowRight") stepImage(1);
    } else if (event.key === "Escape" && !projectView.hidden) {
      showAtlas();
    }
  });
  window.addEventListener("resize", () => {
    updateOrbitSizes();
    atlasHalftone.resize();
    detailHalftone.resize();
  }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopOrbit();
      stopCenterSlideshow();
      atlasHalftone.stop();
      detailHalftone.stop();
    } else {
      startOrbit();
      scheduleCenterSlide();
      (atlasView.hidden ? detailHalftone : atlasHalftone).start();
    }
  });
  reduceMotion.addEventListener("change", () => {
    atlasHalftone.stop();
    detailHalftone.stop();
    (atlasView.hidden ? detailHalftone : atlasHalftone).start();
    if (reduceMotion.matches) {
      stopOrbit();
      stopCenterSlideshow();
    } else {
      startOrbit();
      scheduleCenterSlide();
    }
  });
  atlasHalftone.start();
  initialize();
})();
