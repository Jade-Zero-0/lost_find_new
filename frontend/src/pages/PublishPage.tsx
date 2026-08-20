import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Spinner } from '../components/LoadingSpinner';
import { useToast } from '../components/Toast';
import { api, type PublicItem } from '../lib/api';
import { downscaleImage } from '../lib/image';
import { Link } from '../lib/router';
import { colorHex } from '../lib/format';
import type { ItemType } from '../types';

const TYPES: ItemType[] = ['证件', '电子产品', '文具', '衣物', '水杯', '钥匙', '其他'];

type Phase = 'form' | 'uploading' | 'analyzing' | 'done';

interface DoneData {
  item: PublicItem & { place: string };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 轮询物品详情直到 AI 分析结束（最多 30 秒），返回最终物品 */
async function waitAiResult(id: string): Promise<PublicItem & { place: string }> {
  const deadline = Date.now() + 30000;
  for (;;) {
    const { item } = await api.itemDetail(id);
    const cur = item as PublicItem & { place: string };
    if (!cur.aiStatus || cur.aiStatus !== 'processing') return cur;
    if (Date.now() >= deadline) return cur;
    await sleep(1000);
  }
}

export default function PublishPage() {
  const { show } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [image, setImage] = useState('');
  const [place, setPlace] = useState('');
  const [locationTips, setLocationTips] = useState('');
  const [detailLocation, setDetailLocation] = useState('');
  const [informationB, setInformationB] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ItemType>('其他');
  const [color, setColor] = useState('');
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [done, setDone] = useState<DoneData | null>(null);
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

  const submit = async () => {
    if (!image) {
      setError('请上传物品图片');
      return;
    }
    if (!place.trim()) {
      setError('请填写当前失物存放地点');
      return;
    }
    if (!description.trim()) {
      setError('请填写物品描述');
      return;
    }
    setError('');
    setPhase('uploading');
    try {
      // 1. 上传图片（后端保存图片并创建记录，aiStatus=processing）
      const { item } = await api.upload({
        image,
        place: place.trim(),
        locationTips: locationTips.trim() || undefined,
        detailLocation: detailLocation.trim() || undefined,
        informationB: informationB.trim() || undefined,
        description: description.trim(),
        type,
        color: color.trim() || undefined
      });
      // 2. 后端已自动触发 AI 分析 → 轮询等待结果
      setPhase('analyzing');
      const finalItem = await waitAiResult(item.id);
      setDone({ item: finalItem });
      setPhase('done');
      window.scrollTo({ top: 0 });
    } catch (err) {
      setPhase('form');
      setError(err instanceof Error ? err.message : '发布失败，请重试');
    }
  };

  const reset = () => {
    setImage('');
    setPlace('');
    setLocationTips('');
    setDetailLocation('');
    setInformationB('');
    setDescription('');
    setType('其他');
    setColor('');
    setError('');
    setDone(null);
    setPhase('form');
  };

  // ===== 阶段一/二：上传中 / AI 分析中 =====
  if (phase === 'uploading' || phase === 'analyzing') {
    return (
      <div className="animate-fade-up mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        {phase === 'uploading' ? (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-blue-100">
              <Spinner size={28} className="text-blue-600" />
            </div>
            <h2 className="mt-6 text-xl font-bold text-slate-800">正在上传图片…</h2>
            <p className="mt-2 text-sm text-slate-500">图片保存成功后会自动开始 AI 分析</p>
          </>
        ) : (
          <>
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-indigo-100">
              <Spinner size={32} className="text-indigo-600" />
            </div>
            <h2 className="mt-6 text-xl font-bold text-slate-800">正在AI分析…</h2>
            <p className="mt-2 text-sm text-slate-500">AI 正在识别物品类型、颜色、形状、材质与外观特征…</p>
            {image && (
              <img src={image} alt="正在分析的物品" className="mx-auto mt-6 h-32 w-32 rounded-2xl object-cover shadow-md" />
            )}
          </>
        )}
      </div>
    );
  }

  // ===== 阶段三：完成 / 失败 =====
  if (done) {
    const aiStatus = done.item.aiStatus || 'none';
    const ai = done.item.aiTags;
    const aiFailed = aiStatus === 'failed';
    const aiCompleted = aiStatus === 'completed';
    return (
      <div className="animate-fade-up mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className={`animate-pop-in mx-auto grid h-20 w-20 place-items-center rounded-full ${aiFailed ? 'bg-amber-100' : 'bg-emerald-100'}`}>
          {aiFailed ? (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8v5" />
              <circle cx="12" cy="16.5" r="0.6" fill="#d97706" />
            </svg>
          ) : (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12.5l5 5L20 6.5" />
            </svg>
          )}
        </div>
        <h2 className="mt-6 text-2xl font-bold text-slate-800">发布成功！</h2>
        <p className="mt-2 text-sm text-slate-500">
          物品已登记到失物大厅；存放地点与详细地点已隐藏保存，认领审核通过后仅对申请者可见。
        </p>

        <div className={`mt-6 rounded-2xl border p-4 ${aiFailed ? 'border-amber-200 bg-amber-50/70' : 'border-indigo-100 bg-indigo-50/60'}`}>
          {aiCompleted && (
            <>
              <p className="text-sm font-semibold text-emerald-600">✓ AI 分析完成</p>
              {ai && (
                <div className="mt-3 rounded-xl bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-slate-400">AI 识别结果</p>
                  <dl className="mt-2 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-slate-500">物品类型</dt>
                      <dd className="font-medium text-indigo-700">{ai.type || '—'}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-slate-500">颜色</dt>
                      <dd className="flex items-center gap-1.5 font-medium text-cyan-700">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full border border-slate-200"
                          style={{ background: colorHex(ai.color) }}
                        />
                        {ai.color || '—'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-slate-500">形状</dt>
                      <dd className="font-medium text-slate-700">{ai.shape || '—'}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-slate-500">特征</dt>
                      <dd className="text-right font-medium text-slate-700">{ai.feature || '—'}</dd>
                    </div>
                  </dl>
                  {(ai.material || (ai.text && ai.text !== '无') || ai.confidence != null) && (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                      {ai.material && (
                        <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs text-teal-600">{ai.material}</span>
                      )}
                      {ai.text && ai.text !== '无' && (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700">📝 {ai.text}</span>
                      )}
                      {ai.confidence != null && (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-600">
                          置信度 {(ai.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

            </>
          )}
          {aiFailed && (
            <div className="text-center">
              <p className="text-sm font-semibold text-amber-700">⚠️ AI 分析失败（物品已保存）</p>
              <p className="mt-2 text-xs text-amber-600">暂时无法识别该物品，请稍后重试。</p>
              <p className="mt-2 text-xs text-slate-500">可在「我的」页面查看该物品，稍后重新发布即可重新识别。</p>
            </div>
          )}
          {(aiStatus === 'processing' || aiStatus === 'none') && (
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-500">AI 分析仍在进行中</p>
              <p className="mt-2 text-xs text-slate-500">物品已保存，可稍后在「我的」或失物大厅查看识别结果。</p>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/hall" className="btn-gradient rounded-full px-7 py-3 text-sm font-semibold text-white shadow-md">
            去失物大厅看看
          </Link>
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-slate-300 bg-white px-7 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-400 hover:text-blue-600"
          >
            再发一件
          </button>
        </div>
      </div>
    );
  }

  // ===== 阶段零：填写表单 =====
  return (
    <div className="animate-fade-up mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">发布失物</h1>
        <p className="mt-1 text-sm text-slate-500">上传拾取到的物品，AI 将自动识别并生成标签</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
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
              dragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/40'
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
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-3xl">📷</span>
                <p className="mt-3 text-sm font-medium text-slate-600">点击或拖拽上传图片</p>
                <p className="mt-1 text-xs text-slate-400">支持 JPG / PNG，将自动压缩</p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onInput} />
        </div>

        <div className="space-y-4 lg:col-span-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              当前失物存放地点<span className="text-rose-500">*</span>
              <span className="ml-1 text-xs font-normal text-slate-400">（私有，认领通过后仅对申请者可见）</span>
            </label>
            <input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="例如：宿管站103室"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              地点 Tips<span className="ml-1 text-xs font-normal text-slate-400">（公开，帮失主快速定位）</span>
            </label>
            <input
              value={locationTips}
              onChange={(e) => setLocationTips(e.target.value)}
              placeholder="例如：图书馆附近"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              详细地点<span className="ml-1 text-xs font-normal text-slate-400">（私有，认领通过后可见）</span>
            </label>
            <input
              value={detailLocation}
              onChange={(e) => setDetailLocation(e.target.value)}
              placeholder="例如：图书馆三楼靠窗第12排座位"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              其他描述（信息B）<span className="ml-1 text-xs font-normal text-slate-400">（私有，用于认领验证）</span>
            </label>
            <textarea
              value={informationB}
              onChange={(e) => setInformationB(e.target.value)}
              rows={2}
              placeholder="例如：杯底有蓝色贴纸，杯盖内侧有划痕"
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">物品类型（可选）</label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    type === t
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">颜色（可选，留空用 AI 识别结果）</label>
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="例如：黑色"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              物品描述<span className="text-rose-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="描述物品外观、特征、品牌等，帮助失主更快辨认…"
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}

          <button
            type="button"
            onClick={() => void submit()}
            className="btn-gradient flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-white shadow-lg"
          >
            提交发布
          </button>
        </div>
      </div>
    </div>
  );
}