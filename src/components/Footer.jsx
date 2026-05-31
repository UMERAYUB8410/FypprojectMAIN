export default function Footer() {
  return (
    <footer className="bg-black/40 backdrop-blur-lg py-8 mt-12 text-center border-t border-white/20">
      <p className="text-sm opacity-80">© {new Date().getFullYear()} DreamSketch AI</p>
      <p className="text-sm opacity-60">Contact: support@dreamsketch.ai</p>
    </footer>
  );
}
