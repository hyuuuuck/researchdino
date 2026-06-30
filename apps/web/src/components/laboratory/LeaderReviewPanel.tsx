import { useMemo, useState } from "react";
import type { WorkflowCardData } from "../../types/research";

interface LeaderReviewPanelProps {
  cards: WorkflowCardData[];
  onDecision: (
    cardId: string,
    decision: "approved" | "rejected" | "needs_revision" | "stored_in_library",
    reason: string,
  ) => void | Promise<void>;
}

export function LeaderReviewPanel({ cards, onDecision }: LeaderReviewPanelProps) {
  const reviewCards = useMemo(
    () => cards.filter((card) => card.requiresUserReview || card.status === "waiting_for_user"),
    [cards],
  );
  const [selectedCardId, setSelectedCardId] = useState(reviewCards[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const selectedCard = reviewCards.find((card) => card.id === selectedCardId) ?? reviewCards[0];

  if (!selectedCard) {
    return (
      <section className="leader-review-panel">
        <div className="panel-heading panel-heading--compact">
          <span className="panel-kicker">Leader Gate</span>
          <h2>Review Queue</h2>
        </div>
        <p className="empty-note">No cards currently require review.</p>
      </section>
    );
  }

  return (
    <section className="leader-review-panel" aria-label="Leader review panel">
      <div className="panel-heading panel-heading--compact">
        <span className="panel-kicker">Leader Gate</span>
        <h2>Review Queue</h2>
      </div>
      <label className="field-label">
        Pending item
        <select value={selectedCard.id} onChange={(event) => setSelectedCardId(event.target.value)}>
          {reviewCards.map((card) => (
            <option key={card.id} value={card.id}>
              {card.title}
            </option>
          ))}
        </select>
      </label>
      <div className="review-target">
        <span className={`type-chip type-chip--${selectedCard.type}`}>{selectedCard.type}</span>
        <strong>{selectedCard.title}</strong>
        <p>{selectedCard.summary}</p>
      </div>
      <label className="field-label">
        Reason / instruction
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Record approval rationale, rejection reason, or re-analysis instruction."
        />
      </label>
      <div className="review-actions">
        <button type="button" onClick={() => onDecision(selectedCard.id, "approved", reason)}>
          Approve
        </button>
        <button type="button" onClick={() => onDecision(selectedCard.id, "rejected", reason)}>
          Reject
        </button>
        <button type="button" onClick={() => onDecision(selectedCard.id, "needs_revision", reason)}>
          Request Re-analysis
        </button>
        <button type="button" onClick={() => onDecision(selectedCard.id, "stored_in_library", reason)}>
          Send to Library
        </button>
      </div>
    </section>
  );
}
