import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Maximize2, Minimize2, PenLine, Trash2, Undo2 } from "lucide-react";

// Store stroke coordinates in CSS pixels so expanding the paper does not rescale handwriting.
type Point = { x: number; y: number };
type Stroke = { points: Point[]; mode: "pen" | "eraser"; color: string; size: number };
const PEN_COLORS = ["#000000", "#2563eb", "#dc2626", "#16a34a", "#e4c3e2ff", "#b6cdeeff"] as const;
type Paper = "grid" | "lines" | "blank";

// Apple Pencil이 pen 이벤트로 감지된 뒤 손가락/손바닥 터치를 무시합니다.
let penDetected = false;

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
  const interactionGuardTimerRef = useRef<number | null>(null);
  const interactionGuardPageRef = useRef<HTMLElement | null>(null);
  const pageGuardHandlerRef = useRef<((event: Event) => void) | null>(null);
  const [strokeCount, setStrokeCount] = useState(0);
  const [mode, setMode] = useState<"pen" | "eraser">("pen");
  const [paper, setPaper] = useState<Paper>("grid");
  const [expanded, setExpanded] = useState(false);
  const [penFirst, setPenFirst] = useState(true);
  const [penColor, setPenColor] = useState<string>("#000000");
  const [penSize, setPenSize] = useState(3.4);
  const [writing, setWriting] = useState(false);
  const [interactionGuard, setInteractionGuard] = useState(false);
  const [leftHanded, setLeftHanded] = useState(() => {
    try {
      return window.localStorage.getItem("recall-card-scratchpad-left-handed") === "true";
    } catch {
      return false;
    }
  });

  // 왼손잡이 설정을 기억하고, 학습 화면의 좌우 배치를 바꿉니다.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        "recall-card-scratchpad-left-handed",
        String(leftHanded)
      );
    } catch {
      // 저장이 제한된 브라우저에서도 현재 화면의 모드 전환은 동작합니다.
    }

    const studyPage = padRef.current?.closest<HTMLElement>(".study-page");
    if (!studyPage) return;

    studyPage.classList.toggle("scratchpad-left-handed", leftHanded);

    return () => {
      studyPage.classList.remove("scratchpad-left-handed");
    };
  }, [leftHanded]);

  const removePageInteractionGuard = () => {
    const page = interactionGuardPageRef.current;
    const handler = pageGuardHandlerRef.current;

    if (page && handler) {
      // Pointer/touch events must never be swallowed here.
      // The backdrop blocks outside taps; pointer completion is handled by
      // the canvas and the window fallback below.
      const events = ["selectstart", "contextmenu", "dragstart"];
      for (const name of events) {
        page.removeEventListener(name, handler, true);
      }
    }

    page?.classList.remove("scratchpad-handwriting-guard");
    pageGuardHandlerRef.current = null;
    interactionGuardPageRef.current = null;
  };

  useEffect(() => () => {
    if (interactionGuardTimerRef.current !== null) {
      window.clearTimeout(interactionGuardTimerRef.current);
    }
    removePageInteractionGuard();
  }, []);

  const startInteractionGuard = () => {
    if (interactionGuardTimerRef.current !== null) {
      window.clearTimeout(interactionGuardTimerRef.current);
      interactionGuardTimerRef.current = null;
    }
    const page = padRef.current?.closest<HTMLElement>(".study-page");
    if (page) {
      interactionGuardPageRef.current = page;
      page.classList.add("scratchpad-handwriting-guard");

      // 필기 중에는 필기장 바깥의 텍스트 선택/공유 메뉴만 차단합니다.
      // pointer/touch 이벤트는 여기서 가로채지 않아 펜 종료 이벤트가
      // Canvas 또는 window fallback까지 반드시 도달하게 합니다.
      if (!pageGuardHandlerRef.current) {
        const handler = (event: Event) => {
          const target = event.target;
          const insidePad = target instanceof Node && !!padRef.current?.contains(target);
          if (insidePad) return;

          if (event.cancelable) event.preventDefault();
          event.stopPropagation();
        };
        pageGuardHandlerRef.current = handler;
        const events = ["selectstart", "contextmenu", "dragstart"];
        for (const name of events) {
          page.addEventListener(name, handler, { capture: true, passive: false });
        }
      }
    }
    setInteractionGuard(true);
  };

  const finishInteractionGuard = () => {
    if (interactionGuardTimerRef.current !== null) {
      window.clearTimeout(interactionGuardTimerRef.current);
      interactionGuardTimerRef.current = null;
    }
    setInteractionGuard(false);
    removePageInteractionGuard();
  };

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

  const getPoint = (event: PointerEvent): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
    };
  };

  const eraseAt = (point: Point) => {
    const radius = 18;
    const remaining = strokesRef.current.filter(stroke => !stroke.points.some((next, index) => {
      const previous = stroke.points[Math.max(0, index - 1)];
      const dx = next.x - previous.x;
      const dy = next.y - previous.y;
      const t = Math.max(
        0,
        Math.min(
          1,
          ((point.x - previous.x) * dx + (point.y - previous.y) * dy) /
            (dx * dx + dy * dy || 1)
        )
      );
      return Math.hypot(
        point.x - (previous.x + t * dx),
        point.y - (previous.y + t * dy)
      ) < radius;
    }));

    if (remaining.length !== strokesRef.current.length) {
      strokesRef.current = remaining;
      setStrokeCount(remaining.length);
      draw();
    }
  };

  // Canvas에서 시작을 받고, 이동/종료는 window capture 단계에서도 받습니다.
  // WKWebView에서 pointer capture 대상이 바뀌어도 다음 획이 잠기지 않도록 합니다.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const finishActivePointer = (
      pointerId: number,
      finalPoint?: Point
    ) => {
      if (pointerIdRef.current !== pointerId) return;

      if (modeRef.current !== "eraser" && activeRef.current) {
        if (finalPoint) {
          activeRef.current.points.push(finalPoint);
        }
        strokesRef.current.push(activeRef.current);
        activeRef.current = null;
        setStrokeCount(strokesRef.current.length);
      }

      // 모든 종료 경로에서 반드시 포인터 잠금을 해제합니다.
      pointerIdRef.current = null;
      pointerTypeRef.current = "";
      setWriting(false);
      finishInteractionGuard();
      draw();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "pen") penDetected = true;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      // 펜을 감지한 뒤에는 손가락/손바닥 터치를 무시합니다.
      if (
        penFirstRef.current &&
        penDetected &&
        event.pointerType === "touch"
      ) {
        event.preventDefault();
        return;
      }

      // 손바닥이 먼저 닿아 있으면 Apple Pencil 입력이 우선합니다.
      if (
        event.pointerType === "pen" &&
        pointerIdRef.current !== null &&
        pointerTypeRef.current === "touch"
      ) {
        activeRef.current = null;
        pointerIdRef.current = null;
        pointerTypeRef.current = "";
        draw();
      }

      // 이전 포인터가 종료되지 않은 채 남아 있으면 새 포인터를 막지 않도록 복구합니다.
      if (pointerIdRef.current !== null) {
        const oldPointerId = pointerIdRef.current;
        console.warn("[Scratchpad] stale pointer recovered", oldPointerId);
        finishActivePointer(oldPointerId);
      }

      event.preventDefault();
      pointerIdRef.current = event.pointerId;
      pointerTypeRef.current = event.pointerType;
      startInteractionGuard();
      setWriting(true);

      if (modeRef.current === "eraser") {
        eraseAt(getPoint(event));
        return;
      }

      activeRef.current = {
        mode: "pen",
        points: [getPoint(event)],
        color: penColorRef.current,
        size: penSizeRef.current,
      };
      draw();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "pen") penDetected = true;
      if (pointerIdRef.current !== event.pointerId) return;
      if (event.cancelable) event.preventDefault();

      if (modeRef.current === "eraser") {
        eraseAt(getPoint(event));
        return;
      }

      if (!activeRef.current) return;

      const samples =
        typeof event.getCoalescedEvents === "function"
          ? event.getCoalescedEvents()
          : [];
      const points = samples.length > 0 ? samples : [event];

      for (const sample of points) {
        activeRef.current.points.push(getPoint(sample));
      }
      draw();
    };

    // Window capture 단계에서 항상 종료 처리합니다.
    // 이벤트 target이 canvas여도 건너뛰지 않는 것이 핵심입니다.
    const onPointerUp = (event: PointerEvent) => {
      finishActivePointer(event.pointerId, getPoint(event));
    };

    const onPointerCancel = (event: PointerEvent) => {
      // 취소된 이벤트의 마지막 좌표는 넣지 않고 받은 획만 보존합니다.
      finishActivePointer(event.pointerId);
    };

    const onLostPointerCapture = (event: PointerEvent) => {
      finishActivePointer(event.pointerId);
    };

    const onWindowBlur = () => {
      const activePointerId = pointerIdRef.current;
      if (activePointerId !== null) {
        finishActivePointer(activePointerId);
      }
    };

    const preventDefaultEvent = (event: Event) => {
      if (event.cancelable) event.preventDefault();
    };

    const preventContextMenu = (event: Event) => event.preventDefault();
    const options: AddEventListenerOptions = {
      capture: true,
      passive: false,
    };

    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    canvas.addEventListener("touchstart", preventDefaultEvent, { passive: false });
    canvas.addEventListener("click", preventDefaultEvent, { passive: false });
    canvas.addEventListener("lostpointercapture", onLostPointerCapture);
    canvas.addEventListener("contextmenu", preventContextMenu);

    // 포인터가 canvas 밖으로 retarget되더라도 move/up/cancel을 놓치지 않습니다.
    window.addEventListener("pointermove", onPointerMove, options);
    window.addEventListener("pointerup", onPointerUp, options);
    window.addEventListener("pointercancel", onPointerCancel, options);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("touchstart", preventDefaultEvent);
      canvas.removeEventListener("click", preventDefaultEvent);
      canvas.removeEventListener("lostpointercapture", onLostPointerCapture);
      canvas.removeEventListener("contextmenu", preventContextMenu);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerCancel, true);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [draw]);

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
      <section ref={padRef} className={`scratchpad panel ${expanded ? "scratchpad-expanded" : ""} ${writing ? "scratchpad-writing" : ""} ${interactionGuard ? "scratchpad-guarding" : ""}`} aria-label="자유 필기장" onContextMenu={event => event.preventDefault()}>
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
            <button
              type="button"
              className={`scratchpad-tool scratchpad-left-handed-toggle ${leftHanded ? "active" : ""}`}
              onClick={() => setLeftHanded(value => !value)}
              aria-pressed={leftHanded}
              title="필기장을 왼쪽에 배치하고 도구를 오른쪽으로 정렬합니다"
            >
              ✋ 왼손잡이 {leftHanded ? "ON" : "OFF"}
            </button>
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