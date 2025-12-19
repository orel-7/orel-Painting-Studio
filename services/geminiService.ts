
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI } from "@google/genai";
import { AiResponse, DebugInfo, TargetCandidate, BubbleColor } from "../types";

// Re-export TargetCandidate as it is imported from this service file in GeminiSlingshot.tsx
export type { TargetCandidate };

const MODEL_NAME = "gemini-3-flash-preview";

/**
 * Analyzes finger paintings and provides creative critiques using Gemini Vision.
 */
export const analyzeArt = async (
  imageBase64: string,
  strokeCount: number
): Promise<AiResponse> => {
  const startTime = performance.now();
  
  const debug: DebugInfo = {
    latency: 0,
    screenshotBase64: imageBase64,
    promptContext: `Strokes: ${strokeCount}`,
    rawResponse: "",
    timestamp: new Date().toLocaleTimeString()
  };

  if (!process.env.API_KEY) {
    return {
        hint: { message: "API Key missing.", suggestion: "Please check your environment." },
        debug: { ...debug, error: "API Key Missing" }
    };
  }

  // Always create a new instance right before making an API call to ensure use of the most up-to-date key.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    You are a professional Art Critic and Creative Muse. 
    Analyze the user's hand-drawn finger painting from the provided image.
    The user has made ${strokeCount} strokes so far.

    ### YOUR TASK
    1. Identify what the user might be drawing (Detected Subject).
    2. Give them a encouraging, poetic, or funny critique.
    3. Suggest one specific thing they could add to make it better.
    4. Name the "Art Style" they are inadvertently creating.

    ### OUTPUT FORMAT
    Return RAW JSON only. Structure:
    {
      "message": "Enthusiastic critique (1 sentence)",
      "suggestion": "Specific creative tip",
      "detectedSubject": "What you see",
      "artStyle": "Style name (e.g. Neon Expressionism)"
    }
  `;

  try {
    const cleanBase64 = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
            { text: prompt },
            { 
              inlineData: {
                mimeType: "image/png",
                data: cleanBase64
              } 
            }
        ]
      },
      config: {
        temperature: 0.7,
        responseMimeType: "application/json"
      }
    });

    const endTime = performance.now();
    debug.latency = Math.round(endTime - startTime);
    
    let text = response.text || "{}";
    debug.rawResponse = text;

    try {
        const json = JSON.parse(text);
        debug.parsedResponse = json;
        return {
            hint: {
                message: json.message || "Keep painting!",
                suggestion: json.suggestion || "Try adding some swirls.",
                detectedSubject: json.detectedSubject,
                artStyle: json.artStyle
            },
            debug
        };
    } catch (e: any) {
        return {
            hint: { message: "Fascinating work...", suggestion: "Keep going!" },
            debug: { ...debug, error: `JSON Parse Error: ${e.message}` }
        };
    }
  } catch (error: any) {
    const endTime = performance.now();
    debug.latency = Math.round(endTime - startTime);
    return {
        hint: { message: "The muse is silent for a moment.", suggestion: "Paint on!" },
        debug: { ...debug, error: error.message || "Unknown API Error" }
    };
  }
};

/**
 * Analyzes the game board for the Slingshot game and provides tactical advice.
 */
export const getStrategicHint = async (
    screenshot: string,
    candidates: TargetCandidate[],
    maxRow: number
): Promise<AiResponse> => {
  const startTime = performance.now();
  
  const debug: DebugInfo = {
    latency: 0,
    screenshotBase64: screenshot,
    promptContext: `Clusters: ${candidates.length}, Max Row: ${maxRow}`,
    rawResponse: "",
    timestamp: new Date().toLocaleTimeString()
  };

  if (!process.env.API_KEY) {
    return {
        hint: { message: "API Key missing." },
        debug: { ...debug, error: "API Key Missing" }
    };
  }

  // Create a fresh instance of GoogleGenAI before the call.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    You are a professional strategist for a bubble shooter game.
    Analyze the current game state from the image and the provided cluster data.
    
    Current hittable clusters (candidates):
    ${JSON.stringify(candidates, null, 2)}
    
    Highest occupied row on the board: ${maxRow}

    ### YOUR TASK
    1. Select the most strategic target (targetRow and targetCol) from the candidates.
    2. Prioritize larger clusters, high-value colors, and clusters that are higher up (lower row index).
    3. Provide a brief encouraging message and a clear rationale for the move.

    ### OUTPUT FORMAT
    Return RAW JSON only. Structure:
    {
      "message": "Brief strategic advice (1 sentence)",
      "rationale": "Reasoning for choosing this specific target",
      "targetRow": number,
      "targetCol": number,
      "recommendedColor": "red" | "blue" | "green" | "yellow" | "purple" | "orange"
    }
  `;

  try {
    const cleanBase64 = screenshot.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
            { text: prompt },
            { 
              inlineData: {
                mimeType: "image/jpeg",
                data: cleanBase64
              } 
            }
        ]
      },
      config: {
        temperature: 0.2, // Low temperature for consistent strategic reasoning
        responseMimeType: "application/json"
      }
    });

    const endTime = performance.now();
    debug.latency = Math.round(endTime - startTime);
    
    let text = response.text || "{}";
    debug.rawResponse = text;

    try {
        const json = JSON.parse(text);
        debug.parsedResponse = json;
        return {
            hint: json,
            debug
        };
    } catch (e: any) {
        return {
            hint: { message: "Calculating the perfect trajectory..." },
            debug: { ...debug, error: `JSON Parse Error: ${e.message}` }
        };
    }
  } catch (error: any) {
    const endTime = performance.now();
    debug.latency = Math.round(endTime - startTime);
    return {
        hint: { message: "Strategy engine paused." },
        debug: { ...debug, error: error.message || "Unknown API Error" }
    };
  }
};
