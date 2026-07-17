export const ROOM_PADDING = 14;
export const WINDOW_SIZE = 24;
export const WINDOW_GAP = 36;

function getDoorWidth(type) {
  const sizes = {
    Bathroom: 24, Bedroom: 30, Kitchen: 30, Living: 36,
    Dining: 30, Garage: 32, Balcony: 28, Hallway: 28, Staircase: 26
  };
  return sizes[type] || 28;
}

function getOverlap(startA, endA, startB, endB) {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isExteriorEdge(coord, boundary) {
  return Math.abs(coord - boundary) < 2;
}

// Guarantees every room has at least one door. The pairwise adjacency pass
// above only connects rooms that are found touching within a small
// tolerance, so a room placed with no touching neighbor (or one whose
// shared edge falls just outside that tolerance) would otherwise end up a
// fully sealed box. For each such room, this opens a door on whichever of
// its own walls faces the rest of the house (preferring an already-
// connected room so doors chain back toward the main living space, and
// skipping exterior/boundary walls). Mutates `doors` in place.
function ensureRoomConnectivity(rooms, doors, floorWidth, floorHeight) {
  if (rooms.length < 2) return;

  const connected = new Set();
  doors.forEach((door) => (door.roomKeys || []).forEach((key) => connected.add(key)));

  const isolated = rooms.filter((room) => !connected.has(room.roomKey));

  isolated.forEach((room) => {
    const others = rooms.filter((r) => r.roomKey !== room.roomKey);
    if (others.length === 0) return;

    const targets = others.filter((r) => connected.has(r.roomKey));
    const pool = targets.length > 0 ? targets : others;
    const centroid = pool.reduce(
      (acc, r) => ({ x: acc.x + (r.x + r.width / 2), y: acc.y + (r.y + r.length / 2) }),
      { x: 0, y: 0 }
    );
    centroid.x /= pool.length;
    centroid.y /= pool.length;

    const edges = [
      { orientation: "vertical", fixed: room.x, from: room.y, to: room.y + room.length,
        exterior: isExteriorEdge(room.x, ROOM_PADDING), mid: { x: room.x, y: room.y + room.length / 2 } },
      { orientation: "vertical", fixed: room.x + room.width, from: room.y, to: room.y + room.length,
        exterior: isExteriorEdge(room.x + room.width, floorWidth - ROOM_PADDING), mid: { x: room.x + room.width, y: room.y + room.length / 2 } },
      { orientation: "horizontal", fixed: room.y, from: room.x, to: room.x + room.width,
        exterior: isExteriorEdge(room.y, ROOM_PADDING), mid: { x: room.x + room.width / 2, y: room.y } },
      { orientation: "horizontal", fixed: room.y + room.length, from: room.x, to: room.x + room.width,
        exterior: isExteriorEdge(room.y + room.length, floorHeight - ROOM_PADDING), mid: { x: room.x + room.width / 2, y: room.y + room.length } }
    ];

    let best = null;
    let bestScore = -Infinity;
    edges.forEach((edge) => {
      if (edge.to - edge.from < 20) return;
      const dist = Math.hypot(edge.mid.x - centroid.x, edge.mid.y - centroid.y);
      const score = (edge.exterior ? -100000 : 0) - dist;
      if (score > bestScore) { bestScore = score; best = edge; }
    });
    if (!best) return;

    const doorSpan = Math.min(getDoorWidth(room.type), best.to - best.from - 4);
    if (doorSpan < 10) return;
    const center = clamp((best.from + best.to) / 2, best.from + doorSpan / 2, best.to - doorSpan / 2);

    doors.push(
      best.orientation === "vertical"
        ? { orientation: "vertical", x: best.fixed, y: center, height: doorSpan, roomKeys: [room.roomKey] }
        : { orientation: "horizontal", x: center, y: best.fixed, width: doorSpan, roomKeys: [room.roomKey] }
    );
    connected.add(room.roomKey);
  });
}

// Splits a straight wall segment into one-or-more shorter segments so that
// any door sitting along it becomes an actual empty gap instead of a solid
// line with a door icon drawn on top. Returns [wall] unchanged when no door
// falls on this segment.
export function splitWallForDoors(wall, doors) {
  const isHorizontal = wall.y1 === wall.y2;
  const isVertical = wall.x1 === wall.x2;
  if (!isHorizontal && !isVertical) return [wall];

  const axisStart = isHorizontal ? Math.min(wall.x1, wall.x2) : Math.min(wall.y1, wall.y2);
  const axisEnd = isHorizontal ? Math.max(wall.x1, wall.x2) : Math.max(wall.y1, wall.y2);
  const fixedCoord = isHorizontal ? wall.y1 : wall.x1;

  const gaps = (doors || [])
    .filter((door) => {
      if (isHorizontal && door.orientation !== "horizontal") return false;
      if (isVertical && door.orientation !== "vertical") return false;
      const doorFixed = isHorizontal ? door.y : door.x;
      return Math.abs(doorFixed - fixedCoord) < 3;
    })
    .map((door) => {
      const center = isHorizontal ? door.x : door.y;
      const half = (isHorizontal ? door.width : door.height) / 2;
      return {
        start: clamp(center - half, axisStart, axisEnd),
        end: clamp(center + half, axisStart, axisEnd)
      };
    })
    .filter((gap) => gap.end - gap.start > 1)
    .sort((a, b) => a.start - b.start);

  if (gaps.length === 0) return [wall];

  const segments = [];
  let cursor = axisStart;
  gaps.forEach((gap) => {
    if (gap.start - cursor > 1) {
      segments.push(
        isHorizontal
          ? { ...wall, x1: cursor, x2: gap.start }
          : { ...wall, y1: cursor, y2: gap.start }
      );
    }
    cursor = Math.max(cursor, gap.end);
  });
  if (axisEnd - cursor > 1) {
    segments.push(
      isHorizontal
        ? { ...wall, x1: cursor, x2: axisEnd }
        : { ...wall, y1: cursor, y2: axisEnd }
    );
  }
  return segments;
}

export function buildRenderPlan(rooms, floorWidth, floorHeight, wallColor = "#94a3b8") {
  const boundaryWalls = [
    { x1: 0, y1: 0, x2: floorWidth, y2: 0, thickness: 8, stroke: wallColor },
    { x1: floorWidth, y1: 0, x2: floorWidth, y2: floorHeight, thickness: 8, stroke: wallColor },
    { x1: floorWidth, y1: floorHeight, x2: 0, y2: floorHeight, thickness: 8, stroke: wallColor },
    { x1: 0, y1: floorHeight, x2: 0, y2: 0, thickness: 8, stroke: wallColor }
  ];

  const edgeMap = new Map();
  const doors = [];
  const windows = [];

  const addEdge = (edge) => {
    const key = `${edge.orientation}|${edge.coord}|${edge.start}|${edge.end}`;
    if (edgeMap.has(key)) {
      edgeMap.get(key).shared = true;
      return;
    }
    edgeMap.set(key, { ...edge, shared: false });
  };

  rooms.forEach((room) => {
    addEdge({ orientation: "horizontal", coord: room.y, start: room.x, end: room.x + room.width, x1: room.x, y1: room.y, x2: room.x + room.width, y2: room.y });
    addEdge({ orientation: "horizontal", coord: room.y + room.length, start: room.x, end: room.x + room.width, x1: room.x, y1: room.y + room.length, x2: room.x + room.width, y2: room.y + room.length });
    addEdge({ orientation: "vertical", coord: room.x, start: room.y, end: room.y + room.length, x1: room.x, y1: room.y, x2: room.x, y2: room.y + room.length });
    addEdge({ orientation: "vertical", coord: room.x + room.width, start: room.y, end: room.y + room.length, x1: room.x + room.width, y1: room.y, x2: room.x + room.width, y2: room.y + room.length });
  });

  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i];
      const b = rooms[j];
      const overlapY = getOverlap(a.y, a.y + a.length, b.y, b.y + b.length);
      const overlapX = getOverlap(a.x, a.x + a.width, b.x, b.x + b.width);
      const verticalShared = Math.abs(a.x + a.width - b.x) <= 4 && overlapY > 4;
      const horizontalShared = Math.abs(a.y + a.length - b.y) <= 4 && overlapX > 4;

      if (verticalShared) {
        const maxDoorLength = Math.min(getDoorWidth(a.type), getDoorWidth(b.type));
        const doorLength = Math.min(maxDoorLength, Math.max(10, overlapY - 4));
        const doorY = Math.max(a.y, b.y) + overlapY / 2;
        doors.push({ orientation: "vertical", x: a.x + a.width, y: doorY, height: doorLength, roomKeys: [a.roomKey, b.roomKey] });
      } else if (horizontalShared) {
        const maxDoorLength = Math.min(getDoorWidth(a.type), getDoorWidth(b.type));
        const doorLength = Math.min(maxDoorLength, Math.max(10, overlapX - 4));
        const doorX = Math.max(a.x, b.x) + overlapX / 2;
        doors.push({ orientation: "horizontal", x: doorX, y: a.y + a.length, width: doorLength, roomKeys: [a.roomKey, b.roomKey] });
      }
    }
  }

  ensureRoomConnectivity(rooms, doors, floorWidth, floorHeight);

  const walls = [...boundaryWalls];
  edgeMap.forEach((entry) => {
    const wall = { x1: entry.x1, y1: entry.y1, x2: entry.x2, y2: entry.y2, thickness: entry.shared ? 4 : 2, stroke: wallColor };
    walls.push(...splitWallForDoors(wall, doors));
  });

  rooms.forEach((room) => {
    const edges = [
      { orientation: "vertical", x: room.x, y1: room.y, y2: room.y + room.length, exterior: Math.abs(room.x - ROOM_PADDING) < 2 },
      { orientation: "vertical", x: room.x + room.width, y1: room.y, y2: room.y + room.length, exterior: Math.abs(room.x + room.width - (floorWidth - ROOM_PADDING)) < 2 },
      { orientation: "horizontal", y: room.y, x1: room.x, x2: room.x + room.width, exterior: Math.abs(room.y - ROOM_PADDING) < 2 },
      { orientation: "horizontal", y: room.y + room.length, x1: room.x, x2: room.x + room.width, exterior: Math.abs(room.y + room.length - (floorHeight - ROOM_PADDING)) < 2 }
    ];

    edges.forEach((edge) => {
      if (!edge.exterior) return;
      const edgeLength = edge.orientation === "vertical" ? edge.y2 - edge.y1 : edge.x2 - edge.x1;
      if (edgeLength < 60) return;

      const step = WINDOW_SIZE + WINDOW_GAP;
      let offset = edge.orientation === "vertical" ? edge.y1 + 18 : edge.x1 + 18;
      while (offset + WINDOW_SIZE < (edge.orientation === "vertical" ? edge.y2 : edge.x2) - 18) {
        if (edge.orientation === "vertical") {
          windows.push({ x: edge.x - 2, y: offset, width: 4, height: WINDOW_SIZE });
        } else {
          windows.push({ x: offset, y: edge.y - 2, width: WINDOW_SIZE, height: 4 });
        }
        offset += step;
      }
    });
  });

  return { walls, doors, windows };
}
