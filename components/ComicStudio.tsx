import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BookOpen, Camera, ChevronRight, Film, Image as ImageIcon, Loader2, RefreshCw, Sparkles, Trash2, Upload, Users } from 'lucide-react';
import sampleChapter from '../assets/凡人修仙传 第五卷 名震一方 第七百三十六章 破阵大战（一）.txt?raw';
import {
  extractWorkshopEntities,
  generateWorkshopImage,
  generateWorkshopStoryboard,
  WorkshopCharacter,
  WorkshopItem,
  WorkshopScene
} from '../services/comicStudioService';
import { Entity } from '../types';
import { generateId } from '../utils';

interface ComicStudioProps {
  entities: Entity[];
  onError: () => void;
  setEntities: React.Dispatch<React.SetStateAction<Entity[]>>;
}

type AppStep = 'input' | 'analysis' | 'storyboard' | 'render';

const parseDataUrl = (dataUrl?: string | null) => {
  if (!dataUrl || !dataUrl.includes('base64,')) return null;
  const [meta, data] = dataUrl.split(',');
  const match = meta.match(/data:(.*);base64/);
  const mimeType = match?.[1] || 'image/png';
  return { base64: data, mimeType };
};

const SESSION_ACTIVE_KEY = 'comicStudioSessionActive';
const SESSION_INDEX_KEY = 'comicStudioSessionIndex';
const SESSION_PREFIX = 'comicStudioSession:';

interface ComicStudioSession {
  sessionId: string;
  name: string;
  createdAt: number;
  step: AppStep;
  novelText: string;
  characters: WorkshopCharacter[];
  items: WorkshopItem[];
  storyboard: WorkshopScene[];
  pageRenders: Record<number, { imageUrl: string; lastUsedPrompt?: string }>;
  updatedAt: number;
}

export const ComicStudio: React.FC<ComicStudioProps> = ({ entities, onError, setEntities }) => {
  const [step, setStep] = useState<AppStep>('input');
  const [novelText, setNovelText] = useState('');
  const [characters, setCharacters] = useState<WorkshopCharacter[]>([]);
  const [items, setItems] = useState<WorkshopItem[]>([]);
  const [storyboard, setStoryboard] = useState<WorkshopScene[]>([]);
  const [pageRenders, setPageRenders] = useState<Record<number, { imageUrl: string; lastUsedPrompt?: string }>>({});
  const [sessionId, setSessionId] = useState<string>('');
  const [sessionName, setSessionName] = useState<string>('');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showPromptId, setShowPromptId] = useState<string | null>(null);

  const existingEntityCount = useMemo(() => entities.length, [entities]);
  const hasStoryboard = storyboard.length > 0;
  const hasRenderedImage = Object.values(pageRenders).some(page => Boolean(page.imageUrl));

  const storyboardPages = useMemo(() => {
    const pageMap = new Map<number, WorkshopScene[]>();
    storyboard.forEach(scene => {
      const pageNumber = scene.pageNumber || 1;
      if (!pageMap.has(pageNumber)) {
        pageMap.set(pageNumber, []);
      }
      pageMap.get(pageNumber)?.push(scene);
    });
    return Array.from(pageMap.entries())
      .map(([pageNumber, panels]) => ({
        pageNumber,
        panels: panels.sort((a, b) => (a.panelNumber || a.sceneNumber) - (b.panelNumber || b.sceneNumber))
      }))
      .sort((a, b) => a.pageNumber - b.pageNumber);
  }, [storyboard]);

  const navItems = [
    { id: 'input', label: '1. 小说导入', icon: BookOpen },
    { id: 'analysis', label: '2. 资产库', icon: Users },
    { id: 'storyboard', label: '3. 分镜设计', icon: Film },
    { id: 'render', label: '4. 漫画预览', icon: ImageIcon }
  ];

  const withLoading = async (msg: string, fn: () => Promise<void>) => {
    setLoading(true);
    setLoadingMsg(msg);
    setErrorMessage('');
    try {
      await fn();
    } catch (error: any) {
      console.error(error);
      if (error?.message?.includes('Requested entity was not found') || error?.status === 404) {
        onError();
        return;
      }
      setErrorMessage('操作失败，请稍后重试。');
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  const handleLoadSample = () => {
    setNovelText(sampleChapter.trim());
    setStep('input');
  };

  const persistToLocalKnowledgeBase = async (name: string, base64: string, mimeType: string) => {
    try {
      await fetch('/api/knowledge-base/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, base64, mimeType })
      });
    } catch (error) {
      console.error('[KnowledgeBase Sync] Failed to persist asset to disk', error);
    }
  };

  const pushToKnowledgeBase = async (name: string, imageUrl: string) => {
    const parsed = parseDataUrl(imageUrl);
    if (!parsed) return;
    setEntities(prev => {
      const existing = prev.find(entity => entity.name === name);
      const updated: Entity = {
        id: existing?.id || generateId(),
        name,
        base64: parsed.base64,
        mimeType: parsed.mimeType,
        imagePreview: imageUrl
      };
      if (existing) {
        return prev.map(entity => (entity.name === name ? updated : entity));
      }
      return [updated, ...prev];
    });
    await persistToLocalKnowledgeBase(name, parsed.base64, parsed.mimeType);
  };

  const handleTextAnalysis = () =>
    withLoading('正在深度解析小说文本...', async () => {
      if (!novelText.trim()) return;
      const { characters: chars, items: its } = await extractWorkshopEntities(novelText);
      setCharacters(chars);
      setItems(its);
      setStoryboard([]);
      setPageRenders({});
      setStep('analysis');
    });

  const handleGenerateStoryboard = () =>
    withLoading('正在构思漫画分镜脚本...', async () => {
      const scenes = await generateWorkshopStoryboard(novelText, characters);
      setStoryboard(scenes);
      setPageRenders({});
      setStep('storyboard');
    });

  const handleGenerateCharacterImage = (charId: string) =>
    withLoading('正在绘制角色形象设定图...', async () => {
      const char = characters.find(c => c.id === charId);
      if (!char) return;
      const refImages = entities
        .filter(entity => entity.base64 && entity.mimeType)
        .map(entity => ({ data: entity.base64 as string, mimeType: entity.mimeType as string }));
      const prompt = `${char.name} character concept art: ${char.appearance}. Half-body portrait, square 1:1 composition, anime style, clean lines, high resolution.`;
      const { imageUrl, trace } = await generateWorkshopImage(prompt, refImages, '1:1');
      const displayPrompt = `PROMPT:\n${prompt}\n\n注入参考: ${refImages.length} 张\n\nTRACE:\n${trace}`;
      setCharacters(prev =>
        prev.map(c => (
          c.id === charId
            ? { ...c, imageUrl, lastUsedPrompt: displayPrompt }
            : c
        ))
      );
      await pushToKnowledgeBase(char.name, imageUrl);
    });

  const handleUploadCharacterImage = (charId: string, file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
      const url = e.target?.result as string;
      const name = characters.find(c => c.id === charId)?.name;
      setCharacters(prev =>
        prev.map(c =>
          c.id === charId ? { ...c, imageUrl: url, lastUsedPrompt: '由用户手动上传形象参考' } : c
        )
      );
      if (name) await pushToKnowledgeBase(name, url);
    };
    reader.readAsDataURL(file);
  };

  const handleGeneratePageImage = (pageNumber: number) =>
    withLoading('正在执行整页渲染...', async () => {
      const pagePanels = storyboardPages.find(page => page.pageNumber === pageNumber)?.panels || [];
      if (pagePanels.length === 0) return;

      const refCharacters = characters.filter(c => c.imageUrl);
      const pageCharacters = characters.filter(c =>
        pagePanels.some(panel => panel.charactersInScene.some(name => c.name.includes(name)))
      );
      const charRefs = refCharacters
        .map(c => {
          const parsed = parseDataUrl(c.imageUrl);
          return parsed ? { data: parsed.base64, mimeType: parsed.mimeType } : null;
        })
        .filter(Boolean) as { data: string; mimeType: string }[];

      const charDetails =
        pageCharacters.map(c => `${c.name} (${c.appearance})`).join(', ') ||
        '关键角色未提供，保持画风统一';

      const panelLines = pagePanels
        .map((panel, index) => {
          const panelIndex = panel.panelNumber || index + 1;
          return `Panel ${panelIndex}: ${panel.description}. Dialogue: ${panel.dialogue}. Visual: ${panel.visualPrompt}.`;
        })
        .join('\n');

      const drawingPrompt = `Create a single manga page with multiple horizontal panels stacked vertically. Each panel is a full-width row. Page ${pageNumber} panels:\n${panelLines}\nCharacters focus: ${charDetails}. Keep consistent styling across panels and prior pages.`;
      const { imageUrl, trace } = await generateWorkshopImage(drawingPrompt, charRefs);

      const displayPrompt = `【整页渲染】\n- 注入角色库: ${charRefs.length} 张参考\n- 关注角色: ${pageCharacters.map(c => c.name).join('、') || '未指定'}\n- 发送指令: ${drawingPrompt}\n\nTRACE:\n${trace}`;

      setPageRenders(prev => ({
        ...prev,
        [pageNumber]: {
          imageUrl,
          lastUsedPrompt: displayPrompt
        }
      }));
    });

  const handleJumpToRender = () => {
    if (hasRenderedImage) {
      setStep('render');
    }
  };

  const renderEmptyState = (icon: React.ReactNode, text: string) => (
    <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700/50 rounded-2xl py-10 text-slate-400 bg-slate-900/40">
      <div className="mb-3">{icon}</div>
      <p className="text-sm font-semibold text-center max-w-md">{text}</p>
    </div>
  );

  useEffect(() => {
    setCharacters(prev => {
      if (!entities.length || prev.length === 0) return prev;
      let updated = false;
      const next = prev.map(char => {
        if (char.imageUrl) return char;
        const match = entities.find(e => e.name === char.name && e.base64);
        if (!match) return char;
        updated = true;
        return {
          ...char,
          imageUrl: `data:${match.mimeType};base64,${match.base64}`,
          lastUsedPrompt: '来源：人物知识库自动导入'
        };
      });
      return updated ? next : prev;
    });
  }, [entities, characters]);

  const resetSessionState = () => {
    setStep('input');
    setNovelText('');
    setCharacters([]);
    setItems([]);
    setStoryboard([]);
    setPageRenders({});
  };

  const loadSession = (id: string) => {
    try {
      const raw = localStorage.getItem(`${SESSION_PREFIX}${id}`);
      if (!raw) return;
      const data = JSON.parse(raw) as ComicStudioSession;
      setSessionId(data.sessionId);
      setSessionName(data.name || '未命名会话');
      setStep(data.step || 'input');
      setNovelText(data.novelText || '');
      setCharacters(data.characters || []);
      setItems(data.items || []);
      setStoryboard(data.storyboard || []);
      setPageRenders(data.pageRenders || {});
      setLastSavedAt(data.updatedAt || null);
      localStorage.setItem(SESSION_ACTIVE_KEY, data.sessionId);
    } catch (error) {
      console.error('[ComicStudio] Failed to load session', error);
    }
  };

  const dispatchSessionRefresh = () => {
    window.dispatchEvent(new CustomEvent('comic-session-refresh'));
  };

  const createSession = () => {
    const id = generateId();
    const createdAt = Date.now();
    const name = `Session ${new Date(createdAt).toLocaleString()}`;
    setSessionId(id);
    setSessionName(name);
    setLastSavedAt(null);
    resetSessionState();
    localStorage.setItem(SESSION_ACTIVE_KEY, id);
    dispatchSessionRefresh();
  };

  useEffect(() => {
    try {
      const activeId = localStorage.getItem(SESSION_ACTIVE_KEY);
      if (activeId) {
        loadSession(activeId);
        return;
      }
      const indexRaw = localStorage.getItem(SESSION_INDEX_KEY);
      const index = indexRaw ? (JSON.parse(indexRaw) as { id: string }[]) : [];
      if (index.length > 0) {
        loadSession(index[0].id);
        return;
      }
      createSession();
    } catch (error) {
      console.error('[ComicStudio] Failed to restore session index', error);
      createSession();
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    try {
      const now = Date.now();
      const payload: ComicStudioSession = {
        sessionId,
        name: sessionName || '未命名会话',
        createdAt: now,
        step,
        novelText,
        characters,
        items,
        storyboard,
        pageRenders,
        updatedAt: now
      };
      localStorage.setItem(`${SESSION_PREFIX}${sessionId}`, JSON.stringify(payload));
      const indexRaw = localStorage.getItem(SESSION_INDEX_KEY);
      const index = indexRaw ? (JSON.parse(indexRaw) as { id: string; name: string; createdAt: number; updatedAt: number }[]) : [];
      const existing = index.find(item => item.id === sessionId);
      const createdAt = existing?.createdAt || now;
      const nextIndex = [
        {
          id: sessionId,
          name: payload.name,
          createdAt,
          updatedAt: now
        },
        ...index.filter(session => session.id !== sessionId)
      ];
      localStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(nextIndex));
      localStorage.setItem(SESSION_ACTIVE_KEY, sessionId);
      setLastSavedAt(now);
      dispatchSessionRefresh();
    } catch (error) {
      console.error('[ComicStudio] Failed to persist session', error);
    }
  }, [sessionId, sessionName, step, novelText, characters, items, storyboard, pageRenders]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ sessionId?: string }>;
      const nextId = customEvent.detail?.sessionId;
      if (!nextId || nextId === sessionId) return;
      loadSession(nextId);
    };
    window.addEventListener('comic-session-activate', handler);
    return () => window.removeEventListener('comic-session-activate', handler);
  }, [sessionId]);

  return (
    <div className="h-full overflow-y-auto bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-900/60 bg-slate-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="text-white w-6 h-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">AI Comic Studio</p>
              <h1 className="text-xl font-bold">短剧创作工坊 · 分镜到出图一站式</h1>
              <p className="text-xs text-slate-500">知识库已有 {existingEntityCount} 个角色资产</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            {sessionId && (
              <div className="text-xs text-slate-500 text-right">
                <p>{sessionName || `Session ${sessionId.slice(0, 8)}`}</p>
                <p>{lastSavedAt ? `已保存 ${new Date(lastSavedAt).toLocaleTimeString()}` : '本地自动保存'}</p>
              </div>
            )}
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setStep(item.id as AppStep)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                  step === item.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                <item.icon size={16} />
                {item.label}
              </button>
            ))}
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-indigo-300">
              <Loader2 className="animate-spin" size={18} />
              <span className="text-xs">{loadingMsg}</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {errorMessage && (
          <div className="flex items-center gap-2 bg-rose-950/60 border border-rose-800 text-rose-100 px-4 py-3 rounded-xl">
            <AlertCircle size={16} />
            <span className="text-sm">{errorMessage}</span>
          </div>
        )}

        {step === 'input' && (
          <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-slate-950/50 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-100">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold">导入小说章节</h2>
                  <p className="text-xs text-slate-400">粘贴或上传 TXT，作为后续分镜和生图的唯一底稿</p>
                </div>
              </div>
              <button
                onClick={handleLoadSample}
                className="hidden sm:inline-flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg text-xs text-slate-200 border border-slate-700 hover:border-indigo-500 hover:text-white transition-all"
              >
                <RefreshCw size={14} className="text-indigo-300" />
                导入示例章节
              </button>
            </div>

            <textarea
              className="w-full h-[260px] rounded-xl bg-slate-950/60 border border-slate-800 text-slate-100 px-4 py-3 text-sm leading-relaxed focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 outline-none"
              placeholder="在此处粘贴小说原文..."
              value={novelText}
              onChange={(e) => setNovelText(e.target.value)}
            />

            <div className="flex flex-wrap gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-lg text-xs border border-slate-700 hover:border-slate-500 transition-all">
                <Upload size={14} />
                选择 TXT 文件
                <input
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (re) => {
                        setNovelText(re.target?.result as string);
                        setCharacters([]);
                        setItems([]);
                        setStoryboard([]);
                        setPageRenders({});
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </label>
              <button
                onClick={() => setNovelText('')}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs border border-slate-800 text-slate-400 hover:text-rose-200 hover:border-rose-700 transition-all"
              >
                <Trash2 size={14} />
                清空文本
              </button>
              <button
                onClick={() => setStep('analysis')}
                disabled={!novelText.trim()}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  novelText.trim()
                    ? 'bg-slate-100 text-slate-900 hover:bg-white shadow'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <ChevronRight size={14} />
                跳过解析，直接去资产库
              </button>
              <button
                onClick={handleTextAnalysis}
                disabled={!novelText.trim() || loading}
                className="ml-auto inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                立即开始 AI 智能分析
              </button>
            </div>
          </section>
        )}

        {step === 'analysis' && (
          <section className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-slate-950/40 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-100">
                    <Users size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">角色资产库</h3>
                    <p className="text-xs text-slate-400">含身份设定、外貌细节，可生成或上传形象参考</p>
                  </div>
                </div>
                <button
                  onClick={handleGenerateStoryboard}
                  disabled={characters.length === 0 || loading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-900 hover:bg-white shadow disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="animate-spin" size={14} /> : <Film size={14} />}
                  下一步：生成分镜
                </button>
              </div>

              {characters.length === 0
                ? renderEmptyState(<Users className="text-slate-600" />, '尚未有角色，请返回“导入”步骤执行 AI 解析。')
                : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {characters.map((char) => (
                      <div key={char.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-800 bg-slate-900 flex items-center justify-center">
                              {char.imageUrl ? (
                                <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover" />
                              ) : (
                                <Camera className="text-slate-600" size={24} />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-white">{char.name}</p>
                              <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">{char.role}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleGenerateCharacterImage(char.id)}
                              disabled={loading}
                              className="px-3 py-1.5 rounded-lg text-xs bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-50"
                            >
                              生成形象
                            </button>
                            <label className="cursor-pointer px-3 py-1.5 rounded-lg text-xs border border-slate-700 text-slate-200 hover:border-indigo-400 transition-all">
                              上传
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleUploadCharacterImage(char.id, e.target.files?.[0])}
                              />
                            </label>
                          </div>
                        </div>
                        <p className="text-sm text-slate-200 leading-relaxed">{char.description}</p>
                        <p className="text-sm text-slate-400 leading-relaxed">外貌：{char.appearance}</p>
                        {char.lastUsedPrompt && (
                          <details className="text-xs text-slate-500 bg-slate-900/70 border border-slate-800 rounded-lg p-3">
                            <summary className="cursor-pointer text-slate-300">查看提示词</summary>
                            <p className="mt-2 whitespace-pre-wrap">{char.lastUsedPrompt}</p>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-slate-950/40 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-100">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-bold">重要物品</h3>
                  <p className="text-xs text-slate-400">道具、神器或信物，可作为剧情锚点</p>
                </div>
              </div>

              {items.length === 0
                ? renderEmptyState(<Sparkles className="text-slate-600" />, '暂无物品信息，确保原文中有提及后重新解析。')
                : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {items.map(item => (
                      <div key={item.id} className="p-4 rounded-lg border border-slate-800 bg-slate-950/50">
                        <p className="font-semibold text-white">{item.name}</p>
                        <p className="text-sm text-slate-400 mt-1 leading-relaxed">{item.description}</p>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </section>
        )}

        {step === 'storyboard' && (
          <section className="space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl shadow-slate-950/40">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-100">
                    <Film size={18} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">分镜脚本</h3>
                    <p className="text-xs text-slate-400">中文对白 + 英文视觉提示词，自动保证故事连贯</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleGenerateStoryboard}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-900 hover:bg-white shadow disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                    重新生成
                  </button>
                  <button
                    onClick={handleJumpToRender}
                    disabled={!hasRenderedImage}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border border-slate-700 text-slate-200 hover:border-indigo-400 transition-all disabled:opacity-50"
                  >
                    <ChevronRight size={14} />
                    前往漫画预览
                  </button>
                </div>
              </div>

              {!hasStoryboard
                ? renderEmptyState(<Film className="text-slate-600" />, '暂无分镜，请先生成脚本。')
                : (
                  <div className="space-y-4">
                    {storyboardPages.map(page => {
                      const pageRender = pageRenders[page.pageNumber];
                      return (
                        <div key={`page-${page.pageNumber}`} className="p-5 rounded-xl border border-slate-800 bg-slate-950/60 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="px-3 py-1 rounded-full bg-slate-800 text-xs text-slate-200 border border-slate-700">
                                第 {page.pageNumber} 页
                              </div>
                              <p className="text-sm text-slate-300">共 {page.panels.length} 个 panel</p>
                            </div>
                            <button
                              onClick={() => handleGeneratePageImage(page.pageNumber)}
                              disabled={loading}
                              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-50"
                            >
                              {loading ? <Loader2 className="animate-spin" size={14} /> : <ImageIcon size={14} />}
                              生成整页
                            </button>
                          </div>
                          <div className="space-y-3">
                            {page.panels.map(panel => (
                              <div key={panel.id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 space-y-2">
                                <div className="flex items-center gap-3 text-xs text-slate-300">
                                  <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                                    Panel {panel.panelNumber || panel.sceneNumber}
                                  </span>
                                  <span>{panel.location}</span>
                                </div>
                                <p className="text-sm text-slate-200 leading-relaxed">分镜：{panel.description}</p>
                                <p className="text-sm text-slate-300 leading-relaxed">对白：{panel.dialogue}</p>
                                <p className="text-xs text-slate-400">角色：{panel.charactersInScene.join('、 ') || '无明确角色'}</p>
                                <details
                                  className="text-xs text-slate-400 bg-slate-900/70 border border-slate-800 rounded-lg p-3"
                                  open={showPromptId === panel.id}
                                  onToggle={(e) => setShowPromptId(e.currentTarget.open ? panel.id : null)}
                                >
                                  <summary className="cursor-pointer text-slate-300">视觉提示词 (英文)</summary>
                                  <p className="mt-2 whitespace-pre-wrap">{panel.visualPrompt}</p>
                                </details>
                              </div>
                            ))}
                          </div>
                          {pageRender?.imageUrl && (
                            <div className="relative group">
                              <img
                                src={pageRender.imageUrl}
                                alt={`page-${page.pageNumber}`}
                                className="w-full rounded-xl border border-slate-800 shadow-lg"
                              />
                              {pageRender.lastUsedPrompt && (
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all p-4 overflow-y-auto text-xs text-slate-200 rounded-xl">
                                  <p className="whitespace-pre-wrap">{pageRender.lastUsedPrompt}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
            </div>
          </section>
        )}

        {step === 'render' && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-100">
                <ImageIcon size={18} />
              </div>
              <div>
                <h3 className="text-lg font-bold">漫画预览</h3>
                <p className="text-xs text-slate-400">已结合上一镜画风和角色形象，确保时序一致</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setStep('storyboard')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border border-slate-700 text-slate-200 hover:border-indigo-400 transition-all"
                >
                  返回分镜设计
                </button>
              </div>
            </div>

            {!hasRenderedImage
              ? renderEmptyState(<ImageIcon className="text-slate-600" />, '暂无已渲染的画面，请回到“分镜设计”生成每一镜头。')
              : (
                <div className="grid grid-cols-1 gap-4">
                  {storyboardPages
                    .filter(page => pageRenders[page.pageNumber]?.imageUrl)
                    .map(page => {
                      const pageRender = pageRenders[page.pageNumber];
                      return (
                        <div key={`render-page-${page.pageNumber}`} className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                          <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-slate-300">
                              <Film size={14} />
                              <span>第 {page.pageNumber} 页 · {page.panels.length} panels</span>
                            </div>
                            <a
                              href={pageRender?.imageUrl}
                              download={`page-${page.pageNumber}.png`}
                              className="px-3 py-1.5 rounded-lg text-xs border border-slate-700 text-slate-200 hover:border-indigo-400 transition-all"
                            >
                              下载
                            </a>
                          </div>
                          <img src={pageRender?.imageUrl} alt={`render-page-${page.pageNumber}`} className="w-full border-t border-slate-800" />
                          {pageRender?.lastUsedPrompt && (
                            <div className="p-4 text-xs text-slate-400 whitespace-pre-wrap border-t border-slate-800">
                              {pageRender.lastUsedPrompt}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            {storyboardPages.some(page => !pageRenders[page.pageNumber]?.imageUrl) && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-200">继续生成剩余页面</h4>
                  <button
                    onClick={() => setStep('storyboard')}
                    className="text-xs text-indigo-300 hover:text-indigo-200"
                  >
                    前往分镜页
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {storyboardPages
                    .filter(page => !pageRenders[page.pageNumber]?.imageUrl)
                    .map(page => (
                      <div key={`render-queue-${page.pageNumber}`} className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/60">
                        <div className="text-sm text-slate-300">第 {page.pageNumber} 页 · {page.panels.length} panels</div>
                        <button
                          onClick={() => handleGeneratePageImage(page.pageNumber)}
                          disabled={loading}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-50"
                        >
                          {loading ? <Loader2 className="animate-spin" size={14} /> : <ImageIcon size={14} />}
                          生成整页
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};
