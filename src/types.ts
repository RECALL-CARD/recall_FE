export type Card = {
  id: string;
  front: string;
  back: string;
  reading: string;
  voiceLang?: string;
  needsReview?: boolean;
  sourcePage?: number | null;
  sourceKind?: string;
  starred?: boolean;
};

export type Deck = {
  id: string;
  name: string;
  parent: string;
  kind: "language" | "concept";
  language: string;
  cards: Card[];
};

export type Folder = {
  id: string;
  name: string;
  parent: string | null;
};

export type Progress = {
  known: string[];
  review: string[];
  seconds: number;
  rounds: number;
};

export type Collection = {
  id: string;
  name: string;
  cardIds: string[];
};

export type AppData = {
  folders: Folder[];
  decks: Deck[];
  progress: Record<string, Progress>;
  collections: Collection[];
};

export type Page = "home" | "library" | "study" | "favorites" | "collections" | "kanji" | "stats";
