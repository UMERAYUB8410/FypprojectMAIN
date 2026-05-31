// ✅ BUG 4 FIX: Sanitize SVG output
function sanitizeSVG(svg) {
  return svg.replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/on\w+\s*=/gi, '');
}

// ============================================
// RULE-BASED HOUSE ENGINE CONFIGURATION
// ============================================

// Standard room sizes in feet (width x length)
const ROOM_SIZES = {
  Bedroom: { min: { w: 10, l: 10 }, max: { w: 16, l: 18 }, optimal: { w: 12, l: 14 } },
  Bathroom: { min: { w: 6, l: 8 }, max: { w: 10, l: 12 }, optimal: { w: 8, l: 10 } },
  Kitchen: { min: { w: 8, l: 10 }, max: { w: 14, l: 16 }, optimal: { w: 10, l: 12 } },
  Living: { min: { w: 12, l: 14 }, max: { w: 20, l: 24 }, optimal: { w: 16, l: 18 } },
  Dining: { min: { w: 10, l: 10 }, max: { w: 14, l: 16 }, optimal: { w: 12, l: 14 } },
  Garage: { min: { w: 12, l: 20 }, max: { w: 20, l: 24 }, optimal: { w: 16, l: 22 } },
  Balcony: { min: { w: 6, l: 8 }, max: { w: 10, l: 12 }, optimal: { w: 8, l: 10 } },
  Hallway: { min: { w: 3, l: 6 }, max: { w: 6, l: 10 }, optimal: { w: 4, l: 8 } },
  Staircase: { min: { w: 3, l: 8 }, max: { w: 5, l: 12 }, optimal: { w: 4, l: 10 } }
};

// Room adjacency rules (which rooms should be near each other)
const ADJACENCY_RULES = {
  Kitchen: { near: ['Dining', 'Living'], far: ['Bedroom', 'Bathroom'] },
  Dining: { near: ['Kitchen', 'Living'], far: ['Bedroom'] },
  Bathroom: { near: ['Bedroom', 'Hallway'], far: ['Kitchen', 'Living'] },
  Bedroom: { near: ['Bathroom', 'Balcony'], far: ['Kitchen', 'Living', 'Garage'] },
  Living: { near: ['Dining', 'Kitchen'], far: ['Bedroom'] },
  Garage: { near: ['Hallway'], far: ['Bedroom', 'Living'] }
};

// Room colors by type
const ROOM_COLORS = {
  Bedroom: "#1f2933",
  Bathroom: "#e8f4f8",
  Kitchen: "#334155",
  Living: "#2a2a2a",
  Dining: "#374151",
  Garage: "#4b5563",
  Balcony: "#6b7280",
  Hallway: "#9ca3af",
  Staircase: "#d1d5db"
};

// Text colors for rooms (light for dark backgrounds, dark for light backgrounds)
const TEXT_COLORS = {
  Bedroom: "#ffffff",
  Bathroom: "#1e293b",
  Kitchen: "#ffffff",
  Living: "#ffffff",
  Dining: "#ffffff",
  Garage: "#ffffff",
  Balcony: "#ffffff",
  Hallway: "#1e293b",
  Staircase: "#1e293b"
};

const ROOM_PADDING = 14;
const MIN_ROOM_DIMENSION = 40;
const ROOM_PRIORITY = [
  "Living",
  "Dining",
  "Kitchen",
  "Bedroom",
  "Bathroom",
  "Balcony",
  "Garage",
  "Hallway",
  "Staircase"
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function getRoomSize(type, plotWidth, plotLength) {
  const size = ROOM_SIZES[type] || { optimal: { w: 10, l: 10 } };
  const baseWidth = size.optimal.w * 10;
  const baseLength = size.optimal.l * 10;
  const plotScale = Math.min(plotWidth / 400, plotLength / 400, 1);
  const maxWidth = Math.max(80, plotWidth * 0.35);
  const maxLength = Math.max(80, plotLength * 0.35);

  return {
    width: Math.max(MIN_ROOM_DIMENSION, Math.min(baseWidth * plotScale, maxWidth)),
    length: Math.max(MIN_ROOM_DIMENSION, Math.min(baseLength * plotScale, maxLength))
  };
}

function clampValue(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

const ROOM_REGIONS = {
  Living: { x: 0.08, y: 0.08 },
  Dining: { x: 0.7, y: 0.6 },
  Kitchen: { x: 0.08, y: 0.6 },
  Bedroom: { x: 0.65, y: 0.1 },
  Bathroom: { x: 0.7, y: 0.35 },
  Balcony: { x: 0.8, y: 0.08 }
};

const ATTACHMENT_RULES = {
  Bathroom: ["Bedroom"],
  Balcony: ["Bedroom", "Living"]
};

function calculateScore(room, candidate, placedRooms, plotWidth, plotLength) {
  const rules = ADJACENCY_RULES[room.type] || { near: [], far: [] };
  let score = 0;

  placedRooms.forEach(placed => {
    if (rules.near.includes(placed.type)) score += 12;
    if (rules.far.includes(placed.type)) score -= 12;
  });

  if (placedRooms.length > 0) {
    const minDistance = Math.min(
      ...placedRooms.map(placed => {
        const dx = candidate.x - placed.x;
        const dy = candidate.y - placed.y;
        return Math.sqrt(dx * dx + dy * dy);
      })
    );
    score += minDistance * 0.08;
  }

  const region = ROOM_REGIONS[room.type];
  if (region) {
    const targetX = region.x * (plotWidth - candidate.width);
    const targetY = region.y * (plotLength - candidate.length);
    const dx = candidate.x - targetX;
    const dy = candidate.y - targetY;
    const distanceToRegion = Math.sqrt(dx * dx + dy * dy);
    score -= distanceToRegion * 0.06;
  }

  if (room.type === "Balcony") {
    const onEdge = (
      candidate.x <= ROOM_PADDING ||
      candidate.y <= ROOM_PADDING ||
      candidate.x + candidate.width >= plotWidth - ROOM_PADDING ||
      candidate.y + candidate.length >= plotLength - ROOM_PADDING
    );
    if (onEdge) score += 18;
  }

  return score;
}

function findAttachedPosition(room, placedRooms, plotWidth, plotLength) {
  const attachments = ATTACHMENT_RULES[room.type];
  if (!attachments || placedRooms.length === 0) return null;

  const targetRooms = placedRooms.filter((placed) =>
    attachments.includes(placed.type)
  );
  if (targetRooms.length === 0) return null;

  const size = getRoomSize(room.type, plotWidth, plotLength);
  let bestScore = -Infinity;
  let bestPos = null;

  targetRooms.forEach((target) => {
    const candidates = [
      { x: target.x + target.width, y: target.y },
      { x: target.x - size.width, y: target.y },
      { x: target.x, y: target.y + target.length },
      { x: target.x, y: target.y - size.length }
    ];

    candidates.forEach((candidate) => {
      if (
        candidate.x < ROOM_PADDING ||
        candidate.y < ROOM_PADDING ||
        candidate.x + size.width > plotWidth - ROOM_PADDING ||
        candidate.y + size.length > plotLength - ROOM_PADDING
      ) {
        return;
      }

      if (!isValidRoomPlacement({
        x: candidate.x,
        y: candidate.y,
        width: size.width,
        length: size.length
      }, placedRooms, plotWidth, plotLength, true)) {
        return;
      }

      const candidateRoom = {
        x: candidate.x,
        y: candidate.y,
        width: size.width,
        length: size.length
      };
      const score = calculateScore(room, candidateRoom, placedRooms, plotWidth, plotLength) + 30;
      if (score > bestScore) {
        bestScore = score;
        bestPos = candidateRoom;
      }
    });
  });

  return bestPos;
}

function findBestPosition(room, placedRooms, plotWidth, plotLength, gridSize = 20) {
  const size = getRoomSize(room.type, plotWidth, plotLength);
  let bestScore = -Infinity;
  let bestPos = null;

  const attachedPos = findAttachedPosition(room, placedRooms, plotWidth, plotLength);
  if (attachedPos) {
    return attachedPos;
  }

  for (let y = ROOM_PADDING; y <= plotLength - size.length - ROOM_PADDING; y += gridSize) {
    for (let x = ROOM_PADDING; x <= plotWidth - size.width - ROOM_PADDING; x += gridSize) {
      let collision = false;
      for (const placed of placedRooms) {
        if (!(x + size.width + ROOM_PADDING < placed.x ||
              placed.x + placed.width + ROOM_PADDING < x ||
              y + size.length + ROOM_PADDING < placed.y ||
              placed.y + placed.length + ROOM_PADDING < y)) {
          collision = true;
          break;
        }
      }

      if (!collision) {
        const candidate = { x, y, width: size.width, length: size.length };
        const score = calculateScore(room, candidate, placedRooms, plotWidth, plotLength);
        if (score > bestScore) {
          bestScore = score;
          bestPos = candidate;
        }
      }
    }
  }

  if (!bestPos) {
    return {
      x: ROOM_PADDING,
      y: ROOM_PADDING,
      width: size.width,
      length: size.length
    };
  }

  return bestPos;
}

// ============================================
// FLOOR PLAN GENERATION
// ============================================

function generateRoomKey(type, floorNum, instanceIndex) {
  return `${type}-${floorNum}-${instanceIndex}`;
}

function isValidRoomPlacement(candidate, placedRooms, plotWidth, plotLength, allowTouching = false) {
  if (
    candidate.x < ROOM_PADDING ||
    candidate.y < ROOM_PADDING ||
    candidate.x + candidate.width > plotWidth - ROOM_PADDING ||
    candidate.y + candidate.length > plotLength - ROOM_PADDING
  ) {
    return false;
  }

  const padding = allowTouching ? 0 : ROOM_PADDING;
  for (const placed of placedRooms) {
    if (!(candidate.x + candidate.width + padding < placed.x ||
          placed.x + placed.width + padding < candidate.x ||
          candidate.y + candidate.length + padding < placed.y ||
          placed.y + placed.length + padding < candidate.y)) {
      return false;
    }
  }

  return true;
}

function expandRoomCounts(rooms, floorNum, roomPositions = {}) {
  const floorRooms = [];

  rooms.forEach(room => {
    if (!(room.floor === floorNum || (!room.floor && floorNum === 1))) return;

    const repeat = Math.max(1, room.count || 1);
    for (let index = 0; index < repeat; index += 1) {
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
  const floorRooms = expandRoomCounts(rooms, floorNum, roomPositions);
  const placedRooms = [];

  const sortedRooms = [...floorRooms].sort((a, b) => {
    const aPinned = a.preferredX != null ? 0 : 1;
    const bPinned = b.preferredX != null ? 0 : 1;
    if (aPinned !== bPinned) return aPinned - bPinned;

    const priorityA = ROOM_PRIORITY.indexOf(a.type);
    const priorityB = ROOM_PRIORITY.indexOf(b.type);
    if (priorityA !== priorityB) return priorityA - priorityB;

    const sizeA = getRoomSize(a.type, plotWidth, plotLength);
    const sizeB = getRoomSize(b.type, plotWidth, plotLength);
    return (sizeB.width * sizeB.length) - (sizeA.width * sizeA.length);
  });

  sortedRooms.forEach((room, idx) => {
    const size = getRoomSize(room.type, plotWidth, plotLength);
    let pos = null;

    if (room.preferredX != null && room.preferredY != null) {
      const candidate = {
        x: room.preferredX,
        y: room.preferredY,
        width: size.width,
        length: size.length
      };
      if (isValidRoomPlacement(candidate, placedRooms, plotWidth, plotLength, true)) {
        pos = candidate;
      }
    }

    if (!pos) {
      pos = findBestPosition(room, placedRooms, plotWidth, plotLength);
    }

    placedRooms.push({
      ...pos,
      type: room.type,
      id: idx,
      label: room.instance ? `${room.type} ${room.instance}` : room.type,
      roomKey: room.roomKey
    });
  });

  return placedRooms;
}

function getDoorWidth(type) {
  const sizes = {
    Bathroom: 24,
    Bedroom: 30,
    Kitchen: 30,
    Living: 36,
    Dining: 30,
    Garage: 32,
    Balcony: 28,
    Hallway: 28,
    Staircase: 26
  };
  return sizes[type] || 28;
}

function getOverlap(startA, endA, startB, endB) {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB));
}

function getSharedDoorType(roomA, roomB) {
  if (roomA.type === "Bathroom" || roomB.type === "Bathroom") return "bathroom";
  if (roomA.type === "Bedroom" || roomB.type === "Bedroom") return "standard";
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
    wallMap.set(key, {
      ...edge,
      count: 1,
      roomKeys: [edge.roomKey],
      shared: false
    });
  }

  rooms.forEach(room => {
    addEdge({
      orientation: "horizontal",
      coord: room.y,
      start: room.x,
      end: room.x + room.width,
      x1: room.x,
      y1: room.y,
      x2: room.x + room.width,
      y2: room.y,
      roomKey: room.roomKey
    });
    addEdge({
      orientation: "horizontal",
      coord: room.y + room.length,
      start: room.x,
      end: room.x + room.width,
      x1: room.x,
      y1: room.y + room.length,
      x2: room.x + room.width,
      y2: room.y + room.length,
      roomKey: room.roomKey
    });
    addEdge({
      orientation: "vertical",
      coord: room.x,
      start: room.y,
      end: room.y + room.length,
      x1: room.x,
      y1: room.y,
      x2: room.x,
      y2: room.y + room.length,
      roomKey: room.roomKey
    });
    addEdge({
      orientation: "vertical",
      coord: room.x + room.width,
      start: room.y,
      end: room.y + room.length,
      x1: room.x + room.width,
      y1: room.y,
      x2: room.x + room.width,
      y2: room.y + room.length,
      roomKey: room.roomKey
    });
  });

  const segments = [...wallMap.values()].map(entry => {
    const onPlotBoundary = entry.x1 === 0 || entry.y1 === 0 || entry.x2 === plotWidth || entry.y2 === plotLength;
    const wallType = onPlotBoundary ? "outer" : entry.shared ? "shared" : "inner";
    return {
      x1: entry.x1,
      y1: entry.y1,
      x2: entry.x2,
      y2: entry.y2,
      type: wallType,
      thickness: wallType === "outer" ? 6 : wallType === "shared" ? 4 : 2,
      stroke: wallType === "outer" ? "#e2e8f0" : wallType === "shared" ? "#9ca3af" : "#d1d5db"
    };
  });

  const boundaryWalls = [
    { x1: 0, y1: 0, x2: plotWidth, y2: 0, type: "outer", thickness: 8, stroke: "#f8fafc" },
    { x1: plotWidth, y1: 0, x2: plotWidth, y2: plotLength, type: "outer", thickness: 8, stroke: "#f8fafc" },
    { x1: plotWidth, y1: plotLength, x2: 0, y2: plotLength, type: "outer", thickness: 8, stroke: "#f8fafc" },
    { x1: 0, y1: plotLength, x2: 0, y2: 0, type: "outer", thickness: 8, stroke: "#f8fafc" }
  ];

  return [...boundaryWalls, ...segments];
}

function buildDoors(rooms) {
  const doors = [];

  for (let i = 0; i < rooms.length; i += 1) {
    for (let j = i + 1; j < rooms.length; j += 1) {
      const room = rooms[i];
      const other = rooms[j];

      const overlapY = getOverlap(room.y, room.y + room.length, other.y, other.y + other.length);
      const overlapX = getOverlap(room.x, room.x + room.width, other.x, other.x + other.width);
      const verticalShared = Math.abs(room.x + room.width - other.x) <= 2 && overlapY > 8;
      const horizontalShared = Math.abs(room.y + room.length - other.y) <= 2 && overlapX > 8;

      if (verticalShared) {
        const maxDoorLength = Math.min(getDoorWidth(room.type), getDoorWidth(other.type));
        const doorLength = Math.min(maxDoorLength, overlapY - 8);
        if (doorLength > 10) {
          const doorY = Math.max(room.y, other.y) + overlapY / 2;
          doors.push({
            orientation: "vertical",
            x: room.x + room.width,
            y: doorY,
            width: 4,
            height: doorLength,
            roomKeys: [room.roomKey, other.roomKey],
            doorType: getSharedDoorType(room, other)
          });
        }
      } else if (horizontalShared) {
        const maxDoorLength = Math.min(getDoorWidth(room.type), getDoorWidth(other.type));
        const doorLength = Math.min(maxDoorLength, overlapX - 8);
        if (doorLength > 10) {
          const doorX = Math.max(room.x, other.x) + overlapX / 2;
          doors.push({
            orientation: "horizontal",
            x: doorX,
            y: room.y + room.length,
            width: doorLength,
            height: 4,
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
  const windows = [];
  const windowSize = 24;
  const minimumEdge = 60;

  rooms.forEach(room => {
    const exteriorEdges = [
      {
        orientation: "vertical",
        x: room.x,
        y1: room.y,
        y2: room.y + room.length,
        exterior: Math.abs(room.x - ROOM_PADDING) < 2
      },
      {
        orientation: "vertical",
        x: room.x + room.width,
        y1: room.y,
        y2: room.y + room.length,
        exterior: Math.abs(room.x + room.width - (plotWidth - ROOM_PADDING)) < 2
      },
      {
        orientation: "horizontal",
        y: room.y,
        x1: room.x,
        x2: room.x + room.width,
        exterior: Math.abs(room.y - ROOM_PADDING) < 2
      },
      {
        orientation: "horizontal",
        y: room.y + room.length,
        x1: room.x,
        x2: room.x + room.width,
        exterior: Math.abs(room.y + room.length - (plotLength - ROOM_PADDING)) < 2
      }
    ];

    exteriorEdges.forEach(edge => {
      if (!edge.exterior) return;
      const edgeLength = edge.orientation === "vertical" ? edge.y2 - edge.y1 : edge.x2 - edge.x1;
      if (edgeLength < minimumEdge) return;

      const step = windowSize + 36;
      let offset = edge.orientation === "vertical" ? edge.y1 + 18 : edge.x1 + 18;
      while (offset + windowSize < (edge.orientation === "vertical" ? edge.y2 : edge.x2) - 18) {
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

function buildFloorPlanModel(analysis) {
  const plot = analysis.plot || { width: 400, length: 400 };
  const rooms = analysis.rooms || [];
  const totalFloors = analysis.floors || 1;
  const roomPositions = analysis.roomPositions || {};

  const scale = 0.8;
  const plotWidth = Math.min(plot.width * scale * 10, 700);
  const plotLength = Math.min(plot.length * scale * 10, 700);

  const defaultEntrance = {
    x: Math.round(plotWidth / 2),
    y: plotLength - ROOM_PADDING - 14
  };
  const entrancePosition = analysis.entrancePosition || defaultEntrance;
  const entrance = {
    x: clampValue(entrancePosition.x, ROOM_PADDING + 12, plotWidth - ROOM_PADDING - 12),
    y: clampValue(entrancePosition.y, ROOM_PADDING + 12, plotLength - ROOM_PADDING - 12),
    radius: 12
  };

  const floors = [];
  for (let floor = 1; floor <= totalFloors; floor += 1) {
    const placedRooms = placeRooms(rooms, floor, plotWidth, plotLength, roomPositions);
    const walls = buildWallSegments(placedRooms, plotWidth, plotLength);
    const doors = buildDoors(placedRooms);
    const windows = buildWindows(placedRooms, plotWidth, plotLength);
    const floorLabel = totalFloors > 1 ? `Floor ${floor}` : "Ground Floor";

    floors.push({
      floorNum: floor,
      label: floorLabel,
      width: plotWidth,
      length: plotLength,
      rooms: placedRooms,
      walls,
      doors,
      windows,
      entrance
    });
  }

  return {
    plot,
    totalFloors,
    floors
  };
}

function buildSvgFromPlan(plan) {
  const svgWidth = plan.floors[0].width + 120;
  const svgHeight = plan.floors.reduce((acc, floor) => acc + floor.length + 100, 0) + (plan.floors.length > 1 ? 20 : 0);

  const floorGroups = plan.floors.map((floor, index) => {
    const floorY = index * (floor.length + 60) + 60;
    const roomElements = floor.rooms.map(room => {
      const color = ROOM_COLORS[room.type] || "#64748b";
      const textColor = TEXT_COLORS[room.type] || "#ffffff";
      return `
        <g class="room-group" data-room-key="${room.roomKey}" data-room-type="${room.type}" style="cursor: grab;">
          <rect x="${room.x}" y="${room.y}" width="${room.width}" height="${room.length}"
                fill="${color}" fill-opacity="0.14" stroke="#94a3b8" stroke-width="1.5" rx="6" />
          <text x="${room.x + room.width / 2}" y="${room.y + 24}" fill="${textColor}" font-size="12" font-weight="700" text-anchor="middle">${room.label}</text>
          <text x="${room.x + room.width / 2}" y="${room.y + room.length / 2 + 4}" fill="${textColor}" font-size="11" text-anchor="middle" opacity="0.85">${Math.round(room.width / 10)}' x ${Math.round(room.length / 10)}'</text>
        </g>
      `;
    }).join("");

    const wallElements = floor.walls.map(wall => `
      <line x1="${wall.x1}" y1="${wall.y1}" x2="${wall.x2}" y2="${wall.y2}"
            stroke="${wall.stroke}" stroke-width="${wall.thickness}" stroke-linecap="square" />
    `).join("");

    const doorElements = floor.doors.map(door => {
      if (door.orientation === "vertical") {
        const y0 = door.y - door.height / 2;
        const y1 = door.y + door.height / 2;
        return `
          <path d="M ${door.x} ${y0} L ${door.x} ${y1}" stroke="#fbbf24" stroke-width="${door.width}" />
          <path d="M ${door.x} ${y1} A ${door.height / 2} ${door.height / 2} 0 0 0 ${door.x} ${y0}" fill="none" stroke="#fbbf24" stroke-width="2" opacity="0.9" />
        `;
      }
      const x0 = door.x - door.width / 2;
      const x1 = door.x + door.width / 2;
      return `
        <path d="M ${x0} ${door.y} L ${x1} ${door.y}" stroke="#fbbf24" stroke-width="${door.height}" />
        <path d="M ${x1} ${door.y} A ${door.width / 2} ${door.width / 2} 0 0 1 ${x0} ${door.y}" fill="none" stroke="#fbbf24" stroke-width="2" opacity="0.9" />
      `;
    }).join("");

    const windowElements = floor.windows.map(window => `
      <rect x="${window.x}" y="${window.y}" width="${window.width}" height="${window.height}"
            fill="#7dd3fc" fill-opacity="0.75" stroke="#38bdf8" stroke-width="1" rx="2" />
    `).join("");

    const dimensionText = `
      <text x="${floor.width / 2}" y="${floor.length + 30}" fill="#cbd5e1" font-size="11" text-anchor="middle">
        Floor ${floor.floorNum}: ${Math.round(plan.plot.width)}' x ${Math.round(plan.plot.length)}'
      </text>
    `;

    return `
      <g transform="translate(40, ${floorY})">
        <text x="${floor.width / 2}" y="-20" fill="#e2e8f0" font-size="16" font-weight="700" text-anchor="middle">${floor.label}</text>
        <rect x="0" y="0" width="${floor.width}" height="${floor.length}"
              fill="transparent" stroke="#64748b" stroke-width="4" rx="8" />
        ${wallElements}
        ${windowElements}
        ${roomElements}
        ${doorElements}
        ${dimensionText}
      </g>
    `;
  }).join("");

  return `
    <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          text { font-family: Inter, Arial, sans-serif; }
        </style>
      </defs>
      <rect width="100%" height="100%" fill="#070b17" />
      ${floorGroups}
    </svg>
  `;
}

function generateStaircase(plotWidth, plotLength, floorNum, totalFloors) {
  if (floorNum >= totalFloors) return '';
  
  const size = getRoomSize('Staircase');
  const x = plotWidth - size.width - 20;
  const y = plotLength / 2 - size.length / 2;
  
  let svg = `
    <rect x="${x}" y="${y}" width="${size.width}" height="${size.length}" 
          fill="#d1d5db" stroke="#6b7280" stroke-width="2" rx="2"/>
    <text x="${x + size.width/2}" y="${y + size.length/2}" 
          fill="#1e293b" font-size="10" font-weight="bold" 
          text-anchor="middle">Stairs</text>
  `;
  
  // Draw stairs
  const stepHeight = size.length / 10;
  for (let i = 0; i < 10; i++) {
    svg += `
      <line x1="${x + 5}" y1="${y + i * stepHeight + stepHeight}" 
            x2="${x + size.width - 5}" y2="${y + i * stepHeight + stepHeight}" 
            stroke="#6b7280" stroke-width="1"/>
    `;
  }
  
  return svg;
}

// ============================================
// MAIN EXPORT FUNCTION
// ============================================

export function generateFloorPlanModel(analysis) {
  return buildFloorPlanModel(analysis);
}

export function generate2DFloorPlan(analysis) {
  const plan = buildFloorPlanModel(analysis);
  return buildSvgFromPlan(plan);
}
