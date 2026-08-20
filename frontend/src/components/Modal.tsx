import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * 通用模态对话框：用于二次确认、取消原因选择等场景。
 * 受控组件：由父组件通过 open 控制显隐；点击遮罩或取消触发 onClose。
 */
export default function Modal({
  open,
  title,
  children,
  confirmText = '确认',
  cancelText = '取消',
  confirmTone = 'primary',
  loading = false,
  onConfirm,
  onClose,
  confirmDisabled = false
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** 确认按钮色调：primary(蓝) / danger(红) / success(绿) */
  confirmTone?: 'primary' | 'danger' | 'success';
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  confirmDisabled?: boolean;
}) {
  // 打开时禁用滚动，Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  const toneClass =
    confirmTone === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700'
      : confirmTone === 'success'
        ? 'bg-emerald-600 hover:bg-emerald-700'
        : 'bg-blue-600 hover:bg-blue-700';

  // 用 Portal 渲染到 body，避免被祖先元素的 transform / hover 变换（如卡片 hover:-translate-y / scale）
  // 影响 fixed 遮罩的定位基准，导致弹窗鼠标移动时闪烁、抖动。
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
      onClick={() => !loading && onClose()}
    >
      <div
        className="animate-pop-in w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        {children && <div className="mt-3 text-sm text-slate-600">{children}</div>}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={loading || confirmDisabled}
            onClick={onConfirm}
            className={`rounded-full px-5 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
          >
            {loading ? '处理中…' : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
