(function () {
  "use strict";

  const stage = document.querySelector("#bookStage");
  const canvas = document.querySelector("#bookCanvas");
  const nextButton = document.querySelector("#nextPage");
  const previousButton = document.querySelector("#previousPage");
  const status = document.querySelector("#pageStatus");
  const fallback = document.querySelector(".book-fallback");

  if (!window.THREE) {
    status.textContent = "The 3D book could not start";
    return;
  }

  const THREE = window.THREE;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fragmentContainer = document.querySelector(".zine-experience");
  const fragmentMotion = Array.from(document.querySelectorAll(".fragment"), (element) => {
    const styles = getComputedStyle(element);
    const baseRotation = parseFloat(styles.getPropertyValue("--base-rotation")) || 0;
    const angle = Math.random() * Math.PI * 2;

    return {
      element,
      x: 0,
      y: 0,
      angle,
      targetAngle: angle,
      speed: 4 + Math.random() * 4,
      impulseX: 0,
      impulseY: 0,
      rotation: 0,
      spin: (Math.random() - 0.5) * 0.28,
      baseRotation,
      nextTurnAt: performance.now() + 3500 + Math.random() * 6500,
    };
  });
  let previousFragmentTime = 0;
  const backgroundDrag = {
    active: false,
    pointerId: null,
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    previousTime: 0,
  };
  const spreads = [
    { src: "assets/zine/content.jpg", label: "Content · pages 0–1" },
    { src: "assets/zine/02-03.jpg", label: "The Blue Era · pages 2–3" },
    { src: "assets/zine/04-05.jpg", label: "The Rose Period · pages 4–5" },
    { src: "assets/zine/06-07.jpg", label: "Acrobat and Young Harlequin · pages 6–7" },
    { src: "assets/zine/08-09.jpg", label: "African Period · pages 8–9" },
    { src: "assets/zine/10-11.jpg", label: "Cubism · pages 10–11" },
    { src: "assets/zine/12-13.jpg", label: "Cubist works · pages 12–13" },
    { src: "assets/zine/14-15.jpg", label: "Surrealism · pages 14–15" },
  ];

  const PAGE_HEIGHT = 7;
  const PAGE_WIDTH = PAGE_HEIGHT * (1200 / 1697);
  const PAGE_SEGMENTS = 34;
  const TURN_DURATION = reducedMotion ? 1 : 920;
  const PAPER_COLOR = 0xf8f6ec;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch (error) {
    console.error("WebGL could not start.", error);
    status.textContent = "The 3D book could not start";
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(29, 1, 0.1, 100);
  const book = new THREE.Group();
  book.rotation.set(-0.075, -0.035, 0);
  book.position.x = -PAGE_WIDTH / 2;
  scene.add(book);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xc8c1b1, 1.25));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.65);
  keyLight.position.set(-4, 7, 10);
  keyLight.castShadow = true;
  scene.add(keyLight);

  const pageGeometry = new THREE.PlaneGeometry(PAGE_WIDTH, PAGE_HEIGHT, 1, 1);
  const paperMaterial = () => new THREE.MeshBasicMaterial({ color: PAPER_COLOR });
  const leftPage = new THREE.Mesh(pageGeometry, paperMaterial());
  const rightPage = new THREE.Mesh(pageGeometry, paperMaterial());
  // Meet precisely at the spine. The former offset exposed the page block
  // between the two halves and made the center look like two parallel lines.
  leftPage.position.set(-PAGE_WIDTH / 2, 0, 0.04);
  rightPage.position.set(PAGE_WIDTH / 2, 0, 0.04);
  leftPage.visible = false;
  rightPage.visible = false;
  book.add(leftPage, rightPage);

  const pageBlock = new THREE.Mesh(
    new THREE.BoxGeometry(PAGE_WIDTH * 2 + 0.08, PAGE_HEIGHT + 0.07, 0.15),
    new THREE.MeshStandardMaterial({
      color: 0xe9e4d6,
      roughness: 0.97,
      metalness: 0,
    })
  );
  pageBlock.position.set(PAGE_WIDTH / 2, 0, -0.055);
  pageBlock.scale.x = 0.5;
  pageBlock.castShadow = true;
  pageBlock.receiveShadow = true;
  book.add(pageBlock);

  const cover = new THREE.Mesh(pageGeometry, paperMaterial());
  cover.position.set(PAGE_WIDTH / 2, 0, 0.11);
  cover.castShadow = true;
  book.add(cover);

  const textureLoader = new THREE.TextureLoader();
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  let coverTexture = null;
  let spreadTextures = [];
  let spreadIndex = -1;
  let pagesReady = false;
  const interactive = true;
  let turn = null;
  let targetTiltX = -0.075;
  let targetTiltY = -0.035;
  let targetBookX = -PAGE_WIDTH / 2;

  function prepareTexture(texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(maxAnisotropy, 8);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
  }

  function loadTexture(src) {
    return new Promise((resolve, reject) => {
      textureLoader.load(
        src,
        (texture) => resolve(prepareTexture(texture)),
        undefined,
        reject
      );
    });
  }

  function cropTexture(source, side, mirrored) {
    const texture = source.clone();
    texture.image = source.image;
    texture.repeat.set(mirrored ? -0.5 : 0.5, 1);
    if (side === "left") texture.offset.set(mirrored ? 0.5 : 0, 0);
    else texture.offset.set(mirrored ? 1 : 0.5, 0);
    texture.needsUpdate = true;
    return texture;
  }

  function setPageTexture(mesh, texture) {
    if (mesh.material.map && mesh.material.map !== texture) {
      mesh.material.map.dispose();
    }
    mesh.material.map = texture || null;
    mesh.material.color.set(texture ? 0xffffff : PAPER_COLOR);
    mesh.material.needsUpdate = true;
  }

  function showSpread(leftIndex, rightIndex) {
    setPageTexture(
      leftPage,
      leftIndex >= 0 ? cropTexture(spreadTextures[leftIndex], "left", false) : null
    );
    setPageTexture(
      rightPage,
      rightIndex >= 0 ? cropTexture(spreadTextures[rightIndex], "right", false) : null
    );
  }

  function setClosed() {
    spreadIndex = -1;
    leftPage.visible = false;
    rightPage.visible = false;
    cover.visible = true;
    pageBlock.scale.x = 0.5;
    pageBlock.position.x = PAGE_WIDTH / 2;
    targetBookX = -PAGE_WIDTH / 2;
    setPageTexture(cover, coverTexture);
    updateControls();
  }

  function setOpen(index) {
    spreadIndex = index;
    cover.visible = false;
    leftPage.visible = true;
    rightPage.visible = true;
    pageBlock.scale.x = 1;
    pageBlock.position.x = 0;
    targetBookX = 0;
    showSpread(index, index);
    updateControls();
  }

  function updateControls() {
    const turning = Boolean(turn);
    status.textContent = !pagesReady && spreadIndex < 0
      ? "Loading pages…"
      : spreadIndex < 0
        ? "Cover"
        : spreads[spreadIndex].label;
    previousButton.disabled = !interactive || turning || spreadIndex < 0 || !pagesReady;
    nextButton.disabled = !interactive || turning || !pagesReady;
    stage.classList.toggle("is-turning", turning);
  }

  function createTurningSheet(origin, frontTexture, backTexture) {
    const geometry = new THREE.PlaneGeometry(
      PAGE_WIDTH,
      PAGE_HEIGHT,
      PAGE_SEGMENTS,
      2
    );
    geometry.translate(PAGE_WIDTH / 2, 0, 0);
    geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);

    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const baseY = new Float32Array(position.count);
    for (let index = 0; index < position.count; index += 1) {
      baseY[index] = position.getY(index);
    }

    const material = new THREE.MeshBasicMaterial({
      map: frontTexture,
      color: frontTexture ? 0xffffff : PAPER_COLOR,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = 0.13;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    mesh.renderOrder = 10;
    book.add(mesh);

    return {
      origin,
      frontTexture,
      backTexture,
      showingBack: false,
      geometry,
      position,
      uv,
      baseY,
      material,
      mesh,
    };
  }

  function deformTurningSheet(sheet, progress) {
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    const angle = sheet.origin === "right"
      ? Math.PI * eased
      : Math.PI * (1 - eased);
    const lift = Math.sin(Math.PI * progress);

    for (let index = 0; index < sheet.position.count; index += 1) {
      const u = sheet.uv.getX(index);
      const distance = u * PAGE_WIDTH;
      const curve = Math.sin(Math.PI * u) * lift;
      const edgeCurl = Math.sin(Math.PI * u * 0.92) * lift;
      const x = distance * Math.cos(angle) + (sheet.origin === "right" ? -1 : 1) * curve * 0.11;
      const z = distance * Math.sin(angle) + edgeCurl * 0.44;
      const y = sheet.baseY[index] + Math.sin(Math.PI * u) * lift * 0.035;
      sheet.position.setXYZ(index, x, y, z);
    }

    sheet.position.needsUpdate = true;
    sheet.geometry.computeVertexNormals();

    const shouldShowBack = progress >= 0.5;
    if (shouldShowBack !== sheet.showingBack) {
      sheet.showingBack = shouldShowBack;
      sheet.material.map = shouldShowBack ? sheet.backTexture : sheet.frontTexture;
      sheet.material.color.set(sheet.material.map ? 0xffffff : PAPER_COLOR);
      sheet.material.needsUpdate = true;
    }
  }

  function removeTurningSheet() {
    if (!turn) return;
    book.remove(turn.sheet.mesh);
    turn.sheet.geometry.dispose();
    turn.sheet.material.dispose();
  }

  function beginTurn(config) {
    if (!interactive || turn || !pagesReady) return;
    turn = {
      ...config,
      startedAt: performance.now(),
    };
    updateControls();
  }

  function turnForward() {
    if (!interactive || turn || !pagesReady) return;

    if (spreadIndex < 0) {
      cover.visible = false;
      leftPage.visible = false;
      rightPage.visible = true;
      targetBookX = 0;
      showSpread(-1, 0);
      beginTurn({
        kind: "open-cover",
        targetIndex: 0,
        sheet: createTurningSheet(
          "right",
          coverTexture,
          cropTexture(spreadTextures[0], "left", true)
        ),
      });
      return;
    }

    if (spreadIndex === spreads.length - 1) {
      targetBookX = -PAGE_WIDTH / 2;
      leftPage.visible = false;
      pageBlock.scale.x = 0.5;
      pageBlock.position.x = PAGE_WIDTH / 2;
      beginTurn({
        kind: "close-cover",
        targetIndex: -1,
        sheet: createTurningSheet(
          "left",
          cropTexture(spreadTextures[spreadIndex], "left", true),
          coverTexture
        ),
      });
      return;
    }

    const nextIndex = spreadIndex + 1;
    // The next right page sits beneath the moving current right page.
    showSpread(spreadIndex, nextIndex);
    beginTurn({
      kind: "forward",
      targetIndex: nextIndex,
      sheet: createTurningSheet(
        "right",
        cropTexture(spreadTextures[spreadIndex], "right", false),
        cropTexture(spreadTextures[nextIndex], "left", true)
      ),
    });
  }

  function turnBackward() {
    if (!interactive || turn || !pagesReady || spreadIndex < 0) return;

    if (spreadIndex === 0) {
      targetBookX = -PAGE_WIDTH / 2;
      leftPage.visible = false;
      pageBlock.scale.x = 0.5;
      pageBlock.position.x = PAGE_WIDTH / 2;
      beginTurn({
        kind: "close-cover",
        targetIndex: -1,
        sheet: createTurningSheet(
          "left",
          cropTexture(spreadTextures[spreadIndex], "left", true),
          coverTexture
        ),
      });
      return;
    }

    const previousIndex = spreadIndex - 1;
    // The previous left page sits beneath the moving current left page.
    showSpread(previousIndex, spreadIndex);
    beginTurn({
      kind: "backward",
      targetIndex: previousIndex,
      sheet: createTurningSheet(
        "left",
        cropTexture(spreadTextures[spreadIndex], "left", true),
        cropTexture(spreadTextures[previousIndex], "right", false)
      ),
    });
  }

  function finishTurn() {
    const completed = turn;
    removeTurningSheet();
    turn = null;
    if (completed.targetIndex < 0) setClosed();
    else setOpen(completed.targetIndex);
  }

  function animateTurn(time) {
    if (!turn) return;
    const progress = Math.min(1, (time - turn.startedAt) / TURN_DURATION);
    deformTurningSheet(turn.sheet, progress);
    if (progress >= 1) finishTurn();
  }

  function resize() {
    const width = Math.max(1, stage.clientWidth);
    const height = Math.max(1, stage.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;

    const openWidth = PAGE_WIDTH * 2;
    const verticalDistance = PAGE_HEIGHT
      / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const horizontalFov = 2 * Math.atan(
      Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect
    );
    const horizontalDistance = openWidth / (2 * Math.tan(horizontalFov / 2));
    camera.position.set(0, 0.15, Math.max(verticalDistance * 1.18, horizontalDistance * 1.16));
    camera.updateProjectionMatrix();
  }

  function shortestAngle(from, to) {
    return Math.atan2(Math.sin(to - from), Math.cos(to - from));
  }

  function getFragmentBounds(motion) {
    const width = motion.element.offsetWidth;
    const height = motion.element.offsetHeight;
    const rotation = THREE.MathUtils.degToRad(motion.baseRotation + motion.rotation);
    const cosine = Math.abs(Math.cos(rotation));
    const sine = Math.abs(Math.sin(rotation));
    const boundsWidth = width * cosine + height * sine;
    const boundsHeight = width * sine + height * cosine;
    const left = motion.element.offsetLeft + motion.x - (boundsWidth - width) / 2;
    const top = motion.element.offsetTop + motion.y - (boundsHeight - height) / 2;

    return {
      left,
      right: left + boundsWidth,
      top,
      bottom: top + boundsHeight,
      centerX: left + boundsWidth / 2,
      centerY: top + boundsHeight / 2,
    };
  }

  function repelOverlappingFragments() {
    for (let firstIndex = 0; firstIndex < fragmentMotion.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < fragmentMotion.length; secondIndex += 1) {
        const first = fragmentMotion[firstIndex];
        const second = fragmentMotion[secondIndex];
        const firstBounds = getFragmentBounds(first);
        const secondBounds = getFragmentBounds(second);
        const overlapX = Math.min(firstBounds.right, secondBounds.right)
          - Math.max(firstBounds.left, secondBounds.left);
        const overlapY = Math.min(firstBounds.bottom, secondBounds.bottom)
          - Math.max(firstBounds.top, secondBounds.top);

        if (overlapX <= 0 || overlapY <= 0) continue;

        let normalX = 0;
        let normalY = 0;
        if (overlapX < overlapY) {
          normalX = firstBounds.centerX < secondBounds.centerX ? 1 : -1;
          const correction = overlapX / 2 + 0.5;
          first.x -= normalX * correction;
          second.x += normalX * correction;
        } else {
          normalY = firstBounds.centerY < secondBounds.centerY ? 1 : -1;
          const correction = overlapY / 2 + 0.5;
          first.y -= normalY * correction;
          second.y += normalY * correction;
        }

        const firstVelocityX = Math.cos(first.angle) * first.speed + first.impulseX;
        const firstVelocityY = Math.sin(first.angle) * first.speed + first.impulseY;
        const secondVelocityX = Math.cos(second.angle) * second.speed + second.impulseX;
        const secondVelocityY = Math.sin(second.angle) * second.speed + second.impulseY;
        const closingSpeed = (firstVelocityX - secondVelocityX) * normalX
          + (firstVelocityY - secondVelocityY) * normalY;

        if (closingSpeed > 0) {
          const nextFirstVelocityX = firstVelocityX - closingSpeed * normalX;
          const nextFirstVelocityY = firstVelocityY - closingSpeed * normalY;
          const nextSecondVelocityX = secondVelocityX + closingSpeed * normalX;
          const nextSecondVelocityY = secondVelocityY + closingSpeed * normalY;

          first.speed = Math.max(3.5, Math.hypot(nextFirstVelocityX, nextFirstVelocityY));
          second.speed = Math.max(3.5, Math.hypot(nextSecondVelocityX, nextSecondVelocityY));
          first.angle = Math.atan2(nextFirstVelocityY, nextFirstVelocityX);
          second.angle = Math.atan2(nextSecondVelocityY, nextSecondVelocityX);
          first.targetAngle = first.angle;
          second.targetAngle = second.angle;
          first.impulseX = 0;
          first.impulseY = 0;
          second.impulseX = 0;
          second.impulseY = 0;
        }
      }
    }
  }

  function applyBackgroundDragForce(pointerX, pointerY, velocityX, velocityY) {
    if (!fragmentContainer) return;
    const reach = Math.max(
      320,
      Math.min(fragmentContainer.clientWidth, fragmentContainer.clientHeight) * 0.62
    );

    fragmentMotion.forEach((motion) => {
      const bounds = getFragmentBounds(motion);
      const deltaX = bounds.centerX - pointerX;
      const deltaY = bounds.centerY - pointerY;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance >= reach) return;

      const normalizedDistance = distance / reach;
      const influence = Math.pow(1 - normalizedDistance, 2);
      const pointerSpeed = Math.hypot(velocityX, velocityY);
      const wakeStrength = Math.min(32, pointerSpeed * 0.032) * influence;
      const distanceSafe = Math.max(1, distance);

      motion.impulseX += velocityX * 0.2 * influence
        + (deltaX / distanceSafe) * wakeStrength;
      motion.impulseY += velocityY * 0.2 * influence
        + (deltaY / distanceSafe) * wakeStrength;

      const impulseMagnitude = Math.hypot(motion.impulseX, motion.impulseY);
      if (impulseMagnitude > 165) {
        const limit = 165 / impulseMagnitude;
        motion.impulseX *= limit;
        motion.impulseY *= limit;
      }
    });
  }

  function beginBackgroundDrag(event) {
    if (event.button !== 0 || event.target.closest(".book-stage")) return;
    const bounds = fragmentContainer.getBoundingClientRect();
    backgroundDrag.active = true;
    backgroundDrag.pointerId = event.pointerId;
    backgroundDrag.x = event.clientX - bounds.left;
    backgroundDrag.y = event.clientY - bounds.top;
    backgroundDrag.velocityX = 0;
    backgroundDrag.velocityY = 0;
    backgroundDrag.previousTime = performance.now();
    fragmentContainer.classList.add("is-dragging");
    fragmentContainer.setPointerCapture?.(event.pointerId);
  }

  function moveBackgroundDrag(event) {
    if (!backgroundDrag.active || event.pointerId !== backgroundDrag.pointerId) return;
    const bounds = fragmentContainer.getBoundingClientRect();
    const nextX = event.clientX - bounds.left;
    const nextY = event.clientY - bounds.top;
    const now = performance.now();
    const deltaSeconds = Math.max(0.008, (now - backgroundDrag.previousTime) / 1000);
    const measuredVelocityX = (nextX - backgroundDrag.x) / deltaSeconds;
    const measuredVelocityY = (nextY - backgroundDrag.y) / deltaSeconds;

    backgroundDrag.velocityX += (measuredVelocityX - backgroundDrag.velocityX) * 0.42;
    backgroundDrag.velocityY += (measuredVelocityY - backgroundDrag.velocityY) * 0.42;
    applyBackgroundDragForce(
      nextX,
      nextY,
      backgroundDrag.velocityX,
      backgroundDrag.velocityY
    );

    backgroundDrag.x = nextX;
    backgroundDrag.y = nextY;
    backgroundDrag.previousTime = now;
  }

  function endBackgroundDrag(event) {
    if (!backgroundDrag.active || event.pointerId !== backgroundDrag.pointerId) return;
    backgroundDrag.active = false;
    fragmentContainer.classList.remove("is-dragging");
    fragmentContainer.releasePointerCapture?.(event.pointerId);
    backgroundDrag.pointerId = null;
  }

  function animateFragments(time) {
    if (reducedMotion || !fragmentContainer) return;

    if (!previousFragmentTime) {
      previousFragmentTime = time;
      return;
    }

    const delta = Math.min(0.05, (time - previousFragmentTime) / 1000);
    previousFragmentTime = time;
    const containerWidth = fragmentContainer.clientWidth;
    const containerHeight = fragmentContainer.clientHeight;
    const containerRect = fragmentContainer.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const bookInsetX = stageRect.width * 0.1;
    const bookInsetY = stageRect.height * 0.1;
    const bookBounds = {
      left: stageRect.left - containerRect.left + bookInsetX,
      right: stageRect.right - containerRect.left - bookInsetX,
      top: stageRect.top - containerRect.top + bookInsetY,
      bottom: stageRect.bottom - containerRect.top - bookInsetY,
    };

    fragmentMotion.forEach((motion) => {
      if (time >= motion.nextTurnAt) {
        motion.targetAngle += (Math.random() - 0.5) * Math.PI * 0.9;
        motion.speed = 4 + Math.random() * 4;
        motion.spin = (Math.random() - 0.5) * 0.28;
        motion.nextTurnAt = time + 3500 + Math.random() * 6500;
      }

      motion.angle += shortestAngle(motion.angle, motion.targetAngle)
        * Math.min(1, delta * 0.32);
      motion.x += (Math.cos(motion.angle) * motion.speed + motion.impulseX) * delta;
      motion.y += (Math.sin(motion.angle) * motion.speed + motion.impulseY) * delta;
      motion.rotation += motion.spin * delta;
      const impulseDamping = Math.pow(0.93, delta * 60);
      motion.impulseX *= impulseDamping;
      motion.impulseY *= impulseDamping;

      const elementWidth = motion.element.offsetWidth;
      const elementHeight = motion.element.offsetHeight;
      const rotation = THREE.MathUtils.degToRad(motion.baseRotation + motion.rotation);
      const cosine = Math.abs(Math.cos(rotation));
      const sine = Math.abs(Math.sin(rotation));
      const boundsWidth = elementWidth * cosine + elementHeight * sine;
      const boundsHeight = elementWidth * sine + elementHeight * cosine;
      let left = motion.element.offsetLeft + motion.x - (boundsWidth - elementWidth) / 2;
      let top = motion.element.offsetTop + motion.y - (boundsHeight - elementHeight) / 2;
      let bouncedHorizontally = false;
      let bouncedVertically = false;

      if (left < 0) {
        motion.x -= left;
        bouncedHorizontally = Math.cos(motion.angle) < 0;
      } else if (left + boundsWidth > containerWidth) {
        motion.x -= left + boundsWidth - containerWidth;
        bouncedHorizontally = Math.cos(motion.angle) > 0;
      }

      if (top < 0) {
        motion.y -= top;
        bouncedVertically = Math.sin(motion.angle) < 0;
      } else if (top + boundsHeight > containerHeight) {
        motion.y -= top + boundsHeight - containerHeight;
        bouncedVertically = Math.sin(motion.angle) > 0;
      }

      if (bouncedHorizontally) {
        motion.angle = Math.PI - motion.angle;
        motion.targetAngle = Math.PI - motion.targetAngle;
        motion.impulseX *= -0.58;
      }

      if (bouncedVertically) {
        motion.angle = -motion.angle;
        motion.targetAngle = -motion.targetAngle;
        motion.impulseY *= -0.58;
      }

      left = motion.element.offsetLeft + motion.x - (boundsWidth - elementWidth) / 2;
      top = motion.element.offsetTop + motion.y - (boundsHeight - elementHeight) / 2;
      const right = left + boundsWidth;
      const bottom = top + boundsHeight;
      const touchesBook = right > bookBounds.left
        && left < bookBounds.right
        && bottom > bookBounds.top
        && top < bookBounds.bottom;

      if (touchesBook) {
        const exits = [
          { side: "left", distance: right - bookBounds.left },
          { side: "right", distance: bookBounds.right - left },
          { side: "top", distance: bottom - bookBounds.top },
          { side: "bottom", distance: bookBounds.bottom - top },
        ];
        exits.sort((first, second) => first.distance - second.distance);
        const exit = exits[0];

        if (exit.side === "left") {
          motion.x -= exit.distance;
          if (Math.cos(motion.angle) > 0) {
            motion.angle = Math.PI - motion.angle;
            motion.targetAngle = Math.PI - motion.targetAngle;
          }
          motion.impulseX = -Math.abs(motion.impulseX) * 0.58;
        } else if (exit.side === "right") {
          motion.x += exit.distance;
          if (Math.cos(motion.angle) < 0) {
            motion.angle = Math.PI - motion.angle;
            motion.targetAngle = Math.PI - motion.targetAngle;
          }
          motion.impulseX = Math.abs(motion.impulseX) * 0.58;
        } else if (exit.side === "top") {
          motion.y -= exit.distance;
          if (Math.sin(motion.angle) > 0) {
            motion.angle = -motion.angle;
            motion.targetAngle = -motion.targetAngle;
          }
          motion.impulseY = -Math.abs(motion.impulseY) * 0.58;
        } else {
          motion.y += exit.distance;
          if (Math.sin(motion.angle) < 0) {
            motion.angle = -motion.angle;
            motion.targetAngle = -motion.targetAngle;
          }
          motion.impulseY = Math.abs(motion.impulseY) * 0.58;
        }
      }

    });

    repelOverlappingFragments();

    fragmentMotion.forEach((motion) => {
      motion.element.style.transform =
        `translate3d(${motion.x.toFixed(2)}px, ${motion.y.toFixed(2)}px, 0) `
        + `rotate(${(motion.baseRotation + motion.rotation).toFixed(2)}deg)`;
    });
  }

  function animate(time) {
    animateTurn(time);
    animateFragments(time);
    book.rotation.x += (targetTiltX - book.rotation.x) * 0.07;
    book.rotation.y += (targetTiltY - book.rotation.y) * 0.07;
    book.position.x += (targetBookX - book.position.x) * 0.075;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  nextButton.addEventListener("click", turnForward);
  previousButton.addEventListener("click", turnBackward);
  fragmentContainer.addEventListener("pointerdown", beginBackgroundDrag);
  fragmentContainer.addEventListener("pointermove", moveBackgroundDrag);
  fragmentContainer.addEventListener("pointerup", endBackgroundDrag);
  fragmentContainer.addEventListener("pointercancel", endBackgroundDrag);

  stage.addEventListener("pointerup", (event) => {
    if (!interactive || turn || !pagesReady) return;
    const bounds = stage.getBoundingClientRect();
    if (event.clientX - bounds.left >= bounds.width / 2) turnForward();
    else turnBackward();
  });

  stage.addEventListener("pointermove", (event) => {
    if (!interactive || reducedMotion || turn) return;
    const bounds = stage.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    targetTiltY = THREE.MathUtils.clamp(x * 0.16, -0.09, 0.09);
    targetTiltX = THREE.MathUtils.clamp(-0.075 - y * 0.12, -0.14, 0.025);
  });

  stage.addEventListener("pointerleave", () => {
    targetTiltX = -0.075;
    targetTiltY = -0.035;
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") turnForward();
    if (event.key === "ArrowLeft") turnBackward();
  });
  window.addEventListener("resize", resize);

  resize();
  updateControls();

  loadTexture("assets/zine/cover.jpg")
    .then((loadedCover) => {
      coverTexture = loadedCover;
      setPageTexture(cover, coverTexture);
      fallback.alt = "";
      stage.classList.add("is-three-ready");
      requestAnimationFrame(animate);
      return Promise.all(spreads.map(({ src }) => loadTexture(src)));
    })
    .then((loadedSpreads) => {
      spreadTextures = loadedSpreads;
      pagesReady = true;
      setClosed();
      canvas.dataset.ready = "true";
    })
    .catch((error) => {
      console.error("The zine images could not be loaded.", error);
      status.textContent = coverTexture
        ? "Unable to load interior pages"
        : "Unable to load zine";
    });
})();
