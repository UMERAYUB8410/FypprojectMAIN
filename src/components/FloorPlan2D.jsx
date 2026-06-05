import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { buildRenderPlan, ROOM_PADDING } from "../utils/floorPlanLayout";

const SNAP_RADIUS = 12;
const DOOR_STROKE = "#fbbf24";

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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function rectsOverlap(a, b) {
  return !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.length <= b.y || b.y + b.length <= a.y);
}

function getEntranceDoorArc(entrance, floorWidth, floorLength) {
  if (!entrance) return null;
  const W = 32;
  const { x, y } = entrance;
  const walls = [
    { id: "north", d: y },
    { id: "south", d: floorLength - y },
    { id: "west",  d: x },
    { id: "east",  d: floorWidth - x },
  ];
  const { id } = walls.reduce((a, b) => (a.d < b.d ? a : b));
  switch (id) {
    case "north": {
      const hx = x - W / 2;
      return { line: [hx, 0, hx + W, 0], open: [hx, 0, hx, W], arc: `M ${hx + W} 0 A ${W} ${W} 0 0 1 ${hx} ${W}` };
    }
    case "south": {
      const hx = x - W / 2, wy = floorLength;
      return { line: [hx, wy, hx + W, wy], open: [hx, wy, hx, wy - W], arc: `M ${hx + W} ${wy} A ${W} ${W} 0 0 0 ${hx} ${wy - W}` };
    }
    case "west": {
      const hy = y - W / 2;
      return { line: [0, hy, 0, hy + W], open: [0, hy, W, hy], arc: `M 0 ${hy + W} A ${W} ${W} 0 0 0 ${W} ${hy}` };
    }
    case "east": {
      const hy = y - W / 2, wx = floorWidth;
      return { line: [wx, hy, wx, hy + W], open: [wx, hy, wx - W, hy], arc: `M ${wx} ${hy + W} A ${W} ${W} 0 0 1 ${wx - W} ${hy}` };
    }
    default: return null;
  }
}

function findSnapped(value, lines) {
  let closest = value;
  let best = SNAP_RADIUS + 1;
  lines.forEach((line) => {
    const distance = Math.abs(value - line);
    if (distance < best) {
      best = distance;
      closest = line;
    }
  });
  return closest;
}


const FloorPlan2D = forwardRef(({ plan, onRoomDragEnd, onEntranceDragEnd, wallColor = "#94a3b8", floorColor = "#1a1a2e" }, ref) => {
  const [rooms, setRooms] = useState(plan?.floors?.[0]?.rooms || []);
  const [entrance, setEntrance] = useState(plan?.floors?.[0]?.entrance || null);
  const [invalid, setInvalid] = useState(false);
  const dragSessionRef = useRef(null);
  const svgRef = useRef(null);
  const floor = plan?.floors?.[0] || null;

  useImperativeHandle(ref, () => ({
    downloadSVG: () => {
      if (!svgRef.current) return;
      
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const blob = new Blob([svgData], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "floor-plan-2d.svg";
      link.click();
      URL.revokeObjectURL(url);
    },
    downloadPNG: () => {
      if (!svgRef.current) return;
      
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      
      img.onload = () => {
        canvas.width = img.width * 2;
        canvas.height = img.height * 2;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          const pngUrl = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = pngUrl;
          link.download = "floor-plan-2d.png";
          link.click();
          URL.revokeObjectURL(pngUrl);
          URL.revokeObjectURL(url);
        });
      };
      
      img.src = url;
    }
  }));

  useEffect(() => {
    setRooms(plan?.floors?.[0]?.rooms || []);
    setEntrance(plan?.floors?.[0]?.entrance || null);
    setInvalid(false);
    dragSessionRef.current = null;
  }, [plan]);

  const renderPlan = useMemo(() => {
    if (!floor) return { walls: [], doors: [], windows: [] };
    return buildRenderPlan(rooms, floor.width, floor.length, wallColor);
  }, [rooms, floor, wallColor]);

  const snapLines = useMemo(() => {
    const xLines = [ROOM_PADDING, floor ? floor.width - ROOM_PADDING : 0];
    const yLines = [ROOM_PADDING, floor ? floor.length - ROOM_PADDING : 0];
    rooms.forEach((room) => {
      xLines.push(room.x, room.x + room.width);
      yLines.push(room.y, room.y + room.length);
    });
    return {
      x: Array.from(new Set(xLines)),
      y: Array.from(new Set(yLines))
    };
  }, [rooms, floor]);

  useEffect(() => {
    const handleMove = (event) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      event.preventDefault();

      let dx = event.clientX - session.startX;
      let dy = event.clientY - session.startY;
      const svg = svgRef.current;
      if (svg?.createSVGPoint && svg.getScreenCTM) {
        const point = svg.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());
        dx = svgPoint.x - session.startX;
        dy = svgPoint.y - session.startY;
      }

      if (session.type === "entrance") {
        const candidate = {
          ...session.item,
          x: session.originX + dx,
          y: session.originY + dy
        };
        const maxX = floor.width - candidate.radius - ROOM_PADDING;
        const maxY = floor.length - candidate.radius - ROOM_PADDING;
        candidate.x = clamp(candidate.x, ROOM_PADDING + candidate.radius, maxX);
        candidate.y = clamp(candidate.y, ROOM_PADDING + candidate.radius, maxY);
        setEntrance(candidate);
        return;
      }

      const candidate = {
        ...session.item,
        x: session.originX + dx,
        y: session.originY + dy
      };
      const maxX = floor.width - session.item.width - ROOM_PADDING;
      const maxY = floor.length - session.item.length - ROOM_PADDING;
      candidate.x = clamp(candidate.x, ROOM_PADDING, maxX);
      candidate.y = clamp(candidate.y, ROOM_PADDING, maxY);
      candidate.x = findSnapped(candidate.x, snapLines.x);
      candidate.y = findSnapped(candidate.y, snapLines.y);

      const nextRooms = rooms.map((room) => (room.roomKey === session.item.roomKey ? candidate : room));
      const overlap = nextRooms.some((room) => room.roomKey !== session.item.roomKey && rectsOverlap(candidate, room));
      setInvalid(overlap);
      setRooms(nextRooms);
    };

    const handleUp = (event) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      if (!invalid) {
        if (session.type === "entrance" && typeof onEntranceDragEnd === "function") {
          onEntranceDragEnd({ x: entrance.x, y: entrance.y });
        }
        if (session.type === "room" && typeof onRoomDragEnd === "function") {
          const dragged = rooms.find((room) => room.roomKey === session.item.roomKey);
          if (dragged) {
            onRoomDragEnd({ roomKey: dragged.roomKey, x: dragged.x, y: dragged.y });
          }
        }
      } else {
        if (session.type === "room") {
          setRooms(plan?.floors?.[0]?.rooms || []);
        }
        if (session.type === "entrance") {
          setEntrance(plan?.floors?.[0]?.entrance || null);
        }
        setInvalid(false);
      }
      dragSessionRef.current = null;
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [rooms, entrance, invalid, onRoomDragEnd, onEntranceDragEnd, plan, snapLines, floor]);

  const startDrag = (event, item, type = "room") => {
    event.preventDefault();
    let startX = event.clientX;
    let startY = event.clientY;
    const svg = svgRef.current;
    if (svg?.createSVGPoint && svg.getScreenCTM) {
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const svgPoint = point.matrixTransform(svg.getScreenCTM().inverse());
      startX = svgPoint.x;
      startY = svgPoint.y;
    }

    dragSessionRef.current = {
      pointerId: event.pointerId,
      startX,
      startY,
      originX: item.x,
      originY: item.y,
      item,
      type
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  if (!floor) {
    return null;
  }

  const totalWidth = Math.round(floor.width / 10);
  const totalHeight = Math.round(floor.length / 10);

  return (
    <div
      className="relative rounded-3xl border border-white/10 bg-slate-950/80 p-4"
      style={{ touchAction: "none", width: "100%", minHeight: "40vh", maxHeight: "65vh", overflow: "auto" }}
    >
      <div className="mb-4 flex flex-col gap-2 text-sm text-slate-300">
        <div className="font-semibold text-white">Interactive Architectural Floor Plan</div>
        <div className="text-slate-400">Room edges snap to nearby boundaries and adjacent rooms.</div>
        <div className="text-slate-400">Floor dimensions: {totalWidth}' x {totalHeight}'</div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${floor.width + 120} ${floor.length + 120}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", maxWidth: "720px", maxHeight: "60vh", display: "block", margin: "0 auto" }}
      >
        <defs>
          <linearGradient id="bgGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#020617" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={floor.width + 120} height={floor.length + 120} fill="url(#bgGradient)" />

        <g transform="translate(40, 40)">
          <rect x="0" y="0" width={floor.width} height={floor.length} fill={floorColor} stroke="#64748b" strokeWidth="4" rx="8" />

          {renderPlan.walls.map((wall, index) => (
            <line
              key={`wall-${index}`}
              x1={wall.x1}
              y1={wall.y1}
              x2={wall.x2}
              y2={wall.y2}
              stroke={wall.stroke}
              strokeWidth={wall.thickness}
              strokeLinecap="square"
            />
          ))}

          {renderPlan.windows.map((windowItem, index) => (
            <rect
              key={`window-${index}`}
              x={windowItem.x}
              y={windowItem.y}
              width={windowItem.width}
              height={windowItem.height}
              fill="#7dd3fc"
              fillOpacity="0.85"
              stroke="#38bdf8"
              strokeWidth="1"
              rx="2"
            />
          ))}

          {entrance && (() => {
            const eDoor = getEntranceDoorArc(entrance, floor.width, floor.length);
            return (
              <g
                className="entrance-point"
                onPointerDown={(event) => startDrag(event, entrance, "entrance")}
                style={{ cursor: "grab" }}
              >
                {eDoor && (
                  <>
                    {/* door panel line on the wall */}
                    <line x1={eDoor.line[0]} y1={eDoor.line[1]} x2={eDoor.line[2]} y2={eDoor.line[3]} stroke="#fbbf24" strokeWidth="5" strokeLinecap="butt" />
                    {/* door open position line */}
                    <line x1={eDoor.open[0]} y1={eDoor.open[1]} x2={eDoor.open[2]} y2={eDoor.open[3]} stroke="#fbbf24" strokeWidth="2" />
                    {/* door swing arc */}
                    <path d={eDoor.arc} fill="none" stroke="#fbbf24" strokeWidth="1.8" strokeDasharray="4 3" opacity="0.85" />
                  </>
                )}
                <circle
                  cx={entrance.x}
                  cy={entrance.y}
                  r={entrance.radius}
                  fill="#fbbf24"
                  fillOpacity="0.92"
                  stroke="#f59e0b"
                  strokeWidth="2"
                />
                <text
                  x={entrance.x}
                  y={entrance.y - entrance.radius - 6}
                  fill="#e2e8f0"
                  fontSize="10"
                  textAnchor="middle"
                >
                  Entrance
                </text>
              </g>
            );
          })()}

          {rooms.map((room) => {
            const fill = ROOM_COLORS[room.type] || "#64748b";
            const textFill = TEXT_COLORS[room.type] || "#ffffff";
            return (
              <g key={room.roomKey} className="room-group" onPointerDown={(event) => startDrag(event, room)} style={{ cursor: "grab" }}>
                <rect
                  x={room.x}
                  y={room.y}
                  width={room.width}
                  height={room.length}
                  fill={fill}
                  fillOpacity="0.16"
                  stroke={invalid ? "#f87171" : "#94a3b8"}
                  strokeWidth="1.8"
                  rx="8"
                />
                {room.type === "Bedroom" && (() => {
                  const bw = Math.min(room.width * 0.52, 72);
                  const bl = Math.min(room.length * 0.55, 80);
                  const bx = room.x + room.width / 2 - bw / 2;
                  const by = room.y + room.length / 2 - bl / 2 + 10;
                  return (
                    <g opacity="0.8">
                      <rect x={bx} y={by} width={bw} height={bl} fill="#475569" fillOpacity="0.55" rx="3" />
                      <rect x={bx} y={by} width={bw} height={bl * 0.18} fill="#334155" fillOpacity="0.9" rx="3" />
                      <rect x={bx + 2} y={by + bl * 0.21} width={bw - 4} height={bl * 0.74} fill="#64748b" fillOpacity="0.4" rx="2" />
                      <rect x={bx + bw * 0.08} y={by + bl * 0.03} width={bw * 0.35} height={bl * 0.14} fill="#94a3b8" fillOpacity="0.7" rx="3" />
                      <rect x={bx + bw * 0.57} y={by + bl * 0.03} width={bw * 0.35} height={bl * 0.14} fill="#94a3b8" fillOpacity="0.7" rx="3" />
                    </g>
                  );
                })()}
                <text x={room.x + room.width / 2} y={room.y + 24} fill={textFill} fontSize="12" fontWeight="700" textAnchor="middle">
                  {room.label}
                </text>
                <text x={room.x + room.width / 2} y={room.y + room.length / 2 + 4} fill={textFill} fontSize="11" textAnchor="middle" opacity="0.88">
                  {Math.round(room.width / 10)}' x {Math.round(room.length / 10)}'
                </text>
              </g>
            );
          })}

          {renderPlan.doors.map((door, index) => {
            if (door.orientation === "vertical") {
              const y0 = door.y - door.height / 2;
              const y1 = door.y + door.height / 2;
              return (
                <g key={`door-${index}`}>
                  <line x1={door.x} y1={y0} x2={door.x} y2={y1} stroke={DOOR_STROKE} strokeWidth="4" />
                  <path d={`M ${door.x} ${y1} A ${door.height / 2} ${door.height / 2} 0 0 0 ${door.x} ${y0}`} fill="none" stroke={DOOR_STROKE} strokeWidth="1.8" opacity="0.95" />
                </g>
              );
            }
            const x0 = door.x - door.width / 2;
            const x1 = door.x + door.width / 2;
            return (
              <g key={`door-${index}`}>
                <line x1={x0} y1={door.y} x2={x1} y2={door.y} stroke={DOOR_STROKE} strokeWidth="4" />
                <path d={`M ${x1} ${door.y} A ${door.width / 2} ${door.width / 2} 0 0 1 ${x0} ${door.y}`} fill="none" stroke={DOOR_STROKE} strokeWidth="1.8" opacity="0.95" />
              </g>
            );
          })}

          <g>
            <line x1="0" y1={-14} x2={floor.width} y2={-14} stroke="#64748b" strokeWidth="1" />
            <text x={floor.width / 2} y={-18} fill="#94a3b8" fontSize="10" textAnchor="middle">
              {totalWidth}'
            </text>
            <line x1={-14} y1="0" x2={-14} y2={floor.length} stroke="#64748b" strokeWidth="1" />
            <text x={-18} y={floor.length / 2} fill="#94a3b8" fontSize="10" textAnchor="middle" transform={`rotate(-90 -18 ${floor.length / 2})`}>
              {totalHeight}'
            </text>
          </g>
        </g>
      </svg>

      {invalid && (
        <div className="pointer-events-none absolute left-6 top-6 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-200">
          Invalid placement detected. Rooms cannot overlap or leave the boundary.
        </div>
      )}
    </div>
  );
});

FloorPlan2D.displayName = "FloorPlan2D";

export default FloorPlan2D;
