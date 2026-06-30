import type { AgentVariant } from "../../types/research";

interface DinoAgentAvatarProps {
  variant: AgentVariant;
  size?: "sm" | "md" | "lg";
}

const agentLabels: Record<AgentVariant, string> = {
  coordinator: "Coordinator",
  search: "Search",
  collector: "Collector",
  reader: "Reader",
  critic: "Critic",
  librarian: "Librarian",
  leader: "Leader",
  strategist: "Strategist",
  experiment: "Experiment",
  writer: "Writer",
};

const imageByVariant: Record<AgentVariant, string> = {
  coordinator: "/brand/agents/explorer-dino.png",
  search: "/brand/agents/search-dino.png",
  collector: "/brand/agents/explorer-dino.png",
  reader: "/brand/agents/reader-dino.png",
  critic: "/brand/agents/critic-dino.png",
  librarian: "/brand/agents/librarian-dino.png",
  leader: "/brand/agents/leader-dino.png",
  strategist: "/brand/agents/strategist-dino.png",
  experiment: "/brand/agents/experiment-dino.png",
  writer: "/brand/agents/writer-dino.png",
};

export function DinoAgentAvatar({ variant, size = "md" }: DinoAgentAvatarProps) {
  return (
    <div className={`dino-avatar dino-avatar--${size}`} aria-label={`${agentLabels[variant]} Dino`}>
      <img src={imageByVariant[variant]} alt="" aria-hidden="true" />
    </div>
  );
}
