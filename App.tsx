
import React, { useEffect, useState } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { ComicSessionPanel } from './components/ComicSessionPanel';
import { KnowledgeBase } from './components/KnowledgeBase';
import { ComicStudio } from './components/ComicStudio';
import { ShieldCheck, Menu, X, RefreshCw, AlertCircle, Sparkles, LayoutGrid } from 'lucide-react';
import { Entity } from './types';
import { compressImage } from './utils';

const discoveredAssets = import.meta.glob(
  '/KnowledgeBase/**/*.{png,jpg,jpeg,webp,gif}',
  { eager: true, query: '?url', import: 'default' }
) as Record<string, string>;

/**
 * Robustly processes an asset by attempting various URL variations.
 * Handles encoding for Chinese characters and path relative/absolute formats.
 */
const processDiscoveredEntity = async (name: string, imagePath: string): Promise<Entity> => {
  // Normalize path: if it starts with 'KnowledgeBase/KnowledgeBase', fix it.
  let normalizedPath = imagePath;
  if (normalizedPath.startsWith('KnowledgeBase/KnowledgeBase/')) {
    normalizedPath = normalizedPath.replace('KnowledgeBase/KnowledgeBase/', 'KnowledgeBase/');
  }

  // URL Encode the path while preserving slashes
  const encodedPath = normalizedPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
  
  const variations = [
    normalizedPath,          // Try original (browser often handles this)
    encodedPath,             // Try fully encoded
    `./${normalizedPath}`,    // Explicit relative
    `./${encodedPath}`,      // Explicit relative encoded
    `/${normalizedPath}`,     // Absolute
    `/${encodedPath}`        // Absolute encoded
  ];

  let response: Response | null = null;
  let successUrl = '';

  for (const url of variations) {
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (res.ok) {
        response = res;
        successUrl = url;
        break;
      }
    } catch (e) {
      // Continue
    }
  }

  if (!response || !response.ok) {
    console.warn(`[Asset Discovery] Failed to load "${name}" at path: ${imagePath}`);
    return {
      id: `discovered_${name}_missing`,
      name,
      imagePreview: '',
      base64: '',
      mimeType: 'application/octet-stream'
    };
  }

  try {
    const blob = await response.blob();
    const extension = imagePath.split('.').pop()?.toLowerCase() || 'jpg';
    const file = new File([blob], `${name}.${extension}`, { type: blob.type || 'image/jpeg' });
    
    const { base64, mimeType } = await compressImage(file);
    const previewUrl = URL.createObjectURL(blob);
    
    console.log(`[Asset Discovery] Successfully loaded: ${name} -> ${successUrl}`);
    
    return {
      id: `ent_${Math.random().toString(36).substr(2, 9)}`,
      name,
      imagePreview: previewUrl,
      base64,
      mimeType
    };
  } catch (e) {
    console.error(`[Asset Discovery] Error processing data for: ${name}`, e);
    return {
      id: `err_${name}`,
      name,
      imagePreview: '',
      base64: '',
      mimeType: ''
    };
  }
};

const getNameFromPath = (path: string) => {
  const filename = path.split('/').pop() || '';
  return decodeURIComponent(filename.replace(/\.[^/.]+$/, ''));
};

export default function App() {
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'comic'>('chat');
  const envApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

  const checkKey = async () => {
    if (envApiKey) {
      setHasKey(true);
      setIsLoading(false);
      return;
    }
    if (window.aistudio) {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasKey(selected);
    }
    setIsLoading(false);
  };

  const scanKnowledgeBase = async () => {
    setIsScanning(true);
    try {
      const manifestUrl = 'KnowledgeBase/index.json';
      const response = await fetch(manifestUrl, { cache: 'no-cache' });

      const manifestEntries: { name: string; path: string }[] = [];
      if (response.ok) {
        const manifest = await response.json();
        console.log("[Asset Discovery] Manifest loaded:", manifest);

        (manifest.characters || []).forEach((char: any) => {
          const fullPath = char.path.startsWith('KnowledgeBase/')
            ? char.path
            : `KnowledgeBase/${char.path}`;
          manifestEntries.push({ name: char.name, path: fullPath });
        });
      }

      const folderEntries = Object.entries(discoveredAssets).map(([assetPath, url]) => ({
        name: getNameFromPath(assetPath),
        path: url
      }));

      const discoveryPromises = [...manifestEntries, ...folderEntries].map((entry) =>
        processDiscoveredEntity(entry.name, entry.path)
      );

      const results = await Promise.all(discoveryPromises);

      setEntities(prev => {
        const uniqueMap = new Map();
        // Keep existing entities first
        prev.forEach(item => uniqueMap.set(item.name, item));
        // Merge new scanned results, prioritizing those with valid previews
        results.forEach(item => {
          const existing = uniqueMap.get(item.name);
          if (!existing || item.imagePreview) {
            uniqueMap.set(item.name, item);
          }
        });
        return Array.from(uniqueMap.values());
      });
    } catch (e) {
      console.error("[Asset Discovery] Error during scan:", e);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      console.info('[Env] GEMINI_API_KEY injected:', Boolean(envApiKey));
      await checkKey();
      const savedEntities = localStorage.getItem('gemini_knowledge_base');
      if (savedEntities) {
        try {
          const parsed = JSON.parse(savedEntities);
          const valid = parsed.map((e: Entity) => ({
            ...e,
            imagePreview: e.base64 ? `data:${e.mimeType};base64,${e.base64}` : ''
          }));
          setEntities(valid);
        } catch (e) {
          console.error("Failed to load cached knowledge base", e);
        }
      }
      scanKnowledgeBase();
    };
    init();
  }, []);

  useEffect(() => {
    if (entities.length > 0) {
      const toSave = entities.map(e => ({ ...e, imagePreview: '' })); // Don't save blob URLs
      localStorage.setItem('gemini_knowledge_base', JSON.stringify(toSave));
    }
  }, [entities]);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        setHasKey(true);
      } catch (e) {
        console.error("Error selecting key:", e);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <RefreshCw className="animate-spin text-indigo-500" size={48} />
      </div>
    );
  }

  if (!hasKey) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
        <div className="w-24 h-24 bg-indigo-600 rounded-3xl mb-8 flex items-center justify-center shadow-2xl shadow-indigo-500/20">
          <Menu size={48} className="text-white" />
        </div>
        <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Nano Banana Pro</h1>
        <p className="text-slate-400 mb-8 max-w-md">Multi-modal intelligent terminal with Just-in-Time Knowledge Injection.</p>
        <button 
          onClick={handleSelectKey} 
          className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-xl transition-all active:scale-95"
        >
          Activate Terminal
        </button>
      </div>
    );
  }

  const activeCount = entities.filter(e => e.imagePreview).length;
  const missingCount = entities.length - activeCount;

  return (
    <div className="h-screen w-full bg-white flex overflow-hidden font-sans">
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed top-4 left-4 z-50 p-3 bg-white rounded-2xl shadow-xl md:hidden border border-slate-200"
      >
        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <div className={`
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        fixed md:relative md:translate-x-0 z-40 h-full w-80 bg-white border-r border-slate-100 transition-transform duration-300 ease-in-out flex-shrink-0 flex flex-col
      `}>
        {activeTab === 'comic' && <ComicSessionPanel />}
        <div className="flex-1 min-h-0">
          <KnowledgeBase entities={entities} setEntities={setEntities} isScanning={isScanning} onRescan={scanKnowledgeBase} />
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-slate-50/20">
        <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('chat')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'chat'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                    : 'bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300'
                }`}
              >
                <Sparkles size={12} />
                对话
              </button>
              <button
                onClick={() => setActiveTab('comic')}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'comic'
                    ? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
                    : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <LayoutGrid size={12} />
                AI 漫画
              </button>
            </div>

            <div className="hidden md:flex items-center gap-2">
              {isScanning ? (
                <div className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-full border border-indigo-100 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm">
                  <RefreshCw size={12} className="animate-spin" /> Synchronizing Assets...
                </div>
              ) : (
                <>
                  <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full border border-emerald-100 text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2">
                    <ShieldCheck size={12} /> {activeCount} Neural Nodes Ready
                  </div>
                  {missingCount > 0 && (
                    <div className="bg-amber-50 text-amber-700 px-4 py-2 rounded-full border border-amber-100 text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-2">
                      <AlertCircle size={12} /> {missingCount} Offline
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === 'chat' ? (
            <ChatInterface onError={() => setHasKey(false)} entities={entities} />
          ) : (
            <ComicStudio onError={() => setHasKey(false)} entities={entities} setEntities={setEntities} />
          )}
        </div>
      </div>
    </div>
  );
}
