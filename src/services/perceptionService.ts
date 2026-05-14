import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface DetectedObject {
  id: string;
  label: string;
  position: [number, number, number]; // [x, y, z] in the 3D world
  confidence: number;
  attributes?: Record<string, any>;
  size?: [number, number, number]; // [w, h, d]
}

export async function identifyObjects(base64Image: string): Promise<DetectedObject[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image,
          },
        },
        {
          text: `Identify all significant objects in this camera frame. 
          Provide their names and estimate their 3D positions in a simple coordinate system where the camera is at [0, 0.5, 0].
          - X: Left/Right (negative to positive)
          - Y: Height (usually 0 to 1 on a floor)
          - Z: Depth (distance from camera, usually positive)
          
          Return the data as a JSON array of objects.`,
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
              position: {
                type: Type.ARRAY,
                items: { type: Type.NUMBER },
                description: "[x, y, z] coordinates",
              },
              confidence: { type: Type.NUMBER },
            },
            required: ["id", "label", "position", "confidence"],
          },
        },
      },
    });

    const results = JSON.parse(response.text || "[]");
    return results;
  } catch (error) {
    console.error("Perception Error:", error);
    return [];
  }
}
