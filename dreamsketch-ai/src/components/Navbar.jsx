// src/components/Navbar.jsx
import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";

export default function Navbar({ isAuth, setIsAuth, onOpenAuth, onCreate }) {
  const [open, setOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // scroll to in-page section or navigate to home then scroll (via state)
  function goToSection(sectionId) {
    if (location.pathname === "/") {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      navigate("/", { state: { scrollTo: sectionId } });
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsAuth(false);
    // optionally collapse avatar/dropdown
    setAvatarOpen(false);
    // redirect to login page or home (choose behaviour)
    navigate("/");
  };

  return (
    <header className="fixed top-0 inset-x-0 z-10">
      <nav className="mx-3 my-3 md:mx-4 md:my-2 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4">
          {/* Logo */}
          <Link to="/" className="text-xl font-bold tracking-wide text-white">
            DreamSketch AI
          </Link>

          {/* Desktop Menu: use buttons to support in-page scroll */}
          <div className="hidden md:flex gap-6 text-white items-center">
            <button onClick={() => goToSection("home")} className="hover:underline">Home</button>
            <button onClick={() => goToSection("explore")} className="hover:underline">Explore</button>
            <button onClick={() => goToSection("about")} className="hover:underline">About</button>
          </div>

          {/* Right: Create + Auth/Avatar */}
          <div className="hidden md:flex items-center gap-3">
            {/* Create button: multi-page behaviour handled in App via onCreate */}
            <button
              onClick={() => onCreate?.()}
              className="px-4 py-2 rounded-lg bg-green-500 text-white hover:opacity-90"
            >
              Create
            </button>

            {/* Auth/Avatar */}
            {isAuth ? (
              <div className="relative">
                <button
                  className="w-9 h-9 rounded-full overflow-hidden border border-white/20"
                  onClick={() => setAvatarOpen((s) => !s)}
                  aria-label="User menu"
                >
                  <img src="/assets/profile.png" alt="avatar" className="w-full h-full object-cover" />
                </button>

                {avatarOpen && (
                  <div className="absolute right-10 mt-2 w-40 bg-white/5 border border-white/20 backdrop-blur-md rounded-lg p-2 z-50">
                    <button
                      onClick={() => {
                        navigate("/profile");
                        setAvatarOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
                    >
                      Profile
                    </button>
                    <button
                      onClick={() => {
                        handleLogout();
                      }}
                      className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-red-400"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => onOpenAuth?.()}
                className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:opacity-90"
              >
                Login
              </button>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden text-white text-2xl"
            onClick={() => setOpen((s) => !s)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
        </div>

        {/* Mobile Menu */}
        {open && (
          <div className="md:hidden px-6 pb-4 flex flex-col gap-3 text-white">
            <button onClick={() => { goToSection("home"); setOpen(false); }}>Home</button>
            <button onClick={() => { goToSection("explore"); setOpen(false); }}>Explore</button>
            <button onClick={() => { goToSection("about"); setOpen(false); }}>About</button>

            <button
              onClick={() => {
                // Create should use multi-page /create behaviour
                setOpen(false);
                onCreate?.();
              }}
              className="px-4 py-2 rounded-lg bg-green-500 text-white"
            >
              Create
            </button>

            {isAuth ? (
              <button
                onClick={() => { handleLogout(); setOpen(false); }}
                className="px-4 py-2 rounded-lg bg-red-500 text-white"
              >
                Logout
              </button>
            ) : (
              <button
                onClick={() => { onOpenAuth?.(); setOpen(false); }}
                className="px-4 py-2 rounded-lg bg-blue-500 text-white"
              >
                Login
              </button>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
