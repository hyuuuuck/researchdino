import type { AgentLogEntry } from "../../types/research";
import { DinoAgentAvatar } from "./DinoAgentAvatar";

interface AgentLogPanelProps {
  logs: AgentLogEntry[];
}

export function AgentLogPanel({ logs }: AgentLogPanelProps) {
  return (
    <section className="agent-log-panel" aria-label="Agent activity log">
      <div className="panel-heading panel-heading--compact">
        <span className="panel-kicker">Activity</span>
        <h2>Agent Log</h2>
      </div>
      <div className="agent-log-list">
        {logs.map((log) => (
          <article className={`agent-log agent-log--${log.level}`} key={log.id}>
            <DinoAgentAvatar variant={log.agent} size="sm" />
            <div>
              <div className="agent-log__topline">
                <strong>{log.title}</strong>
                <span>{log.time}</span>
              </div>
              <p>{log.message}</p>
              <span className="agent-log__meta">
                {log.room} / {log.level}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
