import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  GraduationCap,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Heart,
  Layers3,
  ListFilter,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { StatCard } from "./components/StatCard";
import { CardRow } from "./components/CardRow";
import { Scratchpad } from "./components/Scratchpad";
import { romajiVariants } from "./lib/romaji";
import { getProgress, loadAppData, parseBackup, saveAppData, downloadBackup } from "./lib/storage";
import kanjiData from "./data/kanji.json";
import type { AppData, Card, Page, Progress } from "./types";
import "./styles.css";

type KanjiItem = (typeof kanjiData)[number];

const formatNumber = (value: number) => new Intl.NumberFormat("ko-KR").format(value);
const emptyProgress = (): Progress => ({ known: [], review: [], seconds: 0, rounds: 1 });

function App() {
  const [appData, setAppData] = useState<AppData>(() => loadAppData());
  const [page, setPage] = useState<Page>("home");
  const [selectedDeckId, setSelectedDeckId] = useState(appData.decks[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCard, setNewCard] = useState({ front: "", reading: "", back: "", voiceLang: "" });
  const [toast, setToast] = useState("");
  const [studyQueue, setStudyQueue] = useState<string[]>([]);
  const [studyScope, setStudyScope] = useState("deck");
  const [studyDeckId, setStudyDeckId] = useState(appData.decks[0]?.id ?? "");
  const [flipped, setFlipped] = useState(false);
  const [padResetKey, setPadResetKey] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessionSavedSeconds, setSessionSavedSeconds] = useState(0);
  const [studySessionTotal, setStudySessionTotal] = useState(0);
  const [kanjiQuery, setKanjiQuery] = useState("");
  const [selectedKanji, setSelectedKanji] = useState<KanjiItem | null>(null);
  const [collectionName, setCollectionName] = useState("");
  const [editCardId, setEditCardId] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [typingEnabled, setTypingEnabled] = useState(false);
  const [typingTarget, setTypingTarget] = useState<"reading"|"meaning"|"both">("reading");
  const [romajiEnabled, setRomajiEnabled] = useState(true);
  const [quizReading, setQuizReading] = useState("");
  const [quizMeaning, setQuizMeaning] = useState("");
  const [quizResult, setQuizResult] = useState("");
  const [lapRemaining, setLapRemaining] = useState(0);
  const [passes, setPasses] = useState(1);
  const [timerRunning, setTimerRunning] = useState(false);
  const [scopeLabel, setScopeLabel] = useState("");
  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceReveal, setPracticeReveal] = useState(false);
  const [csvScope, setCsvScope] = useState<"current"|"all">("current");
  const [csvImportScope, setCsvImportScope] = useState<"current"|"structure">("current");
  // 읽는 법(발음)은 뜻(flipped)과 따로 보여요
  const [showReading, setShowReading] = useState(false);
  const [showInlineMeaning, setShowInlineMeaning] = useState(false);
  // 탭이 숨겨져서 "자동으로" 멈춘 경우에만 true → 돌아오면 자동 재개
  const autoPausedRef = useRef(false);

  const selectedDeck = appData.decks.find((deck) => deck.id === selectedDeckId) ?? appData.decks[0];
  const allCards = useMemo(() => appData.decks.flatMap((deck) => deck.cards), [appData.decks]);
  const favoriteCards = useMemo(() => allCards.filter((card) => card.starred), [allCards]);
  const totalCards = allCards.length;
  const knownCount = Object.values(appData.progress).reduce((sum, item) => sum + item.known.length, 0);
  const totalStudySeconds = Object.values(appData.progress).reduce((sum, item) => sum + item.seconds, 0);

  useEffect(() => {
    saveAppData(appData);
  }, [appData]);

  // 카드가 바뀔 때마다(답 분류·섞기·재시작 등) 읽는 법은 다시 가려요
  useEffect(() => {
    setShowReading(false);
    setShowInlineMeaning(false);
  }, [padResetKey]);

  useEffect(() => {
    if (page !== "study" || !timerRunning || document.hidden || studyQueue.length === 0) return;
    const timer = window.setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [page, studyQueue.length, timerRunning]);

  useEffect(() => {
    if (page !== "study") return;
    const onVisibility = () => {
      if (document.hidden) {
        if (timerRunning) {
          autoPausedRef.current = true;
          setTimerRunning(false);
        }
      } else if (autoPausedRef.current) {
        autoPausedRef.current = false;
        setTimerRunning(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [page, timerRunning]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".global-search input")?.focus();
      }
      if (page === "study" && event.code === "Space" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement) && !(event.target instanceof HTMLSelectElement)) {
        event.preventDefault();
        setFlipped((value) => !value);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [page]);

  const updateProgress = (scopeId: string, updater: (current: Progress) => Progress) => {
    setAppData((current) => ({
      ...current,
      progress: {
        ...current.progress,
        [scopeId]: updater(getProgress(current.progress, scopeId)),
      },
    }));
  };

  const toggleFavorite = (cardId: string) => {
    setAppData((current) => ({
      ...current,
      decks: current.decks.map((deck) => ({
        ...deck,
        cards: deck.cards.map((card) =>
          card.id === cardId ? { ...card, starred: !card.starred } : card,
        ),
      })),
    }));
  };

  const startStudy = (deckId: string, scope: "deck" | "favorites" | "collection" = "deck", collectionId = "") => {
    const deck = appData.decks.find((item) => item.id === deckId);
    const cards = scope === "favorites" ? (deck?.cards.filter(c=>c.starred) ?? []) : scope === "collection" ? allCards.filter(c=>appData.collections.find(x=>x.id===collectionId)?.cardIds.includes(c.id)) : deck?.cards ?? [];
    const scopeId = scope === "favorites" ? `fav:${deckId}` : scope === "collection" ? `collection:${collectionId}` : deckId;
    const progress = getProgress(appData.progress, scopeId);
    const ids = new Set(cards.map(c=>c.id));
    const pending = progress.queue?.length ? progress.queue.filter(id=>ids.has(id)&&!progress.known.includes(id)) : cards.filter(c=>!progress.known.includes(c.id)).map(c=>c.id);
    setStudyScope(scopeId); setStudyDeckId(deckId);
    setScopeLabel(scope === "favorites" ? `${deck?.name} · 즐겨찾기` : scope === "collection" ? appData.collections.find(c=>c.id===collectionId)?.name ?? "나의 모음" : deck?.name ?? "학습");
    setStudyQueue(pending); setLapRemaining(progress.lapRemaining && progress.queue?.length ? Math.min(progress.lapRemaining,pending.length) : pending.length);
    setPasses(progress.passes ?? 1); setPadResetKey(n=>n+1); setFlipped(false);
    setElapsedSeconds(progress.roundSeconds??0); setSessionSavedSeconds(progress.roundSeconds??0); setStudySessionTotal(cards.length);
    setTypingEnabled(deck?.typingSettings?.enabled ?? false);
    setTypingTarget(deck?.typingSettings?.target ?? "reading");
    setRomajiEnabled(deck?.typingSettings?.allowRomaji ?? true);
    setQuizReading("");setQuizMeaning("");setQuizResult("");
    // 학습 페이지에 들어오는 순간부터 타이머 자동 시작
    autoPausedRef.current = false;
    setTimerRunning(pending.length > 0);setPage("study");
    if (pending.length > 0) updateProgress(scopeId, p => ({ ...p, roundStartedAt: p.roundStartedAt ?? new Date().toISOString() }));
    if (pending.length === 0) setToast("현재 회독을 마쳤어요. 다음 회독을 시작할 수 있어요.");
  };

  const studyCards = studyScope.startsWith("fav:") ? appData.decks.find(d=>d.id===studyDeckId)?.cards.filter(c=>c.starred) ?? [] : studyScope.startsWith("collection:") ? allCards.filter(c=>appData.collections.find(x=>x.id===studyScope.slice(11))?.cardIds.includes(c.id)) : appData.decks.find(d=>d.id===studyDeckId)?.cards ?? [];
  const currentCard = studyCards.find((card) => card.id === studyQueue[0]);
  const studyDone = page === "study" && studyQueue.length === 0;
  const studyTotal = studySessionTotal;
  const studyDoneCount = getProgress(appData.progress,studyScope).known.filter(id=>studyCards.some(c=>c.id===id)).length;

  const resetQuiz = () => {setQuizReading("");setQuizMeaning("");setQuizResult("");};
  const recordAnswer = (known: boolean) => {
    if (!currentCard) return;
    const prior = getProgress(appData.progress,studyScope);
    const remaining = Math.max(0,lapRemaining-1);
    let queue = [...studyQueue.slice(1)];
    if (!known) queue.push(currentCard.id);
    let nextLap = remaining;let nextPass = passes;
    if (!remaining && queue.length){queue=[...queue].sort(()=>Math.random()-.5);nextLap=queue.length;nextPass++;setToast(`모르는 ${queue.length}개를 다시 섞었어요 · ${nextPass}차 분류`);}
    const nextKnown=known ? [...new Set([...prior.known,currentCard.id])] : prior.known;
    const nextMistakes=(prior.mistakes ?? 0)+(known?0:1);
    const nextSeconds=prior.seconds+Math.max(0,elapsedSeconds-sessionSavedSeconds);
    const history=[...(prior.roundHistory??[])];
    if (queue.length===0) {
      history.push({round:prior.round??prior.rounds,status:"완료",startedAt:prior.roundStartedAt??null,endedAt:new Date().toISOString(),seconds:elapsedSeconds,passes:nextPass,mistakes:nextMistakes,known:nextKnown.length,cards:studyTotal});
      setTimerRunning(false);
    }
    updateProgress(studyScope,()=>({...prior,known:nextKnown,review:known?prior.review.filter(id=>id!==currentCard.id):[...new Set([...prior.review,currentCard.id])],queue,lapRemaining:nextLap,passes:nextPass,round:prior.round??prior.rounds,seconds:nextSeconds,roundSeconds:elapsedSeconds,roundStartedAt:prior.roundStartedAt??new Date().toISOString(),mistakes:nextMistakes,roundHistory:history,completed:(prior.completed??0)+(queue.length===0?1:0)}));
    setSessionSavedSeconds(elapsedSeconds);setStudyQueue(queue);setLapRemaining(nextLap);setPasses(nextPass);
    setPadResetKey(n=>n+1);setFlipped(false);resetQuiz();
  };
  const markKnown = () => recordAnswer(true);
  const markReview = () => recordAnswer(false);
  const exitStudy = () => {
    const delta=Math.max(0,elapsedSeconds-sessionSavedSeconds);
    if(delta){updateProgress(studyScope,p=>({...p,seconds:p.seconds+delta,roundSeconds:elapsedSeconds}));setSessionSavedSeconds(elapsedSeconds);}
    autoPausedRef.current=false;
    setTimerRunning(false);setPage(studyScope.startsWith("fav:")?"favorites":studyScope.startsWith("collection:")?"collections":"library");
  };
  const resetRound = () => {
    if (!window.confirm("이번 회독의 분류 기록을 지우고 처음부터 다시 시작할까요? 이전 완료 회독 기록과 누적 시간은 보존됩니다."))return;
    const ids=studyCards.map(c=>c.id);const old=getProgress(appData.progress,studyScope);
    const history=[...(old.roundHistory??[])];
    if(old.roundStartedAt)history.push({round:old.round??old.rounds,status:"다시 시작",startedAt:old.roundStartedAt,endedAt:new Date().toISOString(),seconds:elapsedSeconds,passes,mistakes:old.mistakes??0,known:old.known.length,cards:studyTotal});
    updateProgress(studyScope,()=>({...emptyProgress(),round:old.round??old.rounds,rounds:old.round??old.rounds,seconds:old.seconds+Math.max(0,elapsedSeconds-sessionSavedSeconds),roundHistory:history,queue:ids,lapRemaining:ids.length,completed:old.completed??0,roundStartedAt:new Date().toISOString()}));
    autoPausedRef.current=false;
    setStudyQueue(ids);setLapRemaining(ids.length);setPasses(1);setElapsedSeconds(0);setSessionSavedSeconds(0);setTimerRunning(true);setFlipped(false);resetQuiz();setPadResetKey(n=>n+1);
  };
  const nextRound = () => {
    const old=getProgress(appData.progress,studyScope);const next=(old.round??old.rounds)+1;const ids=studyCards.map(c=>c.id);
    updateProgress(studyScope,()=>({...emptyProgress(),round:next,rounds:next,queue:ids,lapRemaining:ids.length,seconds:old.seconds,completed:old.completed??0,roundHistory:old.roundHistory??[],roundStartedAt:new Date().toISOString()}));
    autoPausedRef.current=false;
    setStudyQueue(ids);setLapRemaining(ids.length);setPasses(1);setElapsedSeconds(0);setSessionSavedSeconds(0);setTimerRunning(true);resetQuiz();setFlipped(false);setPadResetKey(n=>n+1);
  };
  const reorderQueue = (shuffle: boolean) => {
    const active=studyQueue.slice(0,lapRemaining);const deferred=studyQueue.slice(lapRemaining);
    const order=new Map(studyCards.map((c,i)=>[c.id,i]));
    if(shuffle){for(let i=active.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[active[i],active[j]]=[active[j],active[i]];}}
    else{active.sort((a,b)=>(order.get(a)??0)-(order.get(b)??0));deferred.sort((a,b)=>(order.get(a)??0)-(order.get(b)??0));}
    const queue=[...active,...deferred];setStudyQueue(queue);updateProgress(studyScope,p=>({...p,queue,lapRemaining}));setFlipped(false);resetQuiz();setPadResetKey(n=>n+1);
  };
  const gradeQuiz = () => {
    if(!currentCard)return;
    const normalized=(s:string)=>s.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g,"");
    const lines:string[]=[];
    if(typingTarget!=="meaning"){
      const actual=normalized(quizReading);const expected=normalized(currentCard.reading);
      const match=actual===expected || (romajiEnabled&&romajiVariants(currentCard.reading).has(actual));
      lines.push(`${match?"✓":"△"} 읽는 법: ${quizReading||"(미입력)"} / 정답: ${currentCard.reading||"(없음)"}`);
    }
    if(typingTarget!=="reading")lines.push(`${normalized(quizMeaning)===normalized(currentCard.back)?"✓ 문구 일치":"△ 정답과 비교"} 뜻: ${quizMeaning||"(미입력)"} / ${currentCard.back}`);
    setQuizResult(lines.join("\n")+"\n답 확인은 분류에 반영되지 않습니다. 아래 버튼으로 직접 분류하세요.");
  };

  const openEdit = (card:Card) => {setEditCardId(card.id);setNewCard({front:card.front,reading:card.reading,back:card.back,voiceLang:card.voiceLang||""});setShowAddCard(true);};
  const removeCard = (id:string) => {
    if(!confirm("이 카드를 삭제할까요? 연관된 학습 상태에서도 제거됩니다."))return;
    setAppData(prev=>({...prev,decks:prev.decks.map(d=>({...d,cards:d.cards.filter(c=>c.id!==id)})),collections:prev.collections.map(c=>({...c,cardIds:c.cardIds.filter(x=>x!==id)})),progress:Object.fromEntries(Object.entries(prev.progress).map(([key,val])=>[key,{...val,known:val.known.filter(x=>x!==id),review:val.review.filter(x=>x!==id),queue:val.queue?.filter(x=>x!==id)}]))}));
    setStudyQueue(q=>q.filter(x=>x!==id));setToast("카드를 삭제했어요.");
  };
  const addCard = () => {
    if (!selectedDeck || !newCard.front.trim() || !newCard.back.trim()) {
      setToast("앞면과 뜻을 입력해 주세요.");
      return;
    }
    const card: Card = {
      id: editCardId??`custom-${crypto.randomUUID()}`,
      front: newCard.front.trim(),
      reading: newCard.reading.trim(),
      back: newCard.back.trim(),
      voiceLang: newCard.voiceLang,
      starred: editCardId ? allCards.find(c=>c.id===editCardId)?.starred : false,
    };
    setAppData((current) => ({
      ...current,
      decks: current.decks.map((deck) =>
        editCardId ? {...deck,cards:deck.cards.map(c=>c.id===editCardId?{...c,...card}:c)} : deck.id === selectedDeck.id ? { ...deck, cards: [...deck.cards, card] } : deck,
      ),
    }));
    setNewCard({ front: "", reading: "", back: "", voiceLang:"" });
    setEditCardId(null);setShowAddCard(false);
    setToast(editCardId?"카드를 수정했어요.":"새 카드를 추가했어요.");
  };

  const createFolder = () => {
    const name=prompt("새 폴더 이름");if(!name?.trim())return;
    setAppData(d=>({...d,folders:[...d.folders,{id:crypto.randomUUID(),name:name.trim(),parent:selectedDeck?.parent||null}]}));setToast("폴더를 만들었어요.");
  };
  const createDeck = () => {
    const name=prompt("새 단어장 이름");if(!name?.trim())return;
    const kind=confirm("언어 학습 단어장으로 만들까요?\n확인: 언어 학습 / 취소: 개념 암기")?"language":"concept";
    const id=crypto.randomUUID();setAppData(d=>({...d,decks:[...d.decks,{id,name:name.trim(),parent:selectedDeck?.parent||"",kind,language:kind==="concept"?"ko-KR":"ja-JP",cards:[]}]}));setSelectedDeckId(id);setToast("단어장을 만들었어요.");
  };
  const renameDeck = (id:string) => {
    const deck=appData.decks.find(d=>d.id===id);if(!deck)return;
    const name=prompt("단어장 이름 수정",deck.name);if(name===null)return;
    if(!name.trim())return setToast("이름을 입력해 주세요.");
    setAppData(d=>({...d,decks:d.decks.map(x=>x.id===id?{...x,name:name.trim()}:x)}));
  };
  const renameFolder = (id:string) => {
    const folder=appData.folders.find(f=>f.id===id);if(!folder)return;
    const name=prompt("폴더 이름 수정",folder.name);if(!name?.trim())return;
    setAppData(d=>({...d,folders:d.folders.map(f=>f.id===id?{...f,name:name.trim()}:f)}));
  };
  const deleteFolder = (id:string) => {
    if(appData.folders.some(f=>f.parent===id)||appData.decks.some(d=>d.parent===id)){setToast("하위 폴더와 단어장을 먼저 옮겨 주세요.");return;}
    if(!confirm("빈 폴더를 삭제할까요?"))return;
    setAppData(d=>({...d,folders:d.folders.filter(f=>f.id!==id)}));
  };
  const deleteDeck = (id:string) => {
    const deck=appData.decks.find(d=>d.id===id);if(!deck||!confirm(`'${deck.name}' 단어장과 소속 카드, 학습 기록을 삭제할까요?`))return;
    const ids=new Set(deck.cards.map(c=>c.id));
    setAppData(d=>({...d,decks:d.decks.filter(x=>x.id!==id),progress:Object.fromEntries(Object.entries(d.progress).filter(([k])=>k!==id&&k!==`fav:${id}`).map(([k,v])=>[k,{...v,known:v.known.filter(x=>!ids.has(x)),review:v.review.filter(x=>!ids.has(x)),queue:v.queue?.filter(x=>!ids.has(x))}])),collections:d.collections.map(c=>({...c,cardIds:c.cardIds.filter(id=>!ids.has(id))}))}));
    setSelectedDeckId(appData.decks.find(d=>d.id!==id)?.id??"");setToast("단어장을 삭제했어요.");
  };
  const createCollection = () => {
    if (!collectionName.trim()) {
      setToast("모음 이름을 입력해 주세요.");
      return;
    }
    setAppData((current) => ({
      ...current,
      collections: [
        ...current.collections,
        { id: crypto.randomUUID(), name: collectionName.trim(), cardIds: [] },
      ],
    }));
    setCollectionName("");
    setToast("새 모음을 만들었어요.");
  };

  const addToCollection = (collectionId: string, cardId: string) => {
    setAppData((current) => ({
      ...current,
      collections: current.collections.map((collection) =>
        collection.id === collectionId
          ? {
              ...collection,
              cardIds: collection.cardIds.includes(cardId)
                ? collection.cardIds
                : [...collection.cardIds, cardId],
            }
          : collection,
      ),
    }));
    setToast("모음에 카드를 추가했어요.");
  };

  const folderPath=(id:string|null):string=>{const parts:string[]=[];let seen=0;while(id&&seen++<40){const f=appData.folders.find(x=>x.id===id);if(!f)break;parts.unshift(f.name);id=f.parent;}return parts.join(" / ");};
  const downloadFile=(content:string,name:string,mime:string)=>{const url=URL.createObjectURL(new Blob([content],{type:mime}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);};
  const quoteCsv=(value:unknown)=>{let str=String(value??"");if(/^[\s]*[=+@]/.test(str)||/^[\s]*-(?!\d)/.test(str))str="'"+str;return `"${str.replace(/"/g,'""')}"`;};
  const writeCsv=(rows:unknown[][],filename:string)=>downloadFile("\uFEFF"+rows.map(r=>r.map(quoteCsv).join(",")).join("\r\n"),filename,"text/csv;charset=utf-8");
  const exportCardsCsv=()=>{
    const decks=csvScope==="all"?appData.decks:selectedDeck?[selectedDeck]:[];
    const header=["폴더경로","단어장","학습유형","기본발음언어","앞면","읽는법","뒷면","개별발음언어","즐겨찾기"];
    writeCsv([header,...decks.flatMap(d=>d.cards.map(c=>[folderPath(d.parent),d.name,d.kind,d.language,c.front,c.reading,c.back,c.voiceLang??"",c.starred?"1":"0"]))],"리콜카드_카드.csv");
  };
  const exportStudyCsv=()=>{
    const decks=csvScope==="all"?appData.decks:selectedDeck?[selectedDeck]:[];
    const header=["단어장","회독","상태","시작일시","종료일시","공부시간(초)","총카드수","알고있음","분류차수","오답횟수"];
    const rows:unknown[][]=[];
    for(const d of decks){const p=getProgress(appData.progress,d.id);for(const record of p.roundHistory??[])rows.push([d.name,record.round,record.status,record.startedAt,record.endedAt,record.seconds,record.cards,record.known,record.passes,record.mistakes]);rows.push([d.name,p.round??1,"현재 상태",p.roundStartedAt??"","",p.roundSeconds??0,d.cards.length,p.known.length,p.passes??1,p.mistakes??0]);}
    writeCsv([header,...rows],"리콜카드_공부기록.csv");
  };
  const importCardsCsv=async(file:File)=>{
    try{
      const text=(await file.text()).replace(/^\uFEFF/,"");const rows: string[][]=[];let row:string[]=[],cell="",quoted=false;
      for(let i=0;i<text.length;i++){const ch=text[i];if(quoted){if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(ch==='"')quoted=false;else cell+=ch;}else if(ch==='"')quoted=true;else if(ch===','){row.push(cell);cell="";}else if(ch==='\r'||ch==='\n'){row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell="";if(ch==='\r'&&text[i+1]==='\n')i++;}else cell+=ch;}
      row.push(cell);if(row.some(Boolean))rows.push(row);
      if(!rows.length)throw Error("빈 CSV 파일입니다.");
      const keys=rows[0].map(x=>x.toLowerCase().replace(/[\s_\/-]/g,""));const field=(...names:string[])=>keys.findIndex(k=>names.includes(k));
      const map={front:field("앞면","일본어","문형","질문","단어","front","word","term","표제어"),back:field("뒷면","한국어뜻","뜻","정답","설명","back","meaning","answer"),reading:field("읽는법","발음","히라가나","reading","pronunciation"),deck:field("단어장","deck","deckname"),folder:field("폴더경로","folderpath","folder"),language:field("기본발음언어","language","decklanguage"),voice:field("개별발음언어","voicelang","cardlanguage"),starred:field("즐겨찾기","favorite","starred")};
      const hasHeader=map.front>=0&&map.back>=0;if(!hasHeader){map.front=0;map.back=1;map.reading=2;}
      const val=(row:string[],idx:number)=>idx<0?"":String(row[idx]??"").trim();
      const records=rows.slice(hasHeader?1:0).map(r=>({front:val(r,map.front),back:val(r,map.back),reading:val(r,map.reading),deck:val(r,map.deck),folder:val(r,map.folder),language:val(r,map.language),voice:val(r,map.voice),starred:/^(1|true|yes)$/i.test(val(r,map.starred))})).filter(x=>x.front&&x.back);
      if(!records.length)throw Error("유효한 카드가 없습니다.");
      if(!confirm(`${records.length}장 가져올까요? 중복 카드는 자동으로 제거되지 않습니다.`))return;
      setAppData(prev=>{
        const folders=[...prev.folders],decks=prev.decks.map(d=>({...d,cards:[...d.cards]}));
        for(const r of records){let target=decks.find(d=>d.id===selectedDeckId);
          if(csvImportScope==="structure"&&r.deck){let parent:string|null=null;for(const part of r.folder.split(/\s*\/\s*/).filter(Boolean)){let f=folders.find(f=>f.parent===parent&&f.name===part);if(!f){f={id:crypto.randomUUID(),name:part,parent};folders.push(f);}parent=f.id;}
            target=decks.find(d=>d.parent===(parent??"")&&d.name===r.deck);if(!target){target={id:crypto.randomUUID(),name:r.deck,parent:parent??"",kind:"language",language:r.language||"ja-JP",cards:[]};decks.push(target);}
          }
          if(!target){target={id:crypto.randomUUID(),name:"CSV 가져온 단어장",parent:"",kind:"language",language:"ja-JP",cards:[]};decks.push(target);}
          target.cards.push({id:crypto.randomUUID(),front:r.front,back:r.back,reading:r.reading,voiceLang:r.voice,starred:r.starred});
        }
        return {...prev,folders,decks};
      });setToast(`${records.length}개 카드 가져오기 완료`);
    }catch(e){setToast(e instanceof Error?e.message:"CSV 가져오기 실패");}
  };
  const exportData = () => {
    downloadBackup(appData);
    setToast("JSON 백업 파일을 저장했어요.");
  };

  const importData = async (file: File) => {
    try {
      const imported = parseBackup(await file.text());
      if (!window.confirm("현재 브라우저 데이터를 백업 파일의 내용으로 교체할까요?")) return;
      setAppData(imported);
      setSelectedDeckId(imported.decks[0]?.id ?? "");
      setToast("백업 데이터를 복원했어요.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "백업 파일을 읽지 못했어요.");
    }
  };

  const globalResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return appData.decks.flatMap((deck) =>
      deck.cards
        .filter((card) =>
          [card.front, card.reading, card.back].some((value) => value.toLowerCase().includes(query)),
        )
        .slice(0, 8)
        .map((card) => ({ ...card, deckName: deck.name, deckId: deck.id })),
    ).slice(0, 12);
  }, [appData.decks, search]);

  const renderDashboard = () => {
    const recentDecks = appData.decks.slice(0, 4);
    const recommendedDeck = selectedDeck ?? appData.decks[0];
    const recommendedProgress = recommendedDeck
      ? getProgress(appData.progress, recommendedDeck.id)
      : emptyProgress();
    const recommendedPercent = recommendedDeck?.cards.length
      ? Math.round((recommendedProgress.known.length / recommendedDeck.cards.length) * 100)
      : 0;

    return (
      <>
        <section className="welcome-row">
          <div>
            <span className="eyebrow green-eyebrow"><Sparkles size={13} /> YOUR DAILY STUDY SPACE</span>
            <h1>오늘도 한 장씩,<br /><em>차근차근.</em></h1>
            <p>짧게 반복하는 시간이 쌓여 실력이 됩니다.</p>
          </div>
          <div className="welcome-art" aria-hidden="true">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-book"><BookOpen size={54} strokeWidth={1.25} /></div>
            <span className="art-spark spark-one">✳</span>
            <span className="art-spark spark-two">✦</span>
            <span className="art-kanji">学</span>
          </div>
        </section>

        <section className="stats-grid">
          <StatCard label="전체 카드" value={formatNumber(totalCards)} hint="N1 기본 단어장" icon={<Layers3 size={19} />} tone="green" />
          <StatCard label="학습 완료" value={formatNumber(knownCount)} hint="알고 있음으로 분류한 카드" icon={<Check size={19} />} tone="blue" />
          <StatCard label="즐겨찾기" value={formatNumber(favoriteCards.length)} hint="다시 보고 싶은 카드" icon={<Heart size={19} />} tone="gold" />
          <StatCard label="누적 학습 시간" value={`${Math.floor(totalStudySeconds / 60)}분`} hint="이 브라우저에 저장된 기록" icon={<Clock3 size={19} />} tone="lavender" />
        </section>

        <section className="dashboard-main-grid">
          <article className="continue-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span>
                <h2>이어서 학습하기</h2>
              </div>
              <span className="soft-tag">추천 학습</span>
            </div>
            {recommendedDeck && (
              <div className="continue-content">
                <div className="deck-cover">
                  <span>N1</span>
                  <strong>DAY<br />{String(appData.decks.indexOf(recommendedDeck) + 1).padStart(2, "0")}</strong>
                  <small>日本語</small>
                </div>
                <div className="continue-info">
                  <span className="eyebrow">JLPT N1 · JAPANESE</span>
                  <h3>{recommendedDeck.name}</h3>
                  <p>{formatNumber(recommendedDeck.cards.length)}개의 카드로 구성된 단어장이에요.</p>
                  <div className="progress-label">
                    <span>학습 진행률</span>
                    <strong>{recommendedPercent}%</strong>
                  </div>
                  <div className="progress-track"><span style={{ width: `${recommendedPercent}%` }} /></div>
                  <button className="button button-primary" onClick={() => startStudy(recommendedDeck.id)}>
                    학습 시작 <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </article>

          <article className="quick-card">
            <div className="quick-icon"><GraduationCap size={22} /></div>
            <span className="eyebrow">SMALL STEPS, BIG CHANGE</span>
            <h3>오늘의 목표를<br />가볍게 시작해요.</h3>
            <p>단어 10개만 복습해도 충분해요.</p>
            <button className="button button-outline" onClick={() => startStudy(selectedDeck?.id ?? appData.decks[0].id)}>
              10분 학습하기 <ArrowRight size={15} />
            </button>
          </article>
        </section>

        <section className="deck-section-block">
          <div className="section-heading">
            <div>
              <span className="eyebrow">YOUR LIBRARY</span>
              <h2>내 단어장</h2>
            </div>
            <button className="text-button" onClick={() => setPage("library")}>전체 보기 <ArrowRight size={15} /></button>
          </div>
          <div className="deck-grid">
            {recentDecks.map((deck, index) => {
              const progress = getProgress(appData.progress, deck.id);
              const percent = deck.cards.length ? Math.round((progress.known.length / deck.cards.length) * 100) : 0;
              return (
                <button
                  className="deck-card"
                  key={deck.id}
                  onClick={() => {
                    setSelectedDeckId(deck.id);
                    setPage("library");
                  }}
                >
                  <div className={`deck-card-art art-tone-${index % 4}`}>
                    <span>DAY {String(index + 1).padStart(2, "0")}</span>
                    <strong>{["語", "読", "覚", "文"][index]}</strong>
                  </div>
                  <div className="deck-card-body">
                    <strong>{deck.name}</strong>
                    <span>{formatNumber(deck.cards.length)} cards · {percent}% 완료</span>
                    <div className="progress-track small"><span style={{ width: `${percent}%` }} /></div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </>
    );
  };

  const renderLibrary = () => {
    const deck = selectedDeck;
    if (!deck) return <EmptyState title="단어장이 없어요" description="기본 단어장을 불러오지 못했습니다." />;
    const query = librarySearch.trim().toLowerCase();
    const filtered = deck.cards.filter((card) =>
      [card.front, card.reading, card.back].some((value) => value.toLowerCase().includes(query)),
    );
    const progress = getProgress(appData.progress, deck.id);
    const percent = deck.cards.length ? Math.round((progress.known.length / deck.cards.length) * 100) : 0;

    return (
      <>
        <section className="page-intro-row">
          <div>
            <span className="eyebrow">YOUR COLLECTION / JLPT N1</span>
            <h1>내 라이브러리</h1>
            <p>단어장을 선택하고, 카드를 정리하고, 바로 학습해 보세요.</p>
          </div>
          <div className="library-create-actions"><button className="button button-outline" onClick={createFolder}>＋ 폴더</button><button className="button button-outline" onClick={createDeck}>＋ 단어장</button><button className="button button-primary" onClick={() => {setEditCardId(null);setNewCard({front:"",reading:"",back:"",voiceLang:""});setShowAddCard(true)}}>
            <Plus size={17} /> 카드 추가</button></div>
        </section>

        <div className="csv-toolbar"><select value={csvScope} onChange={e=>setCsvScope(e.target.value as typeof csvScope)}><option value="current">현재 단어장</option><option value="all">전체 라이브러리</option></select><button className="button button-outline" onClick={exportCardsCsv}>↓ 카드 CSV</button><select value={csvImportScope} onChange={e=>setCsvImportScope(e.target.value as typeof csvImportScope)}><option value="current">현재 단어장에 추가</option><option value="structure">CSV 폴더·단어장 복원</option></select><label className="button button-outline">↑ CSV 가져오기<input type="file" accept=".csv,text/csv" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void importCardsCsv(file);e.target.value=""}}/></label></div>
        <section className="library-layout">
          <aside className="deck-picker panel">
            <div className="panel-heading">
              <strong>단어장 목록</strong>
              <span>{appData.decks.length}</span>
            </div>
            <div className="folder-management"><h4>폴더 구조</h4>{appData.folders.map(folder=><div className="folder-manager-row" key={folder.id}><span>{folderPath(folder.parent)}{folder.parent?" / ":""}{folder.name}</span><button onClick={()=>renameFolder(folder.id)} aria-label="폴더 이름 수정">수정</button><button onClick={()=>deleteFolder(folder.id)} aria-label="폴더 삭제">×</button></div>)}</div>
            <div className="deck-picker-list">
              {appData.decks.map((item, index) => (
                <button
                  key={item.id}
                  className={`deck-picker-item ${item.id === deck.id ? "active" : ""}`}
                  onClick={() => setSelectedDeckId(item.id)}
                >
                  <span className="deck-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="deck-picker-copy">
                    <strong>{item.name}</strong>
                    <small>{item.cards.length} cards</small>
                  </span>
                  {item.id === deck.id && <ChevronDown size={15} />}
                </button>
              ))}
            </div>
          </aside>

          <div className="library-content">
            <article className="deck-overview panel">
              <div className="deck-overview-top">
                <div>
                  <span className="eyebrow">JLPT N1 · DAY {String(appData.decks.indexOf(deck) + 1).padStart(2, "0")}</span>
                  <h2>{deck.name}</h2>
                  <p>일본어 단어 · 한자 읽기와 뜻을 함께 익혀요.</p>
                </div>
                <div className="deck-overview-actions"><button className="button button-outline" onClick={()=>renameDeck(deck.id)}>단어장 설정</button>
                  <select aria-label="기본 발음 언어" value={deck.language} onChange={e=>setAppData(d=>({...d,decks:d.decks.map(x=>x.id===deck.id?{...x,language:e.target.value}:x)}))}><option value="ja-JP">일본어</option><option value="en-US">영어(미국)</option><option value="en-GB">영어(영국)</option><option value="ko-KR">한국어</option><option value="zh-CN">중국어</option><option value="de-DE">독일어</option><option value="fr-FR">프랑스어</option><option value="es-ES">스페인어</option><option value="it-IT">이탈리아어</option></select>
                  <select aria-label="단어장 폴더 변경" value={deck.parent} onChange={e=>setAppData(d=>({...d,decks:d.decks.map(x=>x.id===deck.id?{...x,parent:e.target.value}:x)}))}><option value="">루트</option>{appData.folders.map(f=><option key={f.id} value={f.id}>{folderPath(f.parent)} / {f.name}</option>)}</select>
                  <button className="button button-outline" onClick={()=>deleteDeck(deck.id)}>삭제</button>
                  <button className="button button-outline" onClick={() => startStudy(deck.id)}>
                    <BookOpen size={16} /> 학습하기
                  </button>
                </div>
              </div>
              <div className="deck-mini-stats">
                <div><strong>{formatNumber(deck.cards.length)}</strong><span>전체 카드</span></div>
                <div><strong>{formatNumber(progress.known.length)}</strong><span>학습 완료</span></div>
                <div><strong>{formatNumber(deck.cards.filter((card) => card.starred).length)}</strong><span>즐겨찾기</span></div>
                <div><strong>{percent}%</strong><span>진행률</span></div>
              </div>
              <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
            </article>

            <article className="panel card-list-panel">
              <div className="card-list-heading">
                <div>
                  <h3>카드 목록</h3>
                  <span>{formatNumber(filtered.length)}개의 카드</span>
                </div>
                <div className="card-list-tools">
                  <label className="table-search">
                    <Search size={15} />
                    <input value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="이 단어장에서 검색" />
                  </label>
                  <button className="button button-outline" onClick={()=>setManageOpen(v=>!v)}><ListFilter size={14}/>{manageOpen?"간단히 보기":"카드 전체 관리"}</button>
                </div>
              </div>
              <div className="card-table-head">
                <span>단어 / 읽는 법</span>
                <span>뜻</span>
                <span>출처</span>
                <span />
              </div>
              <div className="card-table">
                {(manageOpen?filtered:filtered.slice(0,30)).map((card) => (
                  <div key={card.id} className="card-edit-row"><CardRow card={card} onToggleFavorite={toggleFavorite} /><div className="card-inline-actions"><button onClick={()=>openEdit(card)}>수정</button><button onClick={()=>removeCard(card.id)}>삭제</button></div></div>
                ))}
                {filtered.length === 0 && <EmptyState title="검색 결과가 없어요" description="다른 단어로 검색해 보세요." />}
                {!manageOpen&&filtered.length>30&&<button className="button button-outline" onClick={()=>setManageOpen(true)}>전체 {filtered.length}개 보기</button>}
              </div>
            </article>
          </div>
        </section>
      </>
    );
  };

  const renderStudy = () => {
    const currentDeck = appData.decks.find((deck) => deck.id === studyDeckId);
    const title = scopeLabel || currentDeck?.name || "카드 학습";
    const percent = studyTotal ? Math.round((studyDoneCount / studyTotal) * 100) : 0;

    if (studyDone) {
      return (
        <section className="study-complete panel">
          <div className="complete-icon"><Check size={34} /></div>
          <span className="eyebrow">SESSION COMPLETED</span>
          <h1>오늘 학습을 완료했어요!</h1>
          <p>{studyTotal}장의 카드를 확인했어요. 작은 반복이 실력이 됩니다.</p>
          <div className="complete-summary">
            <div><strong>{studyTotal}</strong><span>학습 카드</span></div>
            <div><strong>{Math.floor(elapsedSeconds / 60)}분</strong><span>이번 세션 시간</span></div>
          </div>
          <button className="button button-primary" onClick={nextRound}>다음 회독 시작 · 전체 카드 원래 순서 <ArrowRight size={16} /></button>
          <button className="button button-quiet" onClick={()=>setPage("home")}>홈으로 돌아가기</button>
        </section>
      );
    }

    if (!currentCard) {
      return <EmptyState title="학습할 카드가 없어요" description="단어장을 선택하거나 카드를 추가해 주세요." />;
    }

    return (
      <section className="study-page">
        <div className="study-main-column">
        <div className="study-topline">
          <button className="text-button" onClick={exitStudy}>
            <ArrowLeft size={16} /> 나가기
          </button>
          <div className="study-session-title">
            <span className="eyebrow">FOCUS MODE</span>
            <strong>{title}</strong>
          </div>
          <div className="study-timer-buttons"><span className="study-time"><Clock3 size={15}/>{Math.floor(elapsedSeconds/60)}:{String(elapsedSeconds%60).padStart(2,"0")}</span><button className="button button-outline" onClick={()=>{autoPausedRef.current=false;setTimerRunning(v=>!v);if(!timerRunning)updateProgress(studyScope,p=>({...p,roundStartedAt:p.roundStartedAt??new Date().toISOString()}));}}>{timerRunning?"Ⅱ 일시정지":"▶ 이어서 공부"}</button></div>
        </div>

        <div className="study-progress-row"><span>{getProgress(appData.progress,studyScope).round??1}회독 · {passes}차 분류 · 이번 차수 {lapRemaining}개</span>
          <span>{studyDoneCount + 1} <i>/</i> {studyTotal}</span>
          <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
          <span>{percent}%</span>
        </div>

        <div className={`flashcard-wrap ${flipped ? "is-flipped" : ""}`}>
          <button className="flashcard" onClick={() => setShowInlineMeaning((value) => !value)} aria-label={showInlineMeaning ? "한자 아래 뜻 가리기" : "한자 아래 뜻 보기"} aria-expanded={showInlineMeaning}>
            <div className="flashcard-top">
              <span>{flipped ? "ANSWER" : "QUESTION"}</span>
              <span className="flashcard-hint">카드를 눌러 뜻 {showInlineMeaning ? "가리기" : "보기"} <span>↗</span></span>
            </div>
            <div className="flashcard-content">
              {!flipped ? (
                <>
                  <span className="flashcard-kicker">JAPANESE WORD</span>
                  <strong className="flashcard-front">{currentCard.front}</strong>
                  {showInlineMeaning && <span className="flashcard-inline-meaning">{currentCard.back}</span>}
                  <span className="flashcard-reading">{showReading ? (currentCard.reading || "(읽는 법 없음)") : "읽는 법과 뜻을 떠올려 보세요"}</span>
                </>
              ) : (
                <>
                  <span className="flashcard-kicker">MEANING</span>
                  <strong className="flashcard-back">{currentCard.back}</strong>
                  <span className="flashcard-reading">{currentCard.front}{showReading ? ` · ${currentCard.reading || "(읽는 법 없음)"}` : ""}</span>
                </>
              )}
            </div>
            <div className="flashcard-bottom">
              <span><Sparkles size={14} /> 반복해서 기억해요</span>
              <span>SPACE ↵</span>
            </div>
          </button>
        </div>

        <div className="study-card-tools">
          <button className="button button-quiet" onClick={() => setFlipped((value) => !value)}>
            <RotateCcw size={16} /> {flipped ? "앞면 보기" : "뜻 보기"}
          </button>
          <button className="button button-quiet" onClick={() => setShowReading((value) => !value)}>
            <Volume2 size={16} /> {showReading ? "읽는 법 가리기" : "읽는 법 보기"}
          </button>
          <button
            className="button button-quiet"
            onClick={() => {
              if (!("speechSynthesis" in window)) return;
              const utterance = new SpeechSynthesisUtterance(currentCard.front);
              utterance.lang = currentCard.voiceLang || appData.decks.find(d=>d.cards.some(c=>c.id===currentCard.id))?.language || "ja-JP";
              window.speechSynthesis.speak(utterance);
            }}
          >
            <Volume2 size={16} /> 발음 듣기
          </button>
          {appData.collections.length>0&&<select className="button button-quiet" defaultValue="" aria-label="현재 카드를 모음에 추가" onChange={e=>{if(e.target.value)addToCollection(e.target.value,currentCard.id);e.target.value=""}}><option value="">＋ 내 모음에 추가</option>{appData.collections.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}
          <button className={`button button-quiet ${currentCard.starred ? "is-favorite" : ""}`} onClick={() => toggleFavorite(currentCard.id)}>
            <Heart size={16} fill={currentCard.starred ? "currentColor" : "none"} /> 저장
          </button>
        </div>

        <section className="typing-panel-v2">
          <div className="typing-options"><label><input type="checkbox" checked={typingEnabled} onChange={e=>{setTypingEnabled(e.target.checked);setAppData(d=>({...d,decks:d.decks.map(x=>x.id===studyDeckId?{...x,typingSettings:{enabled:e.target.checked,target:typingTarget,allowRomaji:romajiEnabled}}:x)}))}}/> ⌨ 입력형 학습 사용</label><select value={typingTarget} onChange={e=>{const next=e.target.value as typeof typingTarget;setTypingTarget(next);resetQuiz();setAppData(d=>({...d,decks:d.decks.map(x=>x.id===studyDeckId?{...x,typingSettings:{enabled:typingEnabled,target:next,allowRomaji:romajiEnabled}}:x)}))}}><option value="reading">읽는 법</option><option value="meaning">뜻·정답</option><option value="both">둘 다</option></select><label><input type="checkbox" checked={romajiEnabled} onChange={e=>{setRomajiEnabled(e.target.checked);setAppData(d=>({...d,decks:d.decks.map(x=>x.id===studyDeckId?{...x,typingSettings:{enabled:typingEnabled,target:typingTarget,allowRomaji:e.target.checked}}:x)}))}}/> 로마자 인정</label></div>
          {typingEnabled&&<><div className="typing-fields">{typingTarget!=="meaning"&&<input value={quizReading} onChange={e=>setQuizReading(e.target.value)} placeholder="읽는 법 · ひらがな / romaji"/>}{typingTarget!=="reading"&&<textarea value={quizMeaning} onChange={e=>setQuizMeaning(e.target.value)} placeholder="뜻·정답 입력" rows={2}/>}</div><div className="mini-actions"><button className="button button-primary" onClick={gradeQuiz}>입력한 답 확인</button><button className="button button-outline" onClick={()=>setQuizResult(`읽는 법: ${currentCard.reading}\n뜻: ${currentCard.back}`)}>답 바로 보기</button></div>{quizResult&&<div className="quiz-result-v2">{quizResult}</div>}</>}
        </section>
        <div className="study-management-actions"><button className="button button-outline" onClick={()=>reorderQueue(false)}>☷ 원래 순서</button><button className="button button-outline" onClick={()=>reorderQueue(true)}>⇄ 카드 섞기</button><button className="button button-outline" onClick={resetRound}>⟳ 이번 회독 다시 시작</button><button className="button button-outline" onClick={()=>openEdit(currentCard)}>✎ 이 카드 수정</button></div>
        <div className="study-answer-actions">
          <button className="answer-button answer-review" onClick={markReview}>
            <RotateCcw size={18} />
            <span><strong>다시 볼게요</strong><small>한 번 더 반복하기</small></span>
          </button>
          <button className="answer-button answer-known" onClick={markKnown}>
            <Check size={19} />
            <span><strong>알고 있어요</strong><small>다음 카드로 이동</small></span>
          </button>
        </div>
        <p className="study-footnote"><CircleHelp size={13} /> 스페이스바를 눌러 카드 앞면과 뒷면을 전환할 수 있어요.</p>
        </div>
        {/* 필기장을 확대했을 때만 보이는 단어 배너 (CSS :has 로 제어) */}
        <div className="study-word-banner">
          <button type="button" className="study-word-title" aria-expanded={showInlineMeaning} onClick={() => setShowInlineMeaning((value) => !value)}>
            <strong>{currentCard.front}</strong>
            {showInlineMeaning && <span className="study-word-inline-meaning">{currentCard.back}</span>}
          </button>
          <button type="button" className={showReading ? "shown" : ""} onClick={() => setShowReading((value) => !value)}>
            <small>읽는 법</small>{showReading ? (currentCard.reading || "(없음)") : "눌러서 보기"}
          </button>
          <button type="button" className={showInlineMeaning ? "shown" : ""} onClick={() => setShowInlineMeaning((value) => !value)}>
            <small>뜻</small>{showInlineMeaning ? "가리기" : "눌러서 보기"}
          </button>
        </div>
        <Scratchpad key={padResetKey} />
      </section>
    );
  };

  const renderFavorites = () => (
    <>
      <section className="page-intro-row">
        <div>
          <span className="eyebrow">YOUR SAVED WORDS</span>
          <h1>즐겨찾기</h1>
          <p>다시 보고 싶은 단어를 한곳에 모아 복습해요.</p>
        </div>
        <button className="button button-primary" disabled={!selectedDeck?.cards.some(c=>c.starred)} onClick={() => startStudy(selectedDeck?.id ?? "", "favorites")}>
          <BookOpen size={16} /> 즐겨찾기 학습
        </button>
      </section>
      <div className="csv-toolbar"><label>즐겨찾기 단어장 <select value={selectedDeckId} onChange={e=>setSelectedDeckId(e.target.value)}>{appData.decks.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label></div>
      <section className="panel card-list-panel">
        <div className="card-list-heading">
          <div><h3>저장한 카드</h3><span>{selectedDeck?.cards.filter(c=>c.starred).length??0}개의 카드</span></div>
          <span className="soft-tag"><Heart size={13} /> FAVORITES</span>
        </div>
        <div className="card-table-head"><span>단어 / 읽는 법</span><span>뜻</span><span>단어장</span><span /></div>
        <div className="card-table">
          {(selectedDeck?.cards.filter(c=>c.starred)??[]).map((card) => {
            const owner = appData.decks.find((deck) => deck.cards.some((item) => item.id === card.id));
            return <CardRow key={card.id} card={card} deckName={owner?.name} onToggleFavorite={toggleFavorite} />;
          })}
          {!selectedDeck?.cards.some(c=>c.starred) && <EmptyState title="아직 저장한 카드가 없어요" description="라이브러리에서 하트 아이콘을 눌러 카드를 저장해 보세요." />}
        </div>
      </section>
    </>
  );

  const renderCollections = () => (
    <>
      <section className="page-intro-row">
        <div>
          <span className="eyebrow">YOUR CUSTOM SETS</span>
          <h1>나의 모음</h1>
          <p>여러 단어장의 카드를 원하는 기준으로 모아 보세요.</p>
        </div>
      </section>
      <section className="collection-create panel">
        <div className="collection-create-icon"><Layers3 size={22} /></div>
        <div className="collection-create-copy">
          <strong>새로운 카드 모음 만들기</strong>
          <span>예: 자주 틀리는 단어, 시험 직전 복습</span>
        </div>
        <input value={collectionName} onChange={(event) => setCollectionName(event.target.value)} placeholder="모음 이름" />
        <button className="button button-primary" onClick={createCollection}><Plus size={16} /> 만들기</button>
      </section>
      <div className="collection-grid">
        {appData.collections.map((collection) => (
          <article className="collection-card panel" key={collection.id}>
            <div className="collection-card-icon"><Layers3 size={20} /></div>
            <h3>{collection.name}</h3><button className="small-inline-button" onClick={()=>{const name=prompt("모음 이름 변경",collection.name);if(name?.trim())setAppData(d=>({...d,collections:d.collections.map(c=>c.id===collection.id?{...c,name:name.trim()}:c)}))}}>이름 변경</button>
            <p>{collection.cardIds.length}개의 카드</p>
            {collection.cardIds.length>0&&<div className="collection-card-items">{collection.cardIds.slice(0,15).map(id=>{const card=allCards.find(c=>c.id===id);return card?<div key={id}><span>{card.front} · {card.back}</span><button onClick={()=>setAppData(d=>({...d,collections:d.collections.map(c=>c.id===collection.id?{...c,cardIds:c.cardIds.filter(x=>x!==id)}:c)}))} aria-label="모음에서 제외">×</button></div>:null})}{collection.cardIds.length>15&&<small>외 {collection.cardIds.length-15}개</small>}</div>}
            <button className="button button-primary" disabled={!collection.cardIds.length} onClick={()=>startStudy(selectedDeck?.id??"", "collection", collection.id)}>이 모음 학습하기</button>
            <div className="collection-card-footer">
              <select
                aria-label={`${collection.name}에 카드 추가`}
                defaultValue=""
                onChange={(event) => {
                  if (event.target.value) addToCollection(collection.id, event.target.value);
                  event.target.value = "";
                }}
              >
                <option value="">카드 추가하기</option>
                {allCards.map((card) => <option key={card.id} value={card.id}>{card.front} · {card.back}</option>)}
              </select>
              <button className="icon-button" onClick={() => setAppData((current) => ({ ...current, collections: current.collections.filter((item) => item.id !== collection.id) }))} aria-label="모음 삭제"><X size={16} /></button>
            </div>
          </article>
        ))}
        {appData.collections.length === 0 && <EmptyState title="아직 모음이 없어요" description="위에서 새 모음을 만들고 필요한 카드를 추가해 보세요." />}
      </div>
    </>
  );

  const renderKanji = () => {
    const filtered = (kanjiData as KanjiItem[]).filter((item) =>
      [item.char, item.on, item.kun, item.note, ...item.examples.flatMap((example) => [example.word, example.reading, example.meaning])]
        .some((value) => value.toLowerCase().includes(kanjiQuery.trim().toLowerCase())),
    );
    return (
      <>
        <section className="page-intro-row">
          <div>
            <span className="eyebrow">KANJI READING GUIDE</span>
            <h1>한자 음훈독</h1>
            <p>한자의 음독과 훈독, 실제 단어 속 쓰임을 함께 익혀요.</p>
          </div>
          <div className="kanji-count"><strong>{kanjiData.length}</strong><span>한자 항목</span></div>
        </section>
        <div className="kanji-actions"><button className="button button-outline" onClick={()=>setPracticeMode(false)}>☷ 한자 목록</button><button className="button button-outline" onClick={()=>{setPracticeMode(true);setPracticeIndex(0);setPracticeReveal(false)}}>✏ 읽기 셀프테스트</button><button className="button button-outline" onClick={()=>{const rows:unknown[][]=[["한자","음독","훈독","힌트","예시","읽는법","뜻"]];for(const item of kanjiData){for(const e of item.examples)rows.push([item.char,item.on,item.kun,item.note,e.word,e.reading,e.meaning]);}writeCsv(rows,"리콜카드_한자.csv")}}>↓ 한자 CSV</button></div>
        <section className="kanji-toolbar panel">
          <label className="table-search kanji-search"><Search size={16} /><input value={kanjiQuery} onChange={(event) => setKanjiQuery(event.target.value)} placeholder="한자, 음독, 훈독, 예시 단어 검색" /></label>
          <span>{filtered.length}개 결과</span>
        </section>
        {practiceMode&&filtered.length>0&&<section className="kanji-practice panel"><span>{practiceIndex%filtered.length+1} / {filtered.length}</span><strong>{filtered[practiceIndex%filtered.length].char}</strong><p>대표 음독과 훈독을 떠올려 보세요.</p><button className="button button-primary" onClick={()=>setPracticeReveal(v=>!v)}>{practiceReveal?"다시 가리기":"음독·훈독·단어 확인"}</button>{practiceReveal&&<div className="kanji-answer"><p>음독: {filtered[practiceIndex%filtered.length].on}</p><p>훈독: {filtered[practiceIndex%filtered.length].kun}</p>{filtered[practiceIndex%filtered.length].examples.map((e,i)=><div key={i}>{e.word} ({e.reading}) · {e.meaning}</div>)}</div>}<div className="mini-actions"><button className="button button-outline" onClick={()=>{setPracticeIndex(i=>(i+filtered.length-1)%filtered.length);setPracticeReveal(false)}}>← 이전</button><button className="button button-primary" onClick={()=>{setPracticeIndex(i=>(i+1)%filtered.length);setPracticeReveal(false)}}>다음 →</button></div></section>}
        {!practiceMode&&<section className="kanji-grid">
          {filtered.map((item) => (
            <button className="kanji-card panel" key={item.char} onClick={() => setSelectedKanji(item)}>
              <span className="kanji-char">{item.char}</span>
              <span className="kanji-readings"><strong>音 {item.on || "-"}</strong><strong>訓 {item.kun || "-"}</strong></span>
              <span className="kanji-examples">{item.examples.slice(0, 2).map((example) => example.word).join(" · ")}</span>
              <span className="kanji-card-bottom"><small>예시 {item.examples.length}개</small><ArrowRight size={14} /></span>
            </button>
          ))}
        </section>}
        {filtered.length === 0 && <EmptyState title="검색 결과가 없어요" description="다른 한자나 읽는 법으로 검색해 보세요." />}
      </>
    );
  };

  const renderStats = () => {
    const deckStats = appData.decks.map((deck) => {
      const progress = getProgress(appData.progress, deck.id);
      return {
        deck,
        known: progress.known.length,
        percent: deck.cards.length ? Math.round((progress.known.length / deck.cards.length) * 100) : 0,
      };
    });
    return (
      <>
        <section className="page-intro-row">
          <div><span className="eyebrow">YOUR LEARNING INSIGHTS</span><h1>학습 통계</h1><p>지금까지의 학습 진행 상황을 확인해요.</p></div>
          <span className="soft-tag">LOCAL PREVIEW</span>
        </section>
        <section className="stats-grid">
          <StatCard label="전체 카드" value={formatNumber(totalCards)} hint="기본 단어장 기준" icon={<Layers3 size={19} />} />
          <StatCard label="학습 완료" value={formatNumber(knownCount)} hint="알고 있음으로 분류" icon={<Check size={19} />} tone="blue" />
          <StatCard label="다시 볼 카드" value={formatNumber(Object.values(appData.progress).reduce((sum, item) => sum + item.review.length, 0))} hint="복습 대상으로 표시" icon={<RotateCcw size={19} />} tone="gold" />
          <StatCard label="누적 학습 시간" value={`${Math.floor(totalStudySeconds / 60)}분`} hint="저장된 학습 시간" icon={<Clock3 size={19} />} tone="lavender" />
        </section>
        <div className="csv-toolbar"><select value={csvScope} onChange={e=>setCsvScope(e.target.value as typeof csvScope)}><option value="current">현재 단어장</option><option value="all">전체 라이브러리</option></select><button className="button button-outline" onClick={exportStudyCsv}>↓ 공부 기록 CSV</button></div>
        <section className="panel deck-progress-panel">
          <div className="section-heading"><div><span className="eyebrow">BY DECK</span><h2>단어장별 진행률</h2></div><span className="soft-tag">N1 · 20 DAYS</span></div>
          <div className="deck-progress-list">
            {deckStats.map(({ deck, known, percent }) => (
              <div className="deck-progress-row" key={deck.id}>
                <span className="deck-progress-name">{deck.name}</span>
                <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
                <span className="deck-progress-count">{known}/{deck.cards.length}</span>
                <strong>{percent}%</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="panel study-history-panel"><h2>회독별 공부 기록</h2><div className="history-scroll"><table><thead><tr><th>단어장</th><th>회독</th><th>상태</th><th>공부시간</th><th>알고 있음</th><th>차수</th><th>오답</th></tr></thead><tbody>{appData.decks.flatMap(deck=>(getProgress(appData.progress,deck.id).roundHistory??[]).map((record,index)=><tr key={`${deck.id}-${index}`}><td>{deck.name}</td><td>{record.round}</td><td>{record.status}</td><td>{Math.floor(record.seconds/60)}분 {record.seconds%60}초</td><td>{record.known}/{record.cards}</td><td>{record.passes}</td><td>{record.mistakes}</td></tr>))}{!appData.decks.some(d=>(getProgress(appData.progress,d.id).roundHistory??[]).length>0)&&<tr><td colSpan={7}>완료한 회독이 아직 없어요.</td></tr>}</tbody></table></div></section>
      </>
    );
  };

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        onNavigate={setPage}
        decks={appData.decks}
        selectedDeckId={selectedDeckId}
        onSelectDeck={setSelectedDeckId}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((value) => !value)}
        favoriteCount={favoriteCards.length}
      />
      <main className="main-area">
        <Topbar page={page} search={search} onSearchChange={setSearch} onExport={exportData} onImport={importData} />
        {search.trim() && page !== "study" ? (
          <div className="content-area">
            <section className="page-intro-row">
              <div><span className="eyebrow">GLOBAL SEARCH</span><h1>검색 결과</h1><p>단어, 읽는 법, 뜻에서 일치하는 카드를 찾았어요.</p></div>
              <button className="button button-outline" onClick={() => setSearch("")}><X size={15} /> 검색 초기화</button>
            </section>
            <section className="panel card-list-panel">
              <div className="card-list-heading"><div><h3>검색된 카드</h3><span>{globalResults.length}개 표시</span></div></div>
              <div className="card-table-head"><span>단어 / 읽는 법</span><span>뜻</span><span>단어장</span><span /></div>
              <div className="card-table">
                {globalResults.map((card) => <CardRow key={card.id} card={card} deckName={card.deckName} onToggleFavorite={toggleFavorite} />)}
                {globalResults.length === 0 && <EmptyState title="검색 결과가 없어요" description="검색어를 바꿔 다시 시도해 주세요." />}
              </div>
            </section>
          </div>
        ) : (
          <div className="content-area">
            {page === "home" && renderDashboard()}
            {page === "library" && renderLibrary()}
            {page === "study" && renderStudy()}
            {page === "favorites" && renderFavorites()}
            {page === "collections" && renderCollections()}
            {page === "kanji" && renderKanji()}
            {page === "stats" && renderStats()}
          </div>
        )}
      </main>

      {showAddCard && (
        <div className="modal-backdrop" onClick={() => setShowAddCard(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading"><div><span className="eyebrow">NEW FLASHCARD</span><h2>{editCardId?"카드 수정":"새 카드 추가"}</h2></div><button className="icon-button" onClick={() => setShowAddCard(false)}><X size={18} /></button></div>
            <p className="modal-description">{selectedDeck?.name} 단어장에 새 카드를 추가합니다.</p>
            <label className="form-field"><span>앞면 · 일본어</span><input autoFocus value={newCard.front} onChange={(event) => setNewCard({ ...newCard, front: event.target.value })} placeholder="예: 挑戦" /></label>
            <label className="form-field"><span>읽는 법</span><input value={newCard.reading} onChange={(event) => setNewCard({ ...newCard, reading: event.target.value })} placeholder="예: ちょうせん" /></label>
            <label className="form-field"><span>개별 발음 언어</span><select value={newCard.voiceLang} onChange={e=>setNewCard({...newCard,voiceLang:e.target.value})}><option value="">단어장 기본값</option><option value="ja-JP">일본어</option><option value="en-US">영어</option><option value="ko-KR">한국어</option><option value="zh-CN">중국어</option></select></label>
            <label className="form-field"><span>뒷면 · 뜻</span><textarea value={newCard.back} onChange={(event) => setNewCard({ ...newCard, back: event.target.value })} placeholder="예: 도전" rows={3} /></label>
            <div className="modal-actions"><button className="button button-quiet" onClick={() => setShowAddCard(false)}>취소</button><button className="button button-primary" onClick={addCard}><Plus size={16} /> {editCardId?"수정 저장":"카드 저장"}</button></div>
          </div>
        </div>
      )}

      {selectedKanji && (
        <div className="modal-backdrop" onClick={() => setSelectedKanji(null)}>
          <div className="modal-card kanji-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading"><div><span className="eyebrow">KANJI DETAIL</span><h2>한자 상세</h2></div><button className="icon-button" onClick={() => setSelectedKanji(null)}><X size={18} /></button></div>
            <div className="kanji-detail-top"><strong>{selectedKanji.char}</strong><div><span>音読み · {selectedKanji.on}</span><span>訓読み · {selectedKanji.kun}</span></div></div>
            <p className="kanji-note">{selectedKanji.note}</p>
            <h3>예시 단어</h3>
            <div className="kanji-example-list">
              {selectedKanji.examples.map((example, index) => (
                <div key={`${example.word}-${index}`}><strong>{example.word}</strong><span>{example.reading}</span><small>{example.meaning}</small><em>DAY {example.day}</em></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast"><Check size={16} /> {toast}</div>}
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><div><BookOpen size={23} /></div><strong>{title}</strong><span>{description}</span></div>;
}


export default App;