import type { WorkflowCardData } from "../../types/research";
import { formatStatusLabel } from "../../lib/format";
import { DinoAgentAvatar } from "./DinoAgentAvatar";

interface WorkflowCardProps {
  card: WorkflowCardData;
  selected: boolean;
  compact?: boolean;
  onSelect: (cardId: string) => void;
}

const cardTypeLabels: Record<WorkflowCardData["type"], string> = {
  paper: "Paper",
  claim: "Claim",
  claim_debate: "Claim Debate",
  paper_review: "Paper Review",
  contradiction_review: "Contradiction",
  hypothesis_debate: "Hypothesis Debate",
  experiment_feasibility: "Feasibility",
  hypothesis: "Hypothesis",
  experiment: "Experiment",
  manuscript: "Manuscript",
  review: "Review",
  error: "Error",
};

export function WorkflowCard({ card, selected, compact = false, onSelect }: WorkflowCardProps) {
  if (compact) {
    return (
      <button
        className={`workflow-card workflow-card--compact workflow-card--${card.status} ${selected ? "is-selected" : ""}`}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onSelect(card.id);
        }}
        title={card.title}
      >
        <span className={`type-chip type-chip--${card.type}`}>{cardTypeLabels[card.type]}</span>
        <strong>{card.title}</strong>
        <span className={`status-chip status-chip--${card.status}`}>{formatStatusLabel(card.status)}</span>
        {card.requiresUserReview && <span className="review-dot" aria-label="Requires user review" />}
      </button>
    );
  }

  return (
    <button
      className={`workflow-card workflow-card--${card.status} ${selected ? "is-selected" : ""}`}
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onSelect(card.id);
      }}
    >
      <div className="workflow-card__topline">
        <span className={`type-chip type-chip--${card.type}`}>{cardTypeLabels[card.type]}</span>
        <span className={`status-chip status-chip--${card.status}`}>{formatStatusLabel(card.status)}</span>
      </div>
      <strong>{card.title}</strong>
      {!compact && <p>{card.summary}</p>}
      <div className="progress-track" aria-label={`${card.progress}% complete`}>
        <span style={{ width: `${card.progress}%` }} />
      </div>
      <div className="workflow-card__meta">
        <DinoAgentAvatar variant={card.assignedAgent} size="sm" />
        <span>{card.evidenceCount} evidence</span>
        {card.requiresUserReview && <span className="review-flag">Review</span>}
      </div>
    </button>
  );
}
