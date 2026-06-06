import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import FloorPlan2D from "../components/FloorPlan2D";
import FloorPlan3D from "../components/FloorPlan3D";
import { Calendar, Trash2, Eye, X } from "lucide-react";

export default function History() {
  const navigate = useNavigate();
  const [floorPlans, setFloorPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [viewMode, setViewMode] = useState("2d");
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }
    fetchHistory();
  }, [navigate]);

  async function fetchHistory() {
    try {
      const res = await api.get("/history?limit=50");
      if (res.data.success) {
        setFloorPlans(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleView(planId) {
    setLoadingDetail(true);
    try {
      const res = await api.get(`/history/${planId}`);
      if (res.data.success) {
        setSelectedPlan(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load floor plan:", err);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleDelete(planId) {
    if (!confirm("Are you sure you want to delete this floor plan?")) return;

    try {
      await api.delete(`/history/${planId}`);
      setFloorPlans(floorPlans.filter(p => p._id !== planId));
      if (selectedPlan?._id === planId) {
        setSelectedPlan(null);
      }
    } catch (err) {
      console.error("Failed to delete floor plan:", err);
      alert("Failed to delete floor plan");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white pt-28 px-6 flex items-center justify-center">
        <div className="text-lg">Loading history...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pt-28 px-6 pb-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Design History</h1>
          <p className="text-slate-400">
            {floorPlans.length} floor plan{floorPlans.length !== 1 ? "s" : ""} saved
          </p>
        </div>

        {floorPlans.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center">
            <div className="text-6xl mb-4">📐</div>
            <h2 className="text-2xl font-semibold mb-2">No designs yet</h2>
            <p className="text-slate-400 mb-6">
              Start creating your first floor plan to see it here
            </p>
            <button
              onClick={() => navigate("/create")}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg transition"
            >
              Create Floor Plan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {floorPlans.map((plan) => (
              <div
                key={plan._id}
                className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition group"
              >
                {/* Preview */}
                <div className="aspect-video bg-slate-900 relative overflow-hidden">
                  {plan.svg ? (
                    <div
                      className="w-full h-full flex items-center justify-center p-4"
                      dangerouslySetInnerHTML={{ __html: plan.svg }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      No preview
                    </div>
                  )}
                  
                  {/* Overlay Actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-3">
                    <button
                      onClick={() => handleView(plan._id)}
                      className="p-3 bg-blue-600 hover:bg-blue-500 rounded-lg transition"
                      title="View"
                    >
                      <Eye size={20} />
                    </button>
                    <button
                      onClick={() => handleDelete(plan._id)}
                      className="p-3 bg-red-600 hover:bg-red-500 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <p className="text-sm text-slate-300 mb-2 line-clamp-2">
                    {plan.prompt}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar size={14} />
                    {new Date(plan.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6 overflow-auto">
          <div className="bg-slate-900 rounded-3xl max-w-7xl w-full max-h-[90vh] overflow-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-slate-900 border-b border-white/10 p-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-2xl font-bold mb-1">Floor Plan Details</h2>
                <p className="text-slate-400 text-sm">{selectedPlan.prompt}</p>
              </div>
              <button
                onClick={() => setSelectedPlan(null)}
                className="p-2 hover:bg-white/10 rounded-lg transition"
              >
                <X size={24} />
              </button>
            </div>

            {/* View Mode Tabs */}
            <div className="p-6 border-b border-white/10">
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode("2d")}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    viewMode === "2d"
                      ? "bg-blue-600 text-white"
                      : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
                >
                  2D View
                </button>
                <button
                  onClick={() => setViewMode("3d")}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    viewMode === "3d"
                      ? "bg-blue-600 text-white"
                      : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
                >
                  3D View
                </button>
                <button
                  onClick={() => setViewMode("both")}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    viewMode === "both"
                      ? "bg-blue-600 text-white"
                      : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
                >
                  Both
                </button>
              </div>
            </div>

            {/* Floor Plan Views */}
            <div className="p-6">
              {loadingDetail ? (
                <div className="text-center py-12">Loading floor plan...</div>
              ) : (
                <div className={`grid gap-6 ${
                  viewMode === "both" ? "lg:grid-cols-2" : "grid-cols-1"
                }`}>
                  {(viewMode === "2d" || viewMode === "both") && (
                    <div>
                      <FloorPlan2D plan={selectedPlan.plan} />
                    </div>
                  )}
                  {(viewMode === "3d" || viewMode === "both") && (
                    <div style={{ minHeight: "500px" }}>
                      <FloorPlan3D plan={selectedPlan.plan} model3D={selectedPlan.model3D} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
