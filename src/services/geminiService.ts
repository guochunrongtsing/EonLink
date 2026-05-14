import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface Action {
  skill: string;
  params: Record<string, any>;
  description: string;
}

export async function decomposeTask(prompt: string, environmentState: string): Promise<Action[]> {
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
    
    Output a JSON array of actions with this schema:
    [{ "skill": string, "params": {}, "description": string }]
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
