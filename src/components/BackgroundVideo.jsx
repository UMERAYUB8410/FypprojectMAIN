import { useState } from "react";

export default function BackgroundVideo() {
  const [videoError, setVideoError] = useState(false);
  const [showVignette, setShowVignette] = useState(true);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden">
      {/* 🎥 Video ya fallback gradient */}
      {!videoError ? (
        <video
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          onError={() => setVideoError(true)}
        >
          <source src="/bg.mp4" type="video/mp4" />
        </video>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-sky-300 via-sky-200 to-green-300" />
      )}

      {/* 🌑 Overlay */}
      {showVignette && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40 pointer-events-none mix-blend-multiply" />
      )}

      {/* 🕹️ Toggle button */}
      <button
        onClick={() => setShowVignette(!showVignette)}
        className="absolute top-4 right-4 bg-white/70 text-black px-3 py-1 rounded shadow-md text-sm z-50"
      >
        {showVignette ? "Hide Overlay" : "Show Overlay"}
      </button>
    </div>
  );
}
