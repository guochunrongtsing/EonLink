
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

async function callNvidia(messages: any[]) {
  const response = await fetch(NVIDIA_PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "meta/llama-3.1-70b-instruct", // Updated to a more standard model name
      messages,
      temperature: 0.2,
      top_p: 0.7,
      max_tokens: 1024,
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`NVIDIA Proxy Error: ${response.status} - ${responseText}`);
  }

  try {
    const data = JSON.parse(responseText);
    return data.choices[0].message.content;
  } catch (e) {
    console.error("Failed to parse NVIDIA proxy response as JSON:", responseText);
    throw new Error(`NVIDIA Parse Error: ${responseText}`);
  }
}

export async function decomposeTaskNvidia(prompt: string, environmentState: string): Promise<Action[]> {
  const systemPrompt = `
    You are the Agent Core of an Embodied Intelligence System.
    Given a user instruction and the current environment state, decompose the task into a sequence of atomic actions.
    
    Available Skills:
    - navigate_to(location: string)
    - pick_up(object_id: string)
    - place_at(location: string)
    - open(object_id: string)
    - close(object_id: string)
    
    Environment State: ${environmentState}
    
    Output ONLY a JSON array of actions with this schema:
    [{ "skill": string, "params": {}, "description": string }]
  `;

  try {
    const content = await callNvidia([
      { role: "system", content: "You are a helpful robotic assistant." },
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
