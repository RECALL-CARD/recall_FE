import { useEffect, useMemo, useState } from "react";
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [newCard, setNewCard] = useState({ front: "", reading: "", back: "" });
  const [toast, setToast] = useState("");
  const [studyQueue, setStudyQueue] = useState<string[]>([]);
  const [studyScope, setStudyScope] = useState("deck");
  const [studyDeckId, setStudyDeckId] = useState(appData.decks[0]?.id ?? "");
  const [flipped, setFlipped] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessionSavedSeconds, setSessionSavedSeconds] = useState(0);
  const [studySessionTotal, setStudySessionTotal] = useState(0);
  const [kanjiQuery, setKanjiQuery] = useState("");
  const [selectedKanji, setSelectedKanji] = useState<KanjiItem | null>(null);
  const [collectionName, setCollectionName] = useState("");

  const selectedDeck = appData.decks.find((deck) => deck.id === selectedDeckId) ?? appData.decks[0];
  const allCards = useMemo(() => appData.decks.flatMap((deck) => deck.cards), [appData.decks]);
  const favoriteCards = useMemo(() => allCards.filter((card) => card.starred), [allCards]);
  const totalCards = allCards.length;
  const knownCount = Object.values(appData.progress).reduce((sum, item) => sum + item.known.length, 0);
  const totalStudySeconds = Object.values(appData.progress).reduce((sum, item) => sum + item.seconds, 0);

  useEffect(() => {
    saveAppData(appData);
  }, [appData]);

  useEffect(() => {
    if (page !== "study" || studyQueue.length === 0) return;
    const timer = window.setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [page, studyQueue.length]);

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
      if (page === "study" && event.code === "Space" && !(event.target instanceof HTMLInputElement)) {
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

  const startStudy = (deckId: string, scope: "deck" | "favorites" = "deck") => {
    const deck = appData.decks.find((item) => item.id === deckId);
    const cards = scope === "favorites" ? favoriteCards : deck?.cards ?? [];
    const scopeId = scope === "favorites" ? "favorites" : deckId;
    const progress = getProgress(appData.progress, scopeId);
    const pending = cards.filter((card) => !progress.known.includes(card.id));
    setStudyScope(scopeId);
    setStudyDeckId(deckId);
    setStudyQueue(pending.map((card) => card.id));
    setFlipped(false);
    setElapsedSeconds(0);
    setSessionSavedSeconds(0);
    setStudySessionTotal(pending.length);
    setPage("study");
    if (pending.length === 0) setToast("학습할 카드가 없어요. 라이브러리에서 카드를 추가해 보세요.");
  };

  const studyCards = studyScope === "favorites" ? favoriteCards : selectedDeck?.cards ?? [];
  const currentCard = studyCards.find((card) => card.id === studyQueue[0]);
  const studyDone = page === "study" && studyQueue.length === 0;
  const studyTotal = studySessionTotal;
  const studyDoneCount = studyTotal - studyQueue.length;

  const markKnown = () => {
    if (!currentCard) return;
    updateProgress(studyScope, (current) => ({
      ...current,
      known: current.known.includes(currentCard.id) ? current.known : [...current.known, currentCard.id],
      review: current.review.filter((id) => id !== currentCard.id),
      seconds: current.seconds + Math.max(0, elapsedSeconds - sessionSavedSeconds),
    }));
    setSessionSavedSeconds(elapsedSeconds);
    setStudyQueue((queue) => queue.slice(1));
    setFlipped(false);
  };

  const exitStudy = () => {
    const unsavedSeconds = Math.max(0, elapsedSeconds - sessionSavedSeconds);
    if (unsavedSeconds > 0) {
      updateProgress(studyScope, (current) => ({
        ...current,
        seconds: current.seconds + unsavedSeconds,
      }));
      setSessionSavedSeconds(elapsedSeconds);
    }
    setPage(studyScope === "favorites" ? "favorites" : "library");
  };

  const markReview = () => {
    if (!currentCard) return;
    updateProgress(studyScope, (current) => ({
      ...current,
      review: current.review.includes(currentCard.id) ? current.review : [...current.review, currentCard.id],
    }));
    setStudyQueue((queue) => (queue.length > 1 ? [...queue.slice(1), queue[0]] : queue));
    setFlipped(false);
  };

  const addCard = () => {
    if (!selectedDeck || !newCard.front.trim() || !newCard.back.trim()) {
      setToast("앞면과 뜻을 입력해 주세요.");
      return;
    }
    const card: Card = {
      id: `custom-${crypto.randomUUID()}`,
      front: newCard.front.trim(),
      reading: newCard.reading.trim(),
      back: newCard.back.trim(),
      voiceLang: "ja-JP",
      starred: false,
    };
    setAppData((current) => ({
      ...current,
      decks: current.decks.map((deck) =>
        deck.id === selectedDeck.id ? { ...deck, cards: [...deck.cards, card] } : deck,
      ),
    }));
    setNewCard({ front: "", reading: "", back: "" });
    setShowAddCard(false);
    setToast("새 카드를 추가했어요.");
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
    const query = search.trim().toLowerCase();
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
          <button className="button button-primary" onClick={() => setShowAddCard(true)}>
            <Plus size={17} /> 카드 추가
          </button>
        </section>

        <section className="library-layout">
          <aside className="deck-picker panel">
            <div className="panel-heading">
              <strong>단어장 목록</strong>
              <span>{appData.decks.length}</span>
            </div>
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
                <div className="deck-overview-actions">
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
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="이 단어장에서 검색" />
                  </label>
                  <span className="filter-chip"><ListFilter size={14} /> 전체 카드</span>
                </div>
              </div>
              <div className="card-table-head">
                <span>단어 / 읽는 법</span>
                <span>뜻</span>
                <span>출처</span>
                <span />
              </div>
              <div className="card-table">
                {filtered.slice(0, 30).map((card) => (
                  <CardRow key={card.id} card={card} onToggleFavorite={toggleFavorite} />
                ))}
                {filtered.length === 0 && <EmptyState title="검색 결과가 없어요" description="다른 단어로 검색해 보세요." />}
                {filtered.length > 30 && <p className="list-note">검색 결과 중 30개를 표시하고 있어요. 더 구체적으로 검색해 보세요.</p>}
              </div>
            </article>
          </div>
        </section>
      </>
    );
  };

  const renderStudy = () => {
    const currentDeck = appData.decks.find((deck) => deck.id === studyDeckId);
    const title = studyScope === "favorites" ? "즐겨찾기 학습" : currentDeck?.name ?? "카드 학습";
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
          <button className="button button-primary" onClick={() => setPage("home")}>홈으로 돌아가기 <ArrowRight size={16} /></button>
        </section>
      );
    }

    if (!currentCard) {
      return <EmptyState title="학습할 카드가 없어요" description="단어장을 선택하거나 카드를 추가해 주세요." />;
    }

    return (
      <section className="study-page">
        <div className="study-topline">
          <button className="text-button" onClick={exitStudy}>
            <ArrowLeft size={16} /> 나가기
          </button>
          <div className="study-session-title">
            <span className="eyebrow">FOCUS MODE</span>
            <strong>{title}</strong>
          </div>
          <div className="study-time"><Clock3 size={15} /> {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, "0")}</div>
        </div>

        <div className="study-progress-row">
          <span>{studyDoneCount + 1} <i>/</i> {studyTotal}</span>
          <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
          <span>{percent}%</span>
        </div>

        <div className={`flashcard-wrap ${flipped ? "is-flipped" : ""}`}>
          <button className="flashcard" onClick={() => setFlipped((value) => !value)} aria-label="카드 뒤집기">
            <div className="flashcard-top">
              <span>{flipped ? "ANSWER" : "QUESTION"}</span>
              <span className="flashcard-hint">카드를 눌러 뒤집기 <span>↗</span></span>
            </div>
            <div className="flashcard-content">
              {!flipped ? (
                <>
                  <span className="flashcard-kicker">JAPANESE WORD</span>
                  <strong className="flashcard-front">{currentCard.front}</strong>
                  <span className="flashcard-reading">{currentCard.reading || "읽는 법을 확인해 보세요"}</span>
                </>
              ) : (
                <>
                  <span className="flashcard-kicker">MEANING</span>
                  <strong className="flashcard-back">{currentCard.back}</strong>
                  <span className="flashcard-reading">{currentCard.front} · {currentCard.reading}</span>
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
            <RotateCcw size={16} /> {flipped ? "앞면 보기" : "뜻 확인하기"}
          </button>
          <button
            className="button button-quiet"
            onClick={() => {
              if (!("speechSynthesis" in window)) return;
              const utterance = new SpeechSynthesisUtterance(currentCard.front);
              utterance.lang = currentCard.voiceLang || "ja-JP";
              window.speechSynthesis.speak(utterance);
            }}
          >
            <Volume2 size={16} /> 발음 듣기
          </button>
          <button className={`button button-quiet ${currentCard.starred ? "is-favorite" : ""}`} onClick={() => toggleFavorite(currentCard.id)}>
            <Heart size={16} fill={currentCard.starred ? "currentColor" : "none"} /> 저장
          </button>
        </div>

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
        <button className="button button-primary" disabled={favoriteCards.length === 0} onClick={() => startStudy(selectedDeck?.id ?? "", "favorites")}>
          <BookOpen size={16} /> 즐겨찾기 학습
        </button>
      </section>
      <section className="panel card-list-panel">
        <div className="card-list-heading">
          <div><h3>저장한 카드</h3><span>{favoriteCards.length}개의 카드</span></div>
          <span className="soft-tag"><Heart size={13} /> FAVORITES</span>
        </div>
        <div className="card-table-head"><span>단어 / 읽는 법</span><span>뜻</span><span>단어장</span><span /></div>
        <div className="card-table">
          {favoriteCards.map((card) => {
            const owner = appData.decks.find((deck) => deck.cards.some((item) => item.id === card.id));
            return <CardRow key={card.id} card={card} deckName={owner?.name} onToggleFavorite={toggleFavorite} />;
          })}
          {favoriteCards.length === 0 && <EmptyState title="아직 저장한 카드가 없어요" description="라이브러리에서 하트 아이콘을 눌러 카드를 저장해 보세요." />}
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
            <h3>{collection.name}</h3>
            <p>{collection.cardIds.length}개의 카드</p>
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
        <section className="kanji-toolbar panel">
          <label className="table-search kanji-search"><Search size={16} /><input value={kanjiQuery} onChange={(event) => setKanjiQuery(event.target.value)} placeholder="한자, 음독, 훈독, 예시 단어 검색" /></label>
          <span>{filtered.length}개 결과</span>
        </section>
        <section className="kanji-grid">
          {filtered.map((item) => (
            <button className="kanji-card panel" key={item.char} onClick={() => setSelectedKanji(item)}>
              <span className="kanji-char">{item.char}</span>
              <span className="kanji-readings"><strong>音 {item.on || "-"}</strong><strong>訓 {item.kun || "-"}</strong></span>
              <span className="kanji-examples">{item.examples.slice(0, 2).map((example) => example.word).join(" · ")}</span>
              <span className="kanji-card-bottom"><small>예시 {item.examples.length}개</small><ArrowRight size={14} /></span>
            </button>
          ))}
        </section>
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
            <div className="modal-heading"><div><span className="eyebrow">NEW FLASHCARD</span><h2>새 카드 추가</h2></div><button className="icon-button" onClick={() => setShowAddCard(false)}><X size={18} /></button></div>
            <p className="modal-description">{selectedDeck?.name} 단어장에 새 카드를 추가합니다.</p>
            <label className="form-field"><span>앞면 · 일본어</span><input autoFocus value={newCard.front} onChange={(event) => setNewCard({ ...newCard, front: event.target.value })} placeholder="예: 挑戦" /></label>
            <label className="form-field"><span>읽는 법</span><input value={newCard.reading} onChange={(event) => setNewCard({ ...newCard, reading: event.target.value })} placeholder="예: ちょうせん" /></label>
            <label className="form-field"><span>뒷면 · 뜻</span><textarea value={newCard.back} onChange={(event) => setNewCard({ ...newCard, back: event.target.value })} placeholder="예: 도전" rows={3} /></label>
            <div className="modal-actions"><button className="button button-quiet" onClick={() => setShowAddCard(false)}>취소</button><button className="button button-primary" onClick={addCard}><Plus size={16} /> 카드 저장</button></div>
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
