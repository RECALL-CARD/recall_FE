import { Download, Search, Upload } from "lucide-react";
import type { Page } from "../types";

const pageTitles: Record<Page, string> = {
  home: "홈",
  library: "내 라이브러리",
  study: "학습하기",
  favorites: "즐겨찾기",
  collections: "나의 모음",
  kanji: "한자 음훈독",
  stats: "학습 통계",
};

type TopbarProps = {
  page: Page;
  search: string;
  onSearchChange: (value: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
};

export function Topbar({ page, search, onSearchChange, onExport, onImport }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-heading">
        <span className="eyebrow">RECALL CARD / STUDY SPACE</span>
        <strong>{pageTitles[page]}</strong>
      </div>

      <div className="topbar-actions">
        <label className="global-search">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="단어, 뜻 검색"
            aria-label="전체 검색"
          />
          <kbd>⌘ K</kbd>
        </label>
        <button className="button button-quiet top-action" onClick={onExport} title="JSON 백업">
          <Download size={16} />
          <span>백업</span>
        </button>
        <label className="button button-quiet top-action upload-action" title="JSON 복원">
          <Upload size={16} />
          <span>복원</span>
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImport(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <div className="top-avatar" title="내 학습 공간">R</div>
      </div>
    </header>
  );
}
