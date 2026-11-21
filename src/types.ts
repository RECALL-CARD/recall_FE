export type Card = { id: string; front: string; back: string; reading: string; voiceLang?: string; needsReview?: boolean; sourcePage?: number|null; sourceKind?: string; starred?: boolean };
export type RoundRecord = { round: number; status: string; startedAt: string|null; endedAt: string; seconds: number; passes: number; mistakes: number; known: number; cards: number };
export type Progress = { known: string[]; review: string[]; seconds: number; rounds: number; round?: number; passes?: number; completed?: number; queue?: string[]; mistakes?: number; lapRemaining?: number; roundSeconds?: number; roundStartedAt?: string|null; roundHistory?: RoundRecord[]; legacySeconds?: number };
export type Deck = {id: string; name: string; parent: string; kind: "language"|"concept"; language: string; cards: Card[]; typingSettings?: {enabled: boolean; target: "reading"|"meaning"|"both";allowRomaji:boolean} };
export type Folder = {id: string; name: string; parent: string|null};
export type Collection = {id:string;name:string;cardIds:string[]};
export type AppData = {folders:Folder[];decks:Deck[];progress:Record<string,Progress>;collections:Collection[]};
export type Page="home"|"library"|"study"|"favorites"|"collections"|"kanji"|"stats";
