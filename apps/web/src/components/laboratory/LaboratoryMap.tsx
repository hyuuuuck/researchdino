import { useEffect, useMemo, useState } from "react";
import {
  getDemoResearchLabState,
  loadResearchLabState,
  submitLeaderDecision,
  type LeaderDecisionValue,
  type ResearchDataMode,
  type ResearchLabState,
} from "../../api/researchApi";
import { formatStatusLabel } from "../../lib/format";
import type { AgentLogEntry, Selection, WorkflowCardData } from "../../types/research";
import { AgentLogPanel } from "./AgentLogPanel";
import { DetailPanel } from "./DetailPanel";
import { IngestPanel } from "./IngestPanel";
import { LaboratoryRoom } from "./LaboratoryRoom";
import { LeaderReviewPanel } from "./LeaderReviewPanel";
import { MeetingRoomWindow } from "./MeetingRoomWindow";
import { RoomSceneGallery } from "./RoomSceneGallery";

const roomFlow = [
  { from: "leader", to: "coordinator", step: "L1", label: "Directive", kind: "directive", active: true },
  { from: "coordinator", to: "leader", step: "R1", label: "Brief", kind: "report" },
  { from: "coordinator", to: "collection", step: "T1", label: "Search Task", kind: "task", showLabel: false, active: true },
  { from: "coordinator", to: "reading", step: "T2", label: "Read Task", kind: "task", showLabel: false },
  { from: "coordinator", to: "debate", step: "T3", label: "Critique", kind: "task", showLabel: false },
  { from: "coordinator", to: "strategy", step: "T4", label: "Plan", kind: "task", showLabel: false },
  { from: "coordinator", to: "experiment", step: "T5", label: "Design", kind: "task", showLabel: false },
  { from: "coordinator", to: "writing", step: "T6", label: "Draft", kind: "task", showLabel: false },
  { from: "coordinator", to: "library", step: "T7", label: "Store", kind: "task", showLabel: false },
  { from: "collection", to: "reading", step: "C1", label: "Search-Read", kind: "collab", active: true },
  { from: "reading", to: "debate", step: "C2", label: "Reader-Critic", kind: "collab", active: true },
  { from: "debate", to: "strategy", step: "C3", label: "Critic-Strategy", kind: "collab" },
  { from: "strategy", to: "experiment", step: "C4", label: "Strategy-Experiment", kind: "collab" },
  { from: "reading", to: "writing", step: "C5", label: "Evidence-Writing", kind: "collab", showLabel: false },
  { from: "strategy", to: "writing", step: "C6", label: "Argument", kind: "collab", showLabel: false },
  { from: "library", to: "strategy", step: "K1", label: "Approved Knowledge", kind: "knowledge", showLabel: false },
  { from: "library", to: "writing", step: "K2", label: "Citations", kind: "knowledge", showLabel: false },
] as const;

const initialResearchLabState = getDemoResearchLabState();

const sidebarNavItems = ["Lab Map", "Projects", "Tasks", "Agents", "Library", "Reports", "Settings"] as const;
const quickActions = ["New Claim", "Import Paper", "Create Task"] as const;

const runningStatuses = new Set(["running", "debating"]);
const waitingStatuses = new Set(["queued", "waiting_for_user", "waiting_for_leader_review", "waiting_for_claim"]);
const completeStatuses = new Set(["approved", "stored_in_library", "archived"]);

function priorityLabel(card: WorkflowCardData, index: number) {
  if (card.requiresUserReview || card.status === "waiting_for_user") return "High";
  if (card.status === "running" || card.status === "debating") return "Medium";
  return index % 2 === 0 ? "Medium" : "Low";
}

export function LaboratoryMap() {
  const [selection, setSelection] = useState<Selection>({ kind: "room", id: "debate" });
  const [rooms, setRooms] = useState(initialResearchLabState.rooms);
  const [cards, setCards] = useState<WorkflowCardData[]>(initialResearchLabState.cards);
  const [logs, setLogs] = useState<AgentLogEntry[]>(initialResearchLabState.logs);
  const [dataMode, setDataMode] = useState<ResearchDataMode>(initialResearchLabState.mode);
  const [loadError, setLoadError] = useState<string>();

  const selectedCardId = selection.kind === "card" ? selection.id : undefined;

  const roomLookup = useMemo(
    () => new Map(rooms.map((room) => [room.id, room])),
    [rooms],
  );

  function isActiveFlow(edge: (typeof roomFlow)[number]) {
    return "active" in edge && edge.active === true;
  }

  function applyResearchLabState(nextState: ResearchLabState) {
    setRooms(nextState.rooms);
    setCards(nextState.cards);
    setLogs(nextState.logs);
    setDataMode(nextState.mode);
  }

  useEffect(() => {
    let cancelled = false;

    loadResearchLabState()
      .then((nextState) => {
        if (cancelled) return;
        applyResearchLabState(nextState);
        setLoadError(undefined);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setDataMode("demo");
        setLoadError(`API unavailable: ${message}. Showing demo data.`);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLeaderDecision(
    cardId: string,
    decision: LeaderDecisionValue,
    reason: string,
  ) {
    if (dataMode === "api") {
      try {
        await submitLeaderDecision(cardId, decision, reason);
        applyResearchLabState(await loadResearchLabState());
        setLoadError(undefined);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        setLoadError(`Leader decision was not saved: ${message}`);
      }
      return;
    }

    const nextStatusByDecision = {
      approved: "approved",
      rejected: "rejected",
      needs_revision: "waiting_for_user",
      stored_in_library: "stored_in_library",
    } as const;

    setCards((currentCards) =>
      currentCards.map((card) =>
        card.id === cardId
          ? {
              ...card,
              status: nextStatusByDecision[decision],
              approvalStatus: decision,
              currentRoom: decision === "stored_in_library" ? "library" : card.currentRoom,
              requiresUserReview: decision === "needs_revision",
              progress: decision === "stored_in_library" ? 100 : card.progress,
              lastAgent: "leader",
              lastUpdated: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            }
          : card,
      ),
    );

    setLogs((currentLogs) => [
      {
        id: `log-${currentLogs.length + 1}`,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        agent: "leader",
        room: "leader",
        level: "approval",
        title: `Leader decision: ${formatStatusLabel(decision)}`,
        message: reason.trim() || "Decision recorded without an additional note.",
        relatedCardId: cardId,
      },
      ...currentLogs,
    ]);
  }

  async function handleIngestComplete() {
    if (dataMode !== "api") return;
    try {
      applyResearchLabState(await loadResearchLabState());
      setLoadError(undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      setLoadError(`Could not refresh after ingest: ${message}`);
    }
  }

  const dashboardStats = useMemo(() => {
    const inProgress = cards.filter((card) => runningStatuses.has(card.status)).length;
    const waiting = cards.filter((card) => waitingStatuses.has(card.status)).length;
    const completedCards = cards.filter((card) => completeStatuses.has(card.status)).length;
    const completedRooms = Math.max(0, rooms.filter((room) => room.metrics.complete > 0).length - 1);
    const agentCount = new Set(rooms.map((room) => room.agent)).size;
    const roomCompletions = rooms.reduce((total, room) => total + room.metrics.complete, 0);
    const roomWork = rooms.reduce(
      (total, room) => total + room.metrics.active + room.metrics.waiting + room.metrics.complete,
      0,
    );

    return {
      totalTasks: cards.length + rooms.reduce((total, room) => total + room.metrics.active, 0),
      inProgress,
      waiting,
      completed: Math.max(completedCards, completedRooms),
      agentsOnline: agentCount,
      tasksRunning: inProgress,
      queueLength: waiting,
      successRate: roomWork === 0 ? 0 : Math.round((roomCompletions / roomWork) * 100),
    };
  }, [cards, rooms]);

  const globalQueueCards = useMemo(
    () =>
      cards
        .filter((card) => !completeStatuses.has(card.status))
        .slice(0, 4),
    [cards],
  );

  return (
    <main className="laboratory-shell dashboard-app">
      <aside className="dashboard-sidebar" aria-label="ResearchDino navigation">
        <div className="dashboard-sidebar__brand">
          <img src="/brand/researchdino-mark.png" alt="" aria-hidden="true" />
          <strong>ResearchDino Lab</strong>
        </div>
        <nav className="dashboard-nav" aria-label="Primary navigation">
          {sidebarNavItems.map((item) => (
            <button className={item === "Lab Map" ? "is-active" : ""} type="button" key={item}>
              <span aria-hidden="true" />
              {item}
            </button>
          ))}
        </nav>
        <section className="sidebar-project-card" aria-label="Active project">
          <span>Active Project</span>
          <strong>AutoPhagy Mechanism</strong>
          <em>Smith et al., 2023</em>
        </section>
        <section className="sidebar-stats" aria-label="Task summary">
          <div>
            <span>Total Tasks</span>
            <strong>{dashboardStats.totalTasks}</strong>
          </div>
          <div>
            <span>In Progress</span>
            <strong>{dashboardStats.inProgress}</strong>
          </div>
          <div>
            <span>Waiting</span>
            <strong>{dashboardStats.waiting}</strong>
          </div>
          <div>
            <span>Completed</span>
            <strong>{dashboardStats.completed}</strong>
          </div>
        </section>
        <section className="sidebar-actions" aria-label="Quick actions">
          <span>Quick Actions</span>
          {quickActions.map((action) => (
            <button type="button" key={action}>
              <span aria-hidden="true" />
              {action}
            </button>
          ))}
        </section>
      </aside>

      <div className="dashboard-workspace">
        <header className="dashboard-topbar">
          <div>
            <span className="dashboard-kicker">Lab Map</span>
            <h1>ResearchDino OS</h1>
            <p>AI Research Workflow Overview</p>
          </div>
          <div className="dashboard-controls">
            <button className="dashboard-control-card" type="button">
              <span>Active Project</span>
              <strong>AutoPhagy Mechanism</strong>
            </button>
            <div className="dashboard-control-card dashboard-control-card--status" role="status">
              <span>System Status</span>
              <strong>{dataMode === "api" ? "Local API Connected" : "Mock Workflow Data"}</strong>
            </div>
            <button className="dashboard-filter-button" type="button">Filters</button>
            <button className="dashboard-icon-button" type="button" aria-label="Open dashboard settings" />
          </div>
          {loadError && <p className="dashboard-load-error">{loadError}</p>}
        </header>

        <section className="dashboard-overview">
          <div className="dashboard-map-panel">
            <div className="map-stage" aria-label="Research laboratory map">
          <svg className="laboratory-map" viewBox="0 0 1390 820" role="img" aria-label="Laboratory workflow map">
            <defs>
              <pattern id="paper-grid" width="16" height="16" patternUnits="userSpaceOnUse">
                <path d="M16 0H0V16" fill="none" stroke="#ececec" strokeWidth="1" />
              </pattern>
              <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0 0L8 4L0 8" fill="#1a1719" />
              </marker>
              <marker id="arrowhead-active" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0 0L8 4L0 8" fill="#2f7d5f" />
              </marker>
            </defs>
            <rect x="8" y="8" width="1374" height="804" rx="24" fill="#fff" stroke="#1a1719" strokeWidth="3" />
            <rect x="26" y="28" width="1338" height="764" rx="18" fill="url(#paper-grid)" stroke="#d5d5d5" />
            {roomFlow.map((edge) => {
              const from = roomLookup.get(edge.from);
              const to = roomLookup.get(edge.to);
              if (!from || !to) return null;
              const laneOffset = edge.kind === "report" ? 72 : edge.kind === "directive" ? -72 : 0;
              const active = isActiveFlow(edge);
              const x1 = from.x + from.width / 2 + laneOffset;
              const y1 = from.y + from.height / 2;
              const x2 = to.x + to.width / 2 + laneOffset;
              const y2 = to.y + to.height / 2;
              return (
                <path
                  key={`${edge.from}-${edge.to}`}
                  className={`flow-line flow-line--${edge.kind}${active ? " is-active" : ""}`}
                  d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
                  markerEnd={active ? "url(#arrowhead-active)" : "url(#arrowhead)"}
                />
              );
            })}
            {rooms.map((room) => (
              <LaboratoryRoom
                key={room.id}
                room={room}
                cards={cards.filter((card) => card.currentRoom === room.id)}
                selected={selection.kind === "room" && selection.id === room.id}
                selectedCardId={selectedCardId}
                onSelectRoom={(roomId) => setSelection({ kind: "room", id: roomId })}
                onSelectCard={(cardId) => setSelection({ kind: "card", id: cardId })}
              />
            ))}
            {roomFlow.map((edge) => {
              if ("showLabel" in edge && edge.showLabel === false) return null;
              const from = roomLookup.get(edge.from);
              const to = roomLookup.get(edge.to);
              if (!from || !to) return null;
              const laneOffset = edge.kind === "report" ? 72 : edge.kind === "directive" ? -72 : 0;
              const active = isActiveFlow(edge);
              const fromCenterX = from.x + from.width / 2 + laneOffset;
              const fromCenterY = from.y + from.height / 2;
              const toCenterX = to.x + to.width / 2 + laneOffset;
              const toCenterY = to.y + to.height / 2;
              const horizontal = Math.abs(fromCenterY - toCenterY) < 80;
              const labelWidth = Math.max(76, Math.min(190, edge.label.length * 7 + 30));
              const labelX = horizontal
                ? fromCenterX < toCenterX
                  ? (from.x + from.width + to.x) / 2
                  : (to.x + to.width + from.x) / 2
                : fromCenterX;
              const labelY = horizontal
                ? edge.kind === "collab"
                  ? Math.min(from.y, to.y) - 18
                  : fromCenterY
                : fromCenterY < toCenterY
                  ? (from.y + from.height + to.y) / 2
                  : (to.y + to.height + from.y) / 2;
              return (
                <g
                  className={`flow-label flow-label--${edge.kind}${active ? " is-active" : ""}`}
                  key={`label-${edge.from}-${edge.to}`}
                  transform={`translate(${labelX - labelWidth / 2} ${labelY - 11})`}
                >
                  <rect width={labelWidth} height="22" rx="0" />
                  <text x="7" y="15">
                    <tspan className="flow-label__step">{edge.step}</tspan>
                    <tspan dx="4">{edge.label}</tspan>
                  </text>
                </g>
              );
            })}
              </svg>
              <div className="dashboard-map-legend" aria-label="Flow legend">
                <strong>Legend</strong>
                <span><i className="legend-line legend-line--directive" />Directive</span>
                <span><i className="legend-line legend-line--report" />Brief / Update</span>
                <span><i className="legend-line legend-line--task" />Data Flow</span>
                <span><i className="legend-line legend-line--archive" />Store / Archive</span>
              </div>
            </div>

            <section className="global-queue" aria-label="Global queue">
              <div className="global-queue__header">
                <span>Global Queue</span>
                <button type="button">View All Queue</button>
              </div>
              <div className="global-queue__items">
                {globalQueueCards.map((card, index) => {
                  const priority = priorityLabel(card, index);
                  return (
                    <button
                      className="global-queue-card"
                      type="button"
                      key={card.id}
                      onClick={() => setSelection({ kind: "card", id: card.id })}
                    >
                      <span className={`global-queue-card__icon global-queue-card__icon--${card.type}`} aria-hidden="true" />
                      <strong>{card.title}</strong>
                      <em>{roomLookup.get(card.currentRoom)?.title ?? card.currentRoom}</em>
                      <span className={`global-queue-card__priority global-queue-card__priority--${priority.toLowerCase()}`}>
                        {priority}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="system-health-panel" aria-label="System health">
            <h2>System Health</h2>
            <dl>
              <div>
                <dt>Agents Online</dt>
                <dd>{dashboardStats.agentsOnline} / {dashboardStats.agentsOnline}</dd>
              </div>
              <div>
                <dt>Tasks Running</dt>
                <dd>{dashboardStats.tasksRunning}</dd>
              </div>
              <div>
                <dt>Queue Length</dt>
                <dd>{dashboardStats.queueLength}</dd>
              </div>
              <div>
                <dt>Success Rate</dt>
                <dd>
                  <span className="system-health-bar" aria-hidden="true">
                    <i style={{ width: `${dashboardStats.successRate}%` }} />
                  </span>
                  {dashboardStats.successRate}%
                </dd>
              </div>
              <div>
                <dt>Last Updated</dt>
                <dd>{logs[0]?.time ?? "Now"}</dd>
              </div>
            </dl>
          </aside>
        </section>

      <MeetingRoomWindow
        cards={cards}
        onSelectCard={(cardId) => setSelection({ kind: "card", id: cardId })}
      />

      <RoomSceneGallery />

      <section className="selected-detail-section" aria-label="Selected workflow detail">
        <DetailPanel
          selection={selection}
          rooms={rooms}
          cards={cards}
          onSelectCard={(cardId) => setSelection({ kind: "card", id: cardId })}
        />
      </section>

      <section className="operations-deck">
        <IngestPanel dataMode={dataMode} onScanComplete={handleIngestComplete} />
        <LeaderReviewPanel cards={cards} onDecision={handleLeaderDecision} />
        <AgentLogPanel logs={logs} />
      </section>
      </div>
    </main>
  );
}
