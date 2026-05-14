
import { Action, ActionResult } from "./geminiService";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

async function callOpenRouter(messages: any[], retries = 2) {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is missing");
  }

  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://ai.studio/build", // Required by OpenRouter
          "X-Title": "EonLink Embodied AI",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001", // Using Gemini 2.0 via OpenRouter as a robust mid-tier
          messages,
          temperature: 0.1,
        }),
      });

      const responseText = await response.text();

      if (response.status === 429 && attempt < retries - 1) {
        const waitTime = Math.pow(2, attempt + 1) * 1000;
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }

      if (!response.ok) {
        throw new Error(`OpenRouter Error: ${response.status} - ${responseText}`);
      }

      const data = JSON.parse(responseText);
      return data.choices[0].message.content;
    } catch (e: any) {
      lastError = e;
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
    }
  }
  
  throw lastError || new Error("OpenRouter call failed");
}

export async function decomposeTaskOpenRouter(prompt: string, environmentState: string, correctionContext?: string): Promise<Action[]> {
  const systemPrompt = `
    You are the Brain of EonLink. Decompose user goals into atomic actions.
    
    ENVIRONMENT STATE:
    ${environmentState}
    
    AVAILABLE SKILLS:
    - navigate_to(x: number, y: number, z: number)
    - pick_up(object_id: string)
    - place_at(x: number, y: number, z: number)
    - open(object_id: string)
    - close(object_id: string)
    
    ${correctionContext ? `\nCRITICAL: PREVIOUS ATTEMPT FAILED. FEEDBACK: ${correctionContext}` : ""}
    
    SOP:
    1. PROXIMITY: navigate_to near object (~0.8m) before manipulation.
    2. CARRYING: If carrying target, skip pick_up.
    3. SEQUENCE: Navigate -> Pick -> Navigate -> Place.
    
    Output ONLY a JSON array of actions:
    [{ "skill": string, "params": { "x"?: number, "y"?: number, "z"?: number, "object_id"?: string }, "description": string }]
  `;

  const content = await callOpenRouter([
    { role: "system", content: "You are a highly efficient task decomposition engine." },
    { role: "user", content: `${systemPrompt}\n\nUser Instruction: ${prompt}` }
  ]);

  try {
    const cleaned = content.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("OpenRouter JSON Parse Error:", content);
    throw new Error("Failed to parse OpenRouter response");
  }
}

export async function simulateActionOpenRouter(action: Action, environmentState: string): Promise<ActionResult> {
  const prompt = `
    Action: ${JSON.stringify(action)}
    Current Environment: ${environmentState}
    
    Evaluate if this action is physically logical and return JSON:
    { "success": boolean, "feedback": string, "resultState": string }
  `;

  const content = await callOpenRouter([
    { role: "system", content: "You are a high-fidelity physical world simulator." },
    { role: "user", content: prompt }
  ]);

  try {
    const cleaned = content.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error("Failed to parse OpenRouter simulation response");
  }
}
