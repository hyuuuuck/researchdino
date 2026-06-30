import { formatStatusLabel } from "../../lib/format";
import type { WorkflowCardData } from "../../types/research";

interface MeetingRoomWindowProps {
  cards: WorkflowCardData[];
  onSelectCard: (cardId: string) => void;
}

function detailText(card: WorkflowCardData | undefined, key: string, fallback = "Pending") {
  const value = card?.details[key];
  if (Array.isArray(value)) return value.join(", ");
  return value === undefined ? fallback : String(value);
}

function detailList(card: WorkflowCardData | undefined, key: string, fallback: string[] = []) {
  const value = card?.details[key];
  if (Array.isArray(value)) return value;
  if (value === undefined) return fallback;
  return [String(value)];
}

export function MeetingRoomWindow({ cards, onSelectCard }: MeetingRoomWindowProps) {
  const debateCard =
    cards.find((card) => card.currentRoom === "debate" && card.type.includes("debate")) ??
    cards.find((card) => card.currentRoom === "debate");
  const supportingEvidence = detailList(debateCard, "supporting_evidence");
  const opposingEvidence = detailList(debateCard, "opposing_evidence");
  const criticComments = detailList(debateCard, "critic_comments");
  const hypotheses = detailList(debateCard, "strategist_hypotheses");
  const experiments = detailList(debateCard, "suggested_experiments");

  return (
    <section className="meeting-room-window debate-room-window" aria-label="Debate Room">
      <div className="meeting-room-window__header">
        <div>
          <span className="panel-kicker">Debate Room</span>
          <h2>Claim Debate Session</h2>
        </div>
        <span className="meeting-room-window__status">
          {debateCard ? formatStatusLabel(debateCard.status) : "Waiting for claim"}
        </span>
      </div>

      <div className="debate-room-layout">
        <div className="debate-room-scene" aria-label="Dino agents discussing a research claim">
          <img
            className="debate-room-illustration"
            src="/brand/debate-room-illustration-clean.png"
            alt="Black and white ResearchDino debate room with Dino agents around a research meeting table"
          />
        </div>

        <aside className="debate-room-detail" aria-label="Debate session data">
          <button
            className="debate-room-card debate-room-card--button"
            type="button"
            disabled={!debateCard}
            onClick={() => debateCard && onSelectCard(debateCard.id)}
          >
            <span className="panel-kicker">Current Debate</span>
            <h3>{debateCard?.title ?? "No active debate card"}</h3>
            <dl>
              <div>
                <dt>Session</dt>
                <dd>{detailText(debateCard, "debate_session_id")}</dd>
              </div>
              <div>
                <dt>Source Paper</dt>
                <dd>{detailText(debateCard, "source_paper")}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{debateCard ? formatStatusLabel(debateCard.status) : "waiting"}</dd>
              </div>
              <div>
                <dt>Leader</dt>
                <dd>{detailText(debateCard, "leader_decision_status")}</dd>
              </div>
            </dl>
          </button>

          <div className="debate-room-card debate-room-card--split">
            <div>
              <h3>Supporting Evidence</h3>
              <ul>
                {supportingEvidence.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Opposing Evidence</h3>
              <ul>
                {opposingEvidence.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="debate-room-card">
            <h3>Critic / Strategy / Experiment</h3>
            <div className="debate-data-columns">
              <section>
                <span>Critic</span>
                <p>{criticComments[0] ?? "No critic comment yet."}</p>
              </section>
              <section>
                <span>Hypothesis</span>
                <p>{hypotheses[0] ?? "No hypothesis yet."}</p>
              </section>
              <section>
                <span>Experiment</span>
                <p>{experiments[0] ?? "No experiment suggestion yet."}</p>
              </section>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
