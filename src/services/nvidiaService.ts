
export interface Action {
  skill: string;
  params: Record<string, any>;
  description: string;
}

const NVIDIA_PROXY_URL = "/api/nvidia";

export async function checkNvidiaAvailability(): Promise<boolean> {
  try {
    const res = await fetch("/api/config");
    const data = await res.json();
    return !!data.hasNvidia;
  } catch {
    return false;
  }
}

async function callNvidia(messages: any[], retries = 3) {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(NVIDIA_PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta/llama-3.1-70b-instruct",
          messages,
          temperature: 0.2,
          top_p: 0.7,
          max_tokens: 1024,
        }),
      });

      const responseText = await response.text();

      if (response.status === 429 && attempt < retries - 1) {
        const waitTime = Math.pow(2, attempt + 1) * 1000;
        console.warn(`NVIDIA 429 (Too Many Requests). Retrying in ${waitTime}ms... (Attempt ${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }

      if (!response.ok) {
        throw new Error(`NVIDIA Proxy Error: ${response.status} - ${responseText}`);
      }

      const data = JSON.parse(responseText);
      return data.choices[0].message.content;
    } catch (e: any) {
      lastError = e;
      if (attempt < retries - 1) {
        const waitTime = Math.pow(2, attempt + 1) * 1000;
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }
    }
  }
  
  throw lastError || new Error("NVIDIA call failed after retries");
}

export async function decomposeTaskNvidia(prompt: string, environmentState: string, correctionContext?: string): Promise<Action[]> {
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
    
    TACTICAL SOP:
    1. PROXIMITY & SAFETY: You MUST 'navigate_to' a position NEAR the object (offset by ~0.8m) before manipulation. NEVER navigate to the exact center.
    2. OBSTACLE AWARENESS: If an object (cup) is on a table, navigate to a spot next to the table, not the cup's center.
    3. BRING/MOVE SEQUENCE: [Navigate to Near-Obj] -> [Pick Up] -> [Navigate to Near-Destination] -> [Place].
    4. STATE AWARENESS: If carrying, skip pick-up.
    
    EXAMPLE:
    Goal: "Bring me the cup"
    Output: [
      {"skill": "navigate_to", "params": {"x": 2.0, "y": 0, "z": 1.0}, "description": "Navigating to cup"},
      {"skill": "pick_up", "params": {"object_id": "cup"}, "description": "Grasping cup"},
      {"skill": "navigate_to", "params": {"x": 0, "y": 0, "z": 0}, "description": "Returning to home"},
      {"skill": "place_at", "params": {"x": 0, "y": 0.5, "z": 0.1}, "description": "Handing over cup"}
    ]
    
    Output ONLY a JSON array of actions:
    [{ "skill": string, "params": { "x"?: number, "y"?: number, "z"?: number, "object_id"?: string }, "description": string }]
  `;

  try {
    const content = await callNvidia([
      { role: "system", content: "You are a highly efficient task decomposition engine." },
      { role: "user", content: systemPrompt + "\n\nUser Instruction: " + prompt }
    ]);
    
    const jsonStr = content.match(/\[.*\]/s)?.[0] || "[]";
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("NVIDIA Decomposition failed:", e);
    throw e;
  }
}

export async function simulateActionNvidia(action: Action, environmentState: string): Promise<{ success: boolean; resultState: string; feedback: string }> {
  const worldModelPrompt = `
    You are the World Model Simulator. 
    Predict the outcome of an action in the environment.
    
    Action: ${JSON.stringify(action)}
    Current State: ${environmentState}
    
    Predict if the action succeeds based on physical laws. 
    Output ONLY JSON: { "success": boolean, "resultState": string, "feedback": string }
  `;

  try {
    const content = await callNvidia([
      { role: "system", content: "You are a physics-aware simulation engine." },
      { role: "user", content: worldModelPrompt }
    ]);
    
    const jsonStr = content.match(/\{.*\}/s)?.[0] || "{}";
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("NVIDIA Simulation failed:", e);
    throw e;
  }
}
