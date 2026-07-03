import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// ============================================
// UNIT CONVERSION — done in CODE not by AI
// ============================================

// Extract area from prompt and convert to sq ft
// Returns { sqFt, cleanPrompt } where cleanPrompt replaces the area with ft dimensions
function preprocessPrompt(prompt) {
  let sqFt = null;
  let cleanPrompt = prompt;

  // Match patterns like: 2150 square yard / 2150 sq yd / 2150 sq yards / 2150sqyd
  const sqYdPattern = /(\d+(?:\.\d+)?)\s*(?:square\s*yards?|sq\.?\s*y(?:ar)?d?s?|sqyd)/i;
  // Match patterns like: 2150 square feet / 2150 sq ft / 2150sqft
  const sqFtPattern = /(\d+(?:\.\d+)?)\s*(?:square\s*fe?e?t?|sq\.?\s*ft|sqft)/i;
  // Match patterns like: 2150 marla (Pakistani unit: 1 marla = 272.25 sq ft)
  const marlaPattern = /(\d+(?:\.\d+)?)\s*marla/i;
  // Match patterns like: 2150 kanal (Pakistani unit: 1 kanal = 5445 sq ft)
  const kanalPattern = /(\d+(?:\.\d+)?)\s*kanal/i;

  let matchYd = prompt.match(sqYdPattern);
  let matchFt = prompt.match(sqFtPattern);
  let matchMarla = prompt.match(marlaPattern);
  let matchKanal = prompt.match(kanalPattern);

  if (matchYd) {
    sqFt = parseFloat(matchYd[1]) * 9;
    console.log(`📐 Converted: ${matchYd[1]} sq yd → ${sqFt} sq ft`);
  } else if (matchFt) {
    sqFt = parseFloat(matchFt[1]);
    console.log(`📐 Using: ${sqFt} sq ft directly`);
  } else if (matchMarla) {
    sqFt = parseFloat(matchMarla[1]) * 272.25;
    console.log(`📐 Converted: ${matchMarla[1]} marla → ${sqFt} sq ft`);
  } else if (matchKanal) {
    sqFt = parseFloat(matchKanal[1]) * 5445;
    console.log(`📐 Converted: ${matchKanal[1]} kanal → ${sqFt} sq ft`);
  }

  // If we got sqFt, compute good width x length and inject into prompt
  if (sqFt && sqFt > 0) {
    const dims = computePlotDimensions(sqFt);
    // Replace the area mention with explicit ft dimensions so AI doesn't guess
    cleanPrompt = prompt
      .replace(sqYdPattern, `${dims.width} x ${dims.length} feet`)
      .replace(sqFtPattern, `${dims.width} x ${dims.length} feet`)
      .replace(marlaPattern, `${dims.width} x ${dims.length} feet`)
      .replace(kanalPattern, `${dims.width} x ${dims.length} feet`);
    console.log(`📐 Plot dimensions: ${dims.width} x ${dims.length} ft (${sqFt} sq ft)`);
    return { sqFt, dims, cleanPrompt };
  }

  return { sqFt: null, dims: null, cleanPrompt: prompt };
}

// Compute a sensible width x length from sq ft area
// Targets aspect ratio between 0.7 and 1.4 (close to square)
function computePlotDimensions(sqFt) {
  const sqSide = Math.sqrt(sqFt);
  // Try ratios from 1.0 up to 1.4 to find clean numbers
  const ratios = [1.0, 1.1, 1.2, 1.3, 1.4];
  for (const ratio of ratios) {
    const w = Math.round(sqSide / Math.sqrt(ratio));
    const l = Math.round(sqSide * Math.sqrt(ratio));
    if (w >= 20 && l >= 20 && Math.abs(w * l - sqFt) / sqFt < 0.05) {
      return { width: w, length: l };
    }
  }
  // Fallback: simple square-ish
  const w = Math.round(sqSide);
  const l = Math.round(sqFt / w);
  return { width: w, length: l };
}

// ============================================
// MAIN EXPORT
// ============================================

export async function analyzeHousePrompt(prompt) {
  try {
    // ✅ FIX: Convert units in CODE before sending to AI
    const { sqFt, dims, cleanPrompt } = preprocessPrompt(prompt);

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
You are an architect AI specialized in residential house design.
Return ONLY valid JSON. No markdown. No explanation. No text.
JSON must start with { and end with }.

════════════════════════════════════════
PLOT DIMENSIONS
════════════════════════════════════════
The user's prompt already contains the plot dimensions in FEET.
Use those exact dimensions in the plot object.
Do NOT convert or change them.
Do NOT guess dimensions from area text — the area has already been converted for you.

════════════════════════════════════════
PLOT SHAPE RULES
════════════════════════════════════════
Plot width/length ratio must be between 0.6 and 1.7.
NEVER return a plot like 90x260 — too elongated.
NEVER return a plot like 20x150 — too narrow.

════════════════════════════════════════
ROOM SIZING (minimum sizes in feet)
════════════════════════════════════════
  Bedroom:   10 x 10  (optimal 12 x 14)
  Bathroom:   6 x 8   (optimal  8 x 10)
  Kitchen:    8 x 10  (optimal 10 x 12)
  Living:    12 x 14  (optimal 16 x 18)
  Dining:    10 x 10  (optimal 12 x 14)
  Garage:    12 x 20  (optimal 16 x 22)
  Balcony:    6 x 8   (optimal  8 x 10)

Total room area must NOT exceed 85% of plot area.

════════════════════════════════════════
BATHROOM RULES
════════════════════════════════════════
ALWAYS place Bathroom adjacent to at least one Bedroom.
NEVER include Bathroom without a Bedroom on same floor.
Bathroom count can be at most Bedroom count + 1.

════════════════════════════════════════
ROOM COUNT RULES
════════════════════════════════════════
- count must be a positive integer (minimum 1).
- Never repeat the same room type twice in the array.
- Only include rooms that realistically fit the plot.
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

Only include room types that are needed.
`.trim()
        },
        {
          role: "user",
          content: cleanPrompt, // ✅ Send pre-processed prompt with ft dimensions
        },
      ],
    });

    let raw = completion.choices[0].message.content.trim();

    const start = raw.indexOf("{");
    const end   = raw.lastIndexOf("}") + 1;
    raw = raw.slice(start, end);

    const parsed = JSON.parse(raw);

    // ✅ OVERRIDE: If we computed dimensions in code, always use them
    //   Don't trust AI to return the right plot size — use our calculation
    if (dims) {
      parsed.plot.width  = dims.width;
      parsed.plot.length = dims.length;
      console.log(`✅ Plot overridden to ${dims.width}x${dims.length} ft`);
    }

    // ✅ POST-PARSE: Fix bad aspect ratios as safety net
    if (parsed.plot?.width && parsed.plot?.length) {
      const ratio = parsed.plot.width / parsed.plot.length;
      if (ratio < 0.6 || ratio > 1.7) {
        const area   = parsed.plot.width * parsed.plot.length;
        const sqSide = Math.round(Math.sqrt(area));
        parsed.plot.width  = sqSide;
        parsed.plot.length = Math.round(area / sqSide);
        console.log(`⚠️ Bad ratio corrected → ${parsed.plot.width}x${parsed.plot.length}`);
      }
    }

    // ✅ Deduplicate room types
    const seen = new Map();
    parsed.rooms = (parsed.rooms || []).reduce((acc, room) => {
      const key = `${room.type}-${room.floor}`;
      if (seen.has(key)) {
        seen.get(key).count = Math.max(seen.get(key).count || 1, room.count || 1);
      } else {
        seen.set(key, room);
        acc.push(room);
      }
      return acc;
    }, []);

    // ✅ Ensure count >= 1
    parsed.rooms = parsed.rooms.map(r => ({
      ...r,
      count: Math.max(1, Math.round(r.count || 1))
    }));

    // ✅ Cap rooms if plot too small
    const plotArea = parsed.plot.width * parsed.plot.length;
    const maxRooms = Math.max(3, Math.floor(plotArea / 200));
    let totalRooms = parsed.rooms.reduce((sum, r) => sum + (r.count || 1), 0);

    if (totalRooms > maxRooms) {
      const trimOrder = ["Balcony", "Garage", "Staircase", "Hallway", "Dining", "Bathroom", "Kitchen", "Bedroom", "Living"];
      for (const type of trimOrder) {
        if (totalRooms <= maxRooms) break;
        const idx = parsed.rooms.findIndex(r => r.type === type);
        if (idx === -1) continue;
        const room = parsed.rooms[idx];
        while (room.count > 1 && totalRooms > maxRooms) { room.count--; totalRooms--; }
        if (totalRooms > maxRooms && room.count === 1) { parsed.rooms.splice(idx, 1); totalRooms--; }
      }
    }

    // ✅ Remove orphan bathrooms
    parsed.rooms = parsed.rooms.filter(room => {
      if (room.type !== "Bathroom") return true;
      return parsed.rooms.some(r => r.type === "Bedroom" && r.floor === room.floor);
    });

    console.log("✅ Final analysis:", JSON.stringify(parsed, null, 2));
    return parsed;

  } catch (error) {
    console.error("AI ERROR:", error.message);
    throw error;
  }
}