import type { LaboratoryRoomData, WorkflowCardData } from "../../types/research";
import { formatStatusLabel } from "../../lib/format";
import { WorkflowCard } from "./WorkflowCard";

interface LaboratoryRoomProps {
  room: LaboratoryRoomData;
  cards: WorkflowCardData[];
  selected: boolean;
  selectedCardId?: string;
  onSelectRoom: (roomId: LaboratoryRoomData["id"]) => void;
  onSelectCard: (cardId: string) => void;
}

const roomSubtitles: Record<LaboratoryRoomData["id"], string> = {
  coordinator: "Triage, assign, and coordinate",
  collection: "Discover and collect papers",
  reading: "Deep read and summarize",
  debate: "Critique and discuss claims",
  leader: "Final decisions and oversight",
  library: "Store and organize knowledge",
  strategy: "Identify gaps and hypotheses",
  experiment: "Design and validate experiments",
  writing: "Draft and refine manuscripts",
};

const roomVisuals: Record<LaboratoryRoomData["id"], { src: string; mode: "agent" | "scene"; slice?: "one" | "two" | "three" }> = {
  coordinator: { src: "/brand/agents/explorer-dino.png", mode: "agent" },
  collection: { src: "/brand/agents/search-dino.png", mode: "agent" },
  reading: { src: "/brand/agents/reader-dino.png", mode: "agent" },
  debate: { src: "/brand/agents/critic-dino.png", mode: "agent" },
  leader: { src: "/brand/agents/leader-dino.png", mode: "agent" },
  library: { src: "/brand/agents/librarian-dino.png", mode: "agent" },
  strategy: { src: "/brand/agents/strategist-dino.png", mode: "agent" },
  experiment: { src: "/brand/agents/experiment-dino.png", mode: "agent" },
  writing: { src: "/brand/agents/writer-dino.png", mode: "agent" },
};

function RoomSymbol({ roomId }: { roomId: LaboratoryRoomData["id"] }) {
  return (
    <div className={`room-symbol room-symbol--${roomId}`} aria-hidden="true">
      {roomId === "coordinator" && (
        <svg viewBox="0 0 64 64">
          <path d="M19 13h26v10H19z" />
          <path d="M12 37h14v14H12zM50 37H36v14h14z" />
          <path d="M32 23v8M19 31h26M19 31v6M45 31v6" />
          <path d="M24 18h16M16 44h6M40 44h6" />
        </svg>
      )}
      {roomId === "collection" && (
        <svg viewBox="0 0 64 64">
          <circle cx="27" cy="27" r="14" />
          <path d="M38 38l13 13" />
          <path d="M18 25h18M18 32h12" />
          <path d="M12 49h18" />
        </svg>
      )}
      {roomId === "reading" && (
        <svg viewBox="0 0 64 64">
          <path d="M12 16c9-3 16-2 20 3v31c-5-5-12-6-20-3z" />
          <path d="M52 16c-9-3-16-2-20 3v31c5-5 12-6 20-3z" />
          <path d="M19 27h7M38 27h7M19 36h7M38 36h7" />
        </svg>
      )}
      {roomId === "debate" && (
        <svg viewBox="0 0 64 64">
          <path d="M10 17h29v20H23l-9 9v-9h-4z" />
          <path d="M31 28h23v17h-7v8l-8-8h-8z" />
          <path d="M18 27h13M38 37h9" />
        </svg>
      )}
      {roomId === "leader" && (
        <svg viewBox="0 0 64 64">
          <path d="M18 14h28v13H18z" />
          <path d="M24 27v11h16V27" />
          <path d="M13 38h38v12H13z" />
          <path d="M22 44h20" />
        </svg>
      )}
      {roomId === "library" && (
        <svg viewBox="0 0 64 64">
          <path d="M12 13h10v38H12zM27 13h10v38H27zM42 13h10v38H42z" />
          <path d="M15 23h4M30 31h4M45 21h4M10 51h44" />
        </svg>
      )}
      {roomId === "strategy" && (
        <svg viewBox="0 0 64 64">
          <path d="M12 49l13-17 12 9 15-24" />
          <circle cx="12" cy="49" r="4" />
          <circle cx="25" cy="32" r="4" />
          <circle cx="37" cy="41" r="4" />
          <circle cx="52" cy="17" r="4" />
        </svg>
      )}
      {roomId === "experiment" && (
        <svg viewBox="0 0 64 64">
          <path d="M24 12h16M28 12v19L16 52h32L36 31V12" />
          <path d="M23 43h18" />
          <circle cx="29" cy="50" r="2" />
          <circle cx="36" cy="46" r="2" />
        </svg>
      )}
      {roomId === "writing" && (
        <svg viewBox="0 0 64 64">
          <path d="M14 50l8-2 27-27-6-6-27 27z" />
          <path d="M38 20l6 6" />
          <path d="M14 16h24M14 26h15M14 36h8" />
        </svg>
      )}
    </div>
  );
}

function RoomVisual({ roomId }: { roomId: LaboratoryRoomData["id"] }) {
  const visual = roomVisuals[roomId];

  return (
    <div className={`room-visual room-visual--${visual.mode} room-visual--${roomId} room-visual-slice--${visual.slice ?? "one"}`}>
      <img src={visual.src} alt="" aria-hidden="true" />
    </div>
  );
}

export function LaboratoryRoom({
  room,
  cards,
  selected,
  selectedCardId,
  onSelectRoom,
  onSelectCard,
}: LaboratoryRoomProps) {
  return (
    <foreignObject x={room.x} y={room.y} width={room.width} height={room.height}>
      <button
        className={`laboratory-room ${selected ? "is-selected" : ""} laboratory-room--${room.status} laboratory-room--${room.id}`}
        type="button"
        onClick={() => onSelectRoom(room.id)}
      >
        <div className="laboratory-room__header">
          <div>
            <strong>{room.title}</strong>
            <p>{roomSubtitles[room.id]}</p>
          </div>
          <div className="laboratory-room__agent">
            <RoomSymbol roomId={room.id} />
          </div>
        </div>
        <div className="laboratory-room__body" aria-hidden="true">
          <RoomVisual roomId={room.id} />
        </div>
        <div className="room-card-stack">
          {cards.length === 0 && (
            <div className="room-empty-state" aria-label="No workflow cards in this room">
              Empty slot
            </div>
          )}
          {cards.slice(0, 1).map((card) => (
            <WorkflowCard
              key={card.id}
              card={card}
              selected={selectedCardId === card.id}
              compact
              onSelect={onSelectCard}
            />
          ))}
          {cards.length > 1 && <span className="more-cards">+{cards.length - 1} more</span>}
        </div>
        <div className="laboratory-room__footer">
          <span>{cards.length} cards</span>
          <span>{room.metrics.waiting} waiting</span>
          <span>{formatStatusLabel(room.status)}</span>
        </div>
      </button>
    </foreignObject>
  );
}
