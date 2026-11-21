import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Eraser, Maximize2, Minimize2, PenLine, Trash2, Undo2 } from "lucide-react";

// Store stroke coordinates in CSS pixels so expanding the paper does not rescale handwriting.
type Point = { x: number; y: number };
type Stroke = { points: Point[]; mode: "pen" | "eraser"; color: string; size: number };
const PEN_COLORS = ["#000000", "#2563eb", "#dc2626", "#16a34a", "#e4c3e2ff", "#b6cdeeff"] as const;
type Paper = "grid" | "lines" | "blank";

// Keep stroke coordinates in logical CSS pixels so the image stays sharp when resized.
export function Scratchpad() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<HTMLElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const activeRef = useRef<Stroke | null>(null);
  const modeRef = useRef<"pen" | "eraser">("pen");
  const pointerIdRef = useRef<number | null>(null);
  const pointerTypeRef = useRef<string>("");
  const penFirstRef = useRef(true);
  const penColorRef = useRef<string>("#000000");
  const penSizeRef = useRef(3.4);
  const blockedPointersRef = useRef(new Set<number>());
  const blockedClickUntilRef = useRef(0);
  // 필기 중 단어 카드의 손바닥 터치로 텍스트가 선택되는 것을 막습니다.
  const handwritingGuardUntilRef = useRef(0);
  const handwritingGuardTimerRef = useRef<number | null>(null);
  const handwritingGuardPageRef = useRef<HTMLElement | null>(null);
  const [strokeCount, setStrokeCount] = useState(0);
  const [mode, setMode] = useState<"pen" | "eraser">("pen");
  const [paper, setPaper] = useState<Paper>("grid");
  const [expanded, setExpanded] = useState(false);
  const [penFirst, setPenFirst] = useState(true);
  const [penColor, setPenColor] = useState<string>("#000000");
  const [penSize, setPenSize] = useState(3.4);
  const [writing, setWriting] = useState(false);

  // 시작 직후에는 React 렌더링을 기다리지 않고 선택 금지 클래스를 붙입니다.
  const beginHandwritingGuard = () => {
    if (handwritingGuardTimerRef.current !== null) {
      window.clearTimeout(handwritingGuardTimerRef.current);
      handwritingGuardTimerRef.current = null;
    }
    handwritingGuardUntilRef.current = Number.POSITIVE_INFINITY;
    const page = padRef.current?.closest<HTMLElement>(".study-page");
    if (page) {
      handwritingGuardPageRef.current = page;
      page.classList.add("scratchpad-handwriting-guard");
    }
    window.getSelection()?.removeAllRanges();
  };

  // 펜을 떼는 순간에도 손바닥이 카드에 닿아 있을 수 있어 잠깐 보호합니다.
  const endHandwritingGuard = () => {
    if (handwritingGuardTimerRef.current !== null) {
      window.clearTimeout(handwritingGuardTimerRef.current);
    }
    handwritingGuardUntilRef.current = Date.now() + 1000;
    handwritingGuardTimerRef.current = window.setTimeout(() => {
      if (pointerIdRef.current === null) {
        handwritingGuardPageRef.current?.classList.remove("scratchpad-handwriting-guard");
      }
      handwritingGuardTimerRef.current = null;
    }, 1000);
  };

  useEffect(() => () => {
    if (handwritingGuardTimerRef.current !== null) {
      window.clearTimeout(handwritingGuardTimerRef.current);
    }
    handwritingGuardPageRef.current?.classList.remove("scratchpad-handwriting-guard");
  }, []);

  // 확대 중 또는 실제 필기 중에는 필기장 바깥의 터치·클릭·스크롤을 차단해요.
  // 포인터 ID는 ref에서 즉시 확인하므로 첫 획을 그리는 순간부터 적용돼요.
  useEffect(() => {
    const insidePad = (target: EventTarget | null) =>
      target instanceof Node && (
        !!padRef.current?.contains(target) ||
        (expanded && target instanceof Element && !!target.closest(".study-word-banner"))
      );
    const isLocked = () =>
      expanded || pointerIdRef.current !== null || blockedPointersRef.current.size > 0;
    const isHandwritingGuarded = () =>
      pointerIdRef.current !== null || Date.now() < handwritingGuardUntilRef.current;
    const isStudyCard = (target: EventTarget | null) =>
      target instanceof Element && !!target.closest(".flashcard");

    const blockOutside = (event: Event) => {
      const pointer = event as PointerEvent;
      const pointerId = typeof pointer.pointerId === "number" ? pointer.pointerId : null;
      const blockedPointer = pointerId !== null && blockedPointersRef.current.has(pointerId);
      const background = !insidePad(event.target);
      const suppressClick = event.type === "click" && Date.now() < blockedClickUntilRef.current;
      const guardedCard = isHandwritingGuarded() && isStudyCard(event.target);

      if (event.type === "selectstart" || event.type === "contextmenu" || event.type === "dragstart") {
        // 평소에는 단어 카드 복사 허용, 필기할 때만 카드 선택 차단.
        if ((event.target instanceof Node && padRef.current?.contains(event.target)) || guardedCard) {
          if (event.cancelable) event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
      }

      // 손바닥이 펜 뒤에 닿거나 펜을 뗀 직후 닿아도 카드에서 길게 누르기가 시작되지 않게 합니다.
      const cardTouch = guardedCard && (
        event.type.startsWith("touch") ||
        (event.type.startsWith("pointer") && pointer.pointerType === "touch")
      );
      if (cardTouch) {
        if (event.type === "pointerdown" && pointerId !== null) {
          blockedPointersRef.current.add(pointerId);
        }
        if ((event.type === "pointerup" || event.type === "pointercancel") && blockedPointer) {
          blockedPointersRef.current.delete(pointerId!);
          blockedClickUntilRef.current = Date.now() + 350;
        }
        if (event.cancelable) event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      // 바깥에서 시작한 다른 손가락이 필기장 안에서 끝나더라도 차단을 해제해야 해요.
      if (!background && !blockedPointer) return;
      if (!isLocked() && !blockedPointer && !suppressClick) return;

      if (event.type === "pointerdown" && pointerId !== null && background) {
        blockedPointersRef.current.add(pointerId);
      }
      if (event.type === "pointerup" || event.type === "pointercancel") {
        if (blockedPointer) {
          blockedPointersRef.current.delete(pointerId!);
          blockedClickUntilRef.current = Date.now() + 350;
        }
      }
      if (event.cancelable) event.preventDefault();
      event.stopImmediatePropagation();
    };

    const blockKeyboard = (event: KeyboardEvent) => {
      if (!isLocked()) return;
      if (event.key === "Escape" && expanded) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setExpanded(false);
        return;
      }
      const textShortcut = (event.ctrlKey || event.metaKey) &&
        ["a", "c", "v", "x"].includes(event.key.toLowerCase());
      if (insidePad(event.target) && !textShortcut) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const events = [
      "pointerdown", "pointermove", "pointerup", "pointercancel",
      "mousedown", "mousemove", "mouseup", "click", "dblclick",
      "touchstart", "touchmove", "touchend", "touchcancel",
      "wheel", "contextmenu", "selectstart", "dragstart",
    ];
    // 이미 시작된 선택(손바닥이 펜보다 먼저 닿은 경우)도 필기 시작 시 해제합니다.
    const clearSelectionDuringHandwriting = () => {
      if (isHandwritingGuarded()) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) selection.removeAllRanges();
      }
    };

    const options: AddEventListenerOptions = { capture: true, passive: false };
    for (const name of events) document.addEventListener(name, blockOutside, options);
    document.addEventListener("selectionchange", clearSelectionDuringHandwriting);
    window.addEventListener("keydown", blockKeyboard, true);
    return () => {
      for (const name of events) document.removeEventListener(name, blockOutside, true);
      document.removeEventListener("selectionchange", clearSelectionDuringHandwriting);
      window.removeEventListener("keydown", blockKeyboard, true);
    };
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [expanded]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.round(rect.width * ratio);
    const height = Math.round(rect.height * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Redraw a stroke at a time: eraser strokes remove previous ink only, not paper.
    for (const stroke of [...strokesRef.current, ...(activeRef.current ? [activeRef.current] : [])]) {
      ctx.save();
      ctx.globalCompositeOperation = stroke.mode === "eraser" ? "destination-out" : "source-over";
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = stroke.mode === "eraser" ? 24 : stroke.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (stroke.points.length === 1) {
        const dot = stroke.points[0];
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (stroke.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    draw();
    return () => observer.disconnect();
  }, [expanded, draw]);

  const getPoint = (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)), y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)) };
  };

  // The original HTML gathered coalesced pointer samples for smooth fast handwriting.
  const getMovePoints = (event: ReactPointerEvent<HTMLCanvasElement>): Point[] => {
    const rect = event.currentTarget.getBoundingClientRect();
    const native = event.nativeEvent;
    const samples = typeof native.getCoalescedEvents === "function"
      ? native.getCoalescedEvents()
      : [];
    const events = samples.length ? samples : [native];
    return events.map(sample => ({
      x: Math.max(0, Math.min(rect.width, sample.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, sample.clientY - rect.top)),
    }));
  };

  const eraseAt = (point: Point) => {
    const radius = 18;
    const remaining = strokesRef.current.filter(stroke => !stroke.points.some((next,index) => {
      const previous = stroke.points[Math.max(0,index-1)];
      const dx = next.x - previous.x, dy = next.y - previous.y;
      const t = Math.max(0, Math.min(1, ((point.x-previous.x)*dx+(point.y-previous.y)*dy)/(dx*dx+dy*dy||1)));
      return Math.hypot(point.x-previous.x-t*dx, point.y-previous.y-t*dy) < radius;
    }));
    if (remaining.length !== strokesRef.current.length) {
      strokesRef.current = remaining;
      setStrokeCount(remaining.length);
      draw();
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();

    // 펜 우선 ON: 펜이 먼저 닿았는지와 관계없이 손가락·손바닥 입력 차단.
    if (penFirstRef.current && event.pointerType === "touch") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    // 펜 우선 OFF에서 손가락으로 시작했다면 펜이 들어올 때 펜으로 전환.
    if (event.pointerType === "pen" && pointerIdRef.current !== null && pointerTypeRef.current === "touch") {
      const previousPointerId = pointerIdRef.current;
      if (event.currentTarget.hasPointerCapture(previousPointerId)) {
        event.currentTarget.releasePointerCapture(previousPointerId);
      }
      activeRef.current = null;
      pointerIdRef.current = null;
      pointerTypeRef.current = "";
      draw();
    }

    // 이미 획을 그리고 있으면 두 번째 입력은 무시.
    if (pointerIdRef.current !== null) return;
    pointerIdRef.current = event.pointerId;
    pointerTypeRef.current = event.pointerType;
    beginHandwritingGuard();
    setWriting(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (modeRef.current === "eraser") { eraseAt(getPoint(event)); return; }
    // 색과 굵기는 획마다 저장하므로 설정 변경 후에도 이전 획을 유지합니다.
    activeRef.current = { mode: "pen", points: [getPoint(event)], color: penColorRef.current, size: penSizeRef.current };
    draw();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerId !== pointerIdRef.current) return;
    event.preventDefault();
    if (modeRef.current === "eraser") {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) eraseAt(getPoint(event));
      return;
    }
    if (!activeRef.current) return;
    activeRef.current.points.push(...getMovePoints(event));
    draw();
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerId !== pointerIdRef.current) return;
    event.preventDefault();
    pointerIdRef.current = null;
    pointerTypeRef.current = "";
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setWriting(false);
    endHandwritingGuard();
    if (modeRef.current === "eraser") return;
    if (!activeRef.current) return;
    activeRef.current.points.push(getPoint(event));
    strokesRef.current.push(activeRef.current);
    activeRef.current = null;
    setStrokeCount(strokesRef.current.length);
    draw();
  };
  const onPointerCancel = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerId !== pointerIdRef.current) return;
    pointerIdRef.current = null;
    pointerTypeRef.current = "";
    activeRef.current = null;
    setWriting(false);
    endHandwritingGuard();
    draw();
  };
  const undo = () => {
    strokesRef.current.pop();
    setStrokeCount(strokesRef.current.length);
    draw();
  };
  const clear = () => {
    strokesRef.current = [];
    activeRef.current = null;
    setStrokeCount(0);
    draw();
  };
  const chooseMode = (next: "pen" | "eraser") => {
    modeRef.current = next;
    setMode(next);
  };
  const chooseColor = (next: string) => {
    penColorRef.current = next;
    setPenColor(next);
    chooseMode("pen");
  };
  const chooseSize = (next: number) => {
    penSizeRef.current = next;
    setPenSize(next);
  };
  const togglePenFirst = () => {
    const next = !penFirst;
    penFirstRef.current = next;
    setPenFirst(next);
  };

  return (
    <>
      {(expanded || writing) && <div className="scratchpad-interaction-backdrop" aria-hidden="true" />}
      <section ref={padRef} className={`scratchpad panel ${expanded ? "scratchpad-expanded" : ""} ${writing ? "scratchpad-writing" : ""}`} aria-label="자유 필기장" onContextMenu={event => event.preventDefault()}>
        <header className="scratchpad-header">
          <div>
            <span className="eyebrow">SCRATCHPAD</span>
            <h3>자유 필기장</h3>
          </div>
          <div className="scratchpad-header-actions">
            <span className="scratchpad-unsaved">저장 안 함</span>
            <button className="icon-button" onClick={() => setExpanded((value) => !value)} title={expanded ? "크기 축소" : "필기장 확대"} aria-label={expanded ? "크기 축소" : "필기장 확대"}>
              {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
          </div>
        </header>
        <div className="scratchpad-tools">
          <div className="scratchpad-tool-row">
            <button className={`scratchpad-tool ${mode === "pen" ? "active" : ""}`} onClick={() => chooseMode("pen")} aria-pressed={mode === "pen"}><PenLine size={15} /> 펜</button>
            <button className={`scratchpad-tool ${mode === "eraser" ? "active" : ""}`} onClick={() => chooseMode("eraser")} aria-pressed={mode === "eraser"}><Eraser size={15} /> 획 지우개</button>
            <button className="scratchpad-tool" onClick={undo} disabled={!strokeCount}><Undo2 size={15} /> 한 획 취소</button>
            <button type="button" className={`scratchpad-tool scratchpad-pen-first ${penFirst ? "active" : ""}`} onClick={togglePenFirst} aria-pressed={penFirst} title="ON: 펜·마우스만 필기 / OFF: 손가락 필기도 허용">✍ 펜 우선 {penFirst ? "ON" : "OFF"}</button>
          </div>
          <div className="scratchpad-tool-row">
            <label className="scratchpad-paper-select">
              <span>연습장</span>
              <select value={paper} onChange={(event) => setPaper(event.target.value as Paper)}>
                <option value="grid">모눈</option>
                <option value="lines">줄 노트</option>
                <option value="blank">무지</option>
              </select>
            </label>
            <button className="scratchpad-tool scratchpad-clear" onClick={clear} disabled={!strokeCount}><Trash2 size={15} /> 모두 지우기</button>
          </div>
        </div>
        <div className="scratchpad-pen-options" aria-label="펜 색상과 굵기 설정">
          <div className="scratchpad-color-picker" role="group" aria-label="펜 색상">
            <span>펜 색상</span>
            {PEN_COLORS.map(color => (
              <button
                key={color}
                type="button"
                className={`scratchpad-color-swatch ${penColor === color ? "active" : ""}`}
                style={{ backgroundColor: color }}
                onClick={() => chooseColor(color)}
                aria-label={`${color} 색상`}
                aria-pressed={penColor === color}
                title={color}
              />
            ))}
            <label className="scratchpad-custom-color" title="다른 색 선택">
              <span>직접 선택</span>
              <input type="color" value={penColor} onChange={event => chooseColor(event.target.value)} aria-label="사용자 지정 펜 색상" />
            </label>
          </div>
          <label className="scratchpad-size-picker">
            <span>펜 굵기</span>
            <input
              type="range"
              min="1"
              max="12"
              step="0.5"
              value={penSize}
              onChange={event => chooseSize(Number(event.target.value))}
              aria-label="펜 굵기"
            />
            <strong>{penSize.toFixed(1)}px</strong>
          </label>
        </div>
        <div className={`scratchpad-paper paper-${paper}`}>
          {strokeCount === 0 && !activeRef.current && <div className="scratchpad-placeholder">여기에 직접 적어 보세요 <small>Apple Pencil · 손가락 · 마우스</small></div>}
          <canvas
            ref={canvasRef}
            className="scratchpad-canvas"
            aria-label="쓰기 연습 필기 영역"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onLostPointerCapture={onPointerCancel}
            onContextMenu={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()}
          />
        </div>
        <footer className="scratchpad-footer"><span>다음 카드로 넘어가면 필기가 지워져요.</span><span>{strokeCount}획</span></footer>
      </section>
    </>
  );
}

export default Scratchpad;
