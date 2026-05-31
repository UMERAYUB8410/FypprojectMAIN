export default function ExplorePage() {
  return (
    <div className="min-h-screen pt-24 container mx-auto px-4">
      <h1 className="text-4xl font-bold title-gradient mb-6">Explore All Designs</h1>
      <p className="opacity-80 mb-8">
        Here all generated designs will appear (from database). For now, this is a placeholder page.
      </p>
      <div className="grid gap-6 md:grid-cols-3">
        {/* Placeholder cards */}
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-lg h-40 flex items-center justify-center"
          >
            Design {i}
          </div>
        ))}
      </div>
    </div>
  );
}
