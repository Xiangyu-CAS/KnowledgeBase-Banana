import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, User, AlertCircle, Download, Copy, Check, Globe, Image as ImageIcon, Sparkles, Search, Activity, ChevronDown, ChevronUp, UserCheck } from 'lucide-react';
import { ChatMessage, LoadingStatus, Entity } from '../types';

interface MessageListProps {
  messages: ChatMessage[];
  isTyping: boolean;
  loadingStatus: LoadingStatus;
  onSuggestionClick?: (text: string) => void;
  entities: Entity[];
}

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button 
      onClick={handleCopy}
      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
      title="复制内容"
    >
      {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
    </button>
  );
};

const TraceView = ({ trace }: { trace: any[] }) => {
  const [isOpen, setIsOpen] = useState(false);

  const renderPart = (part: any, index: number) => {
    if (part?.inlineData?.data) {
      const mimeType = part.inlineData.mimeType || 'image/png';
      const isImage = mimeType.startsWith('image/');
      return (
        <div key={`trace-part-${index}`} className="space-y-2">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em]">
            Inline Data · {mimeType}
          </div>
          {isImage ? (
            <img
              src={`data:${mimeType};base64,${part.inlineData.data}`}
              alt="Trace Inline"
              className="max-w-full rounded-xl border border-slate-800 shadow-md"
            />
          ) : (
            <div className="text-[11px] font-mono text-indigo-300/90">[Binary data omitted]</div>
          )}
        </div>
      );
    }

    if (part?.text) {
      return (
        <pre key={`trace-part-${index}`} className="whitespace-pre-wrap text-[11px] font-mono text-indigo-300/90 leading-relaxed">
          {part.text}
        </pre>
      );
    }

    return (
      <pre key={`trace-part-${index}`} className="whitespace-pre-wrap text-[11px] font-mono text-indigo-300/90 leading-relaxed">
        {JSON.stringify(part, null, 2)}
      </pre>
    );
  };

  return (
    <div className="mt-4 pt-3 border-t border-slate-100/50">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-[10px] font-bold text-slate-400 hover:text-indigo-500 uppercase tracking-[0.15em] transition-all group"
      >
        <Activity size={12} className={`${isOpen ? 'text-indigo-500 animate-pulse' : 'group-hover:text-indigo-400'}`} />
        <span>{isOpen ? '隐藏发送负载 (Trace)' : '查看 JIT 知识注入详情'}</span>
        {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      
      {isOpen && (
        <div className="mt-3 p-4 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner animate-in slide-in-from-top-2 duration-300 space-y-4">
          {trace.map(renderPart)}
        </div>
      )}
    </div>
  );
};

type MentionChunk = {
  type: 'text' | 'mention';
  value: string;
  entity?: Entity;
};

const buildMentionChunks = (text: string, entities: Entity[]): MentionChunk[] => {
  if (!text || entities.length === 0) {
    return [{ type: 'text', value: text }];
  }

  const tokens = entities.map((entity) => ({
    token: `@${entity.name}`,
    entity
  }));

  const chunks: MentionChunk[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    let nextIndex = -1;
    let nextToken: { token: string; entity: Entity } | null = null;

    for (const entry of tokens) {
      const idx = text.indexOf(entry.token, cursor);
      if (idx === -1) continue;
      if (nextIndex === -1 || idx < nextIndex || (idx === nextIndex && entry.token.length > (nextToken?.token.length || 0))) {
        nextIndex = idx;
        nextToken = entry;
      }
    }

    if (nextIndex === -1 || !nextToken) {
      chunks.push({ type: 'text', value: text.slice(cursor) });
      break;
    }

    if (nextIndex > cursor) {
      chunks.push({ type: 'text', value: text.slice(cursor, nextIndex) });
    }

    chunks.push({ type: 'mention', value: nextToken.token, entity: nextToken.entity });
    cursor = nextIndex + nextToken.token.length;
  }

  return chunks;
};

const MentionToken = ({ chunk, variant }: { chunk: MentionChunk; variant: 'user' | 'suggestion' }) => {
  if (chunk.type !== 'mention') {
    return <span>{chunk.value}</span>;
  }

  const entity = chunk.entity;
  const hasPreview = Boolean(entity?.imagePreview);
  const baseClasses = variant === 'user'
    ? 'inline-flex items-center gap-1 bg-white/20 text-white font-bold px-2 py-0.5 rounded-lg border border-white/30 mx-0.5 shadow-sm backdrop-blur-sm transform hover:scale-105 transition-transform cursor-default'
    : 'inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-lg border border-indigo-100 mx-0.5 shadow-sm cursor-default';

  return (
    <span className={`group relative ${baseClasses}`}>
      {hasPreview ? (
        <img
          src={entity?.imagePreview}
          alt={entity?.name}
          className={variant === 'user' ? 'w-4 h-4 rounded-full object-cover border border-white/40' : 'w-4 h-4 rounded-full object-cover border border-indigo-200'}
        />
      ) : (
        <UserCheck size={10} className={variant === 'user' ? 'text-indigo-200' : 'text-indigo-400'} />
      )}
      {chunk.value}
      {hasPreview && (
        <span className="absolute left-0 top-full mt-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-30">
          <span className="block bg-white rounded-2xl border border-slate-100 shadow-xl p-2">
            <img src={entity?.imagePreview} alt={entity?.name} className="w-32 h-32 rounded-xl object-cover" />
            <span className="block text-[10px] font-bold text-slate-600 mt-2 text-center">{entity?.name}</span>
          </span>
        </span>
      )}
    </span>
  );
};

export const MessageList: React.FC<MessageListProps> = ({ messages, isTyping, loadingStatus, onSuggestionClick, entities }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const renderRichText = (text: string, isUser: boolean) => {
    if (!isUser) {
      return <ReactMarkdown>{text}</ReactMarkdown>;
    }

    const chunks = buildMentionChunks(text, entities);
    
    return (
      <div className="whitespace-pre-wrap leading-relaxed">
        {chunks.map((chunk, i) => (
          <MentionToken key={i} chunk={chunk} variant="user" />
        ))}
      </div>
    );
  };

  const renderContent = (message: ChatMessage) => {
    return (
      <div className="space-y-3">
        {message.parts.map((part, index) => {
          if (part.text) {
            return (
              <div key={index} className="prose prose-sm prose-slate max-w-none break-words dark:prose-invert">
                {renderRichText(part.text, message.role === 'user')}
              </div>
            );
          }
          if (part.inlineData) {
            const imgSrc = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            return (
              <div key={index} className="group/img relative inline-block animate-in fade-in zoom-in-95 duration-500">
                <img
                  src={imgSrc}
                  alt="Content"
                  className="rounded-2xl max-w-full md:max-w-lg h-auto border-2 border-white shadow-xl hover:shadow-2xl transition-all"
                />
                <a 
                  href={imgSrc} 
                  download={`gemini-output-${Date.now()}.png`}
                  className="absolute top-3 right-3 p-2.5 bg-white/90 backdrop-blur shadow-lg text-slate-700 rounded-full opacity-0 group-hover/img:opacity-100 transition-all hover:bg-indigo-600 hover:text-white"
                >
                  <Download size={18} />
                </a>
              </div>
            );
          }
          return null;
        })}

        {message.groundingChunks && message.groundingChunks.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100/50">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-widest">
              <Globe size={14} className="text-indigo-500" />
              <span>知识图谱与外部引用</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {message.groundingChunks.map((chunk, i) => chunk.web && (
                <a 
                  key={i} 
                  href={chunk.web.uri} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold border border-indigo-100 transition-all"
                >
                  <span className="truncate max-w-[140px]">{chunk.web.title}</span>
                  <Globe size={10} />
                </a>
              ))}
            </div>
          </div>
        )}

        {message.role === 'model' && message.trace && <TraceView trace={message.trace} />}

        {message.role === 'model' && (
          <div className="pt-2 flex justify-end">
            <CopyButton text={message.parts.map(p => p.text).filter(Boolean).join('\n')} />
          </div>
        )}
      </div>
    );
  };

  const getLoadingText = () => {
    switch (loadingStatus) {
      case 'generating': return '正在根据知识库创作图像...';
      case 'searching': return '正在搜索相关背景资料...';
      default: return 'Nano Banana Pro 正在思考...';
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-8 space-y-10 scrollbar-thin bg-transparent">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-full max-w-2xl mx-auto py-12">
          <div className="p-8 bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-slate-100 mb-8 transform hover:scale-105 transition-transform duration-500">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-indigo-400 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-indigo-200">
              <Sparkles size={40} />
            </div>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 mb-4 text-center tracking-tight">Nano Banana Pro</h2>
          <p className="text-slate-500 text-center mb-12 max-w-sm leading-relaxed font-medium">
            多模态智能终端。支持人物库实时注入。在对话中提及 <span className="text-indigo-600 font-bold">@名字</span> 即可自动关联知识库图像。
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            {suggestions.map((item, i) => (
              <button 
                key={i} 
                onClick={() => onSuggestionClick?.(item.text)} 
                className="group flex items-center gap-4 p-5 bg-white border border-slate-100 rounded-3xl text-left hover:border-indigo-400 hover:bg-indigo-50/50 transition-all shadow-sm hover:shadow-md"
              >
                <span className="text-indigo-500 bg-indigo-50 p-3 rounded-2xl group-hover:bg-indigo-100 transition-colors">{item.icon}</span>
                <span className="text-sm font-bold text-slate-700 leading-relaxed">
                  {buildMentionChunks(item.text, entities).map((chunk, idx) => (
                    <MentionToken key={idx} chunk={chunk} variant="suggestion" />
                  ))}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((msg) => (
        <div key={msg.id} className={`flex w-full animate-in fade-in slide-in-from-bottom-4 duration-500 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`flex max-w-[95%] md:max-w-[85%] gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg transform transition-transform hover:rotate-6 ${
                msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-100 text-indigo-600'
              }`}>
              {msg.role === 'user' ? <User size={22} /> : <Bot size={22} />}
            </div>

            <div className={`relative p-6 rounded-[2rem] shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'
              } ${msg.isError ? 'border-red-200 bg-red-50 text-red-800' : ''}`}>
              
              {renderContent(msg)}

              <div className={`absolute -bottom-6 text-[10px] text-slate-400 font-bold uppercase tracking-widest ${msg.role === 'user' ? 'right-2' : 'left-2'}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </div>
      ))}

      {isTyping && (
        <div className="flex w-full justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex max-w-[80%] gap-4 items-center">
             <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-white border border-slate-100 text-indigo-600 flex items-center justify-center shadow-md">
              <Bot size={22} className="animate-pulse" />
            </div>
            <div className="bg-white border border-slate-100 px-6 py-4 rounded-[2rem] rounded-tl-none shadow-sm flex items-center gap-4">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{getLoadingText()}</span>
            </div>
          </div>
        </div>
      )}
      <div ref={bottomRef} className="h-12" />
    </div>
  );
};

const suggestions = [
  { icon: <ImageIcon size={18} />, text: "画一张@韩立在山谷中修炼的场景，清晨薄雾与飞剑掠影" },
  { icon: <Search size={18} />, text: "分析一下这张图片里的构图与光影，重点看人物衣袍质感" },
  { icon: <Sparkles size={18} />, text: "根据我的知识库角色，写一段@韩立与@慕佩灵联手破阵的故事" },
];
