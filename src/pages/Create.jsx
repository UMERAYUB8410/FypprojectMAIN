// import { useEffect, useState } from "react";
// import api from "../utils/api";
// import { useNavigate } from "react-router-dom";

// export default function Create() {
//   const navigate = useNavigate();

//   const [prompt, setPrompt] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [result, setResult] = useState(null);
//   const [error, setError] = useState("");

//   // 🔐 Protect page
//   useEffect(() => {
//     const token = localStorage.getItem("token");
//     if (!token) {
//       navigate("/");
//     }
//   }, []);

//   async function handleAnalyze() {
//     if (!prompt.trim()) {
//       setError("Please describe your house first.");
//       return;
//     }

//     setError("");
//     setLoading(true);
//     setResult(null);

//     try {
//       const res = await api.post("/ai/analyze", {
//         prompt,
//       });

//       setResult(res.data.data);
//     } catch (err) {
//       setError(
//         err?.response?.data?.message || "AI analysis failed. Try again."
//       );
//     } finally {
//       setLoading(false);
//     }
//   }

//   return (
//     <div className="min-h-screen bg-black text-white pt-28 px-6">
//       <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
        
//         {/* 🧠 PROMPT GUIDE */}
//         <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
//           <h2 className="text-xl font-semibold mb-4">🧠 Prompt Guide</h2>

//           <ul className="text-sm text-white/80 space-y-2 list-disc pl-4">
//             <li>Plot size (e.g. 10 marla, 1 kanal)</li>
//             <li>Number of floors</li>
//             <li>Rooms required (beds, baths, kitchen)</li>
//             <li>Style (modern, luxury, minimal)</li>
//             <li>Special needs (garage, lawn, balcony)</li>
//           </ul>

//           <p className="text-xs text-white/50 mt-4">
//             Example: <br />
//             “10 marla modern house, double story, 4 bedrooms with attached
//             baths, open kitchen, car porch, small lawn.”
//           </p>
//         </div>

//         {/* ✍️ PROMPT INPUT */}
//         <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
//           <h2 className="text-xl font-semibold mb-4">✍️ Describe Your House</h2>

//           <textarea
//             className="w-full h-40 bg-black/40 border border-white/20 rounded-lg p-3 text-sm"
//             placeholder="Write your dream house description here..."
//             value={prompt}
//             onChange={(e) => setPrompt(e.target.value)}
//           />

//           {error && (
//             <p className="text-red-400 text-sm mt-2">{error}</p>
//           )}

//           <button
//             onClick={handleAnalyze}
//             disabled={loading}
//             className="mt-4 w-full bg-green-600 hover:bg-green-500 transition rounded-lg py-2 disabled:opacity-50"
//           >
//             {loading ? "Analyzing with AI..." : "Analyze & Continue"}
//           </button>

//           {/* ✅ RESULT */}
//           {result && (
//             <div className="mt-4 text-sm text-green-400">
//               ✅ Requirements analyzed successfully.  
//               <br />
//               Ready to generate 2D floor plan.
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

// 





import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../utils/api";
import FloorPlan2D from "../components/FloorPlan2D";
import FloorPlan3D from "../components/FloorPlan3D";

const WALL_PRESETS = ["#94a3b8", "#f8fafc", "#fbbf24", "#22c55e", "#3b82f6", "#ec4899", "#a78bfa", "#78716c"];
const FLOOR_PRESETS = ["#1a1a2e", "#0f172a", "#1c1917", "#14532d", "#312e81", "#f5f5f4", "#e5e7eb", "#fef3c7"];

const PROMPT_MIN_WORDS = 10;

function validatePrompt(text) {
  const trimmed = text.trim();
  if (!trimmed) return "Describe your house to get started.";
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < PROMPT_MIN_WORDS) {
    return `Too short (${words.length}/${PROMPT_MIN_WORDS} words). Include plot size, floors, bedrooms, and style — e.g. "5 marla double story house with 3 bedrooms, 2 baths, open kitchen and lawn."`;
  }
  return null;
}

export default function Create() {
  const navigate = useNavigate();
  const location = useLocation();

  const [prompt, setPrompt] = useState(location.state?.prefillPrompt || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [floorPlan, setFloorPlan] = useState(null);
  const [svg, setSvg] = useState(null);
  const [model3D, setModel3D] = useState(null);
  const [isReflowing, setIsReflowing] = useState(false);
  const [viewMode, setViewMode] = useState("both"); // "2d", "3d", "both"
  const floorPlan2DRef = useRef(null);
  const floorPlan3DRef = useRef(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const token = localStorage.getItem("ds_token");
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomColors, setRoomColors] = useState({});
  // --- voice capture state ---
  const [listening, setListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef(null);
  const inactivityTimerRef = useRef(null);
  const lastResultTimeRef = useRef(0);


  // 🔐 Protect page
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/");
  }, [navigate]);

  // Clear prefill state so refresh/back doesn't keep re-applying it
  useEffect(() => {
    if (location.state?.prefillPrompt) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, []);

  // 🧠 AI ANALYZE
  async function handleAnalyze() {
    const validationError = validatePrompt(prompt);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setLoading(true);
    setAnalysis(null);
    setSvg(null);

    try {
      const res = await api.post("/ai/analyze", { prompt });
      const houseJSON = res.data.data;

      setAnalysis(houseJSON);
      localStorage.setItem("houseJSON", JSON.stringify(houseJSON));
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "❌ Login required or AI service error."
      );
    } finally {
      setLoading(false);
    }
  }

  // --- Simple Web Speech API helpers for in-place transcription ---
  function ensureRecognition() {
    if (recognitionRef.current) return recognitionRef.current;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false; // stop automatically after pause

    rec.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const res = event.results[i];
        if (res.isFinal) final += res[0].transcript;
        else interim += res[0].transcript;
      }

      // update timestamps and reset inactivity timer
      lastResultTimeRef.current = Date.now();
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        // no new results for 2s -> treat as inactivity
        stopListeningDueToInactivity();
      }, 2000);

      if (final) {
        setPrompt((p) => (p ? p + " " + final : final));
        setInterimTranscript("");
      } else {
        setInterimTranscript(interim);
      }
    };

    rec.onend = () => {
      setListening(false);
      // leave interim as-is; final text already appended when available
    };

    rec.onerror = (e) => {
      console.warn("Speech recognition error", e);
      setListening(false);
    };

    recognitionRef.current = rec;
    return rec;
  }

  function commitInterimAsFinal() {
    if (interimTranscript) {
      setPrompt((p) => (p ? p + " " + interimTranscript : interimTranscript));
      setInterimTranscript("");
    }
  }

  function stopListeningDueToInactivity() {
    // stop recognition and commit any interim text
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch (e) {
        console.warn(e);
      }
    }
    setListening(false);
    commitInterimAsFinal();
  }

  function startListening() {
    const rec = ensureRecognition();
    if (!rec) {
      alert("Speech recognition not supported in this browser. Use Chrome/Edge on desktop or supported mobile browsers.");
      return;
    }
    try {
      rec.start();
      setListening(true);
      setInterimTranscript("");
      // clear any previous inactivity timer
      clearTimeout(inactivityTimerRef.current);
      lastResultTimeRef.current = Date.now();
      inactivityTimerRef.current = null;
    } catch (e) {
      console.warn(e);
    }
  }

  function stopListening() {
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.stop();
    } catch (e) {
      console.warn(e);
    }
    setListening(false);
    // clear inactivity timer when user stops manually
    clearTimeout(inactivityTimerRef.current);
  }

  function toggleListening() {
    if (listening) stopListening();
    else startListening();
  }

  // cleanup on unmount: stop recognition and clear timers
  useEffect(() => {
    return () => {
      try {
        clearTimeout(inactivityTimerRef.current);
        if (recognitionRef.current) recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    };
  }, []);

  // Initialize room colors when floor plan is generated
  useEffect(() => {
    if (floorPlan?.floors?.[0]?.rooms) {
      initializeRoomColors();
      setSelectedRoom(floorPlan.floors[0].rooms[0]?.roomKey || null);
    }
  }, [floorPlan]);

  // Close download menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (showDownloadMenu && !event.target.closest('.download-menu-container')) {
        setShowDownloadMenu(false);
      }
    }
    
    if (showDownloadMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDownloadMenu]);

  async function regenerateFloorPlan(updatedRoomPositions = {}) {
    if (!analysis) return;

    const roomPositions = {
      ...(analysis.roomPositions || {}),
      ...updatedRoomPositions
    };

    const nextAnalysis = {
      ...analysis,
      roomPositions
    };

    setAnalysis(nextAnalysis);
    setIsReflowing(true);

    const res = await fetch(
      "http://localhost:5000/api/floorplan/generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis: nextAnalysis }),
      }
    );

    const data = await res.json();
    if (data.success) {
      setFloorPlan(data.plan);
      setSvg(data.svg);
      setModel3D(data.model3D);
      
      // Save to history
      await saveToHistory(nextAnalysis, data.svg, data.plan, data.model3D);
    }
    setIsReflowing(false);
  }

  async function saveToHistory(analysis, svg, plan, model3D) {
    try {
      await api.post("/history/save", {
        prompt,
        analysis,
        svg,
        plan,
        model3D
      });
    } catch (err) {
      console.error("Failed to save to history:", err);
    }
  }

  function initializeRoomColors() {
    if (!floorPlan?.floors?.[0]?.rooms) return;
    const colors = {};
    floorPlan.floors[0].rooms.forEach((room) => {
      colors[room.roomKey] = {
        wall: WALL_PRESETS[0],
        floor: FLOOR_PRESETS[0]
      };
    });
    setRoomColors(colors);
  }

  function updateRoomColor(roomKey, type, color) {
    setRoomColors((prev) => ({
      ...prev,
      [roomKey]: {
        ...prev[roomKey],
        [type]: color
      }
    }));
  }

  function generate2D() {
    return regenerateFloorPlan();
  }

  function handleRoomDragEnd({ roomKey, x, y }) {
    if (!analysis) return;

    const sanitizedX = Math.max(0, x);
    const sanitizedY = Math.max(0, y);
    const updatedRoomPositions = {
      ...(analysis.roomPositions || {}),
      [roomKey]: { x: sanitizedX, y: sanitizedY }
    };

    const nextAnalysis = {
      ...analysis,
      roomPositions: updatedRoomPositions
    };

    setAnalysis(nextAnalysis);
    setFloorPlan((prev) => {
      if (!prev) return prev;
      const updatedFloors = prev.floors.map((floor) => {
        const updatedRooms = floor.rooms.map((room) =>
          room.roomKey === roomKey ? { ...room, x: sanitizedX, y: sanitizedY } : room
        );
        return { ...floor, rooms: updatedRooms };
      });
      return { ...prev, floors: updatedFloors };
    });
  }

  function handleEntranceDragEnd({ x, y }) {
    if (!analysis) return;

    const nextAnalysis = {
      ...analysis,
      entrancePosition: { x: Math.max(0, x), y: Math.max(0, y) }
    };

    setAnalysis(nextAnalysis);
    setFloorPlan((prev) => {
      if (!prev) return prev;
      const updatedFloors = prev.floors.map((floor) => ({
        ...floor,
        entrance: { ...floor.entrance, x, y }
      }));
      return { ...prev, floors: updatedFloors };
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-slate-900 text-white pt-24 px-6">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto mb-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
            Design Your Dream Home
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Describe your vision and watch AI generate stunning 2D and 3D floor plans instantly
          </p>
        </div>

        {/* Main Input Card */}
        <div className="relative group mb-8">
          {/* Gradient glow background */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition duration-500" />

          <div className="relative bg-gradient-to-br from-slate-900/80 to-slate-950/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 hover:border-slate-600/80 transition">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-8 bg-gradient-to-b from-blue-400 to-purple-500 rounded-full" />
              <label className="text-sm font-semibold text-slate-300 uppercase tracking-widest">Describe Your Vision</label>
            </div>

            <div className="relative">
              <textarea
                className="w-full h-44 bg-slate-950/50 border border-slate-700/50 rounded-xl p-5 text-base text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 resize-none transition"
                placeholder="E.g., 5 marla modern house, double story, 3 bedrooms with attached baths, open kitchen, drawing room, dining area, car porch and lawn..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />

              {/* Mic button */}
              <div className="absolute right-4 bottom-4 flex items-center gap-2">
                {interimTranscript && (
                  <div className="text-xs text-slate-400 mr-2 px-3 py-1.5 bg-slate-800/50 rounded-lg truncate max-w-[200px]">
                    {interimTranscript}
                  </div>
                )}

                <button
                  onClick={toggleListening}
                  title={listening ? "Stop listening" : "Start listening"}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-all ${
                    listening
                      ? "bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-500/50"
                      : "bg-slate-800 hover:bg-slate-700"
                  }`}
                >
                  🎙️
                </button>
              </div>
            </div>

            {/* Word count indicator */}
            {(() => {
              const wc = prompt.trim() ? prompt.trim().split(/\s+/).filter(Boolean).length : 0;
              const pct = Math.min(wc / PROMPT_MIN_WORDS, 1);
              const color = wc === 0 ? "bg-slate-700" : wc < PROMPT_MIN_WORDS ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-to-r from-green-500 to-emerald-500";
              const label = wc === 0 ? "Start typing…" : wc < PROMPT_MIN_WORDS ? `${wc} / ${PROMPT_MIN_WORDS} words` : `${wc} words ✓`;
              const labelColor = wc === 0 ? "text-slate-500" : wc < PROMPT_MIN_WORDS ? "text-amber-300" : "text-green-300";
              return (
                <div className="mt-4">
                  <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${pct * 100}%` }} />
                  </div>
                  <p className={`text-xs mt-2 text-right font-medium ${labelColor}`}>{label}</p>
                </div>
              );
            })()}

            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="mt-6 w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-blue-500/20"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block animate-spin">⚙️</span>
                  Analyzing with AI...
                </span>
              ) : (
                "Generate Floor Plans"
              )}
            </button>
          </div>
        </div>

        {/* Quick Tips */}
        <div className="grid md:grid-cols-5 gap-3 mb-6">
          {[
            { icon: "📐", label: "Plot size" },
            { icon: "🏢", label: "Floors" },
            { icon: "🛏️", label: "Bedrooms" },
            { icon: "🍳", label: "Kitchen" },
            { icon: "🏠", label: "Special rooms" }
          ].map((tip, idx) => (
            <div key={idx} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 text-center hover:bg-slate-800/60 transition">
              <div className="text-xl mb-1">{tip.icon}</div>
              <p className="text-xs text-slate-400 font-medium">{tip.label}</p>
            </div>
          ))}
        </div>

        {/* Analysis Result */}
        {analysis && (
          <div className="bg-gradient-to-br from-emerald-950/50 to-slate-950/50 border border-emerald-700/50 rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="text-2xl">✅</div>
              <h3 className="text-xl font-semibold text-emerald-300">Analysis Complete</h3>
            </div>

            <details className="mb-4">
              <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-300 transition">
                View Analysis Data
              </summary>
              <pre className="mt-3 bg-black/40 p-4 rounded-lg text-xs text-slate-300 max-h-48 overflow-auto border border-slate-700/30">
                {JSON.stringify(analysis, null, 2)}
              </pre>
            </details>

            <button
              onClick={generate2D}
              className="w-full md:w-auto bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold py-2.5 px-6 rounded-lg transition-all duration-200 shadow-lg hover:shadow-cyan-500/20"
            >
              {isReflowing ? "Updating plan..." : "Generate 2D Floor Plan"}
            </button>
            {floorPlan && (
              <p className="text-xs text-slate-400 mt-3">
                💡 Pro tip: Drag rooms and the entrance marker to reposition them exactly as you like.
              </p>
            )}
          </div>
        )}
      </div>

      {/* 🏠 FLOOR PLANS */}
      {floorPlan && (
        <div className="mt-16 max-w-7xl mx-auto">
          {/* View Mode Tabs & Download */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8 px-6 py-4 bg-slate-800/30 border border-slate-700/50 rounded-2xl">
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("2d")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  viewMode === "2d"
                    ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20"
                    : "bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                📐 2D Only
              </button>
              <button
                onClick={() => setViewMode("both")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  viewMode === "both"
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20"
                    : "bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                🎨 Both
              </button>
              <button
                onClick={() => setViewMode("3d")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  viewMode === "3d"
                    ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
                    : "bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                🎯 3D Only
              </button>
            </div>

            {/* Download Button */}
            <div className="relative download-menu-container">
              <button
                onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg font-medium transition-all flex items-center gap-2 shadow-lg hover:shadow-emerald-500/20"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download
              </button>

              {showDownloadMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl z-20 overflow-hidden backdrop-blur-xl">
                  <div className="p-3">
                    <div className="text-xs text-slate-400 px-3 py-2 font-bold uppercase tracking-widest">2D Formats</div>
                    <button
                      onClick={() => {
                        floorPlan2DRef.current?.downloadSVG();
                        setShowDownloadMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-blue-600/30 hover:text-white rounded transition"
                    >
                      📄 Download SVG
                    </button>
                    <button
                      onClick={() => {
                        floorPlan2DRef.current?.downloadPNG();
                        setShowDownloadMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-blue-600/30 hover:text-white rounded transition"
                    >
                      🖼️ Download PNG
                    </button>
                    <div className="border-t border-slate-700 my-2"></div>
                    <div className="text-xs text-slate-400 px-3 py-2 font-bold uppercase tracking-widest">3D Formats</div>
                    <button
                      onClick={() => {
                        floorPlan3DRef.current?.downloadGLTF();
                        setShowDownloadMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-cyan-600/30 hover:text-white rounded transition"
                    >
                      🎨 Download GLTF
                    </button>
                    <button
                      onClick={() => {
                        floorPlan3DRef.current?.downloadGLB();
                        setShowDownloadMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-cyan-600/30 hover:text-white rounded transition"
                    >
                      📦 Download GLB
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Color Palette */}
          {floorPlan && (
            <div className="flex flex-col gap-6 mb-8 px-8 py-6 bg-slate-800/30 border border-slate-700/50 rounded-2xl max-w-4xl mx-auto">
              {/* Room Selection */}
              <div className="flex flex-col gap-3">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Select Room to Customize</span>
                <div className="flex flex-wrap gap-2">
                  {floorPlan.floors[0]?.rooms?.map((room) => (
                    <button
                      key={room.roomKey}
                      onClick={() => setSelectedRoom(room.roomKey)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all text-sm ${
                        selectedRoom === room.roomKey
                          ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20"
                          : "bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white"
                      }`}
                    >
                      {room.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Per-Room Color Picker */}
              {selectedRoom && roomColors[selectedRoom] && (
                <div className="flex flex-wrap justify-center gap-8">
                  {[
                    { label: "Wall Color", type: "wall", presets: WALL_PRESETS, color: roomColors[selectedRoom].wall },
                    { label: "Floor Color", type: "floor", presets: FLOOR_PRESETS, color: roomColors[selectedRoom].floor },
                  ].map(({ label, type, presets, color }) => (
                    <div key={label} className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {presets.map((preset) => (
                          <button
                            key={preset}
                            onClick={() => updateRoomColor(selectedRoom, type, preset)}
                            title={preset}
                            className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                            style={{
                              background: preset,
                              boxShadow: color === preset ? `0 0 0 2px #60a5fa` : "0 0 0 1px rgba(255,255,255,0.15)",
                            }}
                          />
                        ))}
                        <label
                          className="w-7 h-7 rounded-full border-2 border-dashed border-white/30 hover:border-white/60 transition flex items-center justify-center text-white/50 text-sm cursor-pointer"
                          title="Custom color"
                        >
                          +
                          <input
                            type="color"
                            value={color}
                            onChange={(e) => updateRoomColor(selectedRoom, type, e.target.value)}
                            className="sr-only"
                          />
                        </label>
                        <span className="text-xs font-mono text-slate-400">{color}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Floor Plan Views */}
          <div className={`grid gap-6 ${
            viewMode === "both" ? "lg:grid-cols-2" : "grid-cols-1 max-w-4xl mx-auto"
          }`}>
            {/* 2D View */}
            {(viewMode === "2d" || viewMode === "both") && (
              <div
                className={viewMode === "both" ? "" : "mx-auto w-full"}
                style={{ height: "620px" }}
              >
                <FloorPlan2D
                  ref={floorPlan2DRef}
                  plan={floorPlan}
                  onRoomDragEnd={handleRoomDragEnd}
                  onEntranceDragEnd={handleEntranceDragEnd}
                  roomColors={roomColors}
                />
              </div>
            )}

            {/* 3D View */}
            {(viewMode === "3d" || viewMode === "both") && (
              <div
                className={viewMode === "both" ? "" : "mx-auto w-full"}
                style={{ height: "620px" }}
              >
                <FloorPlan3D
                  ref={floorPlan3DRef}
                  plan={floorPlan}
                  model3D={model3D}
                  roomColors={roomColors}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}



