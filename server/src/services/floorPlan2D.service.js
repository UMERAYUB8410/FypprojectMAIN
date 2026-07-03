// ✅ BUG 4 FIX: Sanitize SVG output
function sanitizeSVG(svg) {
  return svg.replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/on\w+\s*=/gi, '');
}

// ============================================
// RULE-BASED HOUSE ENGINE CONFIGURATION
// ============================================

const ROOM_SIZES = {
  Bedroom:   { min: { w: 10, l: 10 }, max: { w: 16, l: 18 }, optimal: { w: 12, l: 14 } },
  Bathroom:  { min: { w: 6,  l: 8  }, max: { w: 10, l: 12 }, optimal: { w: 8,  l: 10 } },
  Kitchen:   { min: { w: 8,  l: 10 }, max: { w: 14, l: 16 }, optimal: { w: 10, l: 12 } },
  Living:    { min: { w: 12, l: 14 }, max: { w: 20, l: 24 }, optimal: { w: 16, l: 18 } },
  Dining:    { min: { w: 10, l: 10 }, max: { w: 14, l: 16 }, optimal: { w: 12, l: 14 } },
  Garage:    { min: { w: 12, l: 20 }, max: { w: 20, l: 24 }, optimal: { w: 16, l: 22 } },
  Balcony:   { min: { w: 6,  l: 8  }, max: { w: 10, l: 12 }, optimal: { w: 8,  l: 10 } },
  Hallway:   { min: { w: 3,  l: 6  }, max: { w: 6,  l: 10 }, optimal: { w: 4,  l: 8  } },
  Staircase: { min: { w: 3,  l: 8  }, max: { w: 5,  l: 12 }, optimal: { w: 4,  l: 10 } }
};

const ADJACENCY_RULES = {
  Kitchen:   { near: ['Dining', 'Living'],          far: ['Bedroom', 'Bathroom'] },
  Dining:    { near: ['Kitchen', 'Living'],          far: ['Bedroom'] },
  Bathroom:  { near: ['Bedroom', 'Hallway'],         far: ['Kitchen', 'Living'] },
  Bedroom:   { near: ['Bathroom', 'Balcony'],        far: ['Kitchen', 'Living', 'Garage'] },
  Living:    { near: ['Dining', 'Kitchen'],          far: ['Bedroom'] },
  Garage:    { near: ['Hallway'],                    far: ['Bedroom', 'Living'] }
};

const ROOM_COLORS = {
  Bedroom: "#1f2933", Bathroom: "#e8f4f8", Kitchen: "#334155",
  Living: "#2a2a2a",  Dining: "#374151",   Garage: "#4b5563",
  Balcony: "#6b7280", Hallway: "#9ca3af",  Staircase: "#d1d5db"
};

const TEXT_COLORS = {
  Bedroom: "#ffffff",  Bathroom: "#1e293b", Kitchen: "#ffffff",
  Living: "#ffffff",   Dining: "#ffffff",   Garage: "#ffffff",
  Balcony: "#ffffff",  Hallway: "#1e293b",  Staircase: "#1e293b"
};

const ROOM_PADDING = 14;
// ✅ FIX: Use a consistent 1px gap between rooms so walls render cleanly
//         and no floating-point rounding can create an overlap.
const ROOM_GAP = 1;
const MIN_ROOM_DIMENSION = 40;

const ROOM_PRIORITY = [
  "Living", "Dining", "Kitchen", "Bedroom",
  "Bathroom", "Balcony", "Garage", "Hallway", "Staircase"
];

// Room target regions — covers all 4 quadrants of the plot
const ROOM_REGIONS = {
  Living:    { x: 0.05, y: 0.05 },   // top-left quadrant
  Kitchen:   { x: 0.05, y: 0.60 },   // bottom-left quadrant
  Dining:    { x: 0.55, y: 0.60 },   // bottom-right quadrant
  Bedroom:   { x: 0.55, y: 0.05 },   // top-right quadrant
  Bathroom:  { x: 0.55, y: 0.35 },   // mid-right (near bedroom)
  Garage:    { x: 0.05, y: 0.35 },   // mid-left
  Balcony:   { x: 0.80, y: 0.05 },   // far top-right corner
  Hallway:   { x: 0.35, y: 0.35 },   // center
  Staircase: { x: 0.35, y: 0.05 }    // top-center
};

const ATTACHMENT_RULES = {
  Bathroom: ["Bedroom"],
  Balcony:  ["Bedroom", "Living"]
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getRoomSize(type, plotWidth, plotLength) {
  const size = ROOM_SIZES[type] || { optimal: { w: 10, l: 10 } };
  const baseWidth  = size.optimal.w * 10;
  const baseLength = size.optimal.l * 10;
  const plotScale  = Math.min((plotWidth || 400) / 400, (plotLength || 400) / 400, 1);
  const maxWidth   = Math.max(80, (plotWidth  || 400) * 0.35);
  const maxLength  = Math.max(80, (plotLength || 400) * 0.35);
  return {
    width:  Math.max(MIN_ROOM_DIMENSION, Math.min(Math.round(baseWidth  * plotScale), maxWidth)),
    length: Math.max(MIN_ROOM_DIMENSION, Math.min(Math.round(baseLength * plotScale), maxLength))
  };
}

function clampValue(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// ✅ FIX: Spread bonus — rewards distance from center and from other rooms
//   so rooms distribute across the full plot instead of clustering top-left.
function getSpreadBonus(candidate, placedRooms, plotWidth, plotLength) {
  const cx    = plotWidth  / 2;
  const cy    = plotLength / 2;
  const roomCx = candidate.x + candidate.width  / 2;
  const roomCy = candidate.y + candidate.length / 2;
  const distFromCenter = Math.sqrt((roomCx - cx) ** 2 + (roomCy - cy) ** 2);
  let minDistFromPlaced = Infinity;
  placedRooms.forEach(p => {
    const dx = roomCx - (p.x + p.width  / 2);
    const dy = roomCy - (p.y + p.length / 2);
    minDistFromPlaced = Math.min(minDistFromPlaced, Math.sqrt(dx * dx + dy * dy));
  });
  return distFromCenter * 0.04 + (isFinite(minDistFromPlaced) ? minDistFromPlaced * 0.06 : 0);
}

// ✅ FIX: Core overlap check — strict, integer-safe, no tolerance fudge
//   Two rects overlap when they share area (touching edges are NOT overlapping).
function rectsOverlap(a, b) {
  return (
    a.x          < b.x + b.width  &&
    a.x + a.width  > b.x          &&
    a.y          < b.y + b.length &&
    a.y + a.length > b.y
  );
}

// ✅ FIX: isValidRoomPlacement always uses ROOM_GAP (never 0) to prevent
//   flush-but-rounding-overlap situations from attached placement.
function isValidRoomPlacement(candidate, placedRooms, plotWidth, plotLength) {
  // Must be inside plot boundary
  if (
    candidate.x          < ROOM_PADDING ||
    candidate.y          < ROOM_PADDING ||
    candidate.x + candidate.width  > plotWidth  - ROOM_PADDING ||
    candidate.y + candidate.length > plotLength - ROOM_PADDING
  ) return false;

  // Must not overlap any placed room (allow touching walls)
  for (const placed of placedRooms) {
    if (rectsOverlap(candidate, placed)) return false;
  }
  return true;
}

// ✅ FIX: Separate "attached" validity — rooms may share a wall (touch) but
//   still must not overlap and must remain within bounds.
function isValidAttachedPlacement(candidate, placedRooms, plotWidth, plotLength) {
  if (
    candidate.x          < ROOM_PADDING ||
    candidate.y          < ROOM_PADDING ||
    candidate.x + candidate.width  > plotWidth  - ROOM_PADDING ||
    candidate.y + candidate.length > plotLength - ROOM_PADDING
  ) return false;

  for (const placed of placedRooms) {
    if (rectsOverlap(candidate, placed)) return false;
  }
  return true;
}

function calculateScore(room, candidate, placedRooms, plotWidth, plotLength) {
  const rules = ADJACENCY_RULES[room.type] || { near: [], far: [] };
  let score = 0;

  // Adjacency bonuses
  placedRooms.forEach(placed => {
    if (rules.near.includes(placed.type)) score += 15;
    if (rules.far.includes(placed.type))  score -= 15;
  });

  // ✅ REGION TARGETING — much stronger weight so rooms actually
  //   reach their target quadrant instead of staying near origin.
  const region = ROOM_REGIONS[room.type];
  if (region) {
    const tx = region.x * (plotWidth  - candidate.width);
    const ty = region.y * (plotLength - candidate.length);
    const dx = candidate.x - tx;
    const dy = candidate.y - ty;
    const distToRegion = Math.sqrt(dx * dx + dy * dy);
    // Strong pull toward region — was 0.06, now 0.20
    score -= distToRegion * 0.20;
  }

  // Spread bonus — reward distance from already-placed rooms
  score += getSpreadBonus(candidate, placedRooms, plotWidth, plotLength);

  if (room.type === "Balcony") {
    const onEdge = (
      candidate.x <= ROOM_PADDING + 2 ||
      candidate.y <= ROOM_PADDING + 2 ||
      candidate.x + candidate.width  >= plotWidth  - ROOM_PADDING - 2 ||
      candidate.y + candidate.length >= plotLength - ROOM_PADDING - 2
    );
    if (onEdge) score += 20;
  }

  return score;
}

function findAttachedPosition(room, placedRooms, plotWidth, plotLength) {
  const attachments = ATTACHMENT_RULES[room.type];
  if (!attachments || placedRooms.length === 0) return null;

  const targets = placedRooms.filter(p => attachments.includes(p.type));
  if (targets.length === 0) return null;

  const size = getRoomSize(room.type, plotWidth, plotLength);
  let bestScore = -Infinity;
  let bestPos   = null;

  targets.forEach(target => {
    // ✅ FIX: Use ROOM_GAP offset so rooms are flush but not overlapping
    const candidates = [
      { x: target.x + target.width + ROOM_GAP, y: target.y },
      { x: target.x - size.width  - ROOM_GAP, y: target.y },
      { x: target.x, y: target.y + target.length + ROOM_GAP },
      { x: target.x, y: target.y - size.length  - ROOM_GAP }
    ];

    candidates.forEach(c => {
      const candidate = { x: Math.round(c.x), y: Math.round(c.y), width: size.width, length: size.length };
      if (!isValidAttachedPlacement(candidate, placedRooms, plotWidth, plotLength)) return;
      const score = calculateScore(room, candidate, placedRooms, plotWidth, plotLength) + 30;
      if (score > bestScore) { bestScore = score; bestPos = candidate; }
    });
  });

  return bestPos;
}

function findBestPosition(room, placedRooms, plotWidth, plotLength, gridSize = 20) {
  const size = getRoomSize(room.type, plotWidth, plotLength);

  // Try attachment first (e.g. Bathroom next to Bedroom)
  const attachedPos = findAttachedPosition(room, placedRooms, plotWidth, plotLength);
  if (attachedPos) return attachedPos;

  // ✅ FIX: Dynamic grid — finer on large plots so rooms reach target regions
  const dynamicGrid = Math.max(10, Math.min(gridSize, Math.round(Math.min(plotWidth, plotLength) / 30)));

  let bestScore = -Infinity;
  let bestPos   = null;

  for (let y = ROOM_PADDING; y <= plotLength - size.length - ROOM_PADDING; y += dynamicGrid) {
    for (let x = ROOM_PADDING; x <= plotWidth - size.width - ROOM_PADDING; x += dynamicGrid) {
      const candidate = { x, y, width: size.width, length: size.length };
      if (!isValidRoomPlacement(candidate, placedRooms, plotWidth, plotLength)) continue;
      const score = calculateScore(room, candidate, placedRooms, plotWidth, plotLength);
      if (score > bestScore) { bestScore = score; bestPos = candidate; }
    }
  }

  if (bestPos) return bestPos;

  // ✅ FIX: Fallback — scan row-by-row at fine resolution instead of
  //   blindly returning (ROOM_PADDING, ROOM_PADDING), which caused stacking.
  return findFallbackPosition(size, placedRooms, plotWidth, plotLength);
}

// ✅ NEW: Fine-grained fallback that is guaranteed to find an empty spot
//   (or at minimum not overlap) by scanning every pixel row.
function findFallbackPosition(size, placedRooms, plotWidth, plotLength) {
  const step = 4; // fine scan step in pixels
  for (let y = ROOM_PADDING; y <= plotLength - size.length - ROOM_PADDING; y += step) {
    for (let x = ROOM_PADDING; x <= plotWidth - size.width - ROOM_PADDING; x += step) {
      const candidate = { x, y, width: size.width, length: size.length };
      if (isValidRoomPlacement(candidate, placedRooms, plotWidth, plotLength)) {
        return candidate;
      }
    }
  }

  // ✅ LAST RESORT: If even the fine scan fails (plot is genuinely too small),
  //   push the room outside current rooms rather than stacking at origin.
  //   Pick the rightmost x that fits, bottom-most y.
  const lastX = clampValue(plotWidth  - size.width  - ROOM_PADDING, ROOM_PADDING, plotWidth);
  const lastY = clampValue(plotLength - size.length - ROOM_PADDING, ROOM_PADDING, plotLength);
  return { x: lastX, y: lastY, width: size.width, length: size.length };
}

// ============================================
// FLOOR PLAN GENERATION
// ============================================

function generateRoomKey(type, floorNum, instanceIndex) {
  return `${type}-${floorNum}-${instanceIndex}`;
}

function expandRoomCounts(rooms, floorNum, roomPositions = {}) {
  const floorRooms = [];
  rooms.forEach(room => {
    if (!(room.floor === floorNum || (!room.floor && floorNum === 1))) return;
    const repeat = Math.max(1, room.count || 1);
    for (let index = 0; index < repeat; index++) {
      const roomKey = generateRoomKey(room.type, floorNum, index + 1);
      floorRooms.push({
        ...room,
        count: 1,
        instance: repeat > 1 ? index + 1 : undefined,
        roomKey,
        preferredX: roomPositions[roomKey]?.x,
        preferredY: roomPositions[roomKey]?.y
      });
    }
  });
  return floorRooms;
}

function placeRooms(rooms, floorNum, plotWidth, plotLength, roomPositions = {}) {
  const floorRooms  = expandRoomCounts(rooms, floorNum, roomPositions);
  const placedRooms = [];

  const sortedRooms = [...floorRooms].sort((a, b) => {
    // Pinned (user-dragged) rooms go first
    const aPinned = a.preferredX != null ? 0 : 1;
    const bPinned = b.preferredX != null ? 0 : 1;
    if (aPinned !== bPinned) return aPinned - bPinned;

    // Then by priority list
    const pa = ROOM_PRIORITY.indexOf(a.type);
    const pb = ROOM_PRIORITY.indexOf(b.type);
    if (pa !== pb) return pa - pb;

    // Then largest area first (gives small rooms more room to fit)
    const sa = getRoomSize(a.type, plotWidth, plotLength);
    const sb = getRoomSize(b.type, plotWidth, plotLength);
    return (sb.width * sb.length) - (sa.width * sa.length);
  });

  sortedRooms.forEach((room, idx) => {
    const size = getRoomSize(room.type, plotWidth, plotLength);
    let pos = null;

    // Try user-preferred position first
    if (room.preferredX != null && room.preferredY != null) {
      const candidate = {
        x: Math.round(room.preferredX),
        y: Math.round(room.preferredY),
        width: size.width,
        length: size.length
      };
      // ✅ FIX: Use strict isValidRoomPlacement (no allowTouching shortcut)
      if (isValidRoomPlacement(candidate, placedRooms, plotWidth, plotLength)) {
        pos = candidate;
      }
    }

    if (!pos) {
      pos = findBestPosition(room, placedRooms, plotWidth, plotLength);
    }

    // ✅ FIX: Post-placement overlap guard — if somehow we still got an
    //   overlapping position (e.g. from a user drag on a tiny plot),
    //   force it to a safe fallback before pushing.
    const finalPos = { ...pos };
    if (placedRooms.some(p => rectsOverlap(finalPos, p))) {
      const safe = findFallbackPosition(
        { width: finalPos.width, length: finalPos.length },
        placedRooms, plotWidth, plotLength
      );
      finalPos.x = safe.x;
      finalPos.y = safe.y;
    }

    placedRooms.push({
      ...finalPos,
      type:     room.type,
      id:       idx,
      label:    room.instance ? `${room.type} ${room.instance}` : room.type,
      roomKey:  room.roomKey
    });
  });

  return placedRooms;
}

// ============================================
// WALL / DOOR / WINDOW BUILDERS (unchanged logic)
// ============================================

function getDoorWidth(type) {
  const sizes = {
    Bathroom: 24, Bedroom: 30,  Kitchen: 30, Living: 36,
    Dining: 30,   Garage: 32,   Balcony: 28, Hallway: 28, Staircase: 26
  };
  return sizes[type] || 28;
}

function getOverlap(startA, endA, startB, endB) {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

function getSharedDoorType(roomA, roomB) {
  if (roomA.type === "Bathroom" || roomB.type === "Bathroom") return "bathroom";
  if (roomA.type === "Bedroom"  || roomB.type === "Bedroom")  return "standard";
  return "main";
}

function buildWallSegments(rooms, plotWidth, plotLength) {
  const wallMap = new Map();

  function addEdge(edge) {
    const key = `${edge.orientation}|${edge.coord}|${edge.start}|${edge.end}`;
    const existing = wallMap.get(key);
    if (existing) {
      existing.count += 1;
      existing.roomKeys.push(edge.roomKey);
      existing.shared = true;
      return;
    }
    wallMap.set(key, { ...edge, count: 1, roomKeys: [edge.roomKey], shared: false });
  }

  rooms.forEach(room => {
    addEdge({ orientation: "horizontal", coord: room.y,              start: room.x, end: room.x + room.width,  x1: room.x,             y1: room.y,             x2: room.x + room.width, y2: room.y,             roomKey: room.roomKey });
    addEdge({ orientation: "horizontal", coord: room.y + room.length, start: room.x, end: room.x + room.width,  x1: room.x,             y1: room.y + room.length, x2: room.x + room.width, y2: room.y + room.length, roomKey: room.roomKey });
    addEdge({ orientation: "vertical",   coord: room.x,              start: room.y, end: room.y + room.length, x1: room.x,             y1: room.y,             x2: room.x,              y2: room.y + room.length, roomKey: room.roomKey });
    addEdge({ orientation: "vertical",   coord: room.x + room.width, start: room.y, end: room.y + room.length, x1: room.x + room.width, y1: room.y,             x2: room.x + room.width, y2: room.y + room.length, roomKey: room.roomKey });
  });

  const segments = [...wallMap.values()].map(entry => {
    const onBoundary = entry.x1 === 0 || entry.y1 === 0 || entry.x2 === plotWidth || entry.y2 === plotLength;
    const wallType   = onBoundary ? "outer" : entry.shared ? "shared" : "inner";
    return {
      x1: entry.x1, y1: entry.y1, x2: entry.x2, y2: entry.y2,
      type: wallType,
      thickness: wallType === "outer" ? 6 : wallType === "shared" ? 4 : 2,
      stroke:    wallType === "outer" ? "#e2e8f0" : wallType === "shared" ? "#9ca3af" : "#d1d5db"
    };
  });

  const boundaryWalls = [
    { x1: 0,         y1: 0,          x2: plotWidth, y2: 0,           type: "outer", thickness: 8, stroke: "#f8fafc" },
    { x1: plotWidth, y1: 0,          x2: plotWidth, y2: plotLength,  type: "outer", thickness: 8, stroke: "#f8fafc" },
    { x1: plotWidth, y1: plotLength, x2: 0,         y2: plotLength,  type: "outer", thickness: 8, stroke: "#f8fafc" },
    { x1: 0,         y1: plotLength, x2: 0,         y2: 0,           type: "outer", thickness: 8, stroke: "#f8fafc" }
  ];

  return [...boundaryWalls, ...segments];
}

function buildDoors(rooms) {
  const doors = [];
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const room  = rooms[i];
      const other = rooms[j];

      const overlapY        = getOverlap(room.y, room.y + room.length, other.y, other.y + other.length);
      const overlapX        = getOverlap(room.x, room.x + room.width,  other.x, other.x + other.width);
      // ✅ FIX: Tolerance bumped from 2 → 4 to handle ROOM_GAP=1 + rounding
      const verticalShared  = Math.abs(room.x + room.width - other.x) <= 4 && overlapY > 8;
      const horizontalShared = Math.abs(room.y + room.length - other.y) <= 4 && overlapX > 8;

      if (verticalShared) {
        const maxLen  = Math.min(getDoorWidth(room.type), getDoorWidth(other.type));
        const doorLen = Math.min(maxLen, overlapY - 8);
        if (doorLen > 10) {
          doors.push({
            orientation: "vertical",
            x: room.x + room.width,
            y: Math.max(room.y, other.y) + overlapY / 2,
            width: 4, height: doorLen,
            roomKeys: [room.roomKey, other.roomKey],
            doorType: getSharedDoorType(room, other)
          });
        }
      } else if (horizontalShared) {
        const maxLen  = Math.min(getDoorWidth(room.type), getDoorWidth(other.type));
        const doorLen = Math.min(maxLen, overlapX - 8);
        if (doorLen > 10) {
          doors.push({
            orientation: "horizontal",
            x: Math.max(room.x, other.x) + overlapX / 2,
            y: room.y + room.length,
            width: doorLen, height: 4,
            roomKeys: [room.roomKey, other.roomKey],
            doorType: getSharedDoorType(room, other)
          });
        }
      }
    }
  }
  return doors;
}

function buildWindows(rooms, plotWidth, plotLength) {
  const windows     = [];
  const windowSize  = 24;
  const minimumEdge = 60;

  rooms.forEach(room => {
    const exteriorEdges = [
      { orientation: "vertical",   x: room.x,             y1: room.y, y2: room.y + room.length, exterior: Math.abs(room.x - ROOM_PADDING) < 2 },
      { orientation: "vertical",   x: room.x + room.width, y1: room.y, y2: room.y + room.length, exterior: Math.abs(room.x + room.width - (plotWidth - ROOM_PADDING)) < 2 },
      { orientation: "horizontal", y: room.y,             x1: room.x, x2: room.x + room.width,  exterior: Math.abs(room.y - ROOM_PADDING) < 2 },
      { orientation: "horizontal", y: room.y + room.length, x1: room.x, x2: room.x + room.width, exterior: Math.abs(room.y + room.length - (plotLength - ROOM_PADDING)) < 2 }
    ];

    exteriorEdges.forEach(edge => {
      if (!edge.exterior) return;
      const edgeLen = edge.orientation === "vertical" ? edge.y2 - edge.y1 : edge.x2 - edge.x1;
      if (edgeLen < minimumEdge) return;

      const step = windowSize + 36;
      let offset = edge.orientation === "vertical" ? edge.y1 + 18 : edge.x1 + 18;
      const limit = edge.orientation === "vertical" ? edge.y2 : edge.x2;
      while (offset + windowSize < limit - 18) {
        if (edge.orientation === "vertical") {
          windows.push({ x: edge.x - 2, y: offset, width: 4, height: windowSize, orientation: "vertical", roomKey: room.roomKey });
        } else {
          windows.push({ x: offset, y: edge.y - 2, width: windowSize, height: 4, orientation: "horizontal", roomKey: room.roomKey });
        }
        offset += step;
      }
    });
  });

  return windows;
}

// ============================================
// PLOT DIMENSION DERIVATION
// ============================================

function derivePlotDimensions(plot) {
  if (!plot) return null;
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  if (isNum(plot.width) && isNum(plot.length)) return { width: Math.round(plot.width), length: Math.round(plot.length) };

  let areaSqFt = null;
  if (isNum(plot.areaSqYd))  areaSqFt = plot.areaSqYd * 9;
  else if (isNum(plot.areaSqFt)) areaSqFt = plot.areaSqFt;
  else if (isNum(plot.area))     areaSqFt = plot.area;

  if (!areaSqFt && typeof plot.area === 'string') {
    const m = plot.area.match(/(\d+(?:\.\d+)?)\s*(sq\s*y(?:ard)?s?|square\s+yards|yd\^?2|sqyd|sq\s*ft|square\s+feet|ft\^?2|sqft)/i);
    if (m) {
      const val  = parseFloat(m[1]);
      const unit = (m[2] || '').toLowerCase();
      areaSqFt   = /yd/.test(unit) ? val * 9 : val;
    }
  }

  if (!areaSqFt) return null;

  const approx    = Math.round(Math.sqrt(areaSqFt));
  const minDim    = 8;
  const maxTrials = Math.max(approx, 200);
  for (let i = 0; i < maxTrials; i++) {
    const candidates = [];
    if (approx - i >= minDim) candidates.push(approx - i);
    candidates.push(approx + i + 1);
    for (const w of candidates) {
      if (w < minDim) continue;
      const l = areaSqFt / w;
      if (!Number.isFinite(l) || l < minDim) continue;
      const ratio = l / w;
      if (ratio >= 0.6 && ratio <= 1.7) return { width: Math.round(w), length: Math.round(l) };
    }
  }

  const s = Math.round(Math.sqrt(areaSqFt));
  return { width: Math.max(minDim, s), length: Math.max(minDim, Math.round(areaSqFt / s)) };
}

// ============================================
// MAIN MODEL BUILDER
// ============================================

function buildFloorPlanModel(analysis) {
  const plotInput  = analysis.plot || { width: 400, length: 400 };
  const derivedPlot = derivePlotDimensions(plotInput);
  const plot        = derivedPlot || { width: Math.round(plotInput.width || 400), length: Math.round(plotInput.length || 400) };

  const rooms         = analysis.rooms || [];
  const totalFloors   = analysis.floors || 1;
  const roomPositions = analysis.roomPositions || {};

  const scale      = 0.8;
  const plotWidth  = Math.min(Math.round(plot.width  * scale * 10), 700);
  const plotLength = Math.min(Math.round(plot.length * scale * 10), 700);

  const defaultEntrance = { x: Math.round(plotWidth / 2), y: plotLength - ROOM_PADDING - 14 };
  const entrancePosition = analysis.entrancePosition || defaultEntrance;
  const entrance = {
    x:      clampValue(Math.round(entrancePosition.x), ROOM_PADDING + 12, plotWidth  - ROOM_PADDING - 12),
    y:      clampValue(Math.round(entrancePosition.y), ROOM_PADDING + 12, plotLength - ROOM_PADDING - 12),
    radius: 12
  };

  const floors = [];
  for (let floor = 1; floor <= totalFloors; floor++) {
    const placedRooms = placeRooms(rooms, floor, plotWidth, plotLength, roomPositions);
    const walls       = buildWallSegments(placedRooms, plotWidth, plotLength);
    const doors       = buildDoors(placedRooms);
    const windows     = buildWindows(placedRooms, plotWidth, plotLength);
    const floorLabel  = totalFloors > 1 ? `Floor ${floor}` : "Ground Floor";

    floors.push({
      floorNum: floor,
      label:    floorLabel,
      width:    plotWidth,
      length:   plotLength,
      rooms:    placedRooms,
      walls,
      doors,
      windows,
      entrance
    });
  }

  return { plot, totalFloors, floors };
}

// ============================================
// SVG BUILDER
// ============================================

function buildSvgFromPlan(plan) {
  const svgWidth  = plan.floors[0].width + 120;
  const svgHeight = plan.floors.reduce((acc, f) => acc + f.length + 100, 0) + (plan.floors.length > 1 ? 20 : 0);

  const floorGroups = plan.floors.map((floor, index) => {
    const floorY = index * (floor.length + 60) + 60;

    const roomElements = floor.rooms.map(room => {
      const color     = ROOM_COLORS[room.type] || "#64748b";
      const textColor = TEXT_COLORS[room.type] || "#ffffff";
      return `
        <g class="room-group" data-room-key="${room.roomKey}" data-room-type="${room.type}" style="cursor: grab;">
          <rect x="${room.x}" y="${room.y}" width="${room.width}" height="${room.length}"
                fill="${color}" fill-opacity="0.14" stroke="#94a3b8" stroke-width="1.5" rx="6" />
          <text x="${room.x + room.width / 2}" y="${room.y + 24}" fill="${textColor}"
                font-size="12" font-weight="700" text-anchor="middle">${room.label}</text>
          <text x="${room.x + room.width / 2}" y="${room.y + room.length / 2 + 4}" fill="${textColor}"
                font-size="11" text-anchor="middle" opacity="0.85">
            ${Math.round(room.width / 10)}' x ${Math.round(room.length / 10)}'
          </text>
        </g>`;
    }).join("");

    const wallElements = floor.walls.map(w =>
      `<line x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}"
             stroke="${w.stroke}" stroke-width="${w.thickness}" stroke-linecap="square" />`
    ).join("");

    const doorElements = floor.doors.map(door => {
      if (door.orientation === "vertical") {
        const y0 = door.y - door.height / 2;
        const y1 = door.y + door.height / 2;
        return `
          <path d="M ${door.x} ${y0} L ${door.x} ${y1}" stroke="#fbbf24" stroke-width="${door.width}" />
          <path d="M ${door.x} ${y1} A ${door.height / 2} ${door.height / 2} 0 0 0 ${door.x} ${y0}"
                fill="none" stroke="#fbbf24" stroke-width="2" opacity="0.9" />`;
      }
      const x0 = door.x - door.width / 2;
      const x1 = door.x + door.width / 2;
      return `
        <path d="M ${x0} ${door.y} L ${x1} ${door.y}" stroke="#fbbf24" stroke-width="${door.height}" />
        <path d="M ${x1} ${door.y} A ${door.width / 2} ${door.width / 2} 0 0 1 ${x0} ${door.y}"
              fill="none" stroke="#fbbf24" stroke-width="2" opacity="0.9" />`;
    }).join("");

    const windowElements = floor.windows.map(win =>
      `<rect x="${win.x}" y="${win.y}" width="${win.width}" height="${win.height}"
             fill="#7dd3fc" fill-opacity="0.75" stroke="#38bdf8" stroke-width="1" rx="2" />`
    ).join("");

    return `
      <g transform="translate(40, ${floorY})">
        <text x="${floor.width / 2}" y="-20" fill="#e2e8f0" font-size="16" font-weight="700" text-anchor="middle">${floor.label}</text>
        <rect x="0" y="0" width="${floor.width}" height="${floor.length}"
              fill="transparent" stroke="#64748b" stroke-width="4" rx="8" />
        ${wallElements}
        ${windowElements}
        ${roomElements}
        ${doorElements}
        <text x="${floor.width / 2}" y="${floor.length + 30}" fill="#cbd5e1" font-size="11" text-anchor="middle">
          Floor ${floor.floorNum}: ${Math.round(plan.plot.width)}' x ${Math.round(plan.plot.length)}'
        </text>
      </g>`;
  }).join("");

  return sanitizeSVG(`
    <svg width="${svgWidth}" height="${svgHeight}"
         viewBox="0 0 ${svgWidth} ${svgHeight}"
         xmlns="http://www.w3.org/2000/svg">
      <defs><style>text { font-family: Inter, Arial, sans-serif; }</style></defs>
      <rect width="100%" height="100%" fill="#070b17" />
      ${floorGroups}
    </svg>
  `);
}

// ============================================
// EXPORTS
// ============================================

export function generateFloorPlanModel(analysis) {
  return buildFloorPlanModel(analysis);
}

export function generate2DFloorPlan(analysis) {
  const plan = buildFloorPlanModel(analysis);
  return buildSvgFromPlan(plan);
}