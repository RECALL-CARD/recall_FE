import defaultLibrary from "../data/default-library.json";
import type { AppData, Deck, Progress } from "../types";

const STORAGE_KEY = "recall-card-react-web-v1";

type PersistedData = Partial<AppData>;

function createInitialData(): AppData {
  return {
    folders: defaultLibrary.folders,
    decks: defaultLibrary.decks as Deck[],
    progress: {},
    collections: [],
  };
}

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialData();

    const saved = JSON.parse(raw) as PersistedData;
    return {
      ...createInitialData(),
      ...saved,
      folders: saved.folders ?? defaultLibrary.folders,
      decks: (saved.decks as Deck[] | undefined) ?? (defaultLibrary.decks as Deck[]),
      progress: saved.progress ?? {},
      collections: saved.collections ?? [],
    };
  } catch {
    return createInitialData();
  }
}

export function saveAppData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getProgress(progressMap: Record<string, Progress>, scopeId: string): Progress {
  const existing = progressMap[scopeId];
  return {
    known: Array.isArray(existing?.known) ? existing.known : [],
    review: Array.isArray(existing?.review) ? existing.review : [],
    seconds: Number(existing?.seconds) || 0,
    rounds: Number(existing?.round ?? existing?.rounds) || 1,
    round: Number(existing?.round ?? existing?.rounds) || 1,
    passes: Number(existing?.passes) || 1,
    mistakes: Number(existing?.mistakes) || 0,
    completed: Number(existing?.completed) || 0,
    queue: existing?.queue,
    lapRemaining: existing?.lapRemaining,
    roundSeconds: Number(existing?.roundSeconds) || 0,
    roundHistory: Array.isArray(existing?.roundHistory) ? existing.roundHistory : [],
    roundStartedAt: existing?.roundStartedAt ?? null,
    legacySeconds: Number(existing?.legacySeconds) || 0,
  };
}

export function downloadBackup(data: AppData): void {
  // The legacy HTML understands this version-7 format; every deck keeps its own
  // independent round state, with favorites and collections stored separately.
  const createProgress = (ids: string[], existing?: Progress): Progress => {
    const p = existing ? getProgress({ saved: existing }, "saved") : getProgress({}, "saved");
    const known = p.known.filter(id=>ids.includes(id));
    const queue = p.queue?.filter(id=>ids.includes(id)&&!known.includes(id)) ?? ids.filter(id=>!known.includes(id));
    return {...p, known, queue, lapRemaining: p.lapRemaining===undefined ? queue.length : Math.min(p.lapRemaining,queue.length),round:p.round??1,passes:p.passes??1};
  };
  const decks = data.decks.map(deck=>({
    ...deck,
    progress:createProgress(deck.cards.map(c=>c.id),data.progress[deck.id]),
    favoriteProgress:createProgress(deck.cards.filter(c=>c.starred).map(c=>c.id),data.progress[`fav:${deck.id}`]),
  }));
  const collections = data.collections.map(collection=>{
    const entries = collection.cardIds.flatMap(cardId=>{
      const deck=data.decks.find(d=>d.cards.some(c=>c.id===cardId));
      return deck?[{deckId:deck.id,cardId}]:[];
    });
    return {...collection,entries,progress:createProgress(entries.map(e=>e.cardId),data.progress[`collection:${collection.id}`])};
  });
  const payload = {
    format:"recall-cards-backup",
    version:7,
    exportedAt:new Date().toISOString(),
    data:{version:7,folders:data.folders,decks,collections,selected:data.decks[0]?.id??null,
      activeView:"deck",activeCollection:null,ui:{pad:true,library:true,paper:"grid",collapsed:[]}},
  };
  const blob = new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=url;
  anchor.download=`recall-card-backup-v7-${new Date().toISOString().slice(0,10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function parseBackup(text: string): AppData {
  const parsed = JSON.parse(text) as {
    format?: string;
    data?: AppData;
  };

  if (parsed.format === "recall-cards-backup" && parsed.data?.decks) {
    const legacy = parsed.data as Omit<AppData,"collections"> & {collections?: Array<{id:string;name:string;entries?:Array<{deckId:string;cardId:string}>;cardIds?:string[];progress?:Progress}>};
    const progress: Record<string, Progress> = {};
    for (const deck of legacy.decks as Array<Deck & {progress?:Progress;favoriteProgress?:Progress}>) {
      if (deck.progress) progress[deck.id] = deck.progress;
      if (deck.favoriteProgress) progress[`fav:${deck.id}`] = deck.favoriteProgress;
      for (const card of deck.cards) card.starred = Boolean(card.starred);
    }
    for (const c of legacy.collections ?? []) if (c.progress) progress[`collection:${c.id}`] = c.progress;
    return {
      folders: legacy.folders ?? [], decks: legacy.decks,
      collections: (legacy.collections ?? []).map(c => ({id:c.id,name:c.name,cardIds:c.cardIds ?? (c.entries ?? []).map(e=>e.cardId)})), progress,
    };
  }
  if (parsed.format !== "recall-card-web-backup" || !parsed.data?.decks) {
    throw new Error("지원하지 않는 백업 형식입니다. 원본 리콜카드 v7 JSON 또는 React 백업을 선택하세요.");
  }

  return {
    folders: parsed.data.folders ?? [],
    decks: parsed.data.decks,
    progress: parsed.data.progress ?? {},
    collections: parsed.data.collections ?? [],
  };
}
