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
  return progressMap[scopeId] ?? {
    known: [],
    review: [],
    seconds: 0,
    rounds: 1,
  };
}

export function downloadBackup(data: AppData): void {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          format: "recall-card-web-backup",
          version: 1,
          exportedAt: new Date().toISOString(),
          data,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `recall-card-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function parseBackup(text: string): AppData {
  const parsed = JSON.parse(text) as {
    format?: string;
    data?: AppData;
  };

  if (parsed.format !== "recall-card-web-backup" || !parsed.data?.decks) {
    throw new Error("Recall Card 백업 파일 형식이 아닙니다.");
  }

  return {
    folders: parsed.data.folders ?? [],
    decks: parsed.data.decks,
    progress: parsed.data.progress ?? {},
    collections: parsed.data.collections ?? [],
  };
}
