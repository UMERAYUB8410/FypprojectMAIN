import Groq from "groq-sdk";

// ⚠️ NEVER hardcode keys in real apps
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function analyzeHousePrompt(prompt) 
 {
  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content: `
You are an architect AI specialized in residential house design.
Return ONLY valid JSON.
No markdown.
No explanation.
No text.
JSON must start with { and end with }.

Schema:
{
  "plot": { "width": number, "length": number },
  "floors": number,
  "rooms": [
    { "type": "Bedroom", "count": number, "floor": number },
    { "type": "Bathroom", "count": number, "floor": number },
    { "type": "Kitchen", "count": number, "floor": number },
    { "type": "Living", "count": number, "floor": number },
    { "type": "Dining", "count": number, "floor": number },
    { "type": "Garage", "count": number, "floor": number },
    { "type": "Balcony", "count": number, "floor": number }
  ],
  "style": "modern" | "traditional" | "minimalist"
}
          `
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
    const end = raw.lastIndexOf("}") + 1;
    raw = raw.slice(start, end);

    const parsed = JSON.parse(raw);
    console.log(parsed);
    return parsed;

  } catch (error) {
    console.error("AI ERROR:", error.message);
    throw error;
  }
}
