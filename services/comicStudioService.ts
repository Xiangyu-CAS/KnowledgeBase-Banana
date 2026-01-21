import { GoogleGenAI, Type } from '@google/genai';

export interface WorkshopCharacter {
  id: string;
  name: string;
  description: string;
  appearance: string;
  imageUrl?: string;
  lastUsedPrompt?: string;
  role: 'protagonist' | 'antagonist' | 'supporting';
}

export interface WorkshopItem {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
}

export interface WorkshopScene {
  id: string;
  sceneNumber: number;
  pageNumber?: number;
  panelNumber?: number;
  location: string;
  description: string;
  dialogue: string;
  charactersInScene: string[];
  visualPrompt: string;
  generatedImageUrl?: string;
  lastUsedPrompt?: string;
}

const getApiKey = () => process.env.GEMINI_API_KEY || process.env.API_KEY || '';
const WORKSHOP_IMAGE_MODEL = 'gemini-3-pro-image-preview';
let workshopHistory: any[] = [];

export const extractWorkshopEntities = async (text: string): Promise<{ characters: WorkshopCharacter[]; items: WorkshopItem[] }> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `请深入分析以下小说文本，提取其中的核心人物和重要物品。
    
    规则：
    1. 人物姓名、身份描述和外貌细节必须使用中文。
    2. 外貌描述（appearance）必须非常详细，包含发型、五官、体型、标志性服饰（颜色、款式）以及散发的气质，这将直接用于绘图提示词。
    3. 角色角色（role）必须分类为：主角（protagonist）、反派（antagonist）或配角（supporting）。
    
    小说文本：
    ${text.substring(0, 10000)}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          characters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                appearance: { type: Type.STRING },
                role: { type: Type.STRING, enum: ['protagonist', 'antagonist', 'supporting'] }
              },
              required: ['name', 'description', 'appearance', 'role']
            }
          },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ['name', 'description']
            }
          }
        },
        required: ['characters', 'items']
      }
    }
  });

  const textOutput = response.text || '{}';
  const data = JSON.parse(textOutput);

  return {
    characters: (data.characters || []).map((c: any, i: number) => ({
      ...c,
      id: `char-${Date.now()}-${i}`
    })),
    items: (data.items || []).map((item: any, i: number) => ({
      ...item,
      id: `item-${Date.now()}-${i}`
    }))
  };
};

export const generateWorkshopStoryboard = async (text: string, characters: WorkshopCharacter[]): Promise<WorkshopScene[]> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const charContext = characters.map(c => `${c.name}: ${c.description} (外貌: ${c.appearance})`).join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `你是一名资深的动漫分镜导演。请根据以下小说文本创作“页（page）-格（panel）”的漫画分镜脚本。
    
    已知角色背景：
    ${charContext}

    小说内容：
    ${text.substring(0, 8000)}
    
    规则：
    - 每一页包含 3-5 个平行 panel。
    - 每个 panel 只用“一行”描述，格式示例：「Panel 1: 场景/动作；对白：『xxx』」。
    - 对白必须是中文，描述简短但画面信息充分。
    - visualPrompt 必须是英文，包含镜头、构图、光影。

    输出 pages 数组，每个 page 携带 panels，严格遵守 response schema。`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            pageNumber: { type: Type.INTEGER },
            panels: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  panelNumber: { type: Type.INTEGER },
                  location: { type: Type.STRING },
                  panelLine: { type: Type.STRING },
                  dialogue: { type: Type.STRING },
                  charactersInPanel: { type: Type.ARRAY, items: { type: Type.STRING } },
                  visualPrompt: { type: Type.STRING }
                },
                required: ['panelNumber', 'location', 'panelLine', 'dialogue', 'charactersInPanel', 'visualPrompt']
              }
            }
          },
          required: ['pageNumber', 'panels']
        }
      }
    }
  });

  const textOutput = response.text || '[]';
  const data = JSON.parse(textOutput);

  const scenes: WorkshopScene[] = [];
  data.forEach((page: any) => {
    page.panels.forEach((panel: any, idx: number) => {
      scenes.push({
        id: `scene-${Date.now()}-${scenes.length}`,
        sceneNumber: scenes.length + 1,
        pageNumber: page.pageNumber,
        panelNumber: panel.panelNumber,
        location: panel.location,
        description: panel.panelLine,
        dialogue: panel.dialogue,
        charactersInScene: panel.charactersInPanel,
        visualPrompt: panel.visualPrompt
      });
    });
  });

  return scenes;
};

export const generateWorkshopImage = async (
  prompt: string,
  charRefs: { data: string; mimeType: string }[] = [],
  aspectRatio: '16:9' | '1:1' | '9:16' = '16:9'
): Promise<{ imageUrl: string; trace: string }> => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const chat = ai.chats.create({
    model: WORKSHOP_IMAGE_MODEL,
    history: workshopHistory,
    config: {
      systemInstruction: `You are a cinematic manga art director. Produce one vivid frame per turn.
- Always return exactly one image.
- Maintain strict character consistency across turns using provided references.
- Keep visual continuity and coherent pacing between panels.`
    }
  });

  const parts: any[] = [];

  if (charRefs.length > 0) {
    parts.push({
      text: '--- Visual References (use these images as the definitive style + identity anchors) ---'
    });
  }
  const uniqueCharRefs = Array.from(
    new Map(charRefs.map((ref, idx) => [`${ref.data.slice(0, 20)}-${idx}`, ref])).values()
  );
  uniqueCharRefs.forEach((ref, idx) => {
    parts.push({ text: `[Character Reference ${idx + 1}]` });
    parts.push({
      inlineData: {
        data: ref.data,
        mimeType: ref.mimeType
      }
    });
  });
  if (charRefs.length > 0) {
    parts.push({ text: '--- End of Visual References ---' });
  }

  parts.push({
    text: `Render a single ${aspectRatio} anime manga frame. Keep camera, lighting, and styling coherent with prior turns. Scene prompt: ${prompt}`
  });

  const trace = parts
    .map(part => {
      if (part.text) {
        return `TEXT: ${part.text}`;
      }
      if (part.inlineData) {
        return `IMAGE: ${part.inlineData.mimeType || 'image/unknown'}, bytes=${part.inlineData.data?.length || 0}`;
      }
      return 'PART: [unknown]';
    })
    .join('\n');

  const response = await chat.sendMessage({
    message: parts,
    config: {
      imageConfig: {
        aspectRatio
      }
    }
  });

  if (response.candidates?.[0]?.content) {
    workshopHistory.push({
      role: 'user',
      parts: [...parts]
    });
    workshopHistory.push(response.candidates[0].content);
  }

  let imageUrl = '';
  const candidates = response.candidates || [];
  if (candidates.length > 0 && candidates[0].content?.parts) {
    for (const part of candidates[0].content.parts) {
      if (part.inlineData) {
        imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        break;
      }
    }
  }

  if (!imageUrl && response.text) {
    throw new Error(response.text);
  }

  return { imageUrl, trace };
};
