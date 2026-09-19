'use client';
import { useState } from 'react';
import { Download, Loader2, Link as LinkIcon } from 'lucide-react';
import { api } from '@/lib/api';

interface VideoFormat {
  format_id: string;
  ext: string;
  resolution: string;
  filesize?: number;
  label?: string;
}

interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: number;
  formats: VideoFormat[];
}

export function UrlDownloader() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [error, setError] = useState('');

  async function handleFetch(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setInfo(null); setLoading(true);
    try {
      const { data } = await api.post('/api/video/info', { url });
      setInfo(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to fetch video info');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(formatId: string) {
    try {
      const { data } = await api.post('/api/video/download', { url, formatId });
      // Backend returns a job id; poll or use websocket for progress
      alert(`Download queued! Job ID: ${data.jobId}`);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Download failed');
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleFetch} className="glass rounded-2xl p-2 flex gap-2">
        <div className="flex-1 flex items-center gap-3 px-4">
          <LinkIcon className="w-5 h-5 text-gray-400" />
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube, Vimeo, TikTok URL..."
            className="flex-1 bg-transparent outline-none placeholder-gray-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !url}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 font-medium disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {loading ? 'Fetching...' : 'Get'}
        </button>
      </form>

      {error && <p className="text-red-400 mt-4 text-sm">{error}</p>}

      {info && (
        <div className="glass rounded-2xl p-6 mt-6 text-left">
          <div className="flex gap-4 mb-4">
            <img src={info.thumbnail} alt="" className="w-32 h-20 object-cover rounded-lg" />
            <div>
              <h3 className="font-semibold line-clamp-2">{info.title}</h3>
              <p className="text-sm text-gray-400">{Math.floor(info.duration / 60)}:{(info.duration % 60).toString().padStart(2, '0')}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-300">Choose format:</p>
            {info.formats.length === 0 ? (
              <p className="text-yellow-400 text-sm">No downloadable formats found. The video may be restricted.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {info.formats.slice(0, 20).map((f) => (
                  <button
                    key={f.format_id}
                    onClick={() => handleDownload(f.format_id)}
                    className="px-3 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 transition flex flex-col items-start gap-1"
                  >
                    <span className="font-medium">{f.resolution || 'audio'} · {f.ext}</span>
                    <span className="flex w-full justify-between text-xs text-gray-400">
                      <span>{f.label || ''}</span>
                      {f.filesize ? <span>{(f.filesize/1024/1024).toFixed(1)}MB</span> : null}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
