import { useState, useEffect, useCallback } from 'react';
import { browseApi } from '../lib/api';
import { Loader2, ChevronLeft, ChevronRight, X, Copy, Check, ExternalLink } from 'lucide-react';

const CF_HASH = 'wdR9enbrkaPsEgUtgFORrw';

interface CfImage {
  id: string;
  filename: string;
  uploaded: string;
  variants: string[];
}

function thumbUrl(id: string) {
  return `https://imagedelivery.net/${CF_HASH}/${id}/public`;
}

export default function Browse() {
  const [images, setImages] = useState<CfImage[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState<CfImage | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // 日付フィルター（フロント絞り込み）
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await browseApi.list(p);
      const data = res.data;
      if (data.success) {
        setImages(prev => p === 1 ? data.images : [...prev, ...data.images]);
        setHasMore(data.images.length === 100);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPage(next);
  };

  const copyUrl = (id: string) => {
    navigator.clipboard.writeText(thumbUrl(id));
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const filtered = images.filter(img => {
    if (!dateFrom && !dateTo) return true;
    const d = new Date(img.uploaded);
    if (dateFrom && d < new Date(dateFrom)) return false;
    if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  return (
    <>
      {/* ライトボックス */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-4xl w-full mx-4" onClick={e => e.stopPropagation()}>
            <img
              src={thumbUrl(lightbox.id)}
              alt={lightbox.filename}
              className="w-full rounded-2xl shadow-2xl max-h-[80vh] object-contain"
            />
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent rounded-b-2xl">
              <p className="text-white/80 text-xs font-mono">{lightbox.id}</p>
              <p className="text-white/60 text-xs mt-0.5">{lightbox.filename} · {new Date(lightbox.uploaded).toLocaleString('ja-JP')}</p>
            </div>
            <div className="absolute top-3 right-3 flex gap-2">
              <button
                onClick={() => copyUrl(lightbox.id)}
                className="p-2.5 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-colors backdrop-blur-sm"
                title="URLをコピー"
              >
                {copied === lightbox.id ? <Check size={16} /> : <Copy size={16} />}
              </button>
              <a
                href={thumbUrl(lightbox.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-colors backdrop-blur-sm"
                title="新しいタブで開く"
              >
                <ExternalLink size={16} />
              </a>
              <button
                onClick={() => setLightbox(null)}
                className="p-2.5 bg-black/40 text-white rounded-xl hover:bg-black/60 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 space-y-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-2xl font-bold mb-1">全画像ブラウズ</h1>
          <p className="text-gray-500 text-sm">Cloudflare Images の全画像（バッチ・単品混在）</p>
        </div>

        {/* フィルター */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">期間</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="py-2 px-3 text-sm rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary-500 outline-none"
            />
            <span className="text-gray-400 text-sm">〜</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="py-2 px-3 text-sm rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary-500 outline-none"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <span className="text-sm text-gray-400">
            {dateFrom || dateTo ? `${filtered.length} 件` : `${images.length} 件読込済`}
          </span>
        </div>

        {/* グリッド */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map(img => (
            <div
              key={img.id}
              className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 cursor-pointer hover:ring-2 hover:ring-primary-400 transition-all"
              onClick={() => setLightbox(img)}
            >
              <img
                src={thumbUrl(img.id)}
                alt={img.filename}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {/* ホバーで日付とコピーボタン */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex flex-col justify-between p-2 opacity-0 group-hover:opacity-100">
                <div className="flex justify-end">
                  <button
                    onClick={e => { e.stopPropagation(); copyUrl(img.id); }}
                    className="p-1.5 bg-white/90 text-gray-700 rounded-lg hover:bg-white transition-colors"
                    title="URLをコピー"
                  >
                    {copied === img.id ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
                <p className="text-white text-[10px] font-mono truncate">
                  {new Date(img.uploaded).toLocaleDateString('ja-JP')}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* もっと読み込む */}
        {hasMore && !dateFrom && !dateTo && (
          <div className="flex justify-center pt-4">
            <button
              onClick={loadMore}
              disabled={loading}
              className="flex items-center gap-2 px-8 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 shadow-sm"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ChevronLeft size={16} className="rotate-90" />}
              {loading ? '読み込み中...' : 'さらに読み込む（100件）'}
            </button>
          </div>
        )}

        {loading && images.length === 0 && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-primary-500" size={32} />
          </div>
        )}
      </div>
    </>
  );
}
