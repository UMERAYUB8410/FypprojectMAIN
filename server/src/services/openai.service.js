import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function analyzeHousePrompt(prompt) {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.2, // ✅ FIX: was 0.8 — low temp = consistent, structured output
      messages: [
        {
          role: "system",
          content: `
You are an architect AI specialized in residential house design.
Return ONLY valid JSON. No markdown. No explanation. No text.
JSON must start with { and end with }.

════════════════════════════════════════
UNIT RULE
════════════════════════════════════════
All plot dimensions must be in FEET.
If user gives area in sq yd → multiply by 9 to get sq ft, then pick width/length.
Example: 120 sq yd = 1080 sq ft → plot 30 x 36 ft.

════════════════════════════════════════
ROOM SIZING RULES (read carefully)
════════════════════════════════════════
Room types and their minimum sizes in feet:
  Bedroom:   10 x 10  (optimal 12 x 14)
  Bathroom:   6 x 8   (optimal  8 x 10)
  Kitchen:    8 x 10  (optimal 10 x 12)
  Living:    12 x 14  (optimal 16 x 18)
  Dining:    10 x 10  (optimal 12 x 14)
  Garage:    12 x 20  (optimal 16 x 22)
  Balcony:    6 x 8   (optimal  8 x 10)

CRITICAL: Before adding rooms, calculate whether they physically FIT.
Total area of all rooms must NOT exceed 85% of plot area.
If plot is small (under 800 sq ft), reduce room sizes and room count.
For a 30x36 ft plot (1080 sq ft), maximum 4-5 rooms total.
For a 40x50 ft plot (2000 sq ft), maximum 6-7 rooms total.

════════════════════════════════════════
BATHROOM PLACEMENT RULES
════════════════════════════════════════
ALWAYS place Bathroom adjacent to at least one Bedroom.
NEVER include a Bathroom without a Bedroom on the same floor.
Bathroom count must NEVER exceed Bedroom count.

════════════════════════════════════════
ROOM COUNT RULES
════════════════════════════════════════
- count must be a positive integer (minimum 1).
- Never repeat the same room type twice in the array.
  WRONG: [{"type":"Bedroom","count":1}, {"type":"Bedroom","count":1}]
  RIGHT: [{"type":"Bedroom","count":2}]
- Only include room types that realistically fit the plot.
- Garage only if plot width >= 28 ft.
- Balcony only if plot area >= 1200 sq ft.

════════════════════════════════════════
OUTPUT SCHEMA
════════════════════════════════════════
{
  "plot": { "width": number, "length": number },
  "floors": number,
  "rooms": [
    { "type": "Bedroom",   "count": number, "floor": number },
    { "type": "Bathroom",  "count": number, "floor": number },
    { "type": "Kitchen",   "count": number, "floor": number },
    { "type": "Living",    "count": number, "floor": number },
    { "type": "Dining",    "count": number, "floor": number },
    { "type": "Garage",    "count": number, "floor": number },
    { "type": "Balcony",   "count": number, "floor": number }
  ],
  "style": "modern" | "traditional" | "minimalist"
}

Only include room types that are needed. Do not include all types if they don't fit.
`.trim()
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    let raw = completion.choices[0].message.content.trim();

    // ✅ Extract JSON safely
    const start = raw.indexOf("{");
    const end   = raw.lastIndexOf("}") + 1;
    raw = raw.slice(start, end);

    const parsed = JSON.parse(raw);

    // ✅ POST-PARSE SANITIZATION: deduplicate room types
    //    (guards against AI returning duplicate type entries despite instructions)
    const seen = new Map();
    parsed.rooms = (parsed.rooms || []).reduce((acc, room) => {
      const key = `${room.type}-${room.floor}`;
      if (seen.has(key)) {
        // Merge: keep higher count
        const existing = seen.get(key);
        existing.count = Math.max(existing.count || 1, room.count || 1);
      } else {
        seen.set(key, room);
        acc.push(room);
      }
      return acc;
    }, []);

    // ✅ POST-PARSE SANITIZATION: ensure count is always >= 1
    parsed.rooms = parsed.rooms.map(r => ({
      ...r,
      count: Math.max(1, Math.round(r.count || 1))
    }));

    // ✅ POST-PARSE SANITIZATION: cap total rooms if plot is too small
    const plotArea   = (parsed.plot?.width || 30) * (parsed.plot?.length || 36);
    const maxRooms   = Math.max(3, Math.floor(plotArea / 200)); // ~200 sq ft per room slot
    let   totalRooms = parsed.rooms.reduce((sum, r) => sum + (r.count || 1), 0);

    if (totalRooms > maxRooms) {
      // Trim lowest-priority rooms first (reverse of priority order)
      const trimOrder = ["Balcony", "Garage", "Staircase", "Hallway", "Dining", "Bathroom", "Kitchen", "Bedroom", "Living"];
      for (const type of trimOrder) {
        if (totalRooms <= maxRooms) break;
        const idx = parsed.rooms.findIndex(r => r.type === type);
        if (idx === -1) continue;
        const room = parsed.rooms[idx];
        while (room.count > 1 && totalRooms > maxRooms) {
          room.count--;
          totalRooms--;
        }
        if (totalRooms > maxRooms && room.count === 1) {
          parsed.rooms.splice(idx, 1);
          totalRooms--;
        }
      }
    }

    // ✅ POST-PARSE SANITIZATION: remove Bathroom if no Bedroom on same floor
    parsed.rooms = parsed.rooms.filter(room => {
      if (room.type !== "Bathroom") return true;
      const hasBedroom = parsed.rooms.some(
        r => r.type === "Bedroom" && r.floor === room.floor
      );
      return hasBedroom;
    });

    console.log("✅ Parsed & sanitized analysis:", JSON.stringify(parsed, null, 2));
    return parsed;

  } catch (error) {
    console.error("AI ERROR:", error.message);
    throw error;
  }
}