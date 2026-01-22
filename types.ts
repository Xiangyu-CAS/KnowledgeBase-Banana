export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  parts: ChatPart[];
  timestamp: number;
  isError?: boolean;
  trace?: any[]; // The raw parts array sent to the API for this turn
  groundingChunks?: Array<{
    web?: {
      uri: string;
      title: string;
    };
  }>;
}

export interface ChatPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface Attachment {
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
}

export interface Entity {
  id: string;
  name: string;
  imagePreview: string;
  base64: string;
  mimeType: string;
}

export interface SceneReference {
  id: string;
  name: string;
  imagePreview: string;
  base64: string;
  mimeType: string;
}

export type LoadingStatus = 'thinking' | 'generating' | 'searching' | 'idle';

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  loadingStatus: LoadingStatus;
}
