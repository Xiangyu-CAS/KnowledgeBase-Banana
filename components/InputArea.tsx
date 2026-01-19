import React, { useRef, useState, KeyboardEvent, useEffect } from 'react';
import { Paperclip, Send, X, Loader2, AtSign, Users, Sparkles, Image as ImageIcon } from 'lucide-react';
import { Attachment, Entity } from '../types';
import { compressImage } from '../utils';

interface InputAreaProps {
  onSend: (text: string, attachments: Attachment[], mentions: Entity[]) => void;
  isLoading: boolean;
  entities: Entity[];
}

export const InputArea: React.FC<InputAreaProps> = ({ onSend, isLoading, entities }) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedMentions, setSelectedMentions] = useState<Entity[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mentionListRef.current && !mentionListRef.current.contains(event.target as Node)) {
        setShowMentionList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }
      setIsProcessing(true);
      try {
        const { base64, mimeType } = await compressImage(file);
        const newAttachment: Attachment = {
          file,
          previewUrl: URL.createObjectURL(file),
          base64,
          mimeType,
        };
        setAttachments((prev) => [...prev, newAttachment]);
      } catch (err) {
        console.error("Error processing file", err);
      } finally {
        setIsProcessing(false);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const newAtts = [...prev];
      URL.revokeObjectURL(newAtts[index].previewUrl);
      newAtts.splice(index, 1);
      return newAtts;
    });
  };

  const handleSend = () => {
    if ((!text.trim() && attachments.length === 0) || isLoading || isProcessing) return;
    
    // Pass the mentions list so service knows which entities to inject
    onSend(text, attachments, selectedMentions);
    
    setText('');
    setAttachments([]);
    setSelectedMentions([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const addMention = (entity: Entity) => {
    // If the name is already in the list, don't add duplicate metadata
    if (!selectedMentions.find(m => m.id === entity.id)) {
      setSelectedMentions(prev => [...prev, entity]);
    }
    
    // Find the '@' that triggered this and replace it with the name
    const cursorPosition = textareaRef.current?.selectionStart || 0;
    const lastAtPos = text.lastIndexOf('@', cursorPosition - 1);
    
    if (lastAtPos !== -1) {
      const newText = text.substring(0, lastAtPos) + `@${entity.name} ` + text.substring(cursorPosition);
      setText(newText);
    } else {
      setText(prev => prev + `@${entity.name} `);
    }
    
    setShowMentionList(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (showMentionList) {
        const firstFiltered = filteredEntities[0];
        if (firstFiltered) {
          addMention(firstFiltered);
          e.preventDefault();
        }
      } else {
        e.preventDefault();
        handleSend();
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    
    // Simple mention detection
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = val.substring(0, cursorPosition);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIdx !== -1 && lastAtIdx === textBeforeCursor.length - 1) {
      setShowMentionList(true);
      setMentionFilter('');
    } else if (showMentionList) {
      const filter = textBeforeCursor.substring(lastAtIdx + 1);
      if (filter.includes(' ')) {
        setShowMentionList(false);
      } else {
        setMentionFilter(filter);
      }
    }

    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const filteredEntities = entities.filter(e => 
    e.name.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  // Function to render text with highlighted mentions (for UI only)
  const renderHighlightedText = () => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => {
      const entity = entities.find(e => `@${e.name}` === part);
      if (entity) {
        return <span key={i} className="text-indigo-600 font-bold bg-indigo-50 px-1 rounded mx-px">@{entity.name}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 relative">
      {/* Mention List Popover */}
      {showMentionList && (
        <div 
          ref={mentionListRef}
          className="absolute bottom-full left-4 mb-2 w-72 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Users size={12} /> 提及人物
            </span>
            <button onClick={() => setShowMentionList(false)} className="text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filteredEntities.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 italic">
                知识库中未找到 "{mentionFilter}"
              </div>
            ) : (
              filteredEntities.map(entity => (
                <button
                  key={entity.id}
                  onClick={() => addMention(entity)}
                  className="w-full flex items-center gap-3 p-2 hover:bg-indigo-50 rounded-xl transition-colors text-left group"
                >
                  <img src={entity.imagePreview} className="w-10 h-10 rounded-lg object-cover border border-slate-100" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600">{entity.name}</p>
                    <p className="text-[10px] text-slate-400">已学习的人物</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Attachments UI */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          {attachments.map((att, index) => (
            <div key={index} className="relative group flex-shrink-0 animate-in zoom-in-95">
              <img
                src={att.previewUrl}
                alt="preview"
                className="h-16 w-16 object-cover rounded-xl border-2 border-white shadow-md hover:scale-105 transition-transform"
              />
              <button
                onClick={() => removeAttachment(index)}
                className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-1 shadow-lg hover:bg-red-500 transition-colors"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Advanced Input Container */}
      <div className="relative bg-white border border-slate-200 rounded-3xl shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 transition-all">
        {/* Mirror div for highlighting (optional but looks nice) */}
        <div className="flex items-end p-2 px-3">
          <div className="flex gap-1 mb-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
              title="上传图片"
              disabled={isLoading || isProcessing}
            >
              {isProcessing ? <Loader2 size={20} className="animate-spin text-indigo-600" /> : <Paperclip size={20} />}
            </button>
            <button
              onClick={() => { setShowMentionList(!showMentionList); setMentionFilter(''); }}
              className={`p-2 rounded-full transition-colors ${showMentionList ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
              title="提及人物库"
              disabled={isLoading || isProcessing || entities.length === 0}
            >
              <AtSign size={20} />
            </button>
          </div>

          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" />

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，使用 @ 来提及知识库里的人物..."
            className="w-full max-h-48 py-2.5 px-3 bg-transparent border-none focus:ring-0 resize-none text-slate-800 placeholder-slate-400 text-sm leading-relaxed scrollbar-thin"
            rows={1}
            disabled={isLoading || isProcessing}
          />

          <button
            onClick={handleSend}
            disabled={(!text.trim() && attachments.length === 0) || isLoading || isProcessing}
            className={`p-2.5 rounded-2xl flex-shrink-0 transition-all mb-1 ${
              (!text.trim() && attachments.length === 0) || isLoading || isProcessing
                ? 'bg-slate-100 text-slate-300'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 active:scale-95'
            }`}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
      
      <div className="flex justify-center gap-4 mt-2 px-2">
         <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1 uppercase tracking-wider opacity-60">
           <Sparkles size={10} className="text-indigo-400" /> 支持多人物位置感知
         </p>
         <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1 uppercase tracking-wider opacity-60">
           <ImageIcon size={10} className="text-indigo-400" /> 输入 @ 快速选择
         </p>
      </div>
    </div>
  );
};