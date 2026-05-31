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
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import FloorPlan2D from "../components/FloorPlan2D";

export default function Create() {
  const navigate = useNavigate();

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [floorPlan, setFloorPlan] = useState(null);
  const [svg, setSvg] = useState(null);
  const [isReflowing, setIsReflowing] = useState(false);
  const token = localStorage.getItem("ds_token");
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

  // 🧠 AI ANALYZE
  async function handleAnalyze() {
    if (!prompt.trim()) {
      setError("Please describe your house first.");
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
      "http://localhost:5000/api/floorplan/generate-2d",
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
    }
    setIsReflowing(false);
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
    <div className="min-h-screen bg-black text-white pt-28 px-6">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">

        {/* 🧠 PROMPT GUIDE */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">🧠 Prompt Guide</h2>
          <ul className="text-sm text-white/80 space-y-2 list-disc pl-4">
            <li>Plot size</li>
            <li>Floors</li>
            <li>Bedrooms & bathrooms</li>
            <li>Kitchen, living area</li>
            <li>Garage, lawn, balcony</li>
          </ul>
        </div>

        {/* ✍️ PROMPT INPUT */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">✍️ Describe Your House</h2>

          <div className="relative">
            <textarea
              className="w-full h-40 bg-black/40 border border-white/20 rounded-lg p-3"
              placeholder="Describe your house..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />

            {/* mic button (bottom-right) */}
            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              {interimTranscript && (
                <div className="text-xs text-white/60 mr-2">{interimTranscript}</div>
              )}

              <button
                onClick={toggleListening}
                title={listening ? "Stop listening" : "Start listening"}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${listening ? "bg-green-500" : "bg-gray-600"}`}
              >
                🎙
              </button>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}

          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="mt-4 w-full bg-green-600 rounded-lg py-2"
          >
            {loading ? "Analyzing..." : "Analyze"}
          </button>

          {/* ✅ Analysis Result */}
          {analysis && (
            <div className="mt-4 text-sm text-green-400">
              ✅ Analysis Complete
              <pre className="mt-2 bg-black/40 p-3 rounded text-xs text-white max-h-48 overflow-auto">
                {JSON.stringify(analysis, null, 2)}
              </pre>

              <button
                onClick={generate2D}
                className="mt-4 px-6 py-2 bg-blue-600 rounded-lg"
              >
                {isReflowing ? "Updating plan..." : "Generate 2D Floor Plan"}
              </button>
              {floorPlan && (
                <p className="text-xs text-white/60 mt-2">
                  Drag a room or the entrance marker to position the layout exactly.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 🏠 2D FLOOR PLAN */}
      {floorPlan && (
        <div className="mt-10">
          <FloorPlan2D plan={floorPlan} onRoomDragEnd={handleRoomDragEnd} onEntranceDragEnd={handleEntranceDragEnd} />
        </div>
      )}
    </div>
  );
}



