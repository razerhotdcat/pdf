import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
// @ts-expect-error firebase.js is plain JS; 키 설정 후 사용
import { signInWithGoogle } from './firebase';

export type ToastType = 'success' | 'info' | 'error';
export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

const TOAST_DURATION_MS = 3500;

function ToastContainer({ toasts, remove }: { toasts: ToastItem[]; remove: (id: string) => void }) {
  useEffect(() => {
    if (toasts.length === 0) return;
    const id = toasts[0].id;
    const timer = setTimeout(() => remove(id), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toasts, remove]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none no-print">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast-item flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border min-w-[280px] max-w-[90vw] pointer-events-auto animate-toast-in"
          role="alert"
          style={{
            backgroundColor: t.type === 'success' ? '#f0fdf4' : t.type === 'error' ? '#fef2f2' : '#f0f9ff',
            borderColor: t.type === 'success' ? '#86efac' : t.type === 'error' ? '#fecaca' : '#bae6fd',
            color: t.type === 'success' ? '#166534' : t.type === 'error' ? '#b91c1c' : '#0369a1',
          }}
        >
          {t.type === 'success' && (
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
          )}
          {t.type === 'error' && (
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
          )}
          {t.type === 'info' && (
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
          )}
          <span className="text-sm font-medium">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

export type TextAlign = 'left' | 'center' | 'right';
export type FontWeight = 'normal' | 'bold';
export type FontFamily = 'serif' | 'sans-serif';
export type FontStyle = 'normal' | 'italic';

export interface TextObject {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  width: number;
  height: number;
  fontWeight: FontWeight;
  fontStyle: FontStyle;
  textAlign: TextAlign;
  color: string;
  fontFamily: FontFamily;
  opacity: number;
  letterSpacing: number;
  lineHeight: number;
}

const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 80;
const MIN_WIDTH = 60;
const MAX_WIDTH = 400;
const MIN_HEIGHT = 24;
const MAX_HEIGHT = 600;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 72;

const STORAGE_KEY = 'docuFlow_data';
const AUTO_SAVE_DELAY_MS = 1000;

function formatSavedAt(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}`;
}

interface StoredData {
  image: string | null;
  texts: TextObject[];
  savedAt?: string;
  fieldCount?: number;
  thumbnail?: string | null;
}

type SaveStatus = 'pending' | 'saved' | null;

interface TextBoxProps {
  obj: TextObject;
  isFocused: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onMove: (id: string, x: number, y: number) => void;
  onTextChange: (id: string, text: string) => void;
  onStyleChange: (id: string, style: Partial<Pick<TextObject, 'fontSize' | 'fontWeight' | 'fontStyle' | 'textAlign' | 'width' | 'height' | 'color' | 'fontFamily' | 'opacity' | 'letterSpacing' | 'lineHeight'>>) => void;
  onDelete: (id: string) => void;
  onFocus: (id: string) => void;
  onDragEnd?: () => void;
}

function TextBox({
  obj,
  isFocused,
  containerRef,
  onMove,
  onTextChange,
  onStyleChange,
  onDelete: _onDelete,
  onFocus,
  onDragEnd,
}: TextBoxProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (isFocused && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isFocused]);


  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-delete-btn]')) return;
      if ((e.target as HTMLElement).closest('[data-resize-handle]')) return;
      if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;

      e.preventDefault();
      e.stopPropagation();

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      dragOffset.current = { x: clickX - obj.x, y: clickY - obj.y };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!container) return;
        const r = container.getBoundingClientRect();
        const newX = ev.clientX - r.left - dragOffset.current.x;
        const newY = ev.clientY - r.top - dragOffset.current.y;
        onMove(obj.id, Math.max(0, newX), Math.max(0, newY));
      };

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        onDragEnd?.();
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [obj.id, obj.x, obj.y, containerRef, onMove, onDragEnd]
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = obj.width;
      const startHeight = obj.height;
      const container = containerRef.current;
      const rect = container?.getBoundingClientRect();
      const maxW = rect ? Math.max(MIN_WIDTH, rect.width - obj.x) : MAX_WIDTH;
      const maxH = rect ? Math.max(MIN_HEIGHT, rect.height - obj.y) : MAX_HEIGHT;

      const handleMove = (ev: MouseEvent) => {
        const deltaX = ev.clientX - startX;
        const deltaY = ev.clientY - startY;
        const nextWidth = Math.min(maxW, Math.max(MIN_WIDTH, startWidth + deltaX));
        const nextHeight = Math.min(maxH, Math.max(MIN_HEIGHT, startHeight + deltaY));
        onStyleChange(obj.id, { width: nextWidth, height: nextHeight });
      };

      const handleUp = () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [obj.id, obj.x, obj.y, obj.width, obj.height, containerRef, onStyleChange]
  );

  return (
    <div
      className="text-box-wrapper absolute cursor-move select-none"
      style={{ left: obj.x, top: obj.y }}
      onMouseDown={handleMouseDown}
    >
      <div
        className={`text-box-inner relative rounded px-1 py-0.5 overflow-visible ${
          isFocused ? 'border border-indigo-500 bg-white/95' : 'border border-transparent bg-transparent'
        }`}
        style={{
          width: obj.width,
          height: obj.height,
          minHeight: MIN_HEIGHT,
          mixBlendMode: 'multiply',
        }}
      >
        <textarea
          ref={textareaRef}
          value={obj.text}
          onChange={(e) => onTextChange(obj.id, e.target.value)}
          onFocus={() => onFocus(obj.id)}
          onMouseDown={(e) => e.stopPropagation()}
          className="block w-full min-h-0 py-0.5 px-1 bg-transparent outline-none border-none resize-none overflow-hidden break-words whitespace-pre-wrap box-border print-text"
          style={{
            fontSize: obj.fontSize,
            fontWeight: obj.fontWeight,
            fontStyle: obj.fontStyle ?? 'normal',
            textAlign: obj.textAlign,
            color: obj.color ?? '#000000',
            fontFamily: obj.fontFamily === 'serif' ? 'Georgia, "Nanum Myeongjo", serif' : '"Malgun Gothic", Dotum, sans-serif',
            opacity: obj.opacity ?? 0.9,
            letterSpacing: typeof obj.letterSpacing === 'number' ? `${obj.letterSpacing}px` : '0px',
            lineHeight: obj.lineHeight ?? 1.4,
            height: '100%',
            minHeight: MIN_HEIGHT,
          }}
          placeholder="텍스트"
          rows={1}
        />
        {isFocused && (
          <div
            data-resize-handle
            className="no-print absolute bottom-0 right-0 w-3 h-3 rounded-full bg-blue-500 cursor-se-resize shadow"
            onMouseDown={handleResizeStart}
            title="크기 조절"
          />
        )}
      </div>
    </div>
  );
}

function App() {
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [textObjects, setTextObjects] = useState<TextObject[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiStatus, setAiStatus] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiExampleIndex, setAiExampleIndex] = useState(0);
  const [showSoftWall, setShowSoftWall] = useState(false);
  const AI_EXAMPLES = [
    '예: 날짜 써줘',
    '예: 오늘 날짜로 채워줘',
    '예: 주변 글씨체랑 맞춰줘',
    '예: 자동 채우기',
  ];
  const [saveCount, setSaveCount] = useState(0);
  const visitStartedAtRef = useRef(Date.now());
  const softWallCheckedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMountRef = useRef(true);
  const skipNextAutoSaveRef = useRef(false);

  const resetToHome = useCallback(() => {
    setBackgroundImage(null);
    setTextObjects([]);
    setFocusedId(null);
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setBackgroundImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const id = crypto.randomUUID();
    const newObj: TextObject = {
      id,
      x,
      y,
      text: '',
      fontSize: 16,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'left',
      color: '#000000',
      fontFamily: 'sans-serif',
      opacity: 0.9,
      letterSpacing: 0,
      lineHeight: 1.4,
    };
    setTextObjects((prev) => [...prev, newObj]);
    setFocusedId(id);
  };

  const [guideLines, setGuideLines] = useState<number[]>([]);
  const [showGrid, setShowGrid] = useState(false);

  const SNAP_THRESHOLD = 5;

  const updatePosition = useCallback((id: string, rawX: number, rawY: number) => {
    const obj = textObjects.find((o) => o.id === id);
    const container = containerRef.current;
    const rect = container?.getBoundingClientRect();
    const cw = rect?.width ?? 0;
    const ch = rect?.height ?? 0;
    const maxX = Math.max(0, cw - (obj?.width ?? 0));
    const maxY = Math.max(0, ch - (obj?.height ?? 0));

    const clampX = (x: number) => Math.max(0, Math.min(maxX, x));
    const clampY = (y: number) => Math.max(0, Math.min(maxY, y));

    if (!obj) {
      setTextObjects((prev) => prev.map((o) => (o.id === id ? { ...o, x: clampX(rawX), y: clampY(rawY) } : o)));
      return;
    }

    const others = textObjects.filter((o) => o.id !== id);
    const targets: number[] = [];
    others.forEach((o) => {
      targets.push(o.x);
      targets.push(o.x + o.width);
      targets.push(o.x + o.width / 2);
    });
    targets.push(cw / 2);

    let bestX = rawX;
    let bestDist = SNAP_THRESHOLD + 1;
    const lines: number[] = [];

    for (const T of targets) {
      const dLeft = Math.abs(rawX - T);
      if (dLeft <= SNAP_THRESHOLD && dLeft < bestDist) {
        bestDist = dLeft;
        bestX = T;
        lines.length = 0;
        lines.push(T);
      }
      const dRight = Math.abs(rawX + obj.width - T);
      if (dRight <= SNAP_THRESHOLD && dRight < bestDist) {
        bestDist = dRight;
        bestX = T - obj.width;
        lines.length = 0;
        lines.push(T);
      }
      const dCenter = Math.abs(rawX + obj.width / 2 - T);
      if (dCenter <= SNAP_THRESHOLD && dCenter < bestDist) {
        bestDist = dCenter;
        bestX = T - obj.width / 2;
        lines.length = 0;
        lines.push(T);
      }
    }

    const finalX = clampX(bestDist <= SNAP_THRESHOLD ? bestX : rawX);
    const finalY = clampY(rawY);
    setGuideLines(bestDist <= SNAP_THRESHOLD ? lines : []);
    setTextObjects((prev) =>
      prev.map((o) => (o.id === id ? { ...o, x: finalX, y: finalY } : o))
    );
  }, [textObjects]);

  const updateText = useCallback((id: string, text: string) => {
    setTextObjects((prev) => prev.map((o) => (o.id === id ? { ...o, text } : o)));
  }, []);

  const updateStyle = useCallback((id: string, style: Partial<Pick<TextObject, 'fontSize' | 'fontWeight' | 'fontStyle' | 'textAlign' | 'width' | 'height' | 'color' | 'fontFamily' | 'opacity' | 'letterSpacing' | 'lineHeight'>>) => {
    setTextObjects((prev) => prev.map((o) => (o.id === id ? { ...o, ...style } : o)));
  }, []);

  const clearGuides = useCallback(() => setGuideLines([]), []);

  const buildStoredData = useCallback((image: string | null, texts: TextObject[]): StoredData => ({
    image,
    texts,
    savedAt: formatSavedAt(),
    fieldCount: texts.length,
    thumbnail: image ?? null,
  }), []);

  const handleLogoClick = useCallback(() => {
    const hasWork = backgroundImage || textObjects.length > 0;
    if (!hasWork) {
      resetToHome();
      return;
    }
    const ok = window.confirm('현재 작업을 저장하고 처음 화면으로 돌아갈까요?');
    if (!ok) return;
    try {
      const data = buildStoredData(backgroundImage, textObjects);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      addToast('success', '저장되었습니다. 처음 화면으로 이동합니다.');
    } catch {
      addToast('error', '저장에 실패했습니다.');
    }
    resetToHome();
  }, [backgroundImage, textObjects, buildStoredData, resetToHome, addToast]);

  const performSave = useCallback((image: string | null, texts: TextObject[]) => {
    const data = buildStoredData(image, texts);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setSaveStatus('saved');
    } catch {
      setSaveStatus(null);
    }
  }, [buildStoredData]);

  const handleSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    try {
      const data = buildStoredData(backgroundImage, textObjects);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setSaveStatus('saved');
      setSaveCount((c) => c + 1);
      addToast('success', '브라우저에 저장되었습니다.');
    } catch (err) {
      addToast('error', '저장에 실패했습니다. 이미지 용량이 크면 줄이거나 텍스트 수를 줄여 보세요.');
    }
  }, [backgroundImage, textObjects, buildStoredData, addToast]);

  useEffect(() => {
    if (softWallCheckedRef.current) return;
    if (saveCount >= 3) {
      softWallCheckedRef.current = true;
      setShowSoftWall(true);
      return;
    }
    const elapsed = Date.now() - visitStartedAtRef.current;
    if (elapsed >= 10 * 60 * 1000) {
      softWallCheckedRef.current = true;
      setShowSoftWall(true);
    }
  }, [saveCount]);

  useEffect(() => {
    const t = setInterval(() => {
      if (softWallCheckedRef.current) return;
      if (Date.now() - visitStartedAtRef.current >= 10 * 60 * 1000) {
        softWallCheckedRef.current = true;
        setShowSoftWall(true);
      }
    }, 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const applyLoadedData = useCallback((data: StoredData) => {
    setBackgroundImage(data.image ?? null);
    setTextObjects(
      (data.texts || []).map((o) => ({
        ...o,
        height: typeof o.height === 'number' ? o.height : DEFAULT_HEIGHT,
        width: typeof o.width === 'number' ? o.width : DEFAULT_WIDTH,
        color: o.color ?? '#000000',
        fontFamily: o.fontFamily ?? 'sans-serif',
        fontStyle: o.fontStyle ?? 'normal',
        opacity: typeof o.opacity === 'number' ? o.opacity : 0.9,
        letterSpacing: typeof o.letterSpacing === 'number' ? o.letterSpacing : 0,
        lineHeight: typeof o.lineHeight === 'number' ? o.lineHeight : 1.4,
      }))
    );
    setFocusedId(null);
    setSaveStatus('saved');
    skipNextAutoSaveRef.current = true;
  }, []);

  const [showLoadModal, setShowLoadModal] = useState(false);
  const [loadPreviewData, setLoadPreviewData] = useState<StoredData | null>(null);

  const openLoadModal = useCallback(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      addToast('info', '저장된 내역이 없습니다.');
      return;
    }
    try {
      const data: StoredData = JSON.parse(raw);
      setLoadPreviewData(data);
      setShowLoadModal(true);
    } catch {
      addToast('error', '저장된 내용이 없거나 손상되었습니다.');
    }
  }, [addToast]);

  const confirmLoad = useCallback(
    (data: StoredData) => {
      applyLoadedData(data);
      setShowLoadModal(false);
      setLoadPreviewData(null);
      addToast('success', '저장된 작업을 복구했습니다.');
    },
    [applyLoadedData, addToast]
  );

  const closeLoadModal = useCallback(() => {
    setShowLoadModal(false);
    setLoadPreviewData(null);
  }, []);

  // 자동 저장: beforeunload 미사용. 데이터 변경 시 localStorage에만 조용히 저장하여 새로고침 시 브라우저 경고가 뜨지 않게 함.
  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }
    if (!backgroundImage && textObjects.length === 0) return;

    autoSaveTimerRef.current = setTimeout(() => {
      performSave(backgroundImage, textObjects);
      autoSaveTimerRef.current = null;
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [backgroundImage, textObjects, performSave]);

  const handleReset = useCallback(() => {
    const ok = window.confirm('모든 내용을 지우고 처음부터 시작할까요?');
    if (!ok) return;
    setTextObjects([]);
    setBackgroundImage(null);
    setFocusedId(null);
    localStorage.removeItem(STORAGE_KEY);
    addToast('info', '초기화되었습니다.');
  }, [addToast]);

  const removeText = useCallback((id: string) => {
    setTextObjects((prev) => prev.filter((o) => o.id !== id));
    setFocusedId((prev) => (prev === id ? null : prev));
  }, []);

  const GEMINI_SYSTEM =
    "너는 문서 편집 도우미다. 사용자의 요청을 분석해서 { \"action\": \"add_text\", \"content\": \"입력할 내용\", \"type\": \"date\" } 같은 JSON 형식으로만 응답해. 다른 설명 없이 JSON 객체 하나만 출력해.";

  const runAiCommandFallback = useCallback(
    (trimmed: string) => {
      if (trimmed.includes('자동 채우기') || trimmed.includes('오늘 날짜로 채워줘') || trimmed.includes('날짜로 채워')) {
        setAiStatus('양식 분석 중...');
        setTimeout(() => {
          setAiStatus('레이아웃 생성 중...');
          const container = containerRef.current;
          const rect = container?.getBoundingClientRect();
          const cw = rect?.width ?? 400;
          const ch = rect?.height ?? 560;
          const pad = 24;
          const base: Omit<TextObject, 'id' | 'x' | 'y' | 'text'> = {
            fontSize: 14,
            width: 120,
            height: 28,
            fontWeight: 'normal',
            fontStyle: 'normal',
            textAlign: 'left',
            color: '#000000',
            fontFamily: 'sans-serif',
            opacity: 0.9,
            letterSpacing: 0,
            lineHeight: 1.4,
          };
          const now = new Date();
          const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const slots: { x: number; y: number; text: string }[] = [
            { x: pad, y: pad, text: '홍길동' },
            { x: cw - pad - 120, y: pad, text: dateStr },
            { x: pad, y: ch * 0.25, text: '품목: 서류 작성' },
            { x: pad, y: ch * 0.35, text: '금액: 10,000원' },
            { x: cw - pad - 140, y: ch * 0.5, text: '승인' },
          ];
          setTextObjects((prev) => [
            ...prev,
            ...slots.map(({ x, y, text }) => ({
              ...base,
              id: crypto.randomUUID(),
              x: Math.max(0, Math.min(cw - base.width, x)),
              y: Math.max(0, Math.min(ch - base.height, y)),
              text,
            })),
          ]);
          setTimeout(() => {
            setAiStatus('');
            addToast('success', '자동 채우기가 완료되었습니다.');
          }, 300);
        }, 600);
        return;
      }

      if (trimmed.includes('주변 스타일 복제') || trimmed.includes('스타일 복제') || trimmed.includes('주변 글씨체랑 맞춰줘') || trimmed.includes('글씨체 맞춰')) {
        if (!focusedId) {
          addToast('info', '텍스트 박스를 먼저 선택해 주세요.');
          return;
        }
        setAiStatus('스타일 매칭 중...');
        setTimeout(() => {
          updateStyle(focusedId, {
            fontFamily: 'serif',
            opacity: 0.92,
            color: '#1a1a1a',
            letterSpacing: 0.2,
            lineHeight: 1.45,
          });
          setAiStatus('');
          addToast('success', '선택한 텍스트에 양식 스타일이 적용되었습니다.');
        }, 500);
        return;
      }

      addToast('info', '지원 명령: "자동 채우기", "주변 스타일 복제"');
    },
    [focusedId, updateStyle, addToast]
  );

  const addTextObject = useCallback((text: string, x: number = 150, y: number = 150) => {
    const container = containerRef.current;
    const rect = container?.getBoundingClientRect();
    const cw = rect?.width ?? 400;
    const ch = rect?.height ?? 560;
    const clampedX = Math.max(0, Math.min(cw - DEFAULT_WIDTH, x));
    const clampedY = Math.max(0, Math.min(ch - DEFAULT_HEIGHT, y));
    const newObj: TextObject = {
      id: crypto.randomUUID(),
      x: clampedX,
      y: clampedY,
      text,
      fontSize: 16,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'left',
      color: '#000000',
      fontFamily: 'sans-serif',
      opacity: 0.9,
      letterSpacing: 0,
      lineHeight: 1.4,
    };
    setTextObjects((prev) => [...prev, newObj]);
  }, []);

  const callGeminiAndApply = useCallback(
    async (userInput: string): Promise<boolean> => {
      let apiKey: string | undefined;
      try {
        apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
      } catch {
        return false;
      }
      if (!apiKey?.trim()) return false;
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          systemInstruction: GEMINI_SYSTEM,
        });
        const result = await model.generateContent(userInput);
        const text = result?.response?.text?.()?.trim() ?? '';
        const jsonStr = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        let parsed: { action?: string; content?: string; type?: string };
        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          return false;
        }
        if (parsed?.action !== 'add_text' || !parsed?.content) return false;
        addTextObject(String(parsed.content), 150, 150);
        return true;
      } catch {
        return false;
      }
    },
    [addTextObject]
  );

  const runAiCommand = useCallback(
    (input: string) => {
      const trimmed = input.trim();
      const trimmedLower = trimmed.toLowerCase();
      if (!trimmed) return;

      let useGemini = false;
      try {
        useGemini = !!(import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();
      } catch {
        // 키 읽기 실패 시 Gemini 미사용
      }
      if (useGemini) {
        setAiLoading(true);
        setAiStatus('생각 중...');
        addToast('info', 'AI가 문서의 맥락을 분석하고 있습니다...');
        callGeminiAndApply(trimmed)
          .then((applied) => {
            if (applied) {
              addToast('success', 'AI가 텍스트를 생성했습니다!');
            } else {
              setAiStatus('');
              runAiCommandFallback(trimmedLower);
            }
          })
          .catch(() => {
            setAiStatus('');
            addToast('error', 'AI 요청에 실패했습니다.');
            runAiCommandFallback(trimmedLower);
          })
          .finally(() => {
            setAiLoading(false);
            setAiStatus('');
          });
        return;
      }

      runAiCommandFallback(trimmedLower);
    },
    [callGeminiAndApply, addToast, runAiCommandFallback]
  );

  const handleAiKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        runAiCommand(aiPrompt);
        setAiPrompt('');
      }
    },
    [aiPrompt, runAiCommand]
  );

  useEffect(() => {
    const id = setInterval(() => {
      setAiExampleIndex((i) => (i + 1) % AI_EXAMPLES.length);
    }, 3200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const data: StoredData = JSON.parse(raw);
      setBackgroundImage(data.image ?? null);
      setTextObjects(
        (data.texts || []).map((o) => ({
          ...o,
          height: typeof o.height === 'number' ? o.height : DEFAULT_HEIGHT,
          width: typeof o.width === 'number' ? o.width : DEFAULT_WIDTH,
          color: o.color ?? '#000000',
          fontFamily: o.fontFamily ?? 'sans-serif',
          fontStyle: o.fontStyle ?? 'normal',
          opacity: typeof o.opacity === 'number' ? o.opacity : 0.9,
          letterSpacing: typeof o.letterSpacing === 'number' ? o.letterSpacing : 0,
          lineHeight: typeof o.lineHeight === 'number' ? o.lineHeight : 1.4,
        }))
      );
      setFocusedId(null);
      setSaveStatus('saved');
      skipNextAutoSaveRef.current = true;
      addToast('info', '이전 작업을 복구했습니다.');
    } catch {
      // ignore corrupted data
    }
  }, [addToast]);

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <ToastContainer toasts={toasts} remove={removeToast} />

      <header className="no-print bg-white border-b border-gray-100/80 py-2.5 px-4">
        <div className="flex items-center justify-between gap-4">
          <button type="button" onClick={handleLogoClick} className="text-base font-semibold text-gray-900 hover:text-gray-700 transition-colors font-sans">
            DocuFlow
          </button>
          <div className="flex items-center gap-2">
            {saveStatus === 'pending' && <span className="text-xs text-gray-400">Saving...</span>}
            {saveStatus === 'saved' && <span className="text-xs text-emerald-600">Saved</span>}
            <button type="button" onClick={handleSave} className="px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100">Quick Save</button>
            <button type="button" onClick={openLoadModal} className="px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100">Load</button>
            <button type="button" onClick={handleReset} className="px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100">Reset</button>
            <button type="button" onClick={() => window.print()} className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-gray-900 hover:bg-gray-800">Export PDF</button>
          </div>
        </div>
      </header>

      {showLoadModal && loadPreviewData && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeLoadModal}
            aria-hidden
          />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="px-6 pt-6 pb-2">
              <h2 className="text-xl font-semibold text-gray-900">Load Saved Work</h2>
              <p className="text-sm text-gray-500 mt-1">Click to restore this version.</p>
            </div>
            <ul className="px-4 pb-4 space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => confirmLoad(loadPreviewData)}
                  className="w-full text-left rounded-xl border-2 border-gray-200 hover:border-violet-400 hover:bg-violet-50/50 transition-all p-4 group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900 group-hover:text-violet-800">
                        📅 {loadPreviewData.savedAt ?? 'No date'}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {loadPreviewData.fieldCount ?? loadPreviewData.texts?.length ?? 0} text box(es)
                      </p>
                    </div>
                    <span className="text-violet-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                      Restore →
                    </span>
                  </div>
                  {(loadPreviewData.image ?? loadPreviewData.thumbnail) && (
                    <div
                      className="mt-3 h-20 rounded-lg overflow-hidden bg-gray-100 bg-cover bg-center"
                      style={{ backgroundImage: `url(${loadPreviewData.image ?? loadPreviewData.thumbnail})` }}
                    />
                  )}
                </button>
              </li>
            </ul>
            <div className="px-4 pb-4 pt-0">
              <button
                type="button"
                onClick={closeLoadModal}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showSoftWall && (
        <div className="no-print fixed bottom-0 right-0 z-50 p-4 max-w-sm animate-slide-up">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-5">
            <p className="text-sm text-gray-700 mb-4">
              작업물을 안전하게 클라우드에 보관하고 싶으신가요?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowSoftWall(false)}
                className="flex-1 min-w-0 py-2 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200"
              >
                나중에
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await signInWithGoogle();
                    setShowSoftWall(false);
                    addToast('success', '로그인되었습니다.');
                  } catch (err: unknown) {
                    const msg = (err instanceof Error && err.message?.includes('설정되지 않았습니다'))
                      ? 'Firebase 설정 후 이용해 주세요.'
                      : (err instanceof Error ? err.message : '로그인에 실패했습니다.');
                    addToast('error', msg);
                  }
                }}
                className="flex-1 min-w-0 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 text-center overflow-hidden box-border"
                style={{ whiteSpace: 'normal', wordBreak: 'keep-all', padding: 12, lineHeight: 1.2 }}
              >
                로그인하고 영구 저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col min-h-0">
        {!backgroundImage ? (
          <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-2xl flex flex-col items-center gap-10">
            <label className="no-print w-full min-h-[320px] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors cursor-pointer">
              <input
                type="file"
                accept="image/jpeg,image/png,image/jpg,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
              <svg className="w-14 h-14 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-gray-600 font-medium">Upload Document Image</span>
              <span className="text-sm text-gray-400 mt-1">JPG, PNG, WEBP</span>
            </label>

            <section className="w-full text-center no-print">
              <h2 className="text-2xl font-bold text-gray-900 mb-2 font-sans">
                The Fastest Way to Fill Out Paperwork
              </h2>
              <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-sm text-gray-600">
                <span className="flex items-center gap-2">
                  <span className="flex w-9 h-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold">1</span>
                  Upload
                </span>
                <span className="text-gray-300">→</span>
                <span className="flex items-center gap-2">
                  <span className="flex w-9 h-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold">2</span>
                  AI Styling
                </span>
                <span className="text-gray-300">→</span>
                <span className="flex items-center gap-2">
                  <span className="flex w-9 h-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold">3</span>
                  Save PDF
                </span>
              </div>
              <p className="mt-6 text-gray-500 text-sm">
                Over 1,000 users have cut document time by 90%.
              </p>
            </section>
          </div>
          </div>
        ) : (
          <div className="no-print flex flex-1 w-full min-h-0">
            {/* Left: Layers */}
            <aside className="w-52 flex-shrink-0 border-r border-gray-100 bg-white flex flex-col">
              <div className="p-3 border-b border-gray-100">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Layers</h2>
              </div>
              <div className="flex-1 overflow-auto p-2">
                {textObjects.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">Click canvas to add text</p>
                ) : (
                  textObjects.map((o, i) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setFocusedId(o.id)}
                      className={`w-full text-left px-2.5 py-2 rounded-md text-xs truncate mb-0.5 transition-colors ${
                        focusedId === o.id ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {o.text.trim() || `Layer ${i + 1}`}
                    </button>
                  ))
                )}
              </div>
            </aside>

            {/* Center: Canvas */}
            <div className="flex-1 min-w-0 flex flex-col items-center justify-center p-6 bg-[#fafafa]">
              <div className="flex items-center gap-2 mb-3 self-center">
                <label className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer px-2 py-1 rounded hover:bg-gray-100">
                  Change image
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
                <span className="text-gray-300">·</span>
                <button type="button" onClick={() => setShowGrid((v) => !v)} className={`text-xs px-2 py-1 rounded ${showGrid ? 'text-gray-900 bg-gray-200' : 'text-gray-500 hover:bg-gray-100'}`}>
                  Guides
                </button>
              </div>
              <div
                ref={containerRef}
                className="EditorContainer relative bg-white bg-center bg-cover bg-no-repeat rounded-lg overflow-hidden cursor-crosshair border border-gray-200 shadow-sm"
                style={{
                  backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
                  aspectRatio: '210 / 297',
                  width: '100%',
                  maxWidth: 'min(calc(100vh * 0.7 * 210/297), 210mm)',
                  minHeight: '360px',
                }}
                onClick={handleContainerClick}
              >
                  {showGrid && (
                    <div
                      className="no-print absolute inset-0 pointer-events-none z-[1] opacity-[0.15]"
                      style={{
                        backgroundImage: `
                          linear-gradient(to right, #333 1px, transparent 1px),
                          linear-gradient(to bottom, #333 1px, transparent 1px)
                        `,
                        backgroundSize: '10px 10px',
                      }}
                    />
                  )}
                  {focusedId && (() => {
                    const sel = textObjects.find((o) => o.id === focusedId);
                    if (!sel) return null;
                    return (
                      <div
                        className="no-print absolute z-20 flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg shadow-sm px-1.5 py-1"
                        style={{
                          left: sel.x + sel.width / 2,
                          top: sel.y - 40,
                          transform: 'translate(-50%, 0)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button type="button" className="p-2 rounded-md hover:bg-gray-100 text-gray-600" onClick={(e) => { e.stopPropagation(); updateStyle(focusedId, { fontSize: Math.max(MIN_FONT_SIZE, sel.fontSize - 2) }); }} title="Decrease size">A−</button>
                        <button type="button" className="p-2 rounded-md hover:bg-gray-100 text-gray-600" onClick={(e) => { e.stopPropagation(); updateStyle(focusedId, { fontSize: Math.min(MAX_FONT_SIZE, sel.fontSize + 2) }); }} title="Increase size">A+</button>
                        <span className="w-px h-4 bg-gray-200" />
                        <button type="button" className={`p-2 rounded-md font-bold ${sel.fontWeight === 'bold' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`} onClick={(e) => { e.stopPropagation(); updateStyle(focusedId, { fontWeight: sel.fontWeight === 'bold' ? 'normal' : 'bold' }); }}>B</button>
                        <button type="button" className={`p-2 rounded-md italic ${sel.fontStyle === 'italic' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`} onClick={(e) => { e.stopPropagation(); updateStyle(focusedId, { fontStyle: sel.fontStyle === 'italic' ? 'normal' : 'italic' }); }}>I</button>
                        <span className="w-px h-4 bg-gray-200" />
                        <button type="button" className={`p-2 rounded-md ${sel.textAlign === 'left' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`} onClick={(e) => { e.stopPropagation(); updateStyle(focusedId, { textAlign: 'left' }); }}><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4 5h16v2H4V5zm0 4h10v2H4V9zm0 4h16v2H4v-2zm0 4h10v2H4v-2z"/></svg></button>
                        <button type="button" className={`p-2 rounded-md ${sel.textAlign === 'center' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`} onClick={(e) => { e.stopPropagation(); updateStyle(focusedId, { textAlign: 'center' }); }}><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4 5h16v2H4V5zm4 4h8v2H8V9zm-4 4h16v2H4v-2zm4 4h8v2H8v-2z"/></svg></button>
                        <button type="button" className={`p-2 rounded-md ${sel.textAlign === 'right' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`} onClick={(e) => { e.stopPropagation(); updateStyle(focusedId, { textAlign: 'right' }); }}><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4 5h16v2H4V5zm6 4h10v2H10V9zm-6 4h16v2H4v-2zm6 4h10v2H10v-2z"/></svg></button>
                        <span className="w-px h-4 bg-gray-200" />
                        <button type="button" data-delete-btn className="p-2 rounded-md text-gray-500 hover:bg-red-50 hover:text-red-600" onClick={(e) => { e.stopPropagation(); removeText(focusedId); }}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                      </div>
                    );
                  })()}
                  {guideLines.map((x) => (
                    <div
                      key={x}
                      className="no-print absolute top-0 bottom-0 w-0 border-l-2 border-dashed border-violet-500 pointer-events-none z-10"
                      style={{ left: x }}
                    />
                  ))}
                  {textObjects.map((obj) => (
                    <TextBox
                      key={obj.id}
                      obj={obj}
                      isFocused={focusedId === obj.id}
                      containerRef={containerRef}
                      onMove={updatePosition}
                      onTextChange={updateText}
                      onStyleChange={updateStyle}
                      onDelete={removeText}
                      onFocus={setFocusedId}
                      onDragEnd={clearGuides}
                    />
                  ))}
                </div>
              </div>

            {/* Right: Style + AI */}
            <aside className="no-print w-72 flex-shrink-0 border-l border-gray-100 bg-white flex flex-col">
              {focusedId && (() => {
                const focused = textObjects.find((o) => o.id === focusedId);
                if (!focused) return null;
                return (
                  <div className="p-4 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Style</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-medium text-gray-400 mb-1">Font</label>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => updateStyle(focusedId, { fontFamily: 'serif' })} className={`flex-1 py-1.5 rounded text-xs ${focused.fontFamily === 'serif' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} style={{ fontFamily: 'Georgia, serif' }}>Serif</button>
                          <button type="button" onClick={() => updateStyle(focusedId, { fontFamily: 'sans-serif' })} className={`flex-1 py-1.5 rounded text-xs ${focused.fontFamily === 'sans-serif' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} style={{ fontFamily: 'sans-serif' }}>Sans</button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-400 mb-1">Style</label>
                        <div className="flex gap-1 flex-wrap">
                          <button type="button" onClick={() => updateStyle(focusedId, { fontWeight: focused.fontWeight === 'bold' ? 'normal' : 'bold' })} className={`px-2 py-1 rounded text-xs font-bold ${focused.fontWeight === 'bold' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>B</button>
                          <button type="button" onClick={() => updateStyle(focusedId, { fontStyle: focused.fontStyle === 'italic' ? 'normal' : 'italic' })} className={`px-2 py-1 rounded text-xs italic ${focused.fontStyle === 'italic' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>I</button>
                          <input type="color" value={(focused.color ?? '#000000').slice(0, 7)} onChange={(e) => updateStyle(focusedId, { color: e.target.value })} className="w-7 h-7 rounded border border-gray-200 cursor-pointer flex-shrink-0" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-400 mb-1">Color</label>
                        <div className="flex flex-wrap gap-1">
                          {[{ value: '#000000' }, { value: '#dc2626' }, { value: '#2563eb' }].map(({ value }) => (
                            <button key={value} type="button" onClick={() => updateStyle(focusedId, { color: value })} className={`w-6 h-6 rounded border transition-all ${(focused.color ?? '#000000') === value ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200 hover:border-gray-300'}`} style={{ backgroundColor: value }} />
                          ))}
                          <input type="color" value={(focused.color ?? '#000000').slice(0, 7)} onChange={(e) => updateStyle(focusedId, { color: e.target.value })} className="w-6 h-6 rounded border border-gray-200 cursor-pointer" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-400 mb-1">Letter spacing</label>
                        <input type="range" min={-1} max={3} step={0.5} value={focused.letterSpacing ?? 0} onChange={(e) => updateStyle(focusedId, { letterSpacing: Number(e.target.value) })} className="w-full h-1 rounded-full bg-gray-200 appearance-none accent-gray-900" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-400 mb-1">Line height</label>
                        <input type="range" min={1} max={2.5} step={0.1} value={focused.lineHeight ?? 1.4} onChange={(e) => updateStyle(focusedId, { lineHeight: Number(e.target.value) })} className="w-full h-1 rounded-full bg-gray-200 appearance-none accent-gray-900" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-gray-400 mb-1">Opacity</label>
                        <input type="range" min={0.5} max={1} step={0.05} value={focused.opacity ?? 0.9} onChange={(e) => updateStyle(focusedId, { opacity: Number(e.target.value) })} className="w-full h-1 rounded-full bg-gray-200 appearance-none accent-gray-900" />
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div className="p-4 flex-1 flex flex-col gap-2 border-t border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">AI</h3>
                <div className="flex gap-2 items-start">
                  <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={handleAiKeyDown} placeholder="예: 날짜 써줘, 이름 넣어줘" className="flex-1 min-w-0 min-h-[88px] px-3 py-2 rounded-lg border border-gray-200 focus:border-gray-400 focus:ring-1 focus:ring-gray-400 outline-none text-sm resize-none bg-gray-50/50 disabled:opacity-70" rows={3} disabled={aiLoading} />
                  {aiLoading && (
                    <div className="flex-shrink-0 pt-2 flex items-center gap-1" aria-hidden>
                      <span className="ai-thinking-dot w-1.5 h-1.5 rounded-full bg-gray-400" />
                      <span className="ai-thinking-dot w-1.5 h-1.5 rounded-full bg-gray-400 animation-delay-150" />
                      <span className="ai-thinking-dot w-1.5 h-1.5 rounded-full bg-gray-400 animation-delay-300" />
                    </div>
                  )}
                </div>
                {aiStatus && !aiLoading && <div className="flex items-center gap-2 text-xs text-gray-600"><span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse" />{aiStatus}</div>}
                <p className="text-[10px] text-gray-400 min-h-[12px]" key={aiExampleIndex}>{AI_EXAMPLES[aiExampleIndex]}</p>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
