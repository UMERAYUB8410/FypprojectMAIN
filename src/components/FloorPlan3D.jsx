import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";

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

const FloorPlan3D = forwardRef(({ model3D, plan, wallColor = "#94a3b8", floorColor = "#1a1a2e" }, ref) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const animationRef = useRef(null);
  const floorMatRef = useRef(null);
  const wallMatRef = useRef(null);
  const outerWallMatRef = useRef(null);

  // Keep refs in sync so the main effect always reads current colors
  const wallColorRef = useRef(wallColor);
  const floorColorRef = useRef(floorColor);
  wallColorRef.current = wallColor;
  floorColorRef.current = floorColor;

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
      // Room floor
      const roomFloorGeom = new THREE.PlaneGeometry(room.width - 2, room.length - 2);
      const roomFloorMat = new THREE.MeshStandardMaterial({
        color: ROOM_COLORS[room.type] || 0x64748b,
        roughness: 0.9,
        metalness: 0.1,
        transparent: true,
        opacity: 0.4
      });
      const roomFloor = new THREE.Mesh(roomFloorGeom, roomFloorMat);
      roomFloor.rotation.x = -Math.PI / 2;
      roomFloor.position.set(room.x + room.width / 2, 0.2, room.y + room.length / 2);
      roomFloor.receiveShadow = true;
      scene.add(roomFloor);

      // North wall
      createWall(scene, room.x, room.y, room.width, WALL_HEIGHT, wallMaterial, "horizontal");
      // South wall
      createWall(scene, room.x, room.y + room.length, room.width, WALL_HEIGHT, wallMaterial, "horizontal");
      // West wall
      createWall(scene, room.x, room.y, room.length, WALL_HEIGHT, wallMaterial, "vertical");
      // East wall
      createWall(scene, room.x + room.width, room.y, room.length, WALL_HEIGHT, wallMaterial, "vertical");

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

    // Entrance marker
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

      // Entrance label
      const entranceLabel = createTextSprite("Entrance", {
        fontSize: 16,
        textColor: "#fbbf24"
      });
      entranceLabel.position.set(entrance.x, 8, entrance.y);
      entranceLabel.scale.set(40, 20, 1);
      scene.add(entranceLabel);
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
  }, [plan, model3D]);

  // Reactively update material colors without rebuilding the scene
  useEffect(() => {
    if (floorMatRef.current) floorMatRef.current.color.set(floorColor);
    if (wallMatRef.current) wallMatRef.current.color.set(wallColor);
    if (outerWallMatRef.current) outerWallMatRef.current.color.set(wallColor);
  }, [wallColor, floorColor]);

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
