import {
  BookOpen,
  BarChart3,
  Heart,
  Home,
  GraduationCap,
  Layers3,
  Library,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from "lucide-react";
import type { Deck, Page } from "../types";

type SidebarProps = {
  page: Page;
  onNavigate: (page: Page) => void;
  decks: Deck[];
  selectedDeckId: string;
  onSelectDeck: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  favoriteCount: number;
};

export function Sidebar({
  page,
  onNavigate,
  decks,
  selectedDeckId,
  onSelectDeck,
  collapsed,
  onToggle,
  favoriteCount,
}: SidebarProps) {
  const mainItems: { id: Page; label: string; icon: typeof Home; count?: number }[] = [
    { id: "home", label: "홈", icon: Home },
    { id: "library", label: "내 라이브러리", icon: Library },
    { id: "favorites", label: "즐겨찾기", icon: Heart, count: favoriteCount },
    { id: "collections", label: "나의 모음", icon: Layers3 },
    { id: "kanji", label: "한자 음훈독", icon: BookOpen },
    { id: "stats", label: "학습 통계", icon: BarChart3 },
  ];

  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className="sidebar-brand">
        <div className="brand-mark">R</div>
        {!collapsed && (
          <div className="brand-copy">
            <strong>Recall Card</strong>
            <span>나만의 학습 공간</span>
          </div>
        )}
        <button className="icon-button sidebar-toggle" onClick={onToggle} aria-label="사이드바 접기">
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>

      <div className="sidebar-scroll">
        <div className="sidebar-section">
          {!collapsed && <p className="sidebar-label">WORKSPACE</p>}
          {mainItems.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "active" : ""}`}
              onClick={() => onNavigate(id)}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} strokeWidth={1.9} />
              {!collapsed && <span>{label}</span>}
              {!collapsed && count !== undefined && <small>{count}</small>}
            </button>
          ))}
        </div>

        <div className="sidebar-section deck-section">
          <div className="sidebar-section-heading">
            {!collapsed && <p className="sidebar-label">N1 단어장</p>}
            {!collapsed && <span className="deck-total">{decks.length}</span>}
          </div>
          {decks.map((deck, index) => (
            <button
              key={deck.id}
              className={`deck-nav-item ${selectedDeckId === deck.id && page === "library" ? "selected" : ""}`}
              onClick={() => {
                onSelectDeck(deck.id);
                onNavigate("library");
              }}
              title={collapsed ? deck.name : undefined}
            >
              <span className="deck-nav-dot">{String(index + 1).padStart(2, "0")}</span>
              {!collapsed && <span className="deck-nav-name">{deck.name.replace(/^N1 DAY \d+ · /, "")}</span>}
            </button>
          ))}
        </div>
      </div>

      {!collapsed && (
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <div className="tip-icon"><Sparkles size={15} /></div>
            <div>
              <strong>매일 조금씩</strong>
              <span>반복이 실력이 돼요.</span>
            </div>
          </div>
          <div className="sidebar-user">
            <div className="avatar">R</div>
            <div className="sidebar-user-copy">
              <strong>내 학습 공간</strong>
              <span>로컬 미리보기</span>
            </div>
            <GraduationCap size={17} className="user-end-icon" />
          </div>
        </div>
      )}
    </aside>
  );
}
