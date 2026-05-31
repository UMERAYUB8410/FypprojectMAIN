import { Lightbulb, Cpu, Layout } from "lucide-react";

export default function About() {
  return (
    <section id="about" className="relative py-24">
      <div className="container mx-auto px-4">
        <div className="relative rounded-3xl p-10 bg-white/10 border border-white/20 backdrop-blur-xl overflow-hidden shadow-2xl">
          
          {/* 🌧️ Glass + Rain overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="w-full h-full bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.15),transparent_70%)] backdrop-blur-md" />
            <div className="droplet" />
            <div className="droplet delay-1" />
            <div className="droplet delay-2" />
          </div>

          <div className="grid md:grid-cols-2 gap-10 items-center relative z-10">
            
            {/* 🖼️ Left: Image */}
            <div className="flex justify-center md:justify-start">
              <img
                src="/about-room.jpg"
                alt="DreamSketch AI room visualization"
                className="w-full max-w-md rounded-3xl border border-white/30 shadow-2xl object-cover"
              />
            </div>

            {/* 🧠 Right: Text Content */}
            <div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] mb-6 text-center md:text-left">
                Design Made Simple
              </h2>

              <p className="text-lg leading-relaxed text-white/90 mb-6">
                DreamSketch AI revolutionizes home layout design by making it accessible to everyone.
                No technical expertise required—just describe your vision, and our AI brings it to life
                with professional-quality layouts and visualizations.
              </p>

              <p className="text-lg leading-relaxed text-white/90 mb-8">
                Whether you're a homeowner planning renovations, an architect exploring concepts,
                or simply dreaming about your future home, DreamSketch AI turns your words into reality.
              </p>

              {/* 🌟 Feature Cards */}
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { icon: <Lightbulb className="mx-auto mb-3 text-cyan-300" size={32} />, title: "Simple Input", desc: "Describe your dream home naturally." },
                  { icon: <Cpu className="mx-auto mb-3 text-blue-300" size={32} />, title: "Smart AI", desc: "Understands your vision intelligently." },
                  { icon: <Layout className="mx-auto mb-3 text-purple-300" size={32} />, title: "Instant Layouts", desc: "Get layouts in seconds." },
                ].map((f, i) => (
                  <div
                    key={i}
                    className="relative rounded-2xl bg-white/10 border border-white/20 p-5 text-center 
                               overflow-hidden group
                               hover:bg-white/15 transition-all duration-300 
                               transform hover:scale-105 hover:-translate-y-2 
                               shadow-lg hover:shadow-cyan-400/20"
                  >
                    {/* ✨ Light Reflection Sweep */}
                    <div className="absolute inset-0 before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent before:translate-x-[-100%] group-hover:before:translate-x-[100%] before:skew-x-12 before:transition-transform before:duration-700"></div>

                    {f.icon}
                    <h4 className="font-semibold text-white text-lg relative z-10">{f.title}</h4>
                    <p className="text-sm text-white/70 mt-2 relative z-10">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
