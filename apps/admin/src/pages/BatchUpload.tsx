import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { batchesApi } from '../lib/api';
import { ArrowLeft, Upload, Loader2, CheckCircle2, Copy } from 'lucide-react';

export default function BatchUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const CHUNK_SIZE = 5;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [purpose, setPurpose] = useState<'cdn' | 'toon'>('cdn');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [resultBatchId, setResultBatchId] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState('');
  const [copied, setCopied] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    setUploading(true);

    try {
      // 1. バッチを作成
      const batchRes = await batchesApi.create({ name, description, purpose });
      if (!batchRes.data.success || !batchRes.data.data) {
        throw new Error('バッチの作成に失敗しました');
      }

      const batchId = batchRes.data.data.batch_id;
      setResultBatchId(batchId);

      // 2. チャンク処理でアップロード
      const chunks: File[][] = [];
      for (let i = 0; i < files.length; i += CHUNK_SIZE) {
        chunks.push(files.slice(i, i + CHUNK_SIZE));
      }
      setUploadProgress({ current: 0, total: files.length });

      let uploaded = 0;
      for (const chunk of chunks) {
        const uploadRes = await batchesApi.upload(batchId, chunk);
        if (!uploadRes.data.success) {
          throw new Error(`アップロードに失敗しました (${uploaded + 1}枚目付近)`);
        }
        uploaded += chunk.length;
        setUploadProgress({ current: uploaded, total: files.length });
      }

      // 全チャンク完了後にstkへ1記事として記録
      await batchesApi.finalize(batchId);

      // 3. Markdown を取得
      const mdRes = await batchesApi.getMarkdown(batchId);
      if (mdRes.data.success && mdRes.data.data) {
        setMarkdown(mdRes.data.data.markdown);
      }

    } catch (error: any) {
      console.error('Upload failed:', error);
      alert('アップロードに失敗しました: ' + (error.message || '不明なエラー'));
    } finally {
      setUploading(false);
    }
  };

  const copyMarkdown = () => {
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (resultBatchId && !uploading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-500 mb-2">
            <CheckCircle2 size={32} />
          </div>
          <h1 className="text-3xl font-bold">アップロード完了！</h1>
          <p className="text-gray-500">バッチID: <span className="font-mono font-bold text-primary-600">{resultBatchId}</span></p>
        </div>

        <div className="glass p-8 rounded-3xl space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">生成された Markdown</h2>
            <button
              onClick={copyMarkdown}
              className={`flex items-center px-4 py-2 rounded-xl transition-all ${copied ? 'bg-green-500 text-white' : 'bg-primary-500 text-white hover:bg-primary-600 shadow-lg shadow-primary-200'}`}
            >
              {copied ? 'コピーしました！' : <><Copy size={18} className="mr-2" /> まとめてコピー</>}
            </button>
          </div>
          <div className="relative">
            <textarea
              readOnly
              value={markdown}
              rows={12}
              className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-100 font-mono text-sm focus:outline-none"
            />
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => {
              setResultBatchId(null);
              setMarkdown('');
              setFiles([]);
              setName('');
              setDescription('');
              setPurpose('cdn');
            }}
            className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-all"
          >
            別のバッチをアップロード
          </button>
          <Link
            to="/"
            className="flex-1 py-4 bg-primary-500 text-white rounded-2xl font-bold shadow-lg shadow-primary-200 hover:bg-primary-600 text-center transition-all"
          >
            ダッシュボードへ戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2">バッチ画像アップロード</h1>
          <p className="text-gray-500 text-sm">Webtoon や複数枚のイラストを「箱」として一括管理します。</p>
        </div>
        <Link to="/" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={24} />
        </Link>
      </div>

      <form onSubmit={handleUpload} className="space-y-6">
        <div className="glass p-8 rounded-3xl space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">バッチ名 (任意)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 植物観察 20260114"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">説明 (任意)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="バッチの内容について"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* webtoon公開トグル */}
          <div className="flex items-center justify-between p-4 rounded-2xl border border-gray-200 bg-gray-50/50">
            <div>
              <div className="font-semibold text-gray-700 text-sm">webtoonとして公開</div>
              <div className="text-xs text-gray-400 mt-0.5">tokyo86.com のフィードに表示されます</div>
            </div>
            <button
              type="button"
              onClick={() => setPurpose(purpose === 'toon' ? 'cdn' : 'toon')}
              className={`relative w-12 h-6 rounded-full transition-colors ${purpose === 'toon' ? 'bg-primary-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${purpose === 'toon' ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer border-2 border-dashed rounded-3xl p-12 text-center transition-all ${files.length > 0 ? 'border-primary-300 bg-primary-50/30' : 'border-gray-200 hover:border-primary-400 bg-gray-50/50'}`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept=".webp,.png,.jpg,.jpeg"
              className="hidden"
            />
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white shadow-sm text-gray-400">
                <Upload size={32} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-700">
                  {files.length > 0 ? `${files.length} 個のファイルを選択中` : '画像をドラッグ＆ドロップ、またはクリック'}
                </p>
                <p className="text-sm text-gray-400">マンガの原稿やイラストセットをまとめてアップロードできます</p>
              </div>
            </div>
          </div>

          {files.length > 0 && (
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-48 overflow-y-auto p-2">
              {Array.from(files).map((file, i) => (
                <div key={i} className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center relative group overflow-hidden border border-gray-200">
                  <span className="text-[10px] text-gray-400 truncate px-1">{file.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={uploading || files.length === 0}
          className="w-full py-5 bg-primary-500 text-white rounded-2xl font-bold shadow-xl shadow-primary-200 hover:bg-primary-600 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center"
        >
          {uploading ? (
            <><Loader2 className="animate-spin mr-2" size={24} /> {uploadProgress.total > 0 ? `${uploadProgress.current}/${uploadProgress.total}枚 アップロード中...` : 'アップロード中...'}</>
          ) : (
            `一括アップロードを開始する (${files.length}枚)`
          )}
        </button>
      </form>

      <div className="glass p-6 rounded-2xl bg-amber-50/50 border-amber-100">
        <h3 className="text-amber-800 font-bold flex items-center mb-2">
          💡 ヒント
        </h3>
        <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
          <li>対応形式: <code>webp / png / jpg / jpeg</code>（avifは非対応）</li>
          <li>アップロードされた画像は <code>img.tokyo86.com/ID/001.webp</code> のような形式で配信されます。</li>
          <li>IDはランダムに生成されるため、URLから前後の作品を推測される心配がありません。</li>
          <li>完了画面でコピーした Markdown をエピソード本文に貼るだけで公開できます。</li>
        </ul>
      </div>
    </div>
  );
}
