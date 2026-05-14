import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface Action {
  skill: string;
  params: Record<string, any>;
  description: string;
}

export async function decomposeTask(prompt: string, environmentState: string, correctionContext?: string): Promise<Action[]> {
  const systemPrompt = `
    You are the Brain of EonLink, an embodied intelligence system.
    Given a high-level user goal and the current environment state, decompose the task into a logical sequence of atomic actions.
    
    ENVIRONMENT STATE:
    ${environmentState}
    
    AVAILABLE SKILLS:
    - navigate_to(x: number, y: number, z: number)
    - pick_up(object_id: string)
    - place_at(x: number, y: number, z: number)
    - open(object_id: string)
    - close(object_id: string)
    
    ${correctionContext ? `\nCRITICAL: PREVIOUS ATTEMPT FAILED. FEEDBACK: ${correctionContext}` : ""}
    
    STANDARD OPERATING PROCEDURE (SOP):
    1. PROXIMITY CHECK: You cannot interact (pick/place/open/close) with an object if the robot is not currently at that object's coordinates.
    2. CARRYING STATE: If 'Robot is currently carrying [object]', do NOT use 'pick_up' for that object. You can only 'place_at'.
    3. FIRST STEP: If the goal involves an object at a distance and you aren't carrying it, the FIRST action MUST be 'navigate_to' that object.
    4. BRING/MOVE GOALS:
       - If NOT carrying: [Navigate to Obj] -> [Pick Up] -> [Navigate to Destination] -> [Place].
       - If ALREADY carrying: [Navigate to Destination] -> [Place].
    5. USER POSITION: If the user says "bring to me", the destination is [0, 0, 0].
    
    EXAMPLE:
    Goal: "Bring me the cup"
    Output: [
      {"skill": "navigate_to", "params": {"x": 2.0, "y": 0, "z": 1.0}, "description": "Moving to the cup position"},
      {"skill": "pick_up", "params": {"object_id": "red_cup"}, "description": "Picking up the cup"},
      {"skill": "navigate_to", "params": {"x": 0, "y": 0, "z": 0}, "description": "Bringing cup back to user"},
      {"skill": "place_at", "params": {"x": 0, "y": 0.5, "z": 0.2}, "description": "Placing cup near user"}
    ]
    
    Output ONLY a JSON array of actions:
    [{ "skill": string, "params": { "x"?: number, "y"?: number, "z"?: number, "object_id"?: string }, "description": string }]
  `;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        { role: "user", parts: [{ text: systemPrompt + "\n\nUser Instruction: " + prompt }] }
      ]
    });
    
    const text = result.text || "";
    const jsonStr = text.match(/\[.*\]/s)?.[0] || "[]";
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse agent response", e);
    return [];
  }
}

export async function simulateAction(action: Action, environmentState: string): Promise<{ success: boolean; resultState: string; feedback: string }> {
  const worldModelPrompt = `
    You are the World Model Simulator. 
    Predict the outcome of an action in the environment.
    
    Action: ${JSON.stringify(action)}
    Current State: ${environmentState}
    
    Predict if the action succeeds based on physical laws. 
    Output JSON: { "success": boolean, "resultState": string, "feedback": string }
  `;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        { role: "user", parts: [{ text: worldModelPrompt }] }
      ]
    });
    
    const text = result.text || "";
    const jsonStr = text.match(/\{.*\}/s)?.[0] || "{}";
    return JSON.parse(jsonStr);
  } catch (e) {
    return { success: false, resultState: environmentState, feedback: "Simulation failed" };
  }
}
