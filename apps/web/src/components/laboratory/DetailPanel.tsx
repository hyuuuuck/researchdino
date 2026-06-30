import type { DeputyModelAssignment, LaboratoryRoomData, Selection, WorkflowCardData } from "../../types/research";
import { formatStatusLabel } from "../../lib/format";
import { DinoAgentAvatar } from "./DinoAgentAvatar";
import { WorkflowCard } from "./WorkflowCard";

interface DetailPanelProps {
  selection: Selection;
  rooms: LaboratoryRoomData[];
  cards: WorkflowCardData[];
  onSelectCard: (cardId: string) => void;
}

function getDetailText(card: WorkflowCardData, key: string, fallback = "Pending") {
  const value = card.details[key];
  if (Array.isArray(value)) return value.join(", ");
  return value === undefined ? fallback : String(value);
}

function getDetailList(card: WorkflowCardData, key: string) {
  const value = card.details[key];
  if (Array.isArray(value)) return value;
  if (value === undefined) return [];
  return [String(value)];
}

function isDebateCard(card: WorkflowCardData) {
  return card.type === "claim_debate" || card.type === "hypothesis_debate" || card.type === "contradiction_review";
}

function ModelAssignmentsSection({ assignments }: { assignments?: DeputyModelAssignment[] }) {
  return (
    <section className="panel-section">
      <h3>Ollama Deputy Array</h3>
      {assignments && assignments.length > 0 ? (
        <div className="deputy-model-list">
          {assignments.map((assignment) => (
            <article className="deputy-model-card" key={assignment.id}>
              <div>
                <strong>{assignment.label}</strong>
                <span>{assignment.responsibility}</span>
              </div>
              <dl>
                <div>
                  <dt>Provider</dt>
                  <dd>{assignment.provider}</dd>
                </div>
                <div>
                  <dt>Mode</dt>
                  <dd>{assignment.mode}</dd>
                </div>
                <div>
                  <dt>Model</dt>
                  <dd>{assignment.model}</dd>
                </div>
                <div>
                  <dt>Ref</dt>
                  <dd>{assignment.modelRef}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-note">No Ollama deputy model is assigned to this room yet.</p>
      )}
    </section>
  );
}

export function DetailPanel({ selection, rooms, cards, onSelectCard }: DetailPanelProps) {
  if (selection.kind === "card") {
    const card = cards.find((item) => item.id === selection.id);
    if (!card) return null;
    const debateCard = isDebateCard(card);
    const currentRoom = rooms.find((item) => item.id === card.currentRoom);

    return (
      <aside className="detail-panel" aria-label="Selected card details">
        <div className="panel-heading">
          <span className="panel-kicker">Workflow Card</span>
          <h2>{card.title}</h2>
        </div>
        <div className="detail-summary">
          <DinoAgentAvatar variant={card.assignedAgent} size="md" />
          <div>
            <span className={`status-chip status-chip--${card.status}`}>{formatStatusLabel(card.status)}</span>
            <p>{card.summary}</p>
          </div>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Type</dt>
            <dd>{card.type}</dd>
          </div>
          <div>
            <dt>Room</dt>
            <dd>{card.currentRoom}</dd>
          </div>
          <div>
            <dt>Approval</dt>
            <dd>{formatStatusLabel(card.approvalStatus)}</dd>
          </div>
          <div>
            <dt>Evidence</dt>
            <dd>{card.evidenceCount}</dd>
          </div>
        </dl>
        <ModelAssignmentsSection assignments={currentRoom?.modelAssignments} />
        {debateCard && (
          <>
            <section className="panel-section">
              <h3>Debate Session</h3>
              <div className="detail-list detail-list--debate">
                <div>
                  <span>debate_session_id</span>
                  <strong>{getDetailText(card, "debate_session_id")}</strong>
                </div>
                <div>
                  <span>source_paper</span>
                  <strong>{getDetailText(card, "source_paper")}</strong>
                </div>
                <div>
                  <span>target_claim</span>
                  <strong>{getDetailText(card, "target_claim")}</strong>
                </div>
                <div>
                  <span>claim_text</span>
                  <strong>{getDetailText(card, "claim_text")}</strong>
                </div>
              </div>
            </section>
            <section className="panel-section">
              <h3>Evidence And Objections</h3>
              <div className="detail-list detail-list--debate">
                <div>
                  <span>supporting_evidence</span>
                  <strong>{getDetailList(card, "supporting_evidence").join(" / ")}</strong>
                </div>
                <div>
                  <span>opposing_evidence</span>
                  <strong>{getDetailList(card, "opposing_evidence").join(" / ")}</strong>
                </div>
                <div>
                  <span>critic_comments</span>
                  <strong>{getDetailList(card, "critic_comments").join(" / ")}</strong>
                </div>
                <div>
                  <span>unresolved_questions</span>
                  <strong>{getDetailList(card, "unresolved_questions").join(" / ")}</strong>
                </div>
              </div>
            </section>
            <section className="panel-section">
              <h3>Follow-Up Outputs</h3>
              <div className="detail-list detail-list--debate">
                <div>
                  <span>suggested_follow_up_papers</span>
                  <strong>{getDetailList(card, "suggested_follow_up_papers").join(" / ")}</strong>
                </div>
                <div>
                  <span>suggested_experiments</span>
                  <strong>{getDetailList(card, "suggested_experiments").join(" / ")}</strong>
                </div>
                <div>
                  <span>strategist_hypotheses</span>
                  <strong>{getDetailList(card, "strategist_hypotheses").join(" / ")}</strong>
                </div>
                <div>
                  <span>leader_decision_status</span>
                  <strong>{getDetailText(card, "leader_decision_status")}</strong>
                </div>
                <div>
                  <span>library_save_status</span>
                  <strong>{getDetailText(card, "library_save_status")}</strong>
                </div>
                <div>
                  <span>meeting_summary</span>
                  <strong>{getDetailText(card, "meeting_summary")}</strong>
                </div>
              </div>
            </section>
          </>
        )}
        <section className="panel-section">
          <h3>{debateCard ? "Raw Trace Data" : "Trace Data"}</h3>
          <div className="detail-list">
            {Object.entries(card.details).map(([key, value]) => (
              <div key={key}>
                <span>{key}</span>
                <strong>{Array.isArray(value) ? value.join(", ") : value}</strong>
              </div>
            ))}
          </div>
        </section>
      </aside>
    );
  }

  const room = rooms.find((item) => item.id === selection.id);
  if (!room) return null;
  const roomCards = cards.filter((card) => card.currentRoom === room.id);
  const debateCard = room.id === "debate" ? roomCards.find(isDebateCard) : undefined;

  return (
    <aside className="detail-panel" aria-label="Selected room details">
      <div className="panel-heading">
        <span className="panel-kicker">Laboratory Room</span>
        <h2>{room.title}</h2>
      </div>
      <div className="detail-summary">
        <DinoAgentAvatar variant={room.agent} size="md" />
        <div>
          <span className={`status-chip status-chip--${room.status}`}>{formatStatusLabel(room.status)}</span>
          <p>{room.role}</p>
        </div>
      </div>
      <dl className="detail-grid">
        <div>
          <dt>Active</dt>
          <dd>{room.metrics.active}</dd>
        </div>
        <div>
          <dt>Waiting</dt>
          <dd>{room.metrics.waiting}</dd>
        </div>
        <div>
          <dt>Complete</dt>
          <dd>{room.metrics.complete}</dd>
        </div>
        <div>
          <dt>Cards</dt>
          <dd>{roomCards.length}</dd>
        </div>
      </dl>
      <ModelAssignmentsSection assignments={room.modelAssignments} />
      {debateCard && (
        <section className="panel-section">
          <h3>Debate Session</h3>
          <div className="detail-list detail-list--debate">
            <div>
              <span>debate_session_id</span>
              <strong>{getDetailText(debateCard, "debate_session_id")}</strong>
            </div>
            <div>
              <span>target_claim</span>
              <strong>{getDetailText(debateCard, "target_claim")}</strong>
            </div>
            <div>
              <span>leader_decision_status</span>
              <strong>{getDetailText(debateCard, "leader_decision_status")}</strong>
            </div>
            <div>
              <span>library_save_status</span>
              <strong>{getDetailText(debateCard, "library_save_status")}</strong>
            </div>
          </div>
        </section>
      )}
      <section className="panel-section">
        <h3>Current Work</h3>
        <div className="detail-card-list">
          {roomCards.length === 0 ? (
            <p className="empty-note">No workflow cards are currently assigned to this room.</p>
          ) : (
            roomCards.map((card) => (
              <WorkflowCard key={card.id} card={card} selected={false} onSelect={onSelectCard} />
            ))
          )}
        </div>
      </section>
    </aside>
  );
}
