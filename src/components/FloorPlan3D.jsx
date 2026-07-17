import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";
import { buildRenderPlan, splitWallForDoors } from "../utils/floorPlanLayout";

const ROOM_COLORS = {
  Bedroom: 0x1f2933,
  Bathroom: 0x38bdf8,
  Kitchen: 0x334155,
  Living: 0x2a2a2a,
  Dining: 0x374151,
  Garage: 0x4b5563,
  Balcony: 0x6b7280,
  Hallway: 0x9ca3af,
  Staircase: 0xd1d5db
};

const WALL_HEIGHT = 40;
const WALL_THICKNESS = 2;

const FloorPlan3D = forwardRef(({ model3D, plan, roomColors = {} }, ref) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const animationRef = useRef(null);
  const floorMatRef = useRef(null);
  const wallMatRef = useRef(null);
  const outerWallMatRef = useRef(null);
  const roomMatsRef = useRef({});

  const defaultWallColor = "#94a3b8";
  const defaultFloorColor = "#1a1a2e";

  // Keep refs in sync so the main effect always reads current colors
  const wallColorRef = useRef(defaultWallColor);
  const floorColorRef = useRef(defaultFloorColor);
  wallColorRef.current = defaultWallColor;
  floorColorRef.current = defaultFloorColor;

  useImperativeHandle(ref, () => ({
    downloadGLTF: () => {
      if (!sceneRef.current) return;
      
      const exporter = new GLTFExporter();
      exporter.parse(
        sceneRef.current,
        (gltf) => {
          const blob = new Blob([JSON.stringify(gltf)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "floor-plan-3d.gltf";
          link.click();
          URL.revokeObjectURL(url);
        },
        (error) => {
          console.error("Error exporting GLTF:", error);
        },
        { binary: false }
      );
    },
    downloadGLB: () => {
      if (!sceneRef.current) return;
      
      const exporter = new GLTFExporter();
      exporter.parse(
        sceneRef.current,
        (gltf) => {
          const blob = new Blob([gltf], { type: "application/octet-stream" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "floor-plan-3d.glb";
          link.click();
          URL.revokeObjectURL(url);
        },
        (error) => {
          console.error("Error exporting GLB:", error);
        },
        { binary: true }
      );
    }
  }));

  useEffect(() => {
    if (!containerRef.current || !plan?.floors?.[0]) return;

    const container = containerRef.current;
    const floor = plan.floors[0];
    const { width: floorWidth, length: floorLength, rooms, entrance } = floor;

    // Door/window positions derived from the same layout logic as 2D, computed
    // up front so room walls can be split into separate meshes around doors.
    const { windows, doors } = buildRenderPlan(rooms, floorWidth, floorLength);

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070b17);
    sceneRef.current = scene;

    // Camera
    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, aspect, 1, 2000);
    camera.position.set(floorWidth * 0.8, floorLength * 0.8, Math.max(floorWidth, floorLength) * 0.9);
    camera.lookAt(floorWidth / 2, 0, floorLength / 2);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(floorWidth / 2, 0, floorLength / 2);
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 50;
    controls.maxDistance = Math.max(floorWidth, floorLength) * 2;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(floorWidth, floorLength, floorWidth);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0xfbbf24, 0.5, floorWidth * 2);
    pointLight.position.set(floorWidth / 2, WALL_HEIGHT * 0.8, floorLength / 2);
    scene.add(pointLight);

    // Floor base
    const floorGeometry = new THREE.BoxGeometry(floorWidth, 2, floorLength);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: floorColorRef.current,
      roughness: 0.8,
      metalness: 0.2
    });
    floorMatRef.current = floorMaterial;
    const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
    floorMesh.position.set(floorWidth / 2, -1, floorLength / 2);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Grid helper
    const gridHelper = new THREE.GridHelper(Math.max(floorWidth, floorLength) * 1.5, 30, 0x444444, 0x222222);
    gridHelper.position.y = 0.1;
    scene.add(gridHelper);

    // Shared wall material for all room walls (single ref for reactive color updates)
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: wallColorRef.current,
      roughness: 0.7,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });
    wallMatRef.current = wallMaterial;

    // Create rooms
    rooms.forEach((room) => {
      const roomColors_ = roomColors[room.roomKey] || { wall: defaultWallColor, floor: defaultFloorColor };

      // Room floor
      const roomFloorGeom = new THREE.PlaneGeometry(room.width - 2, room.length - 2);
      const roomFloorMat = new THREE.MeshStandardMaterial({
        color: roomColors_.floor,
        roughness: 0.9,
        metalness: 0.1,
        transparent: true,
        opacity: 0.6
      });
      const roomFloor = new THREE.Mesh(roomFloorGeom, roomFloorMat);
      roomFloor.rotation.x = -Math.PI / 2;
      roomFloor.position.set(room.x + room.width / 2, 0.2, room.y + room.length / 2);
      roomFloor.receiveShadow = true;
      scene.add(roomFloor);

      // Room-specific wall material
      const roomWallMat = new THREE.MeshStandardMaterial({
        color: roomColors_.wall,
        roughness: 0.7,
        metalness: 0.1,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide
      });
      roomMatsRef.current[room.roomKey] = roomWallMat;

      // Each side is split around any door that falls on it, so a doorway
      // becomes an actual gap between two separate wall meshes in 3D —
      // mirroring how the 2D wall line is split.
      // North wall
      createWallWithDoorGaps(scene, room.x, room.y, room.x + room.width, room.y, WALL_HEIGHT, roomWallMat, doors);
      // South wall
      createWallWithDoorGaps(scene, room.x, room.y + room.length, room.x + room.width, room.y + room.length, WALL_HEIGHT, roomWallMat, doors);
      // West wall
      createWallWithDoorGaps(scene, room.x, room.y, room.x, room.y + room.length, WALL_HEIGHT, roomWallMat, doors);
      // East wall
      createWallWithDoorGaps(scene, room.x + room.width, room.y, room.x + room.width, room.y + room.length, WALL_HEIGHT, roomWallMat, doors);

      // Room label (3D text sprite)
      const labelSprite = createTextSprite(room.label, {
        fontSize: 24,
        textColor: "#ffffff"
      });
      labelSprite.position.set(room.x + room.width / 2, WALL_HEIGHT / 2, room.y + room.length / 2);
      labelSprite.scale.set(room.width * 0.8, room.width * 0.4, 1);
      scene.add(labelSprite);

      // Dimensions label
      const dimSprite = createTextSprite(`${Math.round(room.width / 10)}' x ${Math.round(room.length / 10)}'`, {
        fontSize: 18,
        textColor: "#94a3b8"
      });
      dimSprite.position.set(room.x + room.width / 2, WALL_HEIGHT / 4, room.y + room.length / 2);
      dimSprite.scale.set(room.width * 0.6, room.width * 0.3, 1);
      scene.add(dimSprite);

      // Bed furniture for bedrooms
      if (room.type === "Bedroom") {
        const cx = room.x + room.width / 2;
        const cz = room.y + room.length / 2 + 5;
        const bedW = Math.min(room.width * 0.5, 65);
        const bedL = Math.min(room.length * 0.58, 80);

        const bedFrameMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
        const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(bedW, 4, bedL), bedFrameMat);
        bedFrame.position.set(cx, 2.5, cz);
        bedFrame.castShadow = true;
        scene.add(bedFrame);

        const mattressMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.95 });
        const mattress = new THREE.Mesh(new THREE.BoxGeometry(bedW - 3, 3, bedL - 3), mattressMat);
        mattress.position.set(cx, 6, cz);
        scene.add(mattress);

        const headMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
        const headboard = new THREE.Mesh(new THREE.BoxGeometry(bedW, 12, 3), headMat);
        headboard.position.set(cx, 8, room.y + 5);
        headboard.castShadow = true;
        scene.add(headboard);

        const blanketMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
        const blanket = new THREE.Mesh(new THREE.BoxGeometry(bedW - 6, 1.5, bedL * 0.68), blanketMat);
        blanket.position.set(cx, 8.2, cz + bedL * 0.05);
        scene.add(blanket);

        const pillowMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9 });
        const pillowGeo = new THREE.BoxGeometry(bedW * 0.38, 2, bedL * 0.12);
        [-1, 1].forEach((side) => {
          const pillow = new THREE.Mesh(pillowGeo, pillowMat);
          pillow.position.set(cx + side * bedW * 0.25, 8.8, room.y + bedL * 0.08 + 5);
          scene.add(pillow);
        });
      }

      // Sofa + coffee table for living rooms
      if (room.type === "Living") {
        const cx = room.x + room.width / 2;
        const sofaW = Math.min(room.width * 0.62, 78);
        const bz = room.y + 5; // sofa base Z (near north wall)

        const seatMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.9 });
        const seat = new THREE.Mesh(new THREE.BoxGeometry(sofaW - 8, 5, 18), seatMat);
        seat.position.set(cx, 4.5, bz + 11);
        seat.castShadow = true;
        scene.add(seat);

        const backMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.9 });
        const back = new THREE.Mesh(new THREE.BoxGeometry(sofaW, 12, 4), backMat);
        back.position.set(cx, 8, bz + 2);
        back.castShadow = true;
        scene.add(back);

        const armMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.9 });
        [-1, 1].forEach((side) => {
          const arm = new THREE.Mesh(new THREE.BoxGeometry(4, 9, 22), armMat);
          arm.position.set(cx + side * (sofaW / 2 - 2), 5.5, bz + 11);
          scene.add(arm);
        });

        // Coffee table
        const tableTopMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.15 });
        const tableTop = new THREE.Mesh(new THREE.BoxGeometry(sofaW * 0.52, 2, 14), tableTopMat);
        tableTop.position.set(cx, 7, bz + 34);
        scene.add(tableTop);

        const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
        const legGeo = new THREE.BoxGeometry(1.5, 7, 1.5);
        const tw = sofaW * 0.52;
        [[-tw / 2 + 2, bz + 28], [tw / 2 - 2, bz + 28],
         [-tw / 2 + 2, bz + 40], [tw / 2 - 2, bz + 40]].forEach(([lx, lz]) => {
          const leg = new THREE.Mesh(legGeo, legMat);
          leg.position.set(cx + lx, 3.5, lz);
          scene.add(leg);
        });
      }

      // Dining table + chairs for dining rooms
      if (room.type === "Dining") {
        const cx = room.x + room.width / 2;
        const cz = room.y + room.length / 2;
        const tableW = Math.min(room.width * 0.6, 70);
        const tableL = Math.min(room.length * 0.5, 50);

        // Dining table top
        const tableTopMat = new THREE.MeshStandardMaterial({ 
          color: 0x92400e, 
          roughness: 0.3, 
          metalness: 0.1 
        });
        const tableTop = new THREE.Mesh(new THREE.BoxGeometry(tableW, 2, tableL), tableTopMat);
        tableTop.position.set(cx, 12, cz);
        tableTop.castShadow = true;
        scene.add(tableTop);

        // Table legs
        const tableLegMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
        const tableLegGeo = new THREE.BoxGeometry(2, 12, 2);
        [
          [-tableW / 2 + 3, -tableL / 2 + 3],
          [tableW / 2 - 3, -tableL / 2 + 3],
          [-tableW / 2 + 3, tableL / 2 - 3],
          [tableW / 2 - 3, tableL / 2 - 3]
        ].forEach(([lx, lz]) => {
          const leg = new THREE.Mesh(tableLegGeo, tableLegMat);
          leg.position.set(cx + lx, 6, cz + lz);
          leg.castShadow = true;
          scene.add(leg);
        });

        // Dining chairs
        const chairSeatMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.8 });
        const chairBackMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.8 });
        const chairW = 8;
        const chairD = 8;
        const chairH = 5;
        const backH = 10;

        // Chairs on long sides (2 on each side)
        const longSidePositions = [
          { x: cx - tableW / 2 - 6, z: cz - tableL / 4, rot: Math.PI / 2 },
          { x: cx - tableW / 2 - 6, z: cz + tableL / 4, rot: Math.PI / 2 },
          { x: cx + tableW / 2 + 6, z: cz - tableL / 4, rot: -Math.PI / 2 },
          { x: cx + tableW / 2 + 6, z: cz + tableL / 4, rot: -Math.PI / 2 }
        ];

        // Chairs on short sides (1 on each end)
        const shortSidePositions = [
          { x: cx, z: cz - tableL / 2 - 6, rot: 0 },
          { x: cx, z: cz + tableL / 2 + 6, rot: Math.PI }
        ];

        [...longSidePositions, ...shortSidePositions].forEach(({ x, z, rot }) => {
          // Chair seat
          const seat = new THREE.Mesh(new THREE.BoxGeometry(chairW, chairH, chairD), chairSeatMat);
          seat.position.set(x, chairH / 2 + 1, z);
          seat.rotation.y = rot;
          seat.castShadow = true;
          scene.add(seat);

          // Chair back
          const back = new THREE.Mesh(new THREE.BoxGeometry(chairW, backH, 1.5), chairBackMat);
          back.position.set(x, chairH + backH / 2 + 1, z - chairD / 2 + 0.75);
          back.rotation.y = rot;
          back.castShadow = true;
          scene.add(back);
        });
      }
    });

    // Outer walls
    const outerWallMat = new THREE.MeshStandardMaterial({
      color: wallColorRef.current,
      roughness: 0.5,
      metalness: 0.2
    });
    outerWallMatRef.current = outerWallMat;
    
    // North outer wall
    createWall(scene, 0, 0, floorWidth, WALL_HEIGHT, outerWallMat, "horizontal", 4);
    // South outer wall
    createWall(scene, 0, floorLength, floorWidth, WALL_HEIGHT, outerWallMat, "horizontal", 4);
    // West outer wall
    createWall(scene, 0, 0, floorLength, WALL_HEIGHT, outerWallMat, "vertical", 4);
    // East outer wall
    createWall(scene, floorWidth, 0, floorLength, WALL_HEIGHT, outerWallMat, "vertical", 4);

    const WIN_H = WALL_HEIGHT * 0.4;
    const WIN_CENTER_Y = WALL_HEIGHT * 0.55;
    const DOOR_H = WALL_HEIGHT * 0.78;

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.65,
      metalness: 0.6,
      roughness: 0.05,
      side: THREE.DoubleSide
    });

    windows.forEach((win) => {
      const isVerticalWall = win.width < win.height;
      const geom = isVerticalWall
        ? new THREE.BoxGeometry(4, WIN_H, win.height)
        : new THREE.BoxGeometry(win.width, WIN_H, 4);
      const mesh = new THREE.Mesh(geom, glassMat);
      mesh.position.set(win.x + win.width / 2, WIN_CENTER_Y, win.y + win.height / 2);
      scene.add(mesh);

      // Thin dark frame around the glass
      const frameGeom = isVerticalWall
        ? new THREE.BoxGeometry(4.5, WIN_H + 2, win.height + 2)
        : new THREE.BoxGeometry(win.width + 2, WIN_H + 2, 4.5);
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
      const frameMesh = new THREE.Mesh(frameGeom, frameMat);
      frameMesh.position.copy(mesh.position);
      scene.add(frameMesh);
      scene.add(mesh); // re-add glass on top of frame
    });

    const doorMat = new THREE.MeshStandardMaterial({
      color: 0x92400e,
      roughness: 0.85,
      metalness: 0.05
    });

    doors.forEach((door) => {
      const span = door.orientation === "vertical" ? door.height : door.width;
      const geom = door.orientation === "vertical"
        ? new THREE.BoxGeometry(4, DOOR_H, span)
        : new THREE.BoxGeometry(span, DOOR_H, 4);
      const mesh = new THREE.Mesh(geom, doorMat);
      mesh.position.set(door.x, DOOR_H / 2, door.y);
      mesh.castShadow = true;
      scene.add(mesh);

      // Door frame (slightly larger dark box behind the panel)
      const frameSpan = span + 3;
      const frameGeom = door.orientation === "vertical"
        ? new THREE.BoxGeometry(5, DOOR_H + 1.5, frameSpan)
        : new THREE.BoxGeometry(frameSpan, DOOR_H + 1.5, 5);
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
      const frameMesh = new THREE.Mesh(frameGeom, frameMat);
      frameMesh.position.copy(mesh.position);
      scene.add(frameMesh);
      scene.add(mesh); // re-add door panel in front of frame
    });

    // Entrance marker + door
    if (entrance) {
      const entranceGeom = new THREE.CylinderGeometry(entrance.radius, entrance.radius, 3, 32);
      const entranceMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xfbbf24,
        emissiveIntensity: 0.3
      });
      const entranceMesh = new THREE.Mesh(entranceGeom, entranceMat);
      entranceMesh.position.set(entrance.x, 1.5, entrance.y);
      entranceMesh.castShadow = true;
      scene.add(entranceMesh);

      const entranceLabel = createTextSprite("Entrance", {
        fontSize: 16,
        textColor: "#fbbf24"
      });
      entranceLabel.position.set(entrance.x, 8, entrance.y);
      entranceLabel.scale.set(40, 20, 1);
      scene.add(entranceLabel);

      // Entrance door on the nearest exterior wall
      const EDW = 34;
      const EDH = WALL_HEIGHT * 0.78;
      const wallDists = [
        { id: "north", d: entrance.y },
        { id: "south", d: floorLength - entrance.y },
        { id: "west",  d: entrance.x },
        { id: "east",  d: floorWidth - entrance.x },
      ];
      const nearestWall = wallDists.reduce((a, b) => (a.d < b.d ? a : b)).id;
      const isNS = nearestWall === "north" || nearestWall === "south";
      const edDoorX = isNS ? entrance.x : (nearestWall === "west" ? 0 : floorWidth);
      const edDoorZ = isNS ? (nearestWall === "north" ? 0 : floorLength) : entrance.y;

      const edFrameMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9 });
      const edDoorMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.8 });

      const edFrameGeom = isNS
        ? new THREE.BoxGeometry(EDW + 4, EDH + 2, 7)
        : new THREE.BoxGeometry(7, EDH + 2, EDW + 4);
      const edDoorGeom = isNS
        ? new THREE.BoxGeometry(EDW, EDH, 5)
        : new THREE.BoxGeometry(5, EDH, EDW);

      const edFrame = new THREE.Mesh(edFrameGeom, edFrameMat);
      edFrame.position.set(edDoorX, EDH / 2, edDoorZ);
      scene.add(edFrame);

      const edDoor = new THREE.Mesh(edDoorGeom, edDoorMat);
      edDoor.position.set(edDoorX, EDH / 2, edDoorZ);
      edDoor.castShadow = true;
      scene.add(edDoor);
    }

    // Animation loop
    function animate() {
      animationRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // Handle resize
    function handleResize() {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        container.removeChild(rendererRef.current.domElement);
      }
      if (sceneRef.current) {
        sceneRef.current.traverse((object) => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(m => m.dispose());
            } else {
              object.material.dispose();
            }
          }
        });
      }
    };
  }, [plan, model3D, roomColors]);

  // Reactively update material colors without rebuilding the scene
  useEffect(() => {
    if (floorMatRef.current) floorMatRef.current.color.set(defaultFloorColor);
    if (wallMatRef.current) wallMatRef.current.color.set(defaultWallColor);
    if (outerWallMatRef.current) outerWallMatRef.current.color.set(defaultWallColor);

    // Update room-specific materials
    Object.keys(roomMatsRef.current).forEach((roomKey) => {
      const roomColors_ = roomColors[roomKey] || { wall: defaultWallColor, floor: defaultFloorColor };
      if (roomMatsRef.current[roomKey]) {
        roomMatsRef.current[roomKey].color.set(roomColors_.wall);
      }
    });
  }, [roomColors, defaultWallColor, defaultFloorColor]);

  return (
    <div
      ref={containerRef}
      className="relative rounded-3xl border border-white/10 bg-slate-950/80 overflow-hidden"
      style={{ width: "100%", height: "100%", minHeight: "400px" }}
    >
      <div className="absolute top-4 left-4 z-10 text-sm text-slate-300 bg-slate-900/80 px-3 py-2 rounded-lg">
        <div className="font-semibold text-white">3D Floor Plan</div>
        <div className="text-slate-400 text-xs mt-1">Drag to rotate • Scroll to zoom</div>
      </div>
    </div>
  );
});

FloorPlan3D.displayName = "FloorPlan3D";

export default FloorPlan3D;

// Builds a wall from (x1,z1) to (x2,z2), splitting it into separate meshes
// around any door that falls along it so the doorway is an empty opening
// rather than a solid box with a door panel overlaid on top.
function createWallWithDoorGaps(scene, x1, z1, x2, z2, height, material, doors, thickness = WALL_THICKNESS) {
  const orientation = z1 === z2 ? "horizontal" : "vertical";
  const segments = splitWallForDoors({ x1, y1: z1, x2, y2: z2 }, doors);
  segments.forEach((seg) => {
    if (orientation === "horizontal") {
      const length = seg.x2 - seg.x1;
      if (length <= 0) return;
      createWall(scene, seg.x1, seg.y1, length, height, material, "horizontal", thickness);
    } else {
      const length = seg.y2 - seg.y1;
      if (length <= 0) return;
      createWall(scene, seg.x1, seg.y1, length, height, material, "vertical", thickness);
    }
  });
}

function createWall(scene, x, z, length, height, material, orientation, thickness = WALL_THICKNESS) {
  let geometry, position;
  
  if (orientation === "horizontal") {
    geometry = new THREE.BoxGeometry(length, height, thickness);
    position = new THREE.Vector3(x + length / 2, height / 2, z);
  } else {
    geometry = new THREE.BoxGeometry(thickness, height, length);
    position = new THREE.Vector3(x, height / 2, z + length / 2);
  }

  const wall = new THREE.Mesh(geometry, material);
  wall.position.copy(position);
  wall.castShadow = true;
  wall.receiveShadow = true;
  scene.add(wall);
}

function createTextSprite(text, options = {}) {
  const { fontSize = 24, textColor = "#ffffff" } = options;
  
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = 256;
  canvas.height = 128;

  context.fillStyle = "transparent";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.font = `bold ${fontSize}px Inter, Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = textColor;
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false
  });

  return new THREE.Sprite(spriteMaterial);
}
