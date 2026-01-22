import React, { useEffect, useRef, useState } from 'react';
import { Trash2, BookOpen, Plus, Image as ImageIcon, Loader2, RotateCcw, Search, Database, AlertCircle, Folder, Image } from 'lucide-react';
import { Entity, SceneReference } from '../types';
import { compressImage, generateId } from '../utils';

const getNameFromPath = (path: string) => {
  const filename = path.split('/').pop() || '';
  return decodeURIComponent(filename.replace(/\.[^/.]+$/, ''));
};

interface KnowledgeBaseProps {
  entities: Entity[];
  setEntities: React.Dispatch<React.SetStateAction<Entity[]>>;
  sceneReferences: SceneReference[];
  setSceneReferences: React.Dispatch<React.SetStateAction<SceneReference[]>>;
  isScanning?: boolean;
  onRescan?: () => void;
}

export const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({
  entities,
  setEntities,
  sceneReferences,
  setSceneReferences,
  isScanning,
  onRescan
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBatchImporting, setIsBatchImporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ total: number; processed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [tempImage, setTempImage] = useState<{ base64: string, preview: string, mimeType: string } | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setIsProcessing(true);
      try {
        const { base64, mimeType } = await compressImage(file);
        setTempImage({
          base64,
          mimeType,
          preview: URL.createObjectURL(file)
        });
      } catch (err) {
        console.error(err);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleAddEntity = () => {
    if (!name.trim() || !tempImage) return;
    const newEntity: Entity = {
      id: generateId(),
      name: name.trim(),
      base64: tempImage.base64,
      imagePreview: tempImage.preview,
      mimeType: tempImage.mimeType
    };
    setEntities(prev => [newEntity, ...prev]);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setTempImage(null);
    setIsAdding(false);
  };

  const deleteEntity = (id: string) => {
    setEntities(prev => prev.filter(e => e.id !== id));
  };

  const deleteSceneReference = (id: string) => {
    setSceneReferences(prev => prev.filter(e => e.id !== id));
  };

  useEffect(() => {
    if (!folderInputRef.current) return;
    folderInputRef.current.setAttribute('webkitdirectory', '');
    folderInputRef.current.setAttribute('directory', '');
  }, []);

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    setIsBatchImporting(true);
    setBatchProgress({ total: imageFiles.length, processed: 0 });
    try {
      const existingNames = new Set(sceneReferences.map(scene => scene.name));
      const imported: SceneReference[] = [];
      let processed = 0;

      for (const file of imageFiles) {
        const relativePath = (file as any).webkitRelativePath || file.name;
        const frameName = getNameFromPath(relativePath);
        if (existingNames.has(frameName)) {
          processed += 1;
          if (processed % 20 === 0) {
            setBatchProgress({ total: imageFiles.length, processed });
          }
          continue;
        }

        const { base64, mimeType } = await compressImage(file);
        imported.push({
          id: generateId(),
          name: frameName,
          base64,
          mimeType,
          imagePreview: URL.createObjectURL(file)
        });
        existingNames.add(frameName);
        processed += 1;

        if (processed % 20 === 0) {
          setBatchProgress({ total: imageFiles.length, processed });
        }
      }

      if (imported.length > 0) {
        setSceneReferences(prev => [...imported, ...prev]);
      }
    } catch (err) {
      console.error('[KnowledgeBase] Batch import failed', err);
    } finally {
      setBatchProgress(null);
      setIsBatchImporting(false);
      if (folderInputRef.current) {
        folderInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100">
                <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 leading-none">人物知识库</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">自动资产扫描</p>
            </div>
        </div>
        <button 
          onClick={onRescan}
          disabled={isScanning}
          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all disabled:opacity-40 disabled:hover:text-slate-400 disabled:hover:bg-transparent"
          title="重新扫描目录"
        >
          <RotateCcw size={16} className={isScanning ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 scrollbar-thin pr-2">
        <input
          ref={folderInputRef}
          type="file"
          className="hidden"
          onChange={handleFolderSelect}
        />
        {isAdding ? (
          <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="space-y-4">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square bg-white rounded-xl border border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 transition-colors overflow-hidden group shadow-sm"
              >
                {tempImage ? (
                  <img src={tempImage.preview} className="w-full h-full object-cover" />
                ) : (
                  <>
                    {isProcessing ? <Loader2 className="animate-spin text-indigo-500" /> : <ImageIcon className="text-slate-400 group-hover:text-indigo-500" />}
                    <span className="text-[10px] font-bold text-slate-500 mt-2 uppercase">人物照片</span>
                  </>
                )}
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
              
              <input 
                type="text" 
                placeholder="人物名称" 
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm font-medium"
              />

              <div className="flex gap-2">
                <button 
                  onClick={handleAddEntity}
                  disabled={!name || !tempImage}
                  className="flex-1 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md active:scale-95"
                >
                  保存人物
                </button>
                <button 
                  onClick={resetForm}
                  className="px-4 py-2.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-200 transition-all"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setIsAdding(true)}
            className="w-full p-4 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center gap-3 text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition-all hover:bg-indigo-50/50 group"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform" />
            <span className="font-bold text-xs uppercase tracking-wider">添加新人物</span>
          </button>
        )}

        {entities.length === 0 && !isAdding && (
          <div className="text-center py-12 px-4 bg-slate-50/50 rounded-3xl border border-slate-100">
            <Search size={32} className="mx-auto text-slate-200 mb-4" />
            <p className="text-[10px] text-slate-400 leading-relaxed font-bold uppercase tracking-widest">
              未发现人物资产<br/>
              请手动添加或配置<br/>
              KnowledgeBase/index.json
            </p>
          </div>
        )}

        <div className="space-y-3 pb-8">
            {entities.map(entity => (
              <div key={entity.id} className="group relative flex items-center gap-4 p-3 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all hover:border-indigo-200 animate-in slide-in-from-right-2">
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-slate-100 shadow-sm bg-slate-50 flex items-center justify-center">
                  {entity.imagePreview ? (
                    <img src={entity.imagePreview} className="w-full h-full object-cover" />
                  ) : (
                    <AlertCircle size={20} className="text-amber-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-slate-800 text-sm truncate tracking-tight">{entity.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Database size={10} className="text-indigo-400" />
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${entity.imagePreview ? 'text-indigo-500' : 'text-amber-600'}`}>
                      {entity.imagePreview ? '已注入上下文' : '资产缺失'}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => deleteEntity(entity.id)}
                  className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
        </div>

        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-black text-slate-800 tracking-tight">场景参考</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">整体画风参考 · 注入一次</p>
            </div>
            <button
              onClick={() => folderInputRef.current?.click()}
              disabled={isBatchImporting}
              className="inline-flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white border border-slate-200 rounded-xl hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all disabled:opacity-40 disabled:hover:text-slate-500 disabled:hover:bg-white"
            >
              <Folder size={14} />
              批量导入
            </button>
          </div>

          {batchProgress && (
            <div className="mb-3 px-3 py-2 rounded-2xl border border-indigo-100 bg-indigo-50/60 text-[10px] font-bold uppercase tracking-widest text-indigo-600">
              正在导入场景参考：{batchProgress.processed} / {batchProgress.total}
            </div>
          )}

          {sceneReferences.length === 0 && (
            <div className="text-center py-6 px-4 bg-slate-50/50 rounded-3xl border border-slate-100">
              <Image size={26} className="mx-auto text-slate-200 mb-3" />
              <p className="text-[10px] text-slate-400 leading-relaxed font-bold uppercase tracking-widest">
                暂无场景参考图<br />
                用于整体画风参考
              </p>
            </div>
          )}

          <div className="space-y-3 pb-6">
            {sceneReferences.map(scene => (
              <div key={scene.id} className="group relative flex items-center gap-4 p-3 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all hover:border-indigo-200 animate-in slide-in-from-right-2">
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-slate-100 shadow-sm bg-slate-50 flex items-center justify-center">
                  {scene.imagePreview ? (
                    <img src={scene.imagePreview} className="w-full h-full object-cover" />
                  ) : (
                    <AlertCircle size={20} className="text-amber-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-slate-800 text-sm truncate tracking-tight">{scene.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Database size={10} className="text-indigo-400" />
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${scene.imagePreview ? 'text-indigo-500' : 'text-amber-600'}`}>
                      {scene.imagePreview ? '画风参考' : '资产缺失'}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => deleteSceneReference(scene.id)}
                  className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-auto pt-6 border-t border-slate-100">
        <div className="flex flex-col items-center gap-2">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest opacity-60">
            安全多模态追踪已开启
          </p>
          <div className="w-1 h-1 rounded-full bg-indigo-200"></div>
        </div>
      </div>
    </div>
  );
};
