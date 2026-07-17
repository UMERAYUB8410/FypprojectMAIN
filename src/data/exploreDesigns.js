// Curated sample designs shown in the Explore sections.
// Clicking a card sends `prompt` to /create so the textarea is prefilled.
// Prompts follow a fixed, parser-friendly format:
// "{size} square yard {single/double}-floor house with {n} bedrooms,
//  {n} bathroom, {n} kitchen, {n} living room, {n} garage, {n} dining room {style} style"
const exploreDesigns = [
  {
    id: 1,
    title: "Modern 120 Sq Yd House",
    tag: "120 Sq Yd • Modern",
    img: "https://picsum.photos/seed/dreamsketch-1/400/250",
    prompt:
      "120 square yard single-floor house with 2 bedrooms, 1 bathroom, 1 kitchen, 1 living room, 1 garage, 1 dining room modern style"
  },
  {
    id: 2,
    title: "Minimalist 150 Sq Yd House",
    tag: "150 Sq Yd • Minimalist",
    img: "https://picsum.photos/seed/dreamsketch-2/400/250",
    prompt:
      "150 square yard single-floor house with 3 bedrooms, 2 bathroom, 1 kitchen, 1 living room, 1 garage, 1 dining room minimalist style"
  },
  {
    id: 3,
    title: "Traditional 200 Sq Yd Home",
    tag: "200 Sq Yd • Traditional",
    img: "https://picsum.photos/seed/dreamsketch-3/400/250",
    prompt:
      "200 square yard double-floor house with 3 bedrooms, 2 bathroom, 1 kitchen, 1 living room, 1 garage, 1 dining room traditional style"
  },
  {
    id: 4,
    title: "Modern 250 Sq Yd Home",
    tag: "250 Sq Yd • Modern",
    img: "https://picsum.photos/seed/dreamsketch-4/400/250",
    prompt:
      "250 square yard double-floor house with 4 bedrooms, 3 bathroom, 1 kitchen, 1 living room, 1 garage, 1 dining room modern style"
  },
  {
    id: 5,
    title: "Modern 300 Sq Yd Villa",
    tag: "300 Sq Yd • Modern",
    img: "https://picsum.photos/seed/dreamsketch-5/400/250",
    prompt:
      "300 square yard double-floor house with 5 bedrooms, 4 bathroom, 1 kitchen, 1 living room, 2 garage, 1 dining room modern style"
  },
  {
    id: 6,
    title: "Traditional 500 Sq Yd Villa",
    tag: "500 Sq Yd • Traditional",
    img: "https://picsum.photos/seed/dreamsketch-6/400/250",
    prompt:
      "500 square yard double-floor house with 6 bedrooms, 5 bathroom, 1 kitchen, 1 living room, 2 garage, 1 dining room traditional style"
  }
];

export default exploreDesigns;
