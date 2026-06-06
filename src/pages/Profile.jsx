import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import { User, Mail, Calendar, LogOut, History } from "lucide-react";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ totalPlans: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }
    fetchUserData();
  }, [navigate]);

  async function fetchUserData() {
    try {
      const [userRes, historyRes] = await Promise.all([
        api.get("/auth/me"),
        api.get("/history?limit=1")
      ]);

      if (userRes.data.success) {
        setUser(userRes.data.user);
      }

      if (historyRes.data.success) {
        setStats({ totalPlans: historyRes.data.total });
      }
    } catch (err) {
      console.error("Failed to fetch user data:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("ds_token");
    navigate("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white pt-28 px-6 flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white pt-28 px-6 flex items-center justify-center">
        <div className="text-lg">User not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pt-28 px-6 pb-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Profile</h1>
          <p className="text-slate-400">Manage your account and view your statistics</p>
        </div>

        {/* Profile Card */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-6">
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-6">
              {/* Avatar */}
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl font-bold">
                {user.name?.charAt(0).toUpperCase() || "U"}
              </div>

              {/* User Info */}
              <div>
                <h2 className="text-2xl font-bold mb-2">{user.name}</h2>
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <Mail size={16} />
                  <span>{user.email}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar size={16} />
                  <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg transition"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-white/10">
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-3xl font-bold text-blue-400 mb-1">{stats.totalPlans}</div>
              <div className="text-sm text-slate-400">Floor Plans Created</div>
            </div>

            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-3xl font-bold text-green-400 mb-1">
                {user.verified ? "✓" : "✗"}
              </div>
              <div className="text-sm text-slate-400">Account Status</div>
            </div>

            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-3xl font-bold text-purple-400 mb-1">
                {user.googleId ? "Google" : "Email"}
              </div>
              <div className="text-sm text-slate-400">Login Method</div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => navigate("/history")}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition text-left group"
          >
            <div className="flex items-center gap-4 mb-3">
              <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center group-hover:bg-blue-600/30 transition">
                <History size={24} className="text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold">View History</h3>
            </div>
            <p className="text-slate-400 text-sm">
              Browse all your saved floor plans and designs
            </p>
          </button>

          <button
            onClick={() => navigate("/create")}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition text-left group"
          >
            <div className="flex items-center gap-4 mb-3">
              <div className="w-12 h-12 rounded-full bg-green-600/20 flex items-center justify-center group-hover:bg-green-600/30 transition">
                <User size={24} className="text-green-400" />
              </div>
              <h3 className="text-xl font-semibold">Create New Design</h3>
            </div>
            <p className="text-slate-400 text-sm">
              Start designing your dream house floor plan
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
