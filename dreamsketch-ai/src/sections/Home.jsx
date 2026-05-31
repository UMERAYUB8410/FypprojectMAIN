// src/sections/Home.jsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import BackgroundVideo from "../components/BackgroundVideo";
import logo from "../assets/logo.png";

export default function Home({ onCreate }) {
  const location = useLocation();

  useEffect(() => {
    const target = location.state?.scrollTo;
    if (target) {
      // clear state so it won't scroll again on back/future navigations
      window.history.replaceState({}, document.title);
      const el = document.getElementById(target);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.state]);

  return (
    <section
      id="home"
      className="relative min-h-screen flex flex-col justify-center items-center text-center z-0"
    >
      <BackgroundVideo />

      <div className="absolute top-20 left-6 z-20">
        <img src={logo} alt="logo" className="w-28 h-28 animate-flip-y" />
      </div>

      <div className="relative z-20 px-4">
        <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]">
          DreamSketch AI
        </h1>
        <p className="mt-5 text-lg text-gray-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
          Lorem ipsum tagline...
        </p>
        <button
          onClick={onCreate}
          className="mt-8 px-8 py-3 bg-green-500 text-white font-semibold rounded-xl shadow-lg hover:bg-green-600 transition-all"
        >
          CREATE DESIGN
        </button>
      </div>
    </section>
  );
}
