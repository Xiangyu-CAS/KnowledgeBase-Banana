import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Clock3, Folder } from 'lucide-react';
import { generateId } from '../utils';

const SESSION_ACTIVE_KEY = 'comicStudioSessionActive';
const SESSION_INDEX_KEY = 'comicStudioSessionIndex';
const SESSION_PREFIX = 'comicStudioSession:';

interface SessionMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

interface ComicStudioSession {
  sessionId: string;
  name: string;
  createdAt: number;
  step: string;
  novelText: string;
  characters: any[];
  items: any[];
  storyboard: any[];
  pageRenders: Record<number, { imageUrl: string; lastUsedPrompt?: string }>;
  updatedAt: number;
}

const loadIndex = () => {
  const indexRaw = localStorage.getItem(SESSION_INDEX_KEY);
  const index = indexRaw ? (JSON.parse(indexRaw) as SessionMeta[]) : [];
  return index.sort((a, b) => b.updatedAt - a.updatedAt);
};

export const ComicSessionPanel: React.FC = () => {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  const refreshSessions = () => {
    const next = loadIndex();
    setSessions(next);
    const active = localStorage.getItem(SESSION_ACTIVE_KEY) || next[0]?.id || '';
    setActiveId(active);
  };

  const activateSession = (id: string) => {
    localStorage.setItem(SESSION_ACTIVE_KEY, id);
    setActiveId(id);
    window.dispatchEvent(new CustomEvent('comic-session-activate', { detail: { sessionId: id } }));
  };

  const createSession = () => {
    const id = generateId();
    const createdAt = Date.now();
    const name = `Session ${new Date(createdAt).toLocaleString()}`;
    const payload: ComicStudioSession = {
      sessionId: id,
      name,
      createdAt,
      step: 'input',
      novelText: '',
      characters: [],
      items: [],
      storyboard: [],
      pageRenders: {},
      updatedAt: createdAt
    };
    localStorage.setItem(`${SESSION_PREFIX}${id}`, JSON.stringify(payload));
    const existingIndex = loadIndex();
    const nextIndex = [{ id, name, createdAt, updatedAt: createdAt }, ...existingIndex.filter(session => session.id !== id)];
    localStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(nextIndex));
    activateSession(id);
    setSessions(nextIndex);
    window.dispatchEvent(new CustomEvent('comic-session-refresh'));
  };

  const deleteSession = (id: string) => {
    localStorage.removeItem(`${SESSION_PREFIX}${id}`);
    const next = sessions.filter(session => session.id !== id);
    localStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(next));
    setSessions(next);
    if (activeId === id) {
      if (next.length > 0) {
        activateSession(next[0].id);
      } else {
        createSession();
      }
    }
    window.dispatchEvent(new CustomEvent('comic-session-refresh'));
  };

  useEffect(() => {
    refreshSessions();
    const handler = () => refreshSessions();
    window.addEventListener('comic-session-refresh', handler);
    return () => window.removeEventListener('comic-session-refresh', handler);
  }, []);

  return (
    <div className="border-b border-slate-100 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg shadow-slate-200">
            <Folder size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 leading-none">会话历史</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Comic Sessions</p>
          </div>
        </div>
        <button
          onClick={createSession}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 shadow"
        >
          <Plus size={12} />
          新建
        </button>
      </div>

      <div className="mt-4 space-y-2 max-h-[280px] overflow-y-auto pr-1">
        {sessions.length === 0 ? (
          <div className="text-xs text-slate-400 bg-slate-50 rounded-2xl p-4 text-center border border-slate-100">
            暂无会话，请创建一个新会话。
          </div>
        ) : (
          sessions.map(session => {
            const isActive = session.id === activeId;
            return (
              <button
                key={session.id}
                onClick={() => activateSession(session.id)}
                className={`w-full text-left p-3 rounded-2xl border transition-all ${
                  isActive
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-100 bg-white hover:border-indigo-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{session.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                      <Clock3 size={10} />
                      <span>{new Date(session.updatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteSession(session.id);
                    }}
                    className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                    title="删除会话"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
