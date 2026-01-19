
import React, { useState, useEffect, useRef } from 'react';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { GeminiService } from '../services/geminiService';
import { ChatMessage, Attachment, ChatPart, LoadingStatus, Entity } from '../types';
import { generateId } from '../utils';
import { Bot, Sparkles, Cpu } from 'lucide-react';

interface ChatInterfaceProps {
  onError: () => void;
  entities: Entity[];
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ onError, entities }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>('idle');
  const serviceRef = useRef<GeminiService | null>(null);

  useEffect(() => {
    serviceRef.current = new GeminiService();
  }, []);

  const handleSendMessage = async (text: string, attachments: Attachment[]) => {
    if (!serviceRef.current) return;

    // Detect character mentions for JIT injection
    const mentions: Entity[] = entities.filter(entity => text.includes(`@${entity.name}`));

    let status: LoadingStatus = 'thinking';
    const lowerText = text.toLowerCase();
    if (lowerText.match(/(draw|create|generate|paint|image|画|生成|图像)/)) {
      status = 'generating';
    } else if (lowerText.match(/(search|latest|news|find|搜索|查找|新闻)/)) {
      status = 'searching';
    }

    // Construct User UI representation
    const userParts: ChatPart[] = [];
    attachments.forEach(att => {
        userParts.push({
            inlineData: { mimeType: att.mimeType, data: att.base64 }
        });
    });
    if (text) userParts.push({ text });

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      parts: userParts,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setLoadingStatus(status);

    try {
      const responseMessage = await serviceRef.current.sendMessage(text, attachments, entities, mentions);
      setMessages((prev) => [...prev, responseMessage]);
    } catch (error: any) {
      console.error("Chat Error:", error);
      if (error.message === 'API_KEY_INVALID') {
          onError();
          return;
      }
      setMessages((prev) => [...prev, {
        id: generateId(),
        role: 'model',
        parts: [{ text: "System overload. Failed to process neural request. Please verify connection." }],
        timestamp: Date.now(),
        isError: true,
      }]);
    } finally {
      setIsLoading(false);
      setLoadingStatus('idle');
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white overflow-hidden">
      {/* Dynamic Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-100 p-4 px-6 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200 ring-4 ring-slate-50">
                <Cpu size={22} className={isLoading ? 'animate-pulse text-indigo-400' : ''} />
            </div>
            <div>
                <h2 className="font-black text-slate-900 leading-none mb-1 text-base tracking-tight">GEMINI-3-PRO</h2>
                <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isLoading ? 'bg-indigo-500 animate-ping' : 'bg-emerald-500'}`}></span>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Neural Stream · Active</span>
                </div>
            </div>
        </div>
        <div className="flex items-center gap-3">
           <div className="hidden sm:flex items-center gap-2 text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-full uppercase tracking-widest shadow-sm">
              <Sparkles size={12} /> JIT Mode
           </div>
        </div>
      </div>

      {/* Message List Container */}
      <div className="flex-1 overflow-hidden relative bg-slate-50/10">
        <div className="absolute inset-0">
             <MessageList 
                messages={messages} 
                isTyping={isLoading} 
                loadingStatus={loadingStatus}
                onSuggestionClick={(text) => handleSendMessage(text, [])}
                entities={entities}
             />
        </div>
      </div>

      {/* Input Area Overlay */}
      <div className="bg-white/95 backdrop-blur-md border-t border-slate-100 p-2 md:p-4">
        <InputArea 
          onSend={(text, attachments) => handleSendMessage(text, attachments)} 
          isLoading={isLoading} 
          entities={entities} 
        />
      </div>
    </div>
  );
};
