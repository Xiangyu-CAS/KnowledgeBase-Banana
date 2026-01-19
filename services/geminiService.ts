
import { GoogleGenAI } from "@google/genai";
import { Attachment, ChatMessage, ChatPart, Entity } from "../types";
import { generateId } from "../utils";

const MODEL_NAME = 'gemini-3-pro-image-preview';

export class GeminiService {
  private history: any[] = [];

  /**
   * Sends a multi-modal message to Gemini 3 Pro.
   */
  public async sendMessage(text: string, attachments: Attachment[], entities: Entity[], mentions: Entity[] = []): Promise<ChatMessage> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    const ai = new GoogleGenAI({ apiKey });
    
    const chat = ai.chats.create({
      model: MODEL_NAME,
      history: this.history,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: `You are Nano Banana Pro, a cutting-edge multimodal AI. 
You excel at text reasoning, image understanding, and image generation.

KNOWLEDGE INJECTION:
When users @mention characters, I will provide their visual reference data using [Visual Reference: Name] tags followed by an image. 
Connect these images to the mentions. Use these visuals to ensure accurate character consistency in your responses.

IMAGE GENERATION:
- If asked to create an image, output an image part in your response.
- Use the provided visual references for characters to maintain visual identity.
- Describe the scene vividly.

MULTI-TURN:
Remember the context of previous turns. If the user refers to "him" or "her" in relation to a character previously discussed or mentioned, maintain continuity.`
      },
    });

    const parts: any[] = [];
    
    // Just-in-Time Injection for Mentions
    if (mentions.length > 0) {
      parts.push({ text: "--- Neural Knowledge Injection (Contextual References) ---\n" });
      
      const uniqueMentions = Array.from(new Map(mentions.map(m => [m.id, m])).values());

      uniqueMentions.forEach(m => {
        parts.push({ text: `[Visual Reference: ${m.name}]` });
        if (m.base64) {
          parts.push({
            inlineData: {
              mimeType: m.mimeType,
              data: m.base64
            }
          });
        } else {
           parts.push({ text: `[Note: Visual data for ${m.name} is currently offline.]` });
        }
      });
      parts.push({ text: "--- End of Reference Injection ---\n" });
    }

    // Add User Attachments
    for (const att of attachments) {
      parts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: att.base64,
        },
      });
    }

    // User Text
    if (text.trim()) {
      parts.push({ text: text });
    }

    const trace = JSON.parse(JSON.stringify(parts));

    try {
      const response = await chat.sendMessage({
        message: parts,
      });

      if (response.candidates?.[0]?.content) {
        // Record history for multi-turn
        this.history.push({
          role: 'user',
          parts: [...parts]
        });
        this.history.push(response.candidates[0].content);
      }

      const responseParts: ChatPart[] = [];
      const candidate = response.candidates?.[0];
      const content = candidate?.content;
      const groundingMetadata = candidate?.groundingMetadata;

      if (content?.parts) {
        for (const part of content.parts) {
          if (part.text) {
            responseParts.push({ text: part.text });
          } else if (part.inlineData) {
            responseParts.push({
              inlineData: {
                mimeType: part.inlineData.mimeType,
                data: part.inlineData.data,
              },
            });
          }
        }
      }

      // Fallback if no parts but text property exists
      if (responseParts.length === 0 && response.text) {
        responseParts.push({ text: response.text });
      }

      return {
        id: generateId(),
        role: 'model',
        parts: responseParts,
        timestamp: Date.now(),
        trace: trace,
        groundingChunks: groundingMetadata?.groundingChunks as any,
      };
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      if (error.message?.includes("Requested entity was not found") || error.status === 404) {
         throw new Error("API_KEY_INVALID");
      }
      throw error;
    }
  }
}
