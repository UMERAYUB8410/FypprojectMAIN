import { useState } from "react";

export default function AuthModal({ mode = "login", onClose, onSwitch, onLoggedIn }) {
  const [cur, setCur] = useState(mode);
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1=email, 2=otp, 3=new password
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [loading, setLoading] = useState(false);

  const API_URL = "http://localhost:5000/api/auth"; // 🔧 change if needed

  function switchTo(m) {
    setCur(m);
    setForgotStep(1);
    onSwitch?.(m);
  }

  // 🧠 LOGIN
  async function handleLogin(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { email, password } = Object.fromEntries(fd.entries());
    if (!email || !password) return alert("Please fill all fields");

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || "Login failed");
      
      // ✅ BUG 1 FIX: Use standardized response
      const token = data.token;
      localStorage.setItem("token", token);
      
      alert("✅ Logged in successfully");
      onLoggedIn?.(data);
      onClose();
    } catch (err) {
      alert("❌ " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // 🧠 REGISTER
  async function handleRegister(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { username, email, password, confirm } = Object.fromEntries(fd.entries());
    if (!username || !email || !password) return alert("Please fill all fields");
    if (password !== confirm) return alert("Passwords do not match");

    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || "Registration failed");
      alert("✅ Registered! You can now log in.");
      switchTo("login");
    } catch (err) {
      alert("❌ " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // 🧠 FORGOT PASSWORD (3-step flow)
  async function handleForgot(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (forgotStep === 1) {
        // Send OTP
        const res = await fetch(`${API_URL}/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.msg);
        alert("✅ OTP sent to your email!");
        setForgotStep(2);
      } else if (forgotStep === 2) {
        // Proceed to set new password
        setForgotStep(3);
      } else if (forgotStep === 3) {
        // Reset password
        const res = await fetch(`${API_URL}/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, otp, newPassword: newPwd }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.msg);
        alert("✅ Password reset successful!");
        switchTo("login");
      }
    } catch (err) {
      alert("❌ " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-3xl p-8 bg-white/10 border border-white/20 backdrop-blur-2xl shadow-[0_0_30px_rgba(255,255,255,0.1)] overflow-hidden">

          {/* 💧 Rain & fog overlay */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="rain-overlay" />
            <div className="fog-layer" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-6 relative z-10">
            <h3 className="text-3xl font-extrabold bg-gradient-to-r from-sky-300 via-blue-400 to-teal-300 text-transparent bg-clip-text drop-shadow-lg">
              {cur === "login" ? "Login" : cur === "register" ? "Register" : "Forgot Password"}
            </h3>
            <button
              onClick={onClose}
              className="px-3 py-1 rounded-lg hover:bg-white/15 border border-white/20 text-white/90"
            >
              ✕
            </button>
          </div>

          {/* Form */}
          <div className="relative z-10">
            {/* 🟢 LOGIN */}
            {cur === "login" && (
              <form onSubmit={handleLogin} className="space-y-5">
                <input
                  name="email"
                  type="email"
                  placeholder="Email"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:border-white/40"
                />
                <div className="relative">
                  <input
                    name="password"
                    type={showPwd ? "text" : "password"}
                    placeholder="Password"
                    className="w-full px-4 py-3 pr-10 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:border-white/40"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 text-xl text-white/70"
                    onClick={() => setShowPwd((s) => !s)}
                  >
                    {showPwd ? "🙈" : "👁️"}
                  </button>
                </div>

                {/* 🔹 Forgot Password link */}
                <div className="text-sm text-right text-white/70">
                  <button
                    type="button"
                    onClick={() => switchTo("forgotPassword")}
                    className="underline hover:text-white"
                  >
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 text-white font-semibold hover:opacity-90 transition-all"
                >
                  {loading ? "Logging in..." : "Login"}
                </button>

                <div className="text-sm text-white/70 text-center">
                  New here?{" "}
                  <button
                    type="button"
                    onClick={() => switchTo("register")}
                    className="underline hover:text-white"
                  >
                    Register
                  </button>
                </div>
              </form>
            )}

            {/* 🟣 REGISTER */}
            {cur === "register" && (
              <form onSubmit={handleRegister} className="space-y-5">
                <button
                  type="button"
                  onClick={() => window.open("http://localhost:5000/api/auth/google", "_self")}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-red-400 to-pink-500 text-white font-semibold hover:opacity-90 transition-all">
                  Register with Google
                </button>

                <div className="relative text-center text-xs text-white/60 select-none">or</div>
                <input
                  name="username"
                  placeholder="Username"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:border-white/40"
                />
                <input
                  name="email"
                  type="email"
                  placeholder="Email"
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:border-white/40"
                />
                <div className="relative">
                  <input
                    name="password"
                    type={showPwd ? "text" : "password"}
                    placeholder="Password"
                    className="w-full px-4 py-3 pr-10 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:border-white/40"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 text-xl text-white/70"
                    onClick={() => setShowPwd((s) => !s)}
                  >
                    {showPwd ? "🙈" : "👁️"}
                  </button>
                </div>
                <div className="relative">
                  <input
                    name="confirm"
                    type={showPwd2 ? "text" : "password"}
                    placeholder="Confirm Password"
                    className="w-full px-4 py-3 pr-10 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:border-white/40"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 text-xl text-white/70"
                    onClick={() => setShowPwd2((s) => !s)}
                  >
                    {showPwd2 ? "🙈" : "👁️"}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 text-white font-semibold hover:opacity-90 transition-all"
                >
                  {loading ? "Registering..." : "Register"}
                </button>
                <div className="text-sm text-white/70 text-center">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchTo("login")}
                    className="underline hover:text-white"
                  >
                    Login
                  </button>
                </div>
              </form>
            )}

            {/* 🟡 FORGOT PASSWORD */}
            {cur === "forgotPassword" && (
              <form onSubmit={handleForgot} className="space-y-5">
                {forgotStep === 1 && (
                  <>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:border-white/40"
                    />
                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 text-white font-semibold hover:opacity-90 transition-all"
                    >
                      Send OTP
                    </button>
                  </>
                )}
                {forgotStep === 2 && (
                  <>
                    <input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="Enter OTP"
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:border-white/40"
                    />
                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-green-400 to-teal-500 text-white font-semibold hover:opacity-90 transition-all"
                    >
                      Verify OTP
                    </button>
                  </>
                )}
                {forgotStep === 3 && (
                  <>
                    <input
                      type="password"
                      value={newPwd}
                      onChange={(e) => setNewPwd(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:border-white/40"
                    />
                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-green-500 text-white font-semibold hover:opacity-90 transition-all"
                    >
                      Reset Password
                    </button>
                  </>
                )}
                <div className="text-sm text-center text-white/70">
                  <button
                    type="button"
                    onClick={() => switchTo("login")}
                    className="underline hover:text-white"
                  >
                    Back to Login
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
