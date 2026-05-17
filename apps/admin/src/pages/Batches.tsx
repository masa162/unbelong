import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { batchesApi } from '../lib/api';
import { Package, Trash2, Copy, Check, Loader2, Plus, Edit2, X, Save, Download } from 'lucide-react';
import { formatDate } from '@tokyo86/shared';

interface Batch {
  id: string;
  batch_id: string;
  name: string | null;
  description: string | null;
  purpose: 'cdn' | 'toon';
  total_images: number;
  created_at: number;
  updated_at: number;
}

export default function Batches() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedBatchId, setCopiedBatchId] = useState<string | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; description: string; purpose: 'cdn' | 'toon' }>({ name: '', description: '', purpose: 'cdn' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    try {
      const res = await batchesApi.list();
      if (res.data.success) {
        setBatches(res.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (batchId: string) => {
    if (!window.confirm('このバッチを完全に削除してもよろしいですか？（バッチ内の全ての画像が Cloudflare Images からも消去されます）')) return;

    try {
      await batchesApi.delete(batchId);
      setBatches(batches.filter(b => b.batch_id !== batchId));
    } catch (error) {
      console.error('Failed to delete batch:', error);
      alert('削除に失敗しました');
    }
  };

  const downloadOriginals = async (batchId: string, totalImages: number) => {
    const CF_HASH = 'wdR9enbrkaPsEgUtgFORrw';
    try {
      const res = await batchesApi.get(batchId);
      if (!res.data.success || !res.data.data?.images) return;
      const images = res.data.data.images;
      for (const img of images) {
        const url = `https://imagedelivery.net/${CF_HASH}/${img.id}/original`;
        const a = document.createElement('a');
        a.href = url;
        a.download = `${batchId}_${String(img.sequence_number).padStart(3, '0')}.webp`;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (error) {
      console.error('Failed to download originals:', error);
    }
  };

  const copyMarkdown = async (batchId: string) => {
    try {
      const res = await batchesApi.getMarkdown(batchId);
      if (res.data.success && res.data.data) {
        navigator.clipboard.writeText(res.data.data.markdown);
        setCopiedBatchId(batchId);
        setTimeout(() => setCopiedBatchId(null), 2000);
      }
    } catch (error) {
      console.error('Failed to get markdown:', error);
    }
  };

  const startEdit = (batch: Batch) => {
    setEditingBatchId(batch.batch_id);
    setEditForm({
      name: batch.name || '',
      description: batch.description || '',
      purpose: batch.purpose || 'cdn',
    });
  };

  const cancelEdit = () => {
    setEditingBatchId(null);
    setEditForm({ name: '', description: '', purpose: 'cdn' });
  };

  const saveEdit = async (batchId: string) => {
    setSaving(true);
    try {
      const res = await batchesApi.update(batchId, {
        name: editForm.name || undefined,
        description: editForm.description || undefined,
        purpose: editForm.purpose,
      });
      if (res.data.success && res.data.data) {
        setBatches(batches.map(b => b.batch_id === batchId ? res.data.data : b));
        setEditingBatchId(null);
      }
    } catch (error) {
      console.error('Failed to update batch:', error);
      alert('更新に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-primary-500" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2">バッチ（箱）一覧</h1>
          <p className="text-gray-500 text-sm">Webtoon や大量画像を「箱」単位で管理・出力します。</p>
        </div>
        <Link
          to="/batches/new"
          className="flex items-center px-6 py-3 bg-primary-500 text-white rounded-xl shadow-lg shadow-primary-200 hover:bg-primary-600 transition-all font-bold"
        >
          <Plus size={20} className="mr-2" />
          新規バッチ作成
        </Link>
      </div>

      {batches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {batches.map((batch) => (
            <div key={batch.id} className="glass rounded-3xl overflow-hidden flex flex-col hover:shadow-xl transition-all group border border-white/50">
              {editingBatchId === batch.batch_id ? (
                // 編集モード
                <div className="p-6 flex-1 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="p-3 bg-primary-50 text-primary-500 rounded-2xl">
                      <Package size={24} />
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Batch ID</span>
                      <code className="text-sm font-mono font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded-lg">
                        {batch.batch_id}
                      </code>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">バッチ名</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        placeholder="例: 植物観察 20260414"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">説明</label>
                      <input
                        type="text"
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="バッチの内容について"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50/50">
                      <div>
                        <div className="font-semibold text-gray-700 text-xs">webtoon公開</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">tokyo86.comに表示</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditForm({ ...editForm, purpose: editForm.purpose === 'toon' ? 'cdn' : 'toon' })}
                        className={`relative w-12 h-6 rounded-full transition-colors ${editForm.purpose === 'toon' ? 'bg-primary-500' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${editForm.purpose === 'toon' ? 'translate-x-7' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => saveEdit(batch.batch_id)}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center p-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-all disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} className="mr-1.5" /> 保存</>}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center p-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50"
                    >
                      <X size={16} className="mr-1.5" /> キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                // 表示モード
                <>
                  <div className="p-6 flex-1 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="p-3 bg-primary-50 text-primary-500 rounded-2xl">
                        <Package size={24} />
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Batch ID</span>
                        <code className="text-sm font-mono font-bold text-primary-600 bg-primary-50 px-2 py-1 rounded-lg">
                          {batch.batch_id}
                        </code>
                      </div>
                    </div>

                    <div>
                      <h2 className="text-lg font-bold text-gray-800 line-clamp-1">
                        {batch.name || '無題のバッチ'}
                      </h2>
                      {batch.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{batch.description}</p>
                      )}
                      <p className="text-sm text-gray-400 mt-1">
                        {formatDate(batch.created_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 py-2 border-y border-gray-50 text-sm">
                      <div className="flex-1">
                        <span className="text-gray-400 block text-[10px] uppercase font-bold">Images</span>
                        <span className="font-bold text-gray-700">{batch.total_images} 枚</span>
                      </div>
                      <div className="flex-1">
                        <span className="text-gray-400 block text-[10px] uppercase font-bold">用途</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${batch.purpose === 'toon' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'}`}>
                          {batch.purpose === 'toon' ? 'webtoon' : 'CDN'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50/50 flex items-center justify-between gap-2">
                    <button
                      onClick={() => copyMarkdown(batch.batch_id)}
                      className={`flex-1 flex items-center justify-center p-2.5 rounded-xl transition-all shadow-sm ${copiedBatchId === batch.batch_id ? 'bg-green-500 text-white' : 'bg-white text-gray-700 hover:bg-white/80'}`}
                    >
                      {copiedBatchId === batch.batch_id ? (
                        <><Check size={16} className="mr-2" /> Copied!</>
                      ) : (
                        <><Copy size={16} className="mr-2" /> MD 出力</>
                      )}
                    </button>
                    <button
                      onClick={() => downloadOriginals(batch.batch_id, batch.total_images)}
                      className="p-2.5 bg-white text-green-600 hover:bg-green-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-green-100"
                      title="オリジナル画像をDL"
                    >
                      <Download size={18} />
                    </button>
                    <button
                      onClick={() => startEdit(batch)}
                      className="p-2.5 bg-white text-blue-600 hover:bg-blue-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-blue-100"
                      title="編集"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(batch.batch_id)}
                      className="p-2.5 bg-white text-red-500 hover:bg-red-50 rounded-xl transition-all shadow-sm border border-transparent hover:border-red-100"
                      title="削除"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
          <Package size={64} className="text-gray-200 mb-4" />
          <p className="text-gray-400 font-medium">バッチがまだありません</p>
          <Link to="/batches/new" className="mt-4 text-primary-500 font-bold hover:underline">
            最初のバッチを作成する
          </Link>
        </div>
      )}
    </div>
  );
}
