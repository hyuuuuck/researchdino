# Handoff: ResearchDino OS — Lab Map & Workspace Redesign

## Overview
A black-and-white, simple-line, **dinosaur-themed** redesign of the ResearchDino
autonomous research platform. ResearchDino autonomously collects papers / news /
reports, runs multi-agent **debates**, reads papers, forms strategy, plans
experiments, and writes manuscripts. This redesign delivers the full operator UI:
a spatial **Lab Map** of the agent "rooms" plus 9 connected workspace views.

The target repo is `hyuuuuck/researchdino` (React + TypeScript; the current screen
lives at `apps/web/src/components/laboratory/LaboratoryMap.tsx`). This redesign
replaces/extends that surface.

## About the Design Files
The file in this bundle (`ResearchDino Lab Map.dc.html`) is a **design reference
created in HTML** — a prototype showing the intended look and behavior. It is
**not production code to copy directly**. The task is to **recreate this design in
the existing React/TypeScript codebase** (`apps/web`), using its established
patterns (components, routing, state, styling approach). Treat the HTML as the
spec; re-implement it as React components.

> The `.dc.html` prototype uses a lightweight in-house template runtime. Ignore
> that runtime — only the **markup, styles, copy, and interactions** are the spec.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, iconography, and
interactions are specified. Recreate pixel-closely with the repo's own component
library. Exact hex, sizes, and copy are listed below.

---

## Design Tokens

### Color (the entire system is monochrome + one accent)
- `--ink`: `#1a1719` — primary text, 1.5px card borders, filled buttons, active nav
- `--paper`: `#ffffff` — card / surface background
- `--canvas`: `#e9e9ea` — app background behind the white shell
- `--hairline`: `#e3e3e3` — secondary/1.4px borders (non-primary cards, tiles)
- `--divider`: `#ededed` / `#f0f0f0` / `#f2f2f2` — internal row separators
- `--muted`: `#9a9a9a` — secondary text
- `--muted-2`: `#6b6b6b` — inactive nav label
- `--faint`: `#a6a6a6` — uppercase eyebrow labels
- `--placeholder`: `#b0b0b0` — empty-slot / placeholder text
- `--accent`: `#2f7d5f` (green) — **reserved for LIVE activity only** (see rule below)
- Priority accents (used only on Task priority + key-point marks):
  `#c0392b` (High/negative), `#c98a16` (Medium/warning)
- Off-white fills: `#f7f7f7` (avatar wells), `#fafafa` (done/muted cards)

**Accent rule:** `--accent` (green) means "live right now" — nothing else.
Applied to: the "All Systems Operational" status dot, "6 Online" dot, the
"Debating" pill, the "Reading" library status, the "Writer drafting" dot, the
Task "Live" badge, active data-flow connectors + their labels on the map, and
positive check-marks. Everything static/idle uses ink/gray. Do **not** use green
for success metrics (e.g. the 98% Success Rate bar is solid `#1a1719`).

### Typography
- Font family: **Hanken Grotesk** (Google Fonts, weights 400/500/600/700/800).
- Eyebrow labels: 10px / 800 / `letter-spacing:.12–.14em` / UPPERCASE / `#a6a6a6`.
- Screen titles (`h2`): 20px / 800 / `letter-spacing:-.01em`.
- Product title (`h1`): 27px / 800.
- Card titles: 14–15px / 800 (rooms use UPPERCASE `.05em`).
- Body: 12–14px / 400–600, line-height 1.4–1.75.
- Status pills: 8.5–9px / 800 / `.05–.06em` / UPPERCASE.

### Radius
Buttons/chips/pills `999px`; cards `14–18px`; tiles/rows `9–12px`; avatar wells
circle (`50%`) in threads / `14px` square on the Agents grid.

### Shadow
- App shell: `0 24px 60px -32px rgba(20,18,22,.28)`
- Clickable map-card hover lift: `translateY(-3px)` + `0 10px 22px -12px rgba(20,18,22,.4)`, transition `.16s ease`.

### Animation
- `@keyframes scr` (screen enter): `opacity 0→1`, `translateY(7px→0)`, `.3s cubic-bezier(.4,0,.2,1)`.
- `@keyframes pulse` (live dots): `opacity 1→.35→1`, `2s ease-in-out infinite`.

---

## Layout shell (every view)
Fixed **1640px** wide white rounded shell (`border-radius:20px`) centered on the
`#e9e9ea` canvas, `display:flex`:
- **Sidebar** `280px`, right hairline border. Contains: brand mark + "ResearchDino
  Lab"; nav list; "Active Project" block (AutoPhagy Mechanism / Smith et al., 2023);
  task stat rows (Total 12 / In Progress 6 / Waiting 3 / Completed 8); Quick Actions
  (New Claim, Import Paper, Create Task — pill outline buttons).
- **Workspace** (flex:1): a **top bar** (eyebrow + `ResearchDino OS` h1 + subtitle;
  right: Active Project selector, System Status w/ pulsing dot, Filters, view icon),
  a **screen-tab strip** (Lab Map · Debate Room · Paper Reader · Manuscript · Agents),
  then the active screen body.

### Navigation model (state)
Single state var `screen ∈ {map, debate, reader, report, agents, library, reports, projects, tasks, settings}`.
- **Top tabs** switch: map / debate / reader / report(Manuscript) / agents.
- **Sidebar** switches: map(Lab Map) / projects / tasks / agents / library / reports / settings.
- Active styling: sidebar item → `background:#f1f1f1; color:#1a1719; weight 700`.
  Top tab → filled `#1a1719` pill, white text.
- Each screen body animates in with `scr`.

---

## Screens / Views

### 1. Lab Map (`map`) — default
Spatial diagram, **1300×685** stage centered. Absolutely-positioned "room" cards
connected by SVG flow lines.
- **Rooms** (white, 1.5px `#1a1719` border, 14px radius): Leader Office, Briefing
  Coordinator, Search Dock, Library, Reading Bench, Debate Room, Strategy Room,
  Experiment Bay, Writing Studio. Each room card = header (UPPERCASE name +
  one-line purpose + 30px outline icon), a centered **dino illustration**, a
  status row (Type tag + truncated item + status word), and a footer (N Cards /
  N Waiting / status). Empty rooms (Search Dock, Library) show a checkbox + "Drop
  a paper here".
- **Two info cards** top-right: **Legend** (Directive solid / Brief dashed / Data
  Flow long-dash / Store dotted) and **System Health** (Agents Online 6/6, Tasks
  Running 6, Queue Length 8, Success Rate 98% w/ solid ink bar, Last Updated).
- **Connectors**: SVG paths with arrow markers. Active paths + their labels
  (`L1 Directive`, `C1 Search-Read`, `C2 Reader-Critic`) use `--accent`; idle
  paths/labels use `#c4c4c4–#c8c8c8` gray.
- **Global Queue** below stage: "View All Queue" button (→ tasks) + 4 queue chips
  (Claim Debate/High, Hypothesis Gen/Medium, Experiment Plan/Medium, Manuscript
  Outline/Low).
- **Clickable rooms** (cursor pointer + hover lift): Debate Room→debate, Reading
  Bench→reader, Writing Studio→report, Library→library.

### 2. Debate Room (`debate`)
3-col grid `312px / 1fr / 300px`.
- **Left**: "Claim Under Debate" card (1.5px border) — claim text ("Autophagy
  activation via ULK1 phosphorylation is sufficient to clear α-synuclein aggregates
  in dopaminergic neurons."), meta chips (Round 3/5, 32 Turns, Smith et al. 2023),
  filled-accent "Debating" pill. Below: Participants list (Critic/Challenger,
  Reader/Evidence, Strategist/Defender) w/ circular dino avatars.
- **Center**: "Debate Thread" card — 5 messages, each = 36px circle dino avatar +
  name + **stance tag** (Challenge = filled ink, Evidence = accent outline, Defend
  = ink outline) + time + speech bubble (`border-radius:4px 14px 14px 14px`).
  Footer composer: leader avatar + rounded input placeholder + circular ink send
  button.
- **Right**: "Scorecard" (Support 3 / Challenge 2 tiles, Confidence 68% ink bar),
  "Key Points" (accent check / red ✕ marks), action buttons: **Accept & Send to
  Leader** (filled ink → reports) and **Request More Evidence** (outline → reader).

### 3. Paper Reader (`reader`)
3-col grid `282px / 1fr / 322px`.
- **Left**: "Now Reading" card (reader dino, title, authors, venue "Nature
  Neuroscience · 2023", tags), Outline nav (Abstract active, Introduction, Methods,
  Results, Discussion, References), Progress 24% bar.
- **Center**: reading pane — "Abstract" section, 2 paragraphs w/ one `<mark>`
  highlight (`background:#efe9dd`), an inline **Reader Note** callout (1.4px ink
  border, reader dino), then "1 Introduction".
- **Right**: "AI Summary" (1.5px border) — Key Findings (3 ink bullets), Limitations
  (2 gray bullets); "Extracted Claims" — 3 claim cards each w/ confidence % + **Send
  to Debate** button (→ debate; first filled ink, rest outline).

### 4. Manuscript / Writing Studio (`report`)
3-col grid `262px / 1fr / 300px`.
- **Left**: section tracker (Abstract ✓, 1 Introduction ✓, 2 Mechanisms = active
  w/ pulsing accent dot, 3 Evidence Synthesis, 4 Discussion, References).
- **Center**: editor — toolbar (B, I, H2, list, quote; right "Writer drafting…"
  w/ pulsing accent dot), title `h2`, byline, "Abstract" + "1 Introduction" body
  with a blinking text-cursor caret.
- **Right**: "Draft Stats" (1,240 words / 18 citations / Grade 13), "Coherence
  Check" (2 accent checks + 1 amber warning), "Cited Sources" (3), Export DOCX /
  PDF buttons.

### 5. Agents (`agents`)
Header ("9 Autonomous Agents" + "6 Online"/"3 Idle" pills, online dot pulses).
3-col grid of 9 agent cards: 60px square dino avatar, name, role, status pill
(Leader="Waiting for user" filled ink; Critic="Debating" filled accent; Running/
Idle/Waiting = gray), "Current Task" box, footer (room + N Cards). Leader card
uses the 1.5px ink border; others hairline.

### 6. Library (`library`)
Header + search field pill. Filter chips (All·42 active, Read·18, Reading·6,
Queued·18) + sort. A bordered list of 7 paper rows: 38px book-icon tile (gray for
queued), title + "authors · venue · year", up to 2 tag chips, status pill (Read =
ink outline, Reading = filled accent, Queued = gray).

### 7. Reports (`reports`)
Header. **Featured** latest-manuscript card (1.5px border, 74px doc icon, title,
meta, "Open in Studio" → report / "Export"). Then 3-col grid of 6 report cards
(Weekly Research Brief/Final, Debate Summary/Draft, Experiment Plan v2/Draft,
Literature Gap Analysis/Final, Reading Digest/Final, Leader Decision Log/Pending) —
each: 36px icon, status pill (Final = ink outline, Draft/Pending = gray), title,
"source · date".

### 8. Projects (`projects`)
Header + "New Project" outline button. **Featured** active program card (1.5px
border, "Active" accent pill, title, "Seeded from Smith et al., 2023 · 9 agents",
stats 12/6/4, 62% ink progress bar, "Open Lab Map" → map). 2-col grid of 4 program
cards (Tau Propagation/Active, Gut-Brain Axis/Active, Mitophagy in ALS/Paused,
Neuroinflammation Atlas/Done) each w/ progress bar (paused uses gray fill).

### 9. Tasks (`tasks`)
Header ("Task Board" + "AutoPhagy Mechanism · 12 tasks"). **4-column kanban**
(Waiting 3 / In Progress 4 / Review 2 / Done 3). Task card: room tag chip +
priority label (High red / Medium amber / Low gray), title, footer 24px dino
avatar + agent name (+ "Live" accent badge on the active debate, "User" ink badge
on the leader-approval). Done cards: `#fafafa` bg, accent check, `line-through`.
In-progress top card uses 1.5px ink border.

### 10. Settings (`settings`)
Header + "Save Changes" filled button. 2-col grid of 4 cards:
- **Autonomy**: level segmented control (Manual / **Assisted** / Auto), "Auto-approve
  low-risk claims" toggle (off), "Max parallel tasks" slider (=6).
- **Paper Sources**: arXiv/bioRxiv/PubMed on, Semantic Scholar off (toggles).
- **Models**: Reasoning & debate = "Claude Sonnet", Read & summarize = "Claude
  Haiku" (select rows), "Local inference" Ollama llama3.1:8b toggle (on).
- **Notifications**: Leader needs input (on), Debate concluded (on), Report ready (off).
- Toggle spec: 44×25px pill, 18–19px knob. On = `#1a1719` bg, knob right, white.
  Off = white bg + 1.5px `#d5d5d5` border, knob left, `#d5d5d5`.

---

## Interactions & Behavior
- **Screen switching** via sidebar + top tabs (state `screen`); body re-mounts with
  `scr` enter animation.
- **Cross-navigation wired** (recreate as router pushes or state sets):
  - Map rooms → Debate / Reader / Manuscript / Library (hover-lift affordance).
  - Reader "Send to Debate" ×3 → Debate.
  - Debate "Accept & Send to Leader" → Reports; "Request More Evidence" → Reader.
  - Global Queue "View All Queue" → Tasks.
  - Reports "Open in Studio" → Manuscript; Projects "Open Lab Map" → Map.
- **Live pulse** on: system-status dot, Agents "Online" dot, Manuscript "Writer
  drafting" dot.
- **Hover**: clickable map cards lift 3px + soft shadow (`.16s`).

## State Management
- `screen`: current view (see enum above). Default `map`.
- All other content shown is currently static mock data mirroring
  `apps/web/src/data/demoResearchLab.ts` (rooms, statuses, queue, agents). In the
  real app, bind these to the existing research-lab state/store. Statuses map to a
  small vocabulary: **Running · Waiting · Idle · Debating · Waiting for user**.

## Assets
Dinosaur illustrations (PNG, transparent) — already in the repo at
`apps/web/public/brand/agents/`: `leader-dino`, `explorer-dino` (Coordinator),
`search-dino`, `librarian-dino`, `reader-dino`, `critic-dino`, `strategist-dino`,
`experiment-dino`, `writer-dino`, plus `researchdino-mark.png`. Reuse these
directly. All other icons are inline 1.5–1.8px-stroke line SVGs (no icon lib
required; substitute Lucide equivalents if preferred).

## Files
- `ResearchDino Lab Map.dc.html` — the full hifi prototype (all 10 views + logic).
  Open in a browser to interact. Reference its markup/styles/copy when building the
  React components.
