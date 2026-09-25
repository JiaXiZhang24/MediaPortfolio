const projects = [
  {
    title: "Bad Film",
    category: "Fiction / Music video",
    runtime: "01:42",
    poster: "assets/videography/bad-film/cover.jpg",
    video: "assets/videography/bad-film/video.mp4",
    stills: [
      "assets/videography/bad-film/still-01.jpg",
      "assets/videography/bad-film/still-02.jpg",
      "assets/videography/bad-film/still-03.jpg",
      "assets/videography/bad-film/still-04.jpg",
    ],
  },
  {
    title: "Escape",
    category: "Photo Roman",
    runtime: "02:48",
    poster: "assets/videography/escape/still-01.jpg",
    video: "assets/videography/escape/video.mp4",
    stills: [
      "assets/videography/escape/still-01.jpg",
      "assets/videography/escape/still-02.jpg",
      "assets/videography/escape/still-03.jpg",
      "assets/videography/escape/still-04.jpg",
      "assets/videography/escape/still-05.jpg",
    ],
  },
  {
    title: "Kinoeyes",
    category: "Experimental short film",
    runtime: "02:02",
    poster: "assets/videography/kinoeyes/cover.jpg",
    video: "assets/videography/kinoeyes/video.mp4",
    stills: [
      "assets/videography/kinoeyes/still-01.jpg",
      "assets/videography/kinoeyes/still-02.jpg",
      "assets/videography/kinoeyes/still-03.jpg",
    ],
  },
  {
    title: "Loading",
    category: "Experimental docu-fiction",
    runtime: "01:34",
    poster: "assets/videography/loading/still-01.jpg",
    video: "assets/videography/loading/video.mp4",
    stills: [
      "assets/videography/loading/still-01.jpg",
      "assets/videography/loading/still-02.jpg",
      "assets/videography/loading/still-03.jpg",
    ],
  },
  {
    title: "Roaming",
    category: "Experimental Super-8 film",
    runtime: "02:41",
    poster: "assets/videography/roaming/cover.jpg",
    video: "assets/videography/roaming/video.mp4",
    stills: [
      "assets/videography/roaming/still-01.jpg",
      "assets/videography/roaming/still-02.jpg",
      "assets/videography/roaming/still-03.jpeg",
      "assets/videography/roaming/still-04.jpg",
    ],
  },
  {
    title: "Surveillance",
    category: "Fictional short film",
    runtime: "01:07",
    poster: "assets/videography/surveillance/poster.jpg",
    video: "assets/videography/surveillance/video.mp4",
    stills: [
      "assets/videography/surveillance/poster.jpg",
      "assets/videography/surveillance/still-01.jpg",
      "assets/videography/surveillance/still-02.jpg",
      "assets/videography/surveillance/still-03.jpg",
    ],
  },
  {
    title: "White Christmas",
    category: "Archive Fable",
    runtime: "03:02",
    poster: "assets/videography/white-christmas/cover.jpg",
    video: "assets/videography/white-christmas/video.mp4",
    stills: [],
  },
];

const projectOrder = [
  "Surveillance",
  "Bad Film",
  "White Christmas",
  "Roaming",
  "Kinoeyes",
  "Loading",
  "Escape",
];

projects.sort((projectA, projectB) => projectOrder.indexOf(projectA.title) - projectOrder.indexOf(projectB.title));

const carousel = document.querySelector("#carousel");
const track = document.querySelector("#carouselTrack");
const projectList = document.querySelector("#projectList");
const activeTitle = document.querySelector("#activeTitle");
const activeCategory = document.querySelector("#activeCategory");
const activeRuntime = document.querySelector("#activeRuntime");
const currentProject = document.querySelector("#currentProject");
const totalProjects = document.querySelector("#totalProjects");
const dialog = document.querySelector("#projectDialog");
const closeDialog = document.querySelector("#closeDialog");
const dialogTitle = document.querySelector("#dialogTitle");
const dialogCategory = document.querySelector("#dialogCategory");
const dialogRuntime = document.querySelector("#dialogRuntime");
const projectVideo = document.querySelector("#projectVideo");
const stillsSection = document.querySelector(".stills-section");
const stillsCount = document.querySelector("#stillsCount");
const stillsGrid = document.querySelector("#stillsGrid");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const ditherBackground = document.querySelector("#ditherBackground");
const ditherBackgroundNext = document.querySelector("#ditherBackgroundNext");
const alternateLayout = Boolean(ditherBackground);

const bayer4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const ditherPixelScale = 1;
const ditherDark = [70, 70, 68];
const ditherPaper = [253, 253, 252];
let ditherRenderToken = 0;
let ditherResizeTimer = 0;
let ditherTransitionTimer = 0;
let activeDitherBackground = ditherBackground;
let ditherHasRendered = false;
const roamingLuminanceByRatio = new Map();

function presentDitherBackground(renderCanvas, width, height, token) {
  if (!ditherBackground) return;

  if (!ditherBackgroundNext || !ditherHasRendered || reducedMotion.matches) {
    ditherBackground.width = width;
    ditherBackground.height = height;
    const visibleContext = ditherBackground.getContext("2d", { alpha: false });
    visibleContext.drawImage(renderCanvas, 0, 0);
    ditherBackground.classList.add("is-visible");
    activeDitherBackground = ditherBackground;
    ditherHasRendered = true;
    return;
  }

  window.clearTimeout(ditherTransitionTimer);

  const outgoing = activeDitherBackground;
  const incoming = outgoing === ditherBackground ? ditherBackgroundNext : ditherBackground;

  outgoing.style.transition = "none";
  outgoing.classList.add("is-visible");
  outgoing.style.zIndex = "0";

  incoming.style.transition = "none";
  incoming.classList.remove("is-visible");
  incoming.style.zIndex = "1";
  incoming.width = width;
  incoming.height = height;
  const incomingContext = incoming.getContext("2d", { alpha: false });
  incomingContext.drawImage(renderCanvas, 0, 0);
  void incoming.offsetWidth;

  window.requestAnimationFrame(() => {
    if (token !== ditherRenderToken) return;

    incoming.style.transition = "";
    incoming.classList.add("is-visible");
    activeDitherBackground = incoming;

    ditherTransitionTimer = window.setTimeout(() => {
      if (activeDitherBackground !== incoming) return;

      outgoing.style.transition = "none";
      outgoing.classList.remove("is-visible");
      outgoing.style.zIndex = "0";
      void outgoing.offsetWidth;
      outgoing.style.transition = "";
    }, 780);
  });
}

function measureImageLuminance(src, targetRatio) {
  const ratioKey = targetRatio.toFixed(3);
  const cached = roamingLuminanceByRatio.get(ratioKey);
  if (cached) return cached;

  const measurement = new Promise((resolve) => {
    const reference = new Image();

    reference.addEventListener("load", () => {
      const sampleWidth = 160;
      const sampleHeight = Math.max(1, Math.round(sampleWidth / targetRatio));
      const sampleCanvas = document.createElement("canvas");
      const sampleContext = sampleCanvas.getContext("2d", { alpha: false });
      const sourceRatio = reference.naturalWidth / reference.naturalHeight;
      let sourceWidth = reference.naturalWidth;
      let sourceHeight = reference.naturalHeight;
      let sourceX = 0;
      let sourceY = 0;

      sampleCanvas.width = sampleWidth;
      sampleCanvas.height = sampleHeight;

      if (sourceRatio > targetRatio) {
        sourceWidth = reference.naturalHeight * targetRatio;
        sourceX = (reference.naturalWidth - sourceWidth) / 2;
      } else {
        sourceHeight = reference.naturalWidth / targetRatio;
        sourceY = (reference.naturalHeight - sourceHeight) / 2;
      }

      sampleContext.drawImage(
        reference,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        sampleWidth,
        sampleHeight,
      );

      const samplePixels = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data;
      let total = 0;

      for (let offset = 0; offset < samplePixels.length; offset += 4) {
        total += (samplePixels[offset] * 0.299 + samplePixels[offset + 1] * 0.587 + samplePixels[offset + 2] * 0.114) / 255;
      }

      resolve(total / (samplePixels.length / 4));
    });

    reference.src = src;
  });

  roamingLuminanceByRatio.set(ratioKey, measurement);
  return measurement;
}

function renderDitherBackground(src) {
  if (!ditherBackground) return;

  const token = ++ditherRenderToken;
  const width = Math.max(1, Math.round(carousel.clientWidth));
  const height = Math.max(1, Math.round(carousel.clientHeight));
  const image = new Image();

  image.addEventListener("load", async () => {
    if (token !== ditherRenderToken) return;

    const renderCanvas = document.createElement("canvas");
    renderCanvas.width = width;
    renderCanvas.height = height;
    const context = renderCanvas.getContext("2d", { alpha: false });
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const canvasRatio = width / height;
    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;
    let sourceX = 0;
    let sourceY = 0;

    if (sourceRatio > canvasRatio) {
      sourceWidth = image.naturalHeight * canvasRatio;
      sourceX = (image.naturalWidth - sourceWidth) / 2;
    } else {
      sourceHeight = image.naturalWidth / canvasRatio;
      sourceY = (image.naturalHeight - sourceHeight) / 2;
    }

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      width,
      height,
    );

    const frame = context.getImageData(0, 0, width, height);
    const pixels = frame.data;
    let totalLuminance = 0;

    for (let offset = 0; offset < pixels.length; offset += 4) {
      totalLuminance += (pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114) / 255;
    }

    const averageLuminance = totalLuminance / (pixels.length / 4);
    const roamingLuminance = await measureImageLuminance("assets/videography/roaming/cover.jpg", canvasRatio);
    if (token !== ditherRenderToken) return;
    const luminanceShift = (roamingLuminance - averageLuminance) * 0.8;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        const ditherCellX = Math.floor(x / ditherPixelScale);
        const ditherCellY = Math.floor(y / ditherPixelScale);
        const sampleX = Math.min(width - 1, Math.floor((ditherCellX + 0.5) * ditherPixelScale));
        const sampleY = Math.min(height - 1, Math.floor((ditherCellY + 0.5) * ditherPixelScale));
        const sampleOffset = (sampleY * width + sampleX) * 4;
        const luminance = (pixels[sampleOffset] * 0.299 + pixels[sampleOffset + 1] * 0.587 + pixels[sampleOffset + 2] * 0.114) / 255;
        const brightnessAdjusted = Math.min(1, Math.max(0, (luminance + luminanceShift) * 1.07));
        const matrixX = ditherCellX % 4;
        const matrixY = ditherCellY % 4;
        const threshold = (bayer4[matrixY][matrixX] + 0.5) / 16;
        const color = brightnessAdjusted >= threshold ? ditherPaper : ditherDark;

        pixels[offset] = color[0];
        pixels[offset + 1] = color[1];
        pixels[offset + 2] = color[2];
        pixels[offset + 3] = 255;
      }
    }

    context.putImageData(frame, 0, 0);

    if (token !== ditherRenderToken) return;

    presentDitherBackground(renderCanvas, width, height, token);
  });

  image.src = src;
}

const cards = projects.map((project, index) => {
  const card = document.createElement("button");
  card.className = "project-card";
  card.type = "button";
  card.dataset.index = String(index);
  card.setAttribute("aria-label", `View ${project.title}`);
  card.innerHTML = `<img src="${project.poster}" alt="" draggable="false" />`;
  track.append(card);
  return card;
});

const projectListButtons = projects.map((project, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = project.title;
  button.setAttribute("aria-label", `Select ${project.title}`);
  button.addEventListener("click", () => snapToIndex(index));
  projectList.append(button);
  return button;
});

projectList.addEventListener("pointerdown", (event) => event.stopPropagation());

totalProjects.textContent = String(projects.length).padStart(2, "0");

const step = (Math.PI * 2) / projects.length;
let rotation = 0;
let velocity = 0;
let targetRotation = 0;
let selectedIndex = 0;
let dragging = false;
let dragDistance = 0;
let lastPointerX = 0;
let lastPointerY = 0;
let lastPointerTime = 0;
let lastFrameTime = performance.now();

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function shortestAngle(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function selectionForRotation(value) {
  return modulo(Math.round(-value / step), projects.length);
}

function updateProjectText(index) {
  const project = projects[index];
  activeTitle.textContent = project.title;
  activeCategory.textContent = project.category;
  activeRuntime.textContent = project.runtime;
  currentProject.textContent = String(index + 1).padStart(2, "0");
  renderDitherBackground(project.poster);

  cards.forEach((card, cardIndex) => {
    const active = cardIndex === index;
    card.classList.toggle("is-active", active);
    card.setAttribute("aria-current", active ? "true" : "false");
  });

  projectListButtons.forEach((button, buttonIndex) => {
    const active = buttonIndex === index;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "true" : "false");
  });
}

function positionCards() {
  const width = carousel.clientWidth;
  const height = carousel.clientHeight;
  const mobile = width <= 760;
  const centerX = mobile ? -0.68 * width : -0.34 * width;
  const radiusX = mobile ? 1.18 * width : 0.84 * width;
  const centerY = mobile ? 0.42 * height : 0.5 * height;
  const radiusY = mobile ? 0.36 * height : 0.44 * height;

  cards.forEach((card, index) => {
    const angle = index * step + rotation;
    const depth = (Math.cos(angle) + 1) / 2;
    const x = centerX + Math.cos(angle) * radiusX;
    const y = centerY + Math.sin(angle) * radiusY;
    const scale = mobile ? 0.72 + depth * 0.5 : 0.58 + depth * 0.86;
    const opacity = 0.22 + depth * 0.78;
    const tilt = Math.sin(angle) * -6;

    card.style.zIndex = String(Math.round(depth * 100));
    card.style.opacity = String(opacity);
    card.style.pointerEvents = depth > 0.18 ? "auto" : "none";
    card.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale}) rotate(${tilt}deg)`;
  });

  const nextSelection = selectionForRotation(rotation);
  if (nextSelection !== selectedIndex) {
    selectedIndex = nextSelection;
    updateProjectText(selectedIndex);
  }
}

function snapToIndex(index) {
  selectedIndex = modulo(index, projects.length);
  velocity = 0;
  const desired = -selectedIndex * step;
  targetRotation = rotation + shortestAngle(rotation, desired);
  updateProjectText(selectedIndex);
}

function openProject(index) {
  const project = projects[index];
  dialogTitle.textContent = project.title;
  dialogCategory.textContent = project.category;
  dialogRuntime.textContent = project.runtime;
  projectVideo.src = project.video;
  projectVideo.poster = project.poster;

  stillsSection.hidden = project.stills.length === 0;
  stillsCount.textContent = project.stills.length
    ? `${String(project.stills.length).padStart(2, "0")} images`
    : "";
  stillsGrid.replaceChildren();
  project.stills.forEach((src, stillIndex) => {
    const figure = document.createElement("figure");
    const image = document.createElement("img");
    image.src = src;
    image.alt = `${project.title} — selected still ${stillIndex + 1}`;
    image.loading = "lazy";
    figure.append(image);
    stillsGrid.append(figure);
  });

  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
  document.body.style.overflow = "hidden";
}

function hideProject() {
  projectVideo.pause();
  projectVideo.removeAttribute("src");
  projectVideo.load();
  if (typeof dialog.close === "function" && dialog.open) {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
  document.body.style.overflow = "";
}

cards.forEach((card, index) => {
  card.addEventListener("click", () => {
    if (dragDistance > 8) return;
    if (index === selectedIndex) {
      openProject(index);
      return;
    }
    snapToIndex(index);
  });
});

carousel.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  dragging = true;
  dragDistance = 0;
  velocity = 0;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  lastPointerTime = performance.now();
  carousel.classList.add("is-dragging");
  carousel.setPointerCapture(event.pointerId);
});

carousel.addEventListener("pointermove", (event) => {
  if (!dragging) return;
  const now = performance.now();
  const deltaX = event.clientX - lastPointerX;
  const deltaY = event.clientY - lastPointerY;
  const delta = Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : -deltaY;
  const elapsed = Math.max(16, now - lastPointerTime);

  rotation += delta * 0.0037;
  velocity = (delta * 0.0037) / (elapsed / 16.67);
  dragDistance += Math.hypot(deltaX, deltaY);
  targetRotation = rotation;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  lastPointerTime = now;
});

function endDrag(event) {
  if (!dragging) return;
  dragging = false;
  carousel.classList.remove("is-dragging");
  if (carousel.hasPointerCapture(event.pointerId)) {
    carousel.releasePointerCapture(event.pointerId);
  }
}

carousel.addEventListener("pointerup", endDrag);
carousel.addEventListener("pointercancel", endDrag);

carousel.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const input = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    velocity += input * -0.00038;
    targetRotation = rotation;
  },
  { passive: false },
);

window.addEventListener("keydown", (event) => {
  if (dialog.open) return;
  if (event.key === "ArrowRight") {
    event.preventDefault();
    snapToIndex(selectedIndex + 1);
  }
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    snapToIndex(selectedIndex - 1);
  }
  if (event.key === "Enter") {
    openProject(selectedIndex);
  }
});

closeDialog.addEventListener("click", hideProject);
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) hideProject();
});
dialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  hideProject();
});

window.addEventListener("resize", () => {
  if (!alternateLayout) return;

  window.clearTimeout(ditherResizeTimer);
  ditherResizeTimer = window.setTimeout(() => {
    renderDitherBackground(projects[selectedIndex].poster);
  }, 100);
});

function animate(now) {
  const elapsed = Math.min(2, (now - lastFrameTime) / 16.67);
  lastFrameTime = now;

  if (!dragging) {
    if (!reducedMotion.matches) {
      rotation += velocity * elapsed;
      velocity *= Math.pow(0.91, elapsed);
    } else {
      velocity = 0;
    }

    if (Math.abs(velocity) < 0.0025) {
      const nearest = Math.round(rotation / step) * step;
      if (Math.abs(shortestAngle(rotation, targetRotation)) > 0.02) {
        rotation += shortestAngle(rotation, targetRotation) * (reducedMotion.matches ? 1 : 0.1 * elapsed);
      } else {
        targetRotation = nearest;
        rotation += shortestAngle(rotation, nearest) * (reducedMotion.matches ? 1 : 0.075 * elapsed);
      }
    }
  }

  positionCards();
  requestAnimationFrame(animate);
}

updateProjectText(0);
positionCards();
requestAnimationFrame(animate);

// Interaction concept inspired by the open-source ICE WORKS / Viscose carousel.
