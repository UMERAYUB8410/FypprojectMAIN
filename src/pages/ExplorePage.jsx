import { useNavigate } from "react-router-dom";
import exploreDesigns from "../data/exploreDesigns";

export default function ExplorePage() {
  const navigate = useNavigate();

  function handleSelect(design) {
    navigate("/create", { state: { prefillPrompt: design.prompt } });
  }

  return (
    <div className="min-h-screen pt-24 container mx-auto px-4 pb-16">
      <h1 className="text-4xl font-bold title-gradient mb-2">Explore All Designs</h1>
      <p className="opacity-80 mb-8">
        Pick a design to prefill the Create screen with its prompt — then just submit to generate your own 2D floor plan.
      </p>
      <div className="grid gap-6 md:grid-cols-3">
        {exploreDesigns.map((design) => (
          <button
            key={design.id}
            onClick={() => handleSelect(design)}
            className="text-left rounded-2xl overflow-hidden bg-white/10 border border-white/20 backdrop-blur-lg hover:bg-white/20 hover:border-white/40 transition cursor-pointer"
            title="Use this prompt in Create"
          >
            <img src={design.img} alt={design.title} className="w-full h-40 object-cover" />
            <div className="p-4">
              <div className="font-semibold">{design.title}</div>
              <div className="text-xs opacity-60 mt-1">{design.tag}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
