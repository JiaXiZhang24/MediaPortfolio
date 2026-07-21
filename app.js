const gallery = document.querySelector("#gallery");
const world = document.querySelector("#galleryWorld");
const rainWorldBack = document.querySelector("#rainWorldBack");
const rainWorldFront = document.querySelector("#rainWorldFront");
const portfolio = document.querySelector(".portfolio");
const masthead = document.querySelector(".masthead");

const covers = [
  "cover-08.jpeg", "cover-01.png", "cover-16.png", "cover-27.jpeg",
  "cover-14.jpeg", "cover-02.jpeg", "cover-25.png",
  "cover-22.png", "cover-21.jpg", "cover-07.jpg", "cover-11.png",
  "cover-18.jpeg", "cover-05.jpg", "cover-15.jpeg",
  "cover-06.png", "cover-13.jpeg", "cover-09.jpeg", "cover-17.jpg",
  "cover-23.png", "cover-04.jpeg", "cover-20.png",
  "cover-26.png", "cover-24.jpeg", "cover-10.png", "cover-19.jpg",
  "cover-03.jpg", "cover-12.png", "cover-28.png"
];

const rows = [-1.5, -0.5, 0.5, 1.5];
const columns = 7;
const tiles = [];
const rainDrops = [];
const rainRipples = [];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let rainGroundY = 470;
let lastRainTime = 0;
let sceneRadius = 850;
let sceneMobile = false;

const state = {
  yaw: 0,
  targetYaw: 0,
  pitch: 0,
  targetPitch: 0,
  yawVelocity: 0,
  pitchVelocity: 0,
  dragging: false,
  lastX: 0,
  lastY: 0,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeTiles() {
  covers.forEach((filename, index) => {
    const tile = document.createElement("div");
    const image = document.createElement("img");
    const row = rows[Math.floor(index / columns)];
    const column = index % columns;

    tile.className = "cover";
    tile.setAttribute("aria-hidden", "true");
    tile.dataset.row = String(row);
    tile.dataset.column = String(column);
    image.alt = "";
    image.draggable = false;
    image.src = `assets/covers/${filename}`;
    image.addEventListener("load", () => {
      const ratio = image.naturalWidth / image.naturalHeight;
      tile.style.aspectRatio = String(Math.min(1.72, Math.max(0.78, ratio)));
      image.classList.add("is-loaded");
    });

    tile.append(image);
    world.append(tile);
    tiles.push({ element: tile, row, column, phase: index * 0.53 });
  });
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function resetDrop(drop, initial = false) {
  const horizontalRange = sceneMobile ? 520 : 950;
  const sceneDepth = drop.layer === "front"
    ? randomBetween(260, 1280)
    : randomBetween(-820, -110);

  drop.x = randomBetween(-horizontalRange, horizontalRange);
  drop.y = initial ? randomBetween(-620, rainGroundY) : randomBetween(-720, -500);
  drop.z = sceneDepth - sceneRadius;
  drop.speed = randomBetween(0.31, 0.55);
  drop.length = randomBetween(30, 66);
  drop.element.style.setProperty("--drop-length", `${drop.length}px`);
  drop.element.style.setProperty("--drop-opacity", String(randomBetween(0.26, 0.59)));
}

function makeRain() {
  if (reducedMotion) return;

  [
    { layer: "back", world: rainWorldBack, drops: 72, ripples: 25 },
    { layer: "front", world: rainWorldFront, drops: 96, ripples: 35 },
  ].forEach(({ layer, world: rainWorld, drops, ripples }) => {
    for (let index = 0; index < drops; index += 1) {
      const element = document.createElement("span");
      const drop = { element, layer, x: 0, y: 0, z: 0, speed: 0, length: 0 };
      element.className = "raindrop";
      resetDrop(drop, true);
      rainWorld.append(element);
      rainDrops.push(drop);
    }

    for (let index = 0; index < ripples; index += 1) {
      const element = document.createElement("span");
      element.className = "rain-ripple";
      rainWorld.append(element);
      rainRipples.push({ element, layer, active: false, born: 0, x: 0, z: 0 });
    }
  });
}

function makeRipple(x, z, time, layer) {
  const layerRipples = rainRipples.filter((item) => item.layer === layer);
  const ripple = layerRipples.find((item) => !item.active) || layerRipples[0];
  ripple.active = true;
  ripple.born = time;
  ripple.x = x;
  ripple.z = z;
}

function animateRain(time) {
  if (reducedMotion) return;

  const delta = Math.min(34, lastRainTime ? time - lastRainTime : 16);
  const upwardLook = clamp(-state.pitch / 22, 0, 1);
  const horizontalRange = sceneMobile ? 520 : 950;
  lastRainTime = time;

  rainDrops.forEach((drop) => {
    drop.y += drop.speed * delta;
    if (drop.y >= rainGroundY) {
      makeRipple(drop.x, drop.z, time, drop.layer);
      resetDrop(drop);
    }
    const horizontalPosition = clamp(drop.x / horizontalRange, -1, 1);
    const fanAngle = -horizontalPosition * upwardLook * 13;
    const forwardTilt = -state.pitch * upwardLook * 2.1;
    const stretch = 1 + upwardLook * (drop.layer === "front" ? 0.82 : 0.54);
    drop.element.style.transform = `translate3d(${drop.x}px, ${drop.y}px, ${drop.z}px) rotateZ(${fanAngle}deg) rotateX(${forwardTilt}deg) scaleY(${stretch})`;
  });

  rainRipples.forEach((ripple) => {
    if (!ripple.active) return;
    const progress = (time - ripple.born) / 1080;
    if (progress >= 1) {
      ripple.active = false;
      ripple.element.style.opacity = "0";
      return;
    }
    const scale = 0.22 + progress * 2.5;
    ripple.element.style.opacity = String((1 - progress) * 0.46);
    ripple.element.style.transform = `translate3d(${ripple.x}px, ${rainGroundY}px, ${ripple.z}px) rotateX(72deg) scale(${scale})`;
  });
}

function layoutTiles(time = 0) {
  const mobile = window.innerWidth < 700;
  const cameraDistance = mobile ? 620 : 850;
  const sphereRadius = cameraDistance;
  const perspectiveDistance = mobile ? 2700 : 3200;
  const mastheadDepth = 2200;
  const mastheadScale = (perspectiveDistance - mastheadDepth) / perspectiveDistance;
  const horizontalStep = mobile ? 13 : 14;
  const verticalStep = mobile ? 18 : 16;
  const floatAmount = reducedMotion ? 0 : 6.2;

  sceneMobile = mobile;
  sceneRadius = sphereRadius;
  rainGroundY = Math.max(300, window.innerHeight * 0.4);
  gallery.style.perspective = `${perspectiveDistance}px`;

  tiles.forEach(({ element, row, column, phase }) => {
    const yawAngle = (column - 3) * horizontalStep;
    const pitchAngle = row * verticalStep;
    const yawRadians = yawAngle * Math.PI / 180;
    const pitchRadians = pitchAngle * Math.PI / 180;
    const floatY = Math.sin(time * 0.00045 + phase) * floatAmount;
    const floatRotation = Math.sin(time * 0.00032 + phase * 1.4) * 0.42;
    const x = sphereRadius * Math.sin(yawRadians) * Math.cos(pitchRadians);
    const y = sphereRadius * Math.sin(pitchRadians) + floatY;
    const z = -sphereRadius * Math.cos(yawRadians) * Math.cos(pitchRadians);
    const edge = (Math.abs(yawAngle) + Math.abs(pitchAngle) * 0.55) / 55;
    const opacity = Math.max(0.68, 0.98 - edge * 0.16);
    const blur = Math.max(0, edge * 0.18);

    element.style.opacity = String(opacity);
    element.style.filter = `saturate(.9) brightness(1.02) blur(${blur}px)`;
    element.style.transform = `translate3d(calc(${x}px - 50%), calc(${y}px - 50%), ${z}px) rotateY(${-yawAngle}deg) rotateX(${pitchAngle}deg) rotateZ(${floatRotation}deg)`;
  });

  // The title stays camera-facing and floats 2200px in front of the wall.
  // Scale compensation preserves its original apparent type size at that depth.
  masthead.style.transform = `translate3d(-50%, -50%, ${mastheadDepth}px) scale(${mastheadScale})`;
  masthead.dataset.depth = String(mastheadDepth);

  world.dataset.cameraDistance = String(cameraDistance);
}

function animate(time) {
  if (!state.dragging) {
    state.targetYaw = clamp(state.targetYaw + state.yawVelocity, -32, 32);
    state.yawVelocity *= 0.93;
    state.targetPitch = clamp(state.targetPitch + state.pitchVelocity, -22, 22);
    state.pitchVelocity *= 0.91;
  }

  state.yaw += (state.targetYaw - state.yaw) * (reducedMotion ? 1 : 0.085);
  state.pitch += (state.targetPitch - state.pitch) * (reducedMotion ? 1 : 0.085);
  const cameraDistance = Number(world.dataset.cameraDistance || 1100);
  world.style.transform = `translateZ(${cameraDistance}px) rotateX(${state.pitch}deg) rotateY(${-state.yaw}deg)`;
  rainWorldBack.style.transform = world.style.transform;
  rainWorldFront.style.transform = world.style.transform;
  layoutTiles(time);
  animateRain(time);
  requestAnimationFrame(animate);
}

function onPointerDown(event) {
  state.dragging = true;
  state.lastX = event.clientX;
  state.lastY = event.clientY;
  state.yawVelocity = 0;
  state.pitchVelocity = 0;
  portfolio.classList.add("is-dragging");
  portfolio.setPointerCapture?.(event.pointerId);
}

function onPointerMove(event) {
  if (state.dragging) {
    const deltaX = event.clientX - state.lastX;
    const deltaY = event.clientY - state.lastY;
    state.targetYaw = clamp(state.targetYaw + deltaX * 0.045, -32, 32);
    state.targetPitch = clamp(state.targetPitch + deltaY * 0.045, -22, 22);
    state.yawVelocity = deltaX * 0.0032;
    state.pitchVelocity = deltaY * 0.0032;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
  }
}

function onPointerUp(event) {
  state.dragging = false;
  portfolio.classList.remove("is-dragging");
  portfolio.releasePointerCapture?.(event.pointerId);
}

portfolio.addEventListener("pointerdown", onPointerDown);
portfolio.addEventListener("pointermove", onPointerMove);
portfolio.addEventListener("pointerup", onPointerUp);
portfolio.addEventListener("pointercancel", onPointerUp);
portfolio.addEventListener("wheel", (event) => {
  state.targetYaw = clamp(
    state.targetYaw + event.deltaY * 0.018 + event.deltaX * 0.025,
    -32,
    32
  );
}, { passive: true });
window.addEventListener("resize", () => {
  layoutTiles();
  rainDrops.forEach((drop) => resetDrop(drop, true));
});

makeTiles();
layoutTiles();
makeRain();
requestAnimationFrame(animate);
