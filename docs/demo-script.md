# Neutrino — Judge Demonstration Script (3–5 Minutes)

**Project:** Neutrino: Graph-Native AI Investigation Platform  
**Target Tracks:**
- Track 01 — Agents That Act on Connected Data (Primary)
- Track 02 — Agent Memory and Coordination
- Track 03 — Company Brain  
**Database:** FalkorDB  
**Live UI:** `http://localhost:3000`  
**API Endpoint:** `http://localhost:4000/api/v1`  

---

## Demonstration Overview & Timeline

| Timestamp | Phase | Topic Covered | Observable System Artifact |
|---|---|---|---|
| **0:00 – 0:30** | 1. Introduction | The problem with isolated alerts & why graph reasoning is essential | Neutrino Web UI Dashboard |
| **0:30 – 1:15** | 2. Connected Data | Synthetic SEV-1 incident `INC-2026-101`, multi-hop graph path discovery | Topology Graph & Trace Visualization |
| **1:15 – 2:00** | 3. Hypotheses | Evaluating competing hypotheses & contradictory evidence | Hypothesis comparison matrix & provenance |
| **2:00 – 2:40** | 4. Persistent Memory | Cross-session memory recall from past quarters (`INC-2025-089`) | Memory Recall cards & verified knowledge claims |
| **2:40 – 3:30** | 5. Safe Actions | 2-person approval boundary, execution sandbox & postcondition check | Action drawer, approval modal, verified status |
| **3:30 – 4:15** | 6. Operations & Security | Multi-tenant isolation, cryptographic JWT auth, audit trail | Audit & Health view, tenant switcher |
| **4:15 – 5:00** | 7. FalkorDB Power | Verified benchmark results (2,324 nodes, 4,245 relationships, p50: 0.45ms) | Terminal benchmark & conclusion |

---

## Detailed Step-by-Step Walkthrough

### Part 1: Problem & Value Proposition (0:00 – 0:30)
**Speaker Narration:**
> *"When a high-severity incident strikes a modern microservice architecture, engineers are flooded with thousands of disconnected alerts, logs, and metric spikes across dozens of dashboards. LLMs acting on raw text hallucinate plausible-sounding causes because they lack the topological context of what actually connects to what.*
>
> *Neutrino is an autonomous operational investigation platform built directly on **FalkorDB**. Instead of guessing, Neutrino reconstructs failures by traversing real dependency graphs, evaluating temporal deployment changes, recalling cross-session organizational memory, and proposing safe, approval-gated actions."*

**On Screen:**
- Navigate to `http://localhost:3000`.
- Display the clean, modern dark-mode Neutrino interface showing live system health, recent incidents, and graph statistics.

---

### Part 2: Connected-Data Investigation (0:30 – 1:15)
**Speaker Narration:**
> *"Let's look at an active SEV-1 incident: `INC-2026-101`, where `checkout-service` is throwing sudden HTTP 500 token verification errors. 
> Looking only at the checkout logs tells you that tokens are failing signature checks. But checkout itself had no code changes today.*
>
> *Let's run an investigation. In less than 1.5 seconds, Neutrino executes a multi-hop traversal in FalkorDB: `checkout-service` DEPENDS_ON `auth-service`, which had a release `v2.4.1` deployed 17 minutes prior to symptom onset. FalkorDB connects the telemetry error from checkout directly to the upstream deployment commit that shortened the JWT key cache TTL."*

**On Screen:**
- Click on **INC-2026-101** in the Incidents view.
- Click **"Run Graph Investigation"**.
- Point to the **Multi-Hop Traversal Graph**:
  `checkout-service` → `[DEPENDS_ON]` → `auth-service` → `[HAS_DEPLOYMENT]` → `v2.4.1 (Reduced internal JWT signing key cache TTL)`
- Show the 60 temporally valid evidence items correlated in the timeline.

---

### Part 3: Competing Hypotheses & Honest Abstention (1:15 – 2:00)
**Speaker Narration:**
> *"Notice that Neutrino doesn't just pick one theory. It generates and ranks competing candidate explanations based on real evidence in FalkorDB.*
>
> *Hypothesis 1—upstream key cache desync—is marked **SUPPORTED** because error logs on auth-service and checkout-service both confirm the missing key ID `k-2026-b`.*
> *Hypothesis 2—database bottleneck—is marked **CONTRADICTED** because live telemetry retrieved from Postgres shows latency remained steady under 2 milliseconds and connection pools were healthy.*
>
> *If evidence were missing or contradictory, Neutrino would honestly flag it as `insufficient-evidence` rather than fabricating an answer."*

**On Screen:**
- Scroll down to the **Candidate Explanations** panel.
- Hover over the **Supported** badge on `Upstream Key Rotation Desync`.
- Hover over the **Contradicted** badge on `Database Connection Pool Saturation` showing the corroborating metric evidence ID.

---

### Part 4: Persistent Memory Across Sessions (2:00 – 2:40)
**Speaker Narration:**
> *"Now observe the Memory panel. Two quarters ago, the team resolved a similar incident: `INC-2025-089`.*
>
> *Neutrino stored this episode as a persistent graph node in FalkorDB with grounded evidence relationships. During this new investigation, Neutrino recalled that precedent and retrieved the verified knowledge claim: `Asymmetric key cache expiration under rapid rotation causes token verification failure`.*
>
> *It also recalled the proven procedure: flush the key cache and trigger JWKS synchronization. Memory in Neutrino survives full application restarts and is strictly tenant-isolated."*

**On Screen:**
- Click the **"Recalled Organizational Memory"** tab.
- Show the recalled `KnowledgeClaim` (Confidence: 96%) linked to historical incident `INC-2025-089`.
- Show the verified `DiagnosticProcedure` recommendation.

---

### Part 5: Safe Action Lifecycle & Verification (2:40 – 3:30)
**Speaker Narration:**
> *"Remediating production systems must never be an unconstrained agent free-for-all. Neutrino enforces a strict four-stage action lifecycle:*
> 1. *Evidence-backed proposal.*
> 2. *Cryptographic two-person approval separation—the proposing engineer cannot self-approve.*
> 3. *Execution strictly against an allowlisted handler.*
> 4. *Independent postcondition verification.*
>
> *Here, the agent proposes a `cache_flush` on the auth service. Let's attempt self-approval: the API strictly rejects it. Now two independent SREs approve it. 
> The action executes in our sandboxed environment, and Neutrino immediately inspects live telemetry in FalkorDB to verify that token latency returned to normal. Notice the status transitions to **VERIFIED**."*

**On Screen:**
- Open the **Action Proposals** drawer.
- Demonstrate self-approval rejection in the UI.
- Approve with authorized peer credentials (`lead-sre` and `incident-commander`).
- Click **"Execute Remediation"**.
- Click **"Verify Postconditions"** and show the confirmation badge: `Postconditions confirmed by independent healthy evidence records in FalkorDB`.

---

### Part 6: Operations, Multi-Tenancy & Audit Integrity (3:30 – 4:15)
**Speaker Narration:**
> *"In the Audit & Health dashboard, every single request, traversal, approval, and execution is recorded in a tenant-isolated audit log.*
>
> *Tenant Alpha cannot inspect Tenant Beta's telemetry, memory, or incidents—even direct ID lookups and multi-hop graph traversals enforce tenant boundaries at every edge. 
> In production mode, Neutrino fails closed if cryptographic authentication is missing, ignoring forged client identity headers."*

**On Screen:**
- Switch to the **Audit & Health** dashboard tab.
- Show the real-time health checks: `databaseConnected: true`, `memoryStoreReady: true`, `uptime: active`.
- Show the immutable audit trail with correlation IDs, principal IDs, and timestamps.

---

### Part 7: FalkorDB Power & Measured Results (4:15 – 5:00)
**Speaker Narration:**
> *"Why FalkorDB? In our reproducible benchmark running against 2,324 nodes and 4,245 relationships:*
> - *Point lookups execute in **0.46ms**.*
> - *3-hop topology traversals complete in **0.45ms**.*
> - *Evidence retrieval takes **2.54ms**.*
> - *The complete multi-hop causal investigation loop completes in **1.47 seconds**.*
>
> *Neutrino demonstrates that when AI agents are grounded in connected data via FalkorDB, they don't hallucinate—they investigate, remember, and safely resolve. Thank you."*

**On Screen:**
- Show terminal output of `pnpm test` (134/134 passing across 23 test suites) and `pnpm bench` (reproducible p50/p95 latency metrics).
- Return to the Neutrino logo and conclude.

---

## Manual Video Recording Instructions

To produce a video recording of this demo:
1. Ensure FalkorDB is running: `docker compose up -d`
2. Start the API server: `pnpm --filter @neutrino/api dev` (port 4000)
3. Start the Next.js frontend: `pnpm --filter @neutrino/web dev` (port 3000)
4. Open Chrome or OBS Studio at `1920x1080` resolution.
5. Follow the timing script above step-by-step.
6. Save the resulting MP4/WebM to `docs/demo-video.webm` or your presentation folder.
