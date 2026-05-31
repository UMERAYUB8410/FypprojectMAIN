import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Explore() {
  const [samples, setSamples] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const dummy = [
      { id: 1, title: "Modern Villa", img: "https://picsum.photos/400/250?random=1" },
      { id: 2, title: "Luxury Apartment", img: "https://picsum.photos/400/250?random=2" },
      { id: 3, title: "Cozy Cottage", img: "https://picsum.photos/400/250?random=3" },
    ];
    setSamples(dummy);
  }, []);

  return (
    <section id="explore" className="relative py-24">
      <div className="container mx-auto px-4">
        <div className="relative rounded-3xl p-10 bg-white/10 border border-white/20 backdrop-blur-xl overflow-hidden shadow-2xl">
          
          {/* 🌧️ Glass + Rain overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="w-full h-full bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.15),transparent_70%)] backdrop-blur-md" />
            <div className="droplet" />
            <div className="droplet delay-1" />
            <div className="droplet delay-2" />
          </div>

          {/* Heading */}
          <h2 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] mb-8 text-center relative z-10">
            Explore Designs
          </h2>

          {/* 3 sample previews */}
          <div className="grid gap-6 md:grid-cols-3 relative z-10">
            {samples.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl overflow-hidden bg-white/5 border border-white/20 hover:bg-white/10 transition"
              >
                <img src={s.img} alt={s.title} className="w-full h-48 object-cover" />
                <div className="p-4 text-center text-white drop-shadow">{s.title}</div>
              </div>
            ))}
          </div>

          {/* More button */}
          <div className="mt-8 text-center relative z-10">
            <button
              onClick={() => navigate("/explore")}
              className="inline-block px-6 py-3 rounded-xl bg-white/10 border border-white/20 hover:bg-white/20 backdrop-blur-lg text-white"
            >
              More →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
