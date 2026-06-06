// import { Routes, Route } from "react-router-dom";
// import { useState, useEffect } from "react";

// import Navbar from "./components/Navbar";
// import Footer from "./components/Footer";
// import AuthModal from "./components/AuthModal";

// import Home from "./sections/Home";
// import Explore from "./sections/Explore";
// import About from "./sections/About";
// import Create from "./pages/Create";

// export default function App() {
//   const [isAuth, setIsAuth] = useState(() => !!localStorage.getItem("ds_token"));
//   const [showLogin, setShowLogin] = useState(false);
//   const [mode, setMode] = useState("login");

//   const handleCreateClick = () => {
//     window.location.href = "/create"; // works but we’ll improve later
//   };

//   return (
//     <div className="relative min-h-screen text-white">
//       <Navbar
//         isAuth={isAuth}
//         setIsAuth={setIsAuth}
//         onOpenAuth={() => {
//           setMode("login");
//           setShowLogin(true);
//         }}
//         onCreate={handleCreateClick}
//       />

//       <Routes>
//         <Route
//           path="/"
//           element={
//             <>
//               <Home onCreate={handleCreateClick} />
//               <Explore />
//               <About />
//             </>
//           }
//         />
//         <Route path="/create" element={<Create />} />
//       </Routes>

//       <Footer />

//       {showLogin && (
//         <AuthModal
//           mode={mode}
//           onClose={() => setShowLogin(false)}
//           onSwitch={(m) => setMode(m)}
//           onLoggedIn={() => {
//             localStorage.setItem("ds_token", "demo_token");
//             setIsAuth(true);
//             setShowLogin(false);
//           }}
//         />
//       )}
//     </div>
//   );
// }


import { Routes, Route, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import AuthModal from "./components/AuthModal";

import Home from "./sections/Home";
import Explore from "./sections/Explore";
import About from "./sections/About";
import Create from "./pages/Create";
import Profile from "./pages/Profile";
import History from "./pages/History";

export default function App() {
  const navigate = useNavigate();

  const [isAuth, setIsAuth] = useState(() => {
    return !!localStorage.getItem("token");
  });

  const [showLogin, setShowLogin] = useState(false);
  const [mode, setMode] = useState("login");

  // 🔑 GOOGLE LOGIN TOKEN HANDLER
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (token) {
      localStorage.setItem("token", token);
      setIsAuth(true);

      // clean URL
      window.history.replaceState({}, document.title, "/");

      // optional: redirect to create or home
      navigate("/");
    }
  }, []);

  const handleCreateClick = () => {
    if (!isAuth) {
      setMode("login");
      setShowLogin(true);
      return;
    }
    navigate("/create");
  };

  return (
    <div className="relative min-h-screen text-white">
      <Navbar
        isAuth={isAuth}
        setIsAuth={setIsAuth}
        onOpenAuth={() => {
          setMode("login");
          setShowLogin(true);
        }}
        onCreate={handleCreateClick}
      />

      <Routes>
        <Route
          path="/"
          element={
            <>
              <Home onCreate={handleCreateClick} />
              <Explore />
              <About />
            </>
          }
        />
        <Route path="/create" element={<Create />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/history" element={<History />} />
      </Routes>

      <Footer />

      {showLogin && (
        <AuthModal
          mode={mode}
          onClose={() => setShowLogin(false)}
          onSwitch={(m) => setMode(m)}
          onLoggedIn={(token) => {
            localStorage.setItem("token", token);
            setIsAuth(true);
            setShowLogin(false);
          }}
        />
      )}
    </div>
  );
}
