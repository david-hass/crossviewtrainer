const leftCanvas = document.getElementById("leftCanvas");
const rightCanvas = document.getElementById("rightCanvas");
const leftCtx = leftCanvas.getContext("2d");
const rightCtx = rightCanvas.getContext("2d");

const newRoundBtn = document.getElementById("newRoundBtn");
const solveBtn = document.getElementById("solveBtn");
const speedRange = document.getElementById("speedRange");
const statusEl = document.getElementById("status");

const SIZE = leftCanvas.width;
const CENTER = SIZE / 2;
const RADIUS = SIZE * 0.46;
const RINGS = 6;
const SPOKES = 16;
const INNER_BLANK_RADIUS = RADIUS / RINGS;

const DOT_COUNT = 3400;
const DOT_RADIUS = 2.2;
const EXTRA_DOT_RADIUS = 2.9;
const MIN_DOT_DISTANCE = DOT_RADIUS * 2 + 0.12;
const EXTRA_MIN_DISTANCE = DOT_RADIUS + EXTRA_DOT_RADIUS + 0.15;
const GRID_LINE_CLEARANCE = DOT_RADIUS + 0.9;
const EXTRA_GRID_LINE_CLEARANCE = EXTRA_DOT_RADIUS + 1.0;

const CONE_WIDTH = Math.PI / 7.7;

const dotPalette = ["#ffec3d", "#e83f3f", "#34d163", "#6ec2ff"];

let dots = [];
let extraDot = null;
let extraSide = 0;
let extraCell = { ring: 1, sector: 1 };
let guessedCell = null;
let solveResult = null;

let coneAngle = Math.PI / 6;
let rotationSpeed = Number(speedRange.value) * 0.0043;
let rotationDirection = Math.random() < 0.5 ? -1 : 1;
let isSolved = false;
let lastFrame = performance.now();

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randomPaletteColor() {
  return dotPalette[Math.floor(rand(0, dotPalette.length))];
}

function randomDot() {
  const angle = rand(0, Math.PI * 2);
  const minR = INNER_BLANK_RADIUS + 4;
  const maxR = RADIUS - 7;
  const radius = Math.sqrt(Math.random() * (maxR * maxR - minR * minR) + minR * minR);
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    color: randomPaletteColor()
  };
}

function cellKey(cx, cy) {
  return `${cx},${cy}`;
}

function gridCoords(x, y, cellSize) {
  return {
    cx: Math.floor((x + RADIUS) / cellSize),
    cy: Math.floor((y + RADIUS) / cellSize)
  };
}

function canPlaceDot(point, grid, cellSize, minDistance) {
  const { cx, cy } = gridCoords(point.x, point.y, cellSize);
  for (let ix = cx - 1; ix <= cx + 1; ix += 1) {
    for (let iy = cy - 1; iy <= cy + 1; iy += 1) {
      const neighbors = grid.get(cellKey(ix, iy));
      if (!neighbors) continue;
      for (const neighbor of neighbors) {
        const dx = point.x - neighbor.x;
        const dy = point.y - neighbor.y;
        if (Math.hypot(dx, dy) < minDistance) {
          return false;
        }
      }
    }
  }
  return true;
}

function normalizeAngle(angle) {
  let a = angle;
  while (a < 0) a += Math.PI * 2;
  while (a >= Math.PI * 2) a -= Math.PI * 2;
  return a;
}

function wrapDelta(angle) {
  let d = angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function hasGridClearance(point, clearance) {
  const r = Math.hypot(point.x, point.y);
  const ringStep = RADIUS / RINGS;

  for (let k = 1; k <= RINGS; k += 1) {
    const ringLineR = k * ringStep;
    if (Math.abs(r - ringLineR) < clearance) {
      return false;
    }
  }

  const angle = normalizeAngle(Math.atan2(point.y, point.x));
  const spokeStep = (Math.PI * 2) / SPOKES;
  const nearestSpoke = Math.round(angle / spokeStep) * spokeStep;
  const delta = wrapDelta(angle - nearestSpoke);
  const distToSpoke = r * Math.abs(Math.sin(delta));

  return distToSpoke >= clearance;
}

function addDotToGrid(point, grid, cellSize) {
  const { cx, cy } = gridCoords(point.x, point.y, cellSize);
  const key = cellKey(cx, cy);
  if (!grid.has(key)) {
    grid.set(key, []);
  }
  grid.get(key).push(point);
}

function generateDots(targetCount, minDistance) {
  const grid = new Map();
  const output = [];
  const cellSize = minDistance;
  const maxAttempts = targetCount * 130;
  let attempts = 0;

  while (output.length < targetCount && attempts < maxAttempts) {
    const candidate = randomDot();
    if (hasGridClearance(candidate, GRID_LINE_CLEARANCE) && canPlaceDot(candidate, grid, cellSize, minDistance)) {
      output.push(candidate);
      addDotToGrid(candidate, grid, cellSize);
    }
    attempts += 1;
  }

  return output;
}

function angleToSector(angle) {
  let normalized = angle;
  if (normalized < 0) normalized += Math.PI * 2;
  const sectorSize = (Math.PI * 2) / SPOKES;
  return Math.floor(normalized / sectorSize) + 1;
}

function pointToCell(x, y) {
  const radiusStep = RADIUS / RINGS;
  const r = Math.hypot(x, y);
  const ring = Math.min(RINGS, Math.max(1, Math.floor(r / radiusStep) + 1));
  const sector = angleToSector(Math.atan2(y, x));
  return { ring, sector };
}

function buildRound() {
  dots = generateDots(DOT_COUNT, MIN_DOT_DISTANCE);
  extraSide = Math.random() > 0.5 ? 1 : 0;

  const dotGrid = new Map();
  for (const dot of dots) {
    addDotToGrid(dot, dotGrid, MIN_DOT_DISTANCE);
  }

  let candidate = randomDot();
  let tries = 0;
  while ((!hasGridClearance(candidate, EXTRA_GRID_LINE_CLEARANCE)
      || !canPlaceDot(candidate, dotGrid, MIN_DOT_DISTANCE, EXTRA_MIN_DISTANCE))
    && tries < 25000) {
    candidate = randomDot();
    tries += 1;
  }

  extraDot = { ...candidate, color: randomPaletteColor() };
  extraCell = pointToCell(extraDot.x, extraDot.y);

  guessedCell = null;
  rotationDirection = Math.random() < 0.5 ? -1 : 1;
  isSolved = false;
  solveResult = null;
  statusEl.textContent = "Click the exact cell (ring + sector), then press Solve.";
}

function drawBackground(ctx) {
  ctx.fillStyle = "#667f98";
  ctx.beginPath();
  ctx.arc(CENTER, CENTER, RADIUS, 0, Math.PI * 2);
  ctx.fill();
}

function drawGrid(ctx) {
  ctx.save();
  ctx.translate(CENTER, CENTER);

  ctx.strokeStyle = "rgba(228, 241, 255, 0.78)";
  ctx.lineWidth = SIZE * 0.0036;
  ctx.lineCap = "butt";

  for (let i = 1; i <= RINGS; i += 1) {
    const ringR = (RADIUS / RINGS) * i;
    ctx.beginPath();
    ctx.arc(0, 0, ringR, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let i = 0; i < SPOKES; i += 1) {
    const a = (Math.PI * 2 / SPOKES) * i;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * RADIUS, Math.sin(a) * RADIUS);
    ctx.stroke();

    const labelR = RADIUS + SIZE * 0.025;
    ctx.fillStyle = "rgba(238, 246, 255, 0.93)";
    ctx.font = `${Math.round(SIZE * 0.033)}px 'Alegreya Sans', 'Trebuchet MS', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), Math.cos(a) * labelR, Math.sin(a) * labelR);
  }

  ctx.restore();
}

function drawCone(ctx) {
  const start = coneAngle - CONE_WIDTH / 2;
  const end = coneAngle + CONE_WIDTH / 2;

  ctx.save();
  ctx.translate(CENTER, CENTER);

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, RADIUS - 1, start, end);
  ctx.closePath();

  const coneGradient = ctx.createLinearGradient(0, 0, Math.cos(coneAngle) * RADIUS, Math.sin(coneAngle) * RADIUS);
  coneGradient.addColorStop(0, "rgba(24, 36, 30, 0.48)");
  coneGradient.addColorStop(1, "rgba(12, 20, 17, 0.86)");
  ctx.fillStyle = coneGradient;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, RADIUS - 1, start, end);
  ctx.closePath();
  ctx.clip();

  for (const dot of dots) {
    ctx.fillStyle = dot.color;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawExtra(ctx) {
  if (!extraDot) return;

  const start = coneAngle - CONE_WIDTH / 2;
  const end = coneAngle + CONE_WIDTH / 2;
  let a = Math.atan2(extraDot.y, extraDot.x);
  if (a < 0) a += Math.PI * 2;
  let s = start;
  let e = end;
  while (s < 0) {
    s += Math.PI * 2;
    e += Math.PI * 2;
  }
  while (a < s) a += Math.PI * 2;

  if (a >= s && a <= e) {
    ctx.save();
    ctx.translate(CENTER, CENTER);
    ctx.beginPath();
    ctx.arc(extraDot.x, extraDot.y, EXTRA_DOT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = extraDot.color;
    ctx.fill();

    if (isSolved) {
      ctx.strokeStyle = "rgba(246, 252, 255, 0.96)";
      ctx.lineWidth = Math.max(1.6, SIZE * 0.0026);
      ctx.beginPath();
      ctx.arc(extraDot.x, extraDot.y, EXTRA_DOT_RADIUS + 1.8, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawCellHighlight(ctx, cell, color) {
  if (!cell) return;
  const sectorSize = (Math.PI * 2) / SPOKES;
  const radiusStep = RADIUS / RINGS;
  const start = (cell.sector - 1) * sectorSize;
  const end = cell.sector * sectorSize;
  const inner = (cell.ring - 1) * radiusStep;
  const outer = cell.ring * radiusStep;

  ctx.save();
  ctx.translate(CENTER, CENTER);
  ctx.beginPath();
  ctx.arc(0, 0, outer, start, end);
  ctx.arc(0, 0, inner, end, start, true);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function cellCenterPoint(cell) {
  const sectorSize = (Math.PI * 2) / SPOKES;
  const radiusStep = RADIUS / RINGS;
  const angle = (cell.sector - 0.5) * sectorSize;
  const radius = (cell.ring - 0.5) * radiusStep;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius
  };
}

function drawCellMarker(ctx, cell, marker, color) {
  if (!cell) return;
  const point = cellCenterPoint(cell);
  ctx.save();
  ctx.translate(CENTER, CENTER);
  ctx.fillStyle = "rgba(11, 16, 21, 0.78)";
  ctx.beginPath();
  ctx.arc(point.x, point.y, SIZE * 0.022, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = `${Math.round(SIZE * 0.05)}px 'Alegreya Sans', 'Trebuchet MS', sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(marker, point.x, point.y + 1);
  ctx.restore();
}

function drawPanel(ctx, side) {
  ctx.clearRect(0, 0, SIZE, SIZE);
  drawBackground(ctx);
  if (guessedCell && !isSolved) {
    drawCellHighlight(ctx, guessedCell, "rgba(255, 215, 114, 0.22)");
  }
  if (isSolved) {
    drawCellHighlight(ctx, extraCell, "rgba(120, 255, 145, 0.30)");
    if (solveResult === "wrong") {
      drawCellHighlight(ctx, guessedCell, "rgba(255, 120, 120, 0.28)");
      drawCellMarker(ctx, guessedCell, "×", "#ffb2b2");
    }
  }
  drawCone(ctx);
  if (side === extraSide) {
    drawExtra(ctx);
  }
  drawGrid(ctx);

  ctx.save();
  ctx.translate(CENTER, CENTER);
  ctx.fillStyle = "#f3f8ff";
  ctx.beginPath();
  ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function animate(ts) {
  const delta = ts - lastFrame;
  lastFrame = ts;
  if (!isSolved) {
    coneAngle += rotationSpeed * rotationDirection * delta;
  }

  drawPanel(leftCtx, 0);
  drawPanel(rightCtx, 1);

  requestAnimationFrame(animate);
}

function cellFromClick(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (canvas.width / rect.width);
  const y = (event.clientY - rect.top) * (canvas.height / rect.height);
  const dx = x - CENTER;
  const dy = y - CENTER;
  const r = Math.hypot(dx, dy);
  if (r > RADIUS || r < INNER_BLANK_RADIUS) return null;
  return pointToCell(dx, dy);
}

function handleCellClick(event, canvas) {
  if (isSolved) return;
  const picked = cellFromClick(event, canvas);
  if (!picked) {
    statusEl.textContent = "Click a cell outside the blank center.";
    return;
  }
  guessedCell = picked;
  statusEl.textContent = `Selected ring ${guessedCell.ring}, sector ${guessedCell.sector}. Press Solve.`;
}

speedRange.addEventListener("input", (event) => {
  rotationSpeed = Number(event.target.value) * 0.0043;
});

newRoundBtn.addEventListener("click", () => {
  buildRound();
});

leftCanvas.addEventListener("click", (event) => handleCellClick(event, leftCanvas));
rightCanvas.addEventListener("click", (event) => handleCellClick(event, rightCanvas));

solveBtn.addEventListener("click", () => {
  if (!guessedCell) {
    statusEl.textContent = "Pick a cell first by clicking the circle.";
    return;
  }

  let extraAngle = Math.atan2(extraDot.y, extraDot.x);
  if (extraAngle < 0) extraAngle += Math.PI * 2;
  coneAngle = extraAngle;
  isSolved = true;

  const isCorrect = guessedCell.ring === extraCell.ring && guessedCell.sector === extraCell.sector;
  if (isCorrect) {
    solveResult = "correct";
  } else {
    solveResult = "wrong";
  }
});

buildRound();
requestAnimationFrame(animate);
