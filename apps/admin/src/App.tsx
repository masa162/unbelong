import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Image as ImageIcon, BookOpen, Settings, LogOut, Menu, Upload, Loader2, Copy, Check, Trash2, Square, CheckSquare } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { imageApi, worksApi, episodesApi, illustrationsApi } from './lib/api';
import { getImageUrl } from '@tokyo86/shared';
import IllustrationsPage from './pages/Illustrations';
import IllustrationNewPage from './pages/IllustrationNew';
import IllustrationEditPage from './pages/IllustrationEdit';
import WorksPage from './pages/Works';
import EpisodesPage from './pages/Episodes';
import EpisodeNewPage from './pages/EpisodeNew';
import EpisodeEditPage from './pages/EpisodeEdit';
import BatchUpload from './pages/BatchUpload';
import BatchesPage from './pages/Batches';
import BrowsePage from './pages/Browse';
import WorkNewPage from './pages/WorkNew';
import WorkEditPage from './pages/WorkEdit';

// ダッシュボードページ
const Dashboard = () => {
  const [uploading, setUploading] = useState(false);
  const [lastImageId, setLastImageId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({ works: 0, episodes: 0, illustrations: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [images, setImages] = useState<any[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pasteUploading, setPasteUploading] = useState(false);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.items || [])
        .find(item => item.type.startsWith('image/'))
        ?.getAsFile();
      if (!file) return;

      setPasteUploading(true);
      try {
        const response = await imageApi.upload(file);
        if (response.data.success && response.data.data) {
          setLastImageId(response.data.data.id);
          const imgRes = await imageApi.list();
          if (imgRes.data.success) setImages(imgRes.data.data || []);
        }
      } catch (error: any) {
        const data = error.response?.data;
        const details = data?.details ? JSON.stringify(data.details) : (data?.error || error.message);
        alert(`ペーストアップロードに失敗しました\n\n【詳細】\n${details}`);
      } finally {
        setPasteUploading(false);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [works, episodes, illustrations] = await Promise.all([
          worksApi.list(),
          episodesApi.list(),
          illustrationsApi.list()
        ]);
        setStats({
          works: works.data.data?.length || 0,
          episodes: episodes.data.data?.length || 0,
          illustrations: illustrations.data.data?.length || 0,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      setLoadingImages(true);
      const response = await imageApi.list();
      if (response.data.success) {
        setImages(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch images:', error);
    } finally {
      setLoadingImages(false);
    }
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDeleteImage = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('この画像を完全に削除してもよろしいですか？（Cloudflare Imagesからも消去されます）')) return;

    try {
      setIsDeleting(true);
      const res = await imageApi.delete(id);
      if (res.data.success) {
        setImages(prev => prev.filter(img => img.id !== id));
        setSelectedIds(prev => prev.filter(i => i !== id));
        if (lastImageId === id) setLastImageId(null);
      }
    } catch (error) {
      console.error('Failed to delete image:', error);
      alert('削除に失敗しました');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`${selectedIds.length}枚の画像を完全に削除してもよろしいですか？`)) return;

    try {
      setIsDeleting(true);
      const res = await imageApi.bulkDelete(selectedIds);
      if (res.data.success) {
        setImages(prev => prev.filter(img => !selectedIds.includes(img.id)));
        if (lastImageId && selectedIds.includes(lastImageId)) setLastImageId(null);
        setSelectedIds([]);
      }
    } catch (error) {
      console.error('Failed to bulk delete images:', error);
      alert('一括削除に失敗しました');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const response = await imageApi.upload(file);
      if (response.data.success && response.data.data) {
        setLastImageId(response.data.data.id);
        // ギャラリーを再取得
        const imgRes = await imageApi.list();
        if (imgRes.data.success) {
          setImages(imgRes.data.data || []);
        }
      }
    } catch (error: any) {
      console.error('Upload failed:', error);
      const data = error.response?.data;
      const details = data?.details ? JSON.stringify(data.details) : (data?.error || error.message);
      alert(`アップロードに失敗しました\n\n【詳細】\n${details}`);
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">ダッシュボード</h1>
        <p className="text-gray-400 mb-6 font-mono text-sm">
          2026 - Production Environment 
          <span className="ml-4 px-2 py-0.5 bg-gray-100 rounded text-[10px] uppercase">
            API: {import.meta.env.VITE_API_URL || 'https://tokyo86-api.belong2jazz.workers.dev'}
          </span>
        </p>
      </div>

      {/* クイックアップロードセクション */}
      <div className="glass p-8 rounded-3xl border border-primary-100 shadow-xl shadow-primary-50/50">
        <h2 className="text-lg font-bold mb-4 flex items-center">
          <Upload className="mr-2 text-primary-500" size={20} />
          クイック画像アップロード
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Cloudflare Images に直接画像をアップロードして、ID を取得できます。
              投稿前に画像を準備する際にお使いください。
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || pasteUploading}
              className="w-full flex items-center justify-center px-6 py-4 bg-primary-500 text-white rounded-2xl shadow-lg shadow-primary-200 hover:bg-primary-600 transition-all font-bold disabled:opacity-50"
            >
              {(uploading || pasteUploading) ? (
                <Loader2 className="animate-spin mr-2" size={20} />
              ) : (
                <Upload className="mr-2" size={20} />
              )}
              {uploading ? 'アップロード中...' : pasteUploading ? 'ペースト中...' : '画像を選択してアップロード'}
            </button>
            <p className="text-xs text-gray-400 text-center">または Cmd+V でクリップボードの画像を直接アップロード</p>
          </div>

          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-3xl p-6 min-h-[300px] bg-gray-50/50">
            {lastImageId ? (
              <div className="w-full space-y-4 animate-in zoom-in-95 duration-300">
                <div className="relative group max-h-[400px] rounded-xl overflow-y-auto bg-white border border-gray-100 shadow-sm scrollbar-thin scrollbar-thumb-gray-200">
                  <img
                    src={getImageUrl(lastImageId, { width: 800 })}
                    alt="Uploaded preview"
                    className="w-full h-auto block"
                  />
                  <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
                    Preview (Scrollable)
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Raw Image ID</p>
                    <code className="text-xs font-mono text-gray-600 truncate block">{lastImageId}</code>
                  </div>
                  <button
                    onClick={() => copyToClipboard(lastImageId)}
                    className={`p-2 rounded-lg transition-all ${copied ? 'bg-green-500 text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>

                <div className="flex items-center gap-2 bg-primary-50 p-3 rounded-xl border border-primary-100 shadow-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-primary-400 uppercase font-bold mb-1">Short CDN URL</p>
                    <code className="text-xs font-mono text-primary-700 truncate block">
                      https://img.tokyo86.com/{lastImageId.substring(0, 6)}.webp
                    </code>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`https://img.tokyo86.com/${lastImageId.substring(0, 6)}.webp`);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className={`p-2 rounded-lg transition-all ${copied ? 'bg-green-500 text-white' : 'bg-primary-100 text-primary-500 hover:bg-primary-200'}`}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <ImageIcon className="mx-auto text-gray-200 mb-2" size={48} />
                <p className="text-xs text-gray-400">プレビューがここに表示されます</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass p-6 rounded-2xl shadow-sm">
          <h3 className="text-gray-500 text-sm font-medium">作品数</h3>
          <p className="text-3xl font-bold mt-2">{loadingStats ? '...' : stats.works}</p>
        </div>
        <div className="glass p-6 rounded-2xl shadow-sm">
          <h3 className="text-gray-500 text-sm font-medium">エピソード数</h3>
          <p className="text-3xl font-bold mt-2">{loadingStats ? '...' : stats.episodes}</p>
        </div>
        <div className="glass p-6 rounded-2xl shadow-sm">
          <h3 className="text-gray-500 text-sm font-medium">イラスト数</h3>
          <p className="text-3xl font-bold mt-2">{loadingStats ? '...' : stats.illustrations}</p>
        </div>
      </div>

      {/* 画像ギャラリーセクション */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center">
            <ImageIcon className="mr-2 text-primary-500" size={20} />
            最近のアップロード（ギャラリー）
          </h2>
          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all font-bold text-sm border border-red-100"
            >
              {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              選択した {selectedIds.length} 件を削除
            </button>
          )}
        </div>
        
        {loadingImages ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-square bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : images.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {images.map((img) => (
              <div 
                key={img.id} 
                className={`group relative aspect-square bg-white rounded-xl border overflow-hidden shadow-sm hover:shadow-md transition-all ${selectedIds.includes(img.id) ? 'ring-2 ring-primary-500 border-primary-500' : 'border-gray-100'}`}
                onClick={(e) => handleToggleSelect(img.id, e)}
              >
                <img
                  src={getImageUrl(img.id, { width: 200, height: 200, fit: 'cover' })}
                  alt={img.filename}
                  className="w-full h-full object-cover"
                />
                
                {/* 選択チェックボックス */}
                <div className={`absolute top-2 left-2 z-10 p-1 rounded-lg backdrop-blur-md transition-all ${selectedIds.includes(img.id) ? 'bg-primary-500 text-white' : 'bg-black/20 text-white opacity-0 group-hover:opacity-100'}`}>
                  {selectedIds.includes(img.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                </div>

                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(img.id); }}
                    className="w-full py-1.5 text-[10px] bg-white/20 hover:bg-white/40 text-white rounded backdrop-blur-md transition-colors font-bold"
                  >
                    IDをコピー
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const url = img.batch_id 
                        ? `https://img.tokyo86.com/${img.batch_id}/${String(img.sequence_number).padStart(3, '0')}.webp`
                        : `https://img.tokyo86.com/${img.id.substring(0, 6)}.webp`;
                      navigator.clipboard.writeText(url);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="w-full py-1.5 text-[10px] bg-primary-500/80 hover:bg-primary-500 text-white rounded backdrop-blur-md transition-colors font-bold"
                  >
                    URLをコピー
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const url = `https://imagedelivery.net/wdR9enbrkaPsEgUtgFORrw/${img.id}/original`;
                      const blob = await fetch(url).then(r => r.blob());
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(blob);
                      a.download = `${img.id.substring(0, 6)}.webp`;
                      a.click();
                      URL.revokeObjectURL(a.href);
                    }}
                    className="w-full py-1.5 text-[10px] bg-green-500/80 hover:bg-green-500 text-white rounded backdrop-blur-md transition-colors font-bold"
                  >
                    DL
                  </button>
                  <button
                    onClick={(e) => handleDeleteImage(img.id, e)}
                    className="w-full py-1.5 text-[10px] bg-red-500/80 hover:bg-red-500 text-white rounded backdrop-blur-md transition-colors font-bold flex items-center justify-center gap-1"
                  >
                    <Trash2 size={12} />
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
            <p className="text-gray-400">まだアップロードされた画像はありません</p>
          </div>
        )}
      </div>
    </div>
  );
};

// 認証設定
const ADMIN_USERNAME = import.meta.env.VITE_ADMIN_USERNAME;
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

// レイアウトコンポーネント
const Layout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const location = useLocation();

  useEffect(() => {
    const auth = localStorage.getItem('admin_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      localStorage.setItem('admin_auth', 'true');
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('ユーザー名またはパスワードが正しくありません');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_auth');
    setIsAuthenticated(false);
    window.location.href = '/';
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'ダッシュボード', path: '/' },
    { icon: BookOpen, label: '作品・マンガ', path: '/works' },
    { icon: ImageIcon, label: 'イラスト', path: '/illustrations' },
    { icon: Upload, label: '画像バッチ一覧', path: '/batches' },
    { icon: ImageIcon, label: '全画像ブラウズ', path: '/browse' },
    { icon: Settings, label: '設定', path: '/settings' },
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-6">
        <div className="glass p-8 rounded-3xl w-full max-w-md shadow-2xl shadow-primary-100/50 border border-primary-50">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-primary-500 mb-2">tokyo86 admin</h1>
            <p className="text-gray-400 text-sm">管理者ログインが必要です</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">ユーザー名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-white/50 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                placeholder="Username"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-2">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-white/50 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                placeholder="Password"
                required
              />
            </div>
            
            {error && (
              <p className="text-red-500 text-xs font-medium text-center animate-shake">{error}</p>
            )}

            <button
              type="submit"
              className="w-full py-4 bg-primary-500 text-white rounded-2xl font-bold shadow-lg shadow-primary-200 hover:bg-primary-600 transition-all active:scale-95"
            >
              ログイン
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-center gap-4">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${ADMIN_USERNAME ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
              User: {ADMIN_USERNAME ? 'Set' : 'Missing'}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${ADMIN_PASSWORD ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
              Pass: {ADMIN_PASSWORD ? 'Set' : 'Missing'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-[#f8fafc]">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 glass border-r border-white/50 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-100">
          <span className="text-xl font-bold text-primary-500">tokyo86 <span className="text-xs text-gray-400 font-normal">v2</span></span>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <Menu size={20} />
          </button>
        </div>
        <nav className="mt-6 px-4 space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                location.pathname === item.path
                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-200'
                  : 'text-gray-600 hover:bg-white hover:shadow-sm hover:translate-x-1'
              }`}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-6 w-full px-4">
          <button 
            onClick={handleLogout}
            className="flex items-center space-x-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all w-full group"
          >
            <LogOut size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">ログアウト</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <header className="h-16 glass flex items-center justify-between px-6 border-b border-gray-100 sticky top-0 z-40">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="ml-auto flex items-center space-x-4">
             <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold border border-primary-200 shadow-sm">M</div>
          </div>
        </header>
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/works" element={<WorksPage />} />
          <Route path="/works/new" element={<WorkNewPage />} />
          <Route path="/works/:id/edit" element={<WorkEditPage />} />
          <Route path="/works/:workId/episodes" element={<EpisodesPage />} />
          <Route path="/illustrations" element={<IllustrationsPage />} />
          <Route path="/illustrations/new" element={<IllustrationNewPage />} />
          <Route path="/illustrations/:id/edit" element={<IllustrationEditPage />} />
          <Route path="/episodes/new" element={<EpisodeNewPage />} />
          <Route path="/episodes/:id/edit" element={<EpisodeEditPage />} />
          <Route path="/batches" element={<BatchesPage />} />
          <Route path="/batches/new" element={<BatchUpload />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/settings" element={<div className="p-6">Settings Page (Coming Soon)</div>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
