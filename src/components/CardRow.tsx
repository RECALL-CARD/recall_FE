import { Heart, Volume2 } from "lucide-react";
import type { Card } from "../types";

type CardRowProps = {
  card: Card;
  deckName?: string;
  onToggleFavorite: (cardId: string) => void;
};

export function CardRow({ card, deckName, onToggleFavorite }: CardRowProps) {
  const speak = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(card.front);
    utterance.lang = card.voiceLang || "ja-JP";
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="card-row">
      <div className="card-word-cell">
        <strong>{card.front}</strong>
        <span>{card.reading || "읽는 법 없음"}</span>
      </div>
      <div className="card-meaning-cell">{card.back}</div>
      <div className="card-source-cell">{deckName ?? `p.${card.sourcePage ?? "-"}`}</div>
      <div className="card-row-actions">
        <button className="icon-button" onClick={speak} title="발음 듣기" aria-label="발음 듣기">
          <Volume2 size={16} />
        </button>
        <button
          className={`icon-button favorite-button ${card.starred ? "is-favorite" : ""}`}
          onClick={() => onToggleFavorite(card.id)}
          title="즐겨찾기"
          aria-label="즐겨찾기"
        >
          <Heart size={16} fill={card.starred ? "currentColor" : "none"} />
        </button>
      </div>
    </div>
  );
}
