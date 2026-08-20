import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import ItemCard from '../components/ItemCard';
import { Spinner } from '../components/LoadingSpinner';
import { useToast } from '../components/Toast';
import { api, type MatchResult } from '../lib/api';
import { downscaleImage } from '../lib/image';
import { Link } from '../lib/router';
import { colorHex } from '../lib/format';

type Phase = 'form' | 'searching' | 'done';

export default function MatchPage() {
  const { show } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const [image, setImage] = useState('');
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState('');

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      show('请选择图片文件', 'error');
      return;
    }
    try {
      const dataUrl = await downscaleImage(file);
      setImage(dataUrl);
      setError('');
    } catch {
      show('图片读取失败，请重试', 'error');
    }
  };

  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    void handleFile(e.target.files?.[0]);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    void handleFile(e.dataTransfer.files?.[0]);
  };

  const search = async () => {
    if (!image) {
      setError('请上传你丢失物品的照片');
      return;
    }
    setError('');
    setPhase('searching');
    try {
      const res = await api.matchLostItems(image);
      if (cancelledRef.current) return;
      setResult(res);
      setPhase('done');
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (cancelledRef.current) return;
      setPhase('form');
      setError(err instanceof Error ? err.message : '匹配失败，请重试');
    }
  };

  const reset = () => {
    setImage('');
    setResult(null);
    setError('');
    setPhase('form');
  };

  // ===== 搜索中 =====
  if (phase === 'searching') {
    return (
      <div className="animate-fade-up mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-indigo-100">
          <Spinner size={32} className="text-indigo-600" />
        </div>
        <h2 className="mt-6 text-xl font-bold text-slate-800">正在识别并匹配…</h2>
        <p className="mt-2 text-sm text-slate-500">AI 正在识别你的物品特征，并在寻物广场中寻找相似的失物…</p>
        {image && (
          <img src={image} alt="正在匹配的物品" className="mx-auto mt-6 h-32 w-32 rounded-2xl object-cover shadow-md" />
        )}
      </div>
    );
  }

  // ===== 结果 =====
  if (phase === 'done' && result) {
    const q = result.query;
    return (
      <div className="animate-fade-up mx-auto max-w-5xl space-y-6">
        {/* AI 识别到的特征摘要 */}
        <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {image && (
              <img src={image} alt="你上传的物品" className="h-28 w-28 shrink-0 rounded-2xl object-cover shadow-md" />
            )}
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-400">🤖 AI 识别到你的物品是</p>
              <p className="mt-1 text-lg font-bold text-indigo-700">{q.type || '未知物品'}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {q.color && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full border border-slate-200"
                      style={{ background: colorHex(q.color) }}
                    />
                    {q.color}
                  </span>
                )}
                {q.shape && q.shape !== '未知' && (
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600">形状：{q.shape}</span>
                )}
                {q.material && q.material !== '未知' && (
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600">材质：{q.material}</span>
                )}
                {q.text && q.text !== '无' && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">🔤 {q.text}</span>
                )}
                {q.confidence != null && (
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-blue-600">
                    置信度 {(q.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              {q.features && <p className="mt-2 text-sm text-slate-500">特征：{q.features}</p>}
            </div>
            <button
              type="button"
              onClick={reset}
              className="shrink-0 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-400 hover:text-indigo-600"
            >
              重新识图
            </button>
          </div>
        </div>

        {/* 匹配结果 */}
        {result.count > 0 ? (
          <div>
            <div className="mb-4 flex items-end justify-between">
              <h2 className="text-xl font-bold text-slate-800">
                为你找到 <span className="text-indigo-600">{result.count}</span> 件相似失物
              </h2>
              <p className="text-sm text-slate-500">按匹配度排序，越靠前越可能是你的</p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {result.candidates.map((c) => (
                <div key={c.item.id} className="relative">
                  <span className="absolute -top-2 left-3 z-10 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-md">
                    匹配度 {c.score}
                  </span>
                  <ItemCard item={c.item} />
                  {c.matched.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.matched.map((m) => (
                        <span key={m} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                          ✓ {m}一致
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-center text-sm text-slate-500">
              找到疑似你的物品了吗？点击卡片进入详情，即可 <Link to="/hall" className="font-medium text-indigo-600">申请认领</Link>。
            </p>
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <span className="grid mx-auto h-16 w-16 place-items-center rounded-full bg-slate-100 text-3xl">🔍</span>
            <h2 className="mt-5 text-xl font-bold text-slate-800">暂时没有找到相似的失物</h2>
            <p className="mt-2 text-sm text-slate-500">
              可能还没有人捡到并登记你的物品。建议稍后再来试试，或直接去寻物广场浏览。
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/hall" className="btn-gradient rounded-full px-7 py-3 text-sm font-semibold text-white shadow-md">
                去寻物广场看看
              </Link>
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-slate-300 bg-white px-7 py-3 text-sm font-semibold text-slate-700 transition hover:border-indigo-400 hover:text-indigo-600"
              >
                换张图再试
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===== 表单 =====
  return (
    <div className="animate-fade-up mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-800">我是失主 · 识图找失物</h1>
        <p className="mt-2 text-sm text-slate-500">
          上传你丢失物品的照片（或同款物品的照片），AI 会自动识别特征，并在寻物广场中为你匹配相似的失物。
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition ${
          dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/40'
        }`}
      >
        {image ? (
          <>
            <img src={image} alt="物品预览" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/60 px-4 py-1.5 text-xs font-medium text-white backdrop-blur">
              点击更换图片
            </span>
          </>
        ) : (
          <>
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-3xl">📷</span>
            <p className="mt-3 text-sm font-medium text-slate-600">点击或拖拽上传你丢失物品的照片</p>
            <p className="mt-1 text-xs text-slate-400">支持 JPG / PNG，将自动压缩</p>
          </>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onInput} />

      {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}

      <button
        type="button"
        onClick={() => void search()}
        className="btn-gradient mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-white shadow-lg"
      >
        🔍 开始智能匹配
      </button>

      <p className="mt-4 text-center text-xs text-slate-400">
        提示：识图匹配仅用于帮你缩小范围，最终请通过认领流程与拾取者核实。
      </p>
    </div>
  );
}
