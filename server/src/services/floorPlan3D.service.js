// 3D Floor Plan Generation Service
// Generates Three.js-compatible 3D model data from floor plan analysis

const ROOM_COLORS_3D = {
  Bedroom: 0x1f2933,
  Bathroom: 0xe8f4f8,
  Kitchen: 0x334155,
  Living: 0x2a2a2a,
  Dining: 0x374151,
  Garage: 0x4b5563,
  Balcony: 0x6b7280,
  Hallway: 0x9ca3af,
  Staircase: 0xd1d5db
};

const WALL_HEIGHT = 30; // Wall height in units
const WALL_THICKNESS = 2;
const FLOOR_THICKNESS = 2;

/**
 * Generate 3D model data from floor plan
 * Returns JSON structure for Three.js rendering on frontend
 */
export function generate3DFloorPlan(plan) {
  if (!plan || !plan.floors || plan.floors.length === 0) {
    throw new Error('Invalid floor plan data');
  }

  const floor = plan.floors[0];
  const { rooms, width: floorWidth, length: floorLength, entrance } = floor;

  const model = {
    dimensions: {
      width: floorWidth,
      length: floorLength,
      wallHeight: WALL_HEIGHT
    },
    floor: {
      width: floorWidth,
      length: floorLength,
      thickness: FLOOR_THICKNESS,
      color: 0x1a1a2e
    },
    rooms: rooms.map(room => ({
      id: room.roomKey,
      type: room.type,
      label: room.label,
      x: room.x,
      y: room.y,
      width: room.width,
      length: room.length,
      height: WALL_HEIGHT,
      color: ROOM_COLORS_3D[room.type] || 0x64748b,
      walls: generateRoomWalls(room, floorWidth, floorLength)
    })),
    walls: generateOuterWalls(floorWidth, floorLength),
    entrance: entrance ? {
      x: entrance.x,
      y: entrance.y,
      radius: entrance.radius || 12
    } : null,
    camera: {
      position: { x: floorWidth * 0.8, y: floorLength * 1.2, z: Math.max(floorWidth, floorLength) * 0.8 },
      target: { x: floorWidth / 2, y: 0, z: floorLength / 2 }
    }
  };

  return model;
}

function generateRoomWalls(room, floorWidth, floorLength) {
  const walls = [];
  const { x, y, width, length } = room;
  const padding = 14;

  // North wall (top)
  walls.push({
    start: { x: x, z: y },
    end: { x: x + width, z: y },
    height: WALL_HEIGHT,
    thickness: WALL_THICKNESS,
    isExterior: Math.abs(y - padding) < 2
  });

  // South wall (bottom)
  walls.push({
    start: { x: x, z: y + length },
    end: { x: x + width, z: y + length },
    height: WALL_HEIGHT,
    thickness: WALL_THICKNESS,
    isExterior: Math.abs(y + length - (floorLength - padding)) < 2
  });

  // West wall (left)
  walls.push({
    start: { x: x, z: y },
    end: { x: x, z: y + length },
    height: WALL_HEIGHT,
    thickness: WALL_THICKNESS,
    isExterior: Math.abs(x - padding) < 2
  });

  // East wall (right)
  walls.push({
    start: { x: x + width, z: y },
    end: { x: x + width, z: y + length },
    height: WALL_HEIGHT,
    thickness: WALL_THICKNESS,
    isExterior: Math.abs(x + width - (floorWidth - padding)) < 2
  });

  return walls;
}

function generateOuterWalls(width, length) {
  return [
    // North
    { start: { x: 0, z: 0 }, end: { x: width, z: 0 }, height: WALL_HEIGHT, thickness: 4 },
    // South
    { start: { x: 0, z: length }, end: { x: width, z: length }, height: WALL_HEIGHT, thickness: 4 },
    // West
    { start: { x: 0, z: 0 }, end: { x: 0, z: length }, height: WALL_HEIGHT, thickness: 4 },
    // East
    { start: { x: width, z: 0 }, end: { x: width, z: length }, height: WALL_HEIGHT, thickness: 4 }
  ];
}

export default { generate3DFloorPlan };
