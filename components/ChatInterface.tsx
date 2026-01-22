
import React, { useState, useEffect, useRef } from 'react';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { GeminiService } from '../services/geminiService';
import { ChatMessage, Attachment, ChatPart, LoadingStatus, Entity, SceneReference } from '../types';
import { generateId } from '../utils';
import { Bot, Sparkles, Cpu, Activity, X } from 'lucide-react';

interface ChatInterfaceProps {
  onError: () => void;
  entities: Entity[];
  sceneReferences: SceneReference[];
  sceneRefsInjected: boolean;
  setSceneRefsInjected: React.Dispatch<React.SetStateAction<boolean>>;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  onError,
  entities,
  sceneReferences,
  sceneRefsInjected,
  setSceneRefsInjected
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>('idle');
  const [showHistory, setShowHistory] = useState(false);
  const [historySnapshot, setHistorySnapshot] = useState<any[]>([]);
  const serviceRef = useRef<GeminiService | null>(null);

  useEffect(() => {
    serviceRef.current = new GeminiService();
  }, []);

  const refreshHistory = () => {
    if (!serviceRef.current) return;
    setHistorySnapshot(serviceRef.current.getHistory());
  };

  useEffect(() => {
    if (showHistory) {
      refreshHistory();
    }
  }, [showHistory]);

  const handleSendMessage = async (text: string, attachments: Attachment[]) => {
    if (!serviceRef.current) return;

    // Detect character mentions for JIT injection
    const mentions: Entity[] = entities.filter(entity => text.includes(`@${entity.name}`));

    let status: LoadingStatus = 'thinking';
    const lowerText = text.toLowerCase();
    const isImageRequest = Boolean(lowerText.match(/(draw|create|generate|paint|image|画|生成|图像)/));
    if (isImageRequest) {
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
      const shouldInjectSceneRefs = isImageRequest && sceneReferences.length > 0 && !sceneRefsInjected;
      const responseMessage = await serviceRef.current.sendMessage(
        text,
        attachments,
        entities,
        mentions,
        sceneReferences,
        shouldInjectSceneRefs
      );
      setMessages((prev) => [...prev, responseMessage]);
      if (shouldInjectSceneRefs) {
        setSceneRefsInjected(true);
      }
      refreshHistory();
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

  const resolveHistoryEntry = (entry: any) => {
    if (!entry) return { role: 'model', parts: [] as any[] };
    if (entry.parts) return { role: entry.role || 'model', parts: entry.parts };
    if (entry.content?.parts) return { role: entry.content.role || entry.role || 'model', parts: entry.content.parts };
    return { role: entry.role || 'model', parts: [] as any[] };
  };

  const renderHistoryPart = (part: any, index: number) => {
    if (part?.inlineData?.data) {
      const mimeType = part.inlineData.mimeType || 'image/png';
      const isImage = mimeType.startsWith('image/');
      return (
        <div key={`history-part-${index}`} className="space-y-2">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em]">
            Inline Data · {mimeType}
          </div>
          {isImage ? (
            <img
              src={`data:${mimeType};base64,${part.inlineData.data}`}
              alt="History Inline"
              className="max-w-full rounded-xl border border-slate-200 shadow-sm"
            />
          ) : (
            <div className="text-[11px] font-mono text-slate-500">[Binary data omitted]</div>
          )}
        </div>
      );
    }

    if (part?.text) {
      return (
        <pre key={`history-part-${index}`} className="whitespace-pre-wrap text-[12px] text-slate-700 leading-relaxed font-mono">
          {part.text}
        </pre>
      );
    }

    return (
      <pre key={`history-part-${index}`} className="whitespace-pre-wrap text-[12px] text-slate-500 leading-relaxed font-mono">
        {JSON.stringify(part, null, 2)}
      </pre>
    );
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
           <button
             onClick={() => setShowHistory(prev => !prev)}
             className="flex items-center gap-2 text-[10px] font-black text-slate-600 bg-white border border-slate-200 px-4 py-2 rounded-full uppercase tracking-widest shadow-sm hover:text-indigo-600 hover:border-indigo-200 transition-colors"
             title="查看当前上下文 History"
           >
             <Activity size={12} />
             History
           </button>
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
        {showHistory && (
          <div className="absolute inset-0 z-30 flex justify-end bg-slate-950/30 backdrop-blur-sm">
            <div className="w-full max-w-md h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Trace</div>
                  <div className="text-base font-black text-slate-900">当前上下文 History</div>
                  <div className="text-[11px] text-slate-500 mt-1">共 {historySnapshot.length} 条记录</div>
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-2 rounded-full border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-colors"
                  title="关闭"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {historySnapshot.length === 0 && (
                  <div className="text-sm text-slate-500">暂无历史内容，发送一次消息后即可查看。</div>
                )}
                {historySnapshot.map((entry, index) => {
                  const { role, parts } = resolveHistoryEntry(entry);
                  return (
                    <div key={`history-entry-${index}`} className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                        {role === 'user' ? 'User' : 'Model'} · #{index + 1}
                      </div>
                      <div className="mt-3 space-y-3">
                        {parts?.length ? parts.map(renderHistoryPart) : (
                          <div className="text-[12px] text-slate-500">[Empty parts]</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
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
