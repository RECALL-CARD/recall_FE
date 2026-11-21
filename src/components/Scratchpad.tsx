import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Eraser, Maximize2, Minimize2, PenLine, Trash2, Undo2, X } from "lucide-react";

type Point = { x: number; y: number };
type Stroke = { points: Point[]; mode: "pen" | "eraser" };
type Paper = "grid" | "lines" | "blank";

// 카드가 바뀌어 컴포넌트가 다시 만들어져도 "펜을 썼다"는 사실은 유지해요.
let penDetected = false;

// Keep stroke coordinates in logical CSS pixels so the image stays sharp when resized.
export function Scratchpad() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const activeRef = useRef<Stroke | null>(null);
  const modeRef = useRef<"pen" | "eraser">("pen");
  const pointerIdRef = useRef<number | null>(null);
  const pointerTypeRef = useRef<string>("");
  const penFirstRef = useRef(true);
  const [strokeCount, setStrokeCount] = useState(0);
  const [mode, setMode] = useState<"pen" | "eraser">("pen");
  const [paper, setPaper] = useState<Paper>("grid");
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [penFirst, setPenFirst] = useState(true);

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
      ctx.strokeStyle = "#294f3b";
      ctx.fillStyle = "#294f3b";
      ctx.lineWidth = stroke.mode === "eraser" ? 24 : 3.4;
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
    if (collapsed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    draw();
    return () => observer.disconnect();
  }, [collapsed, expanded, draw]);

  const getPoint = (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const eraseAt = (point: Point) => {
    const radius = 18;
    const remaining = strokesRef.current.filter(stroke => !stroke.points.some((next,index) => {
      const previous = stroke.points[Math.max(0,index-1)];
      const dx = next.x-previous.x, dy = next.y-previous.y;
      const t = Math.max(0, Math.min(1, ((point.x-previous.x)*dx+(point.y-previous.y)*dy)/(dx*dx+dy*dy||1)));
      return Math.hypot(point.x-(previous.x+t*dx),point.y-(previous.y+t*dy)) < radius;
    }));
    if (remaining.length !== strokesRef.current.length) {
      strokesRef.current = remaining;
      setStrokeCount(remaining.length);
      draw();
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === "pen") penDetected = true;
    // 펜을 쓴 뒤에는 손가락·손바닥 터치 무시
    if (penFirstRef.current && penDetected && event.pointerType === "touch") return;
    // 손바닥이 먼저 닿아 있었다면 펜이 우선: 손바닥 획을 버리고 펜으로 전환
    if (event.pointerType === "pen" && pointerIdRef.current !== null && pointerTypeRef.current === "touch") {
      activeRef.current = null;
      pointerIdRef.current = null;
      draw();
    }
    // 쓰는 중 다른 터치 무시
    if (pointerIdRef.current !== null) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointerIdRef.current = event.pointerId;
    pointerTypeRef.current = event.pointerType;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (modeRef.current === "eraser") { eraseAt(getPoint(event)); return; }
    activeRef.current = { mode: "pen", points: [getPoint(event)] };
    draw();
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === "pen") penDetected = true; // 호버만 해도 펜 감지
    if (event.pointerId !== pointerIdRef.current) return;
    if (modeRef.current === "eraser") {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) eraseAt(getPoint(event));
      return;
    }
    if (!activeRef.current) return;
    activeRef.current.points.push(getPoint(event));
    draw();
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerId !== pointerIdRef.current) return;
    pointerIdRef.current = null;
    if (modeRef.current === "eraser") return;
    if (!activeRef.current) return;
    activeRef.current.points.push(getPoint(event));
    strokesRef.current.push(activeRef.current);
    activeRef.current = null;
    setStrokeCount(strokesRef.current.length);
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
  const togglePenFirst = () => {
    const next = !penFirst;
    penFirstRef.current = next;
    setPenFirst(next);
  };

  if (collapsed) {
    return (
      <div className="scratchpad-collapsed panel">
        <span><PenLine size={16} /> 자유 필기장</span>
        <button className="button button-outline" onClick={() => setCollapsed(false)}>펼치기</button>
      </div>
    );
  }

  return (
    <section className={`scratchpad panel ${expanded ? "scratchpad-expanded" : ""}`} aria-label="자유 필기장">
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
          <button className="icon-button" onClick={() => { setCollapsed(true); setExpanded(false); }} title="필기장 접기" aria-label="필기장 접기"><X size={17} /></button>
        </div>
      </header>
      <div className="scratchpad-tools">
        <div className="scratchpad-tool-row">
          <button className={`scratchpad-tool ${mode === "pen" ? "active" : ""}`} onClick={() => chooseMode("pen")} aria-pressed={mode === "pen"}><PenLine size={15} /> 펜</button>
          <button className={`scratchpad-tool ${mode === "eraser" ? "active" : ""}`} onClick={() => chooseMode("eraser")} aria-pressed={mode === "eraser"}><Eraser size={15} /> 획 지우개</button>
          <button className="scratchpad-tool" onClick={undo} disabled={!strokeCount}><Undo2 size={15} /> 한 획 취소</button>
          <button className={`scratchpad-tool ${penFirst ? "active" : ""}`} onClick={togglePenFirst} aria-pressed={penFirst} title="펜을 쓰면 손가락·손바닥 터치를 무시해요">✍ 펜 우선</button>
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
      <div className={`scratchpad-paper paper-${paper}`}>
        {strokeCount === 0 && !activeRef.current && <div className="scratchpad-placeholder">여기에 직접 적어 보세요 <small>Apple Pencil · 손가락 · 마우스</small></div>}
        <canvas
          ref={canvasRef}
          className="scratchpad-canvas"
          aria-label="쓰기 연습 필기 영역"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(event) => event.preventDefault()}
        />
      </div>
      <footer className="scratchpad-footer"><span>다음 카드로 넘어가면 필기가 지워져요.</span><span>{strokeCount}획</span></footer>
    </section>
  );
}

export default Scratchpad;
