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

export function buildRenderPlan(rooms, floorWidth, floorHeight, wallColor = "#94a3b8") {
  const walls = [
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

  edgeMap.forEach((entry) => {
    walls.push({ x1: entry.x1, y1: entry.y1, x2: entry.x2, y2: entry.y2, thickness: entry.shared ? 4 : 2, stroke: wallColor });
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
        doors.push({ orientation: "vertical", x: a.x + a.width, y: doorY, height: doorLength });
      } else if (horizontalShared) {
        const maxDoorLength = Math.min(getDoorWidth(a.type), getDoorWidth(b.type));
        const doorLength = Math.min(maxDoorLength, Math.max(10, overlapX - 4));
        const doorX = Math.max(a.x, b.x) + overlapX / 2;
        doors.push({ orientation: "horizontal", x: doorX, y: a.y + a.length, width: doorLength });
      }
    }
  }

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
