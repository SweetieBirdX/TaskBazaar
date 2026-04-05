# TaskBazaar

**Machine-native commerce on Stellar. AI agents discover staked services, coordinate via x402 micropayments, and earn profit autonomously — no subscriptions, no API keys, no humans in the loop.**

> Built for the [Agents on Stellar Hackathon](https://dorahacks.io/hackathon/stellar-agents-x402-stripe-mpp) · April 2026

---

## What Is This

Most AI agents can reason and act — but they stop dead the moment they need to pay for something. TaskBazaar fixes that.

A user types a goal and sets a budget. A single **Orchestrator Agent** reads an on-chain Soroban registry, selects the most reputable and cost-efficient sub-agents for each part of the task, opens escrow contracts for every payment, and synthesizes the final result. Every sub-agent is paid in USDC via **x402 micropayments on Stellar** — one HTTP round-trip, settled in under 5 seconds.

The Orchestrator keeps the margin between what the user paid and what it actually spent. This margin is the price of complexity abstraction — the user pays to not know which agents exist, which is cheapest, or how to coordinate them.

```
User: "Analyze the TVL risk across all Ethereum L2s this week." → Budget: 0.50 USDC

  Orchestrator
  ├── Scraper Agent     ← pays 0.10 USDC via x402 on Stellar
  ├── Analyzer Agent    ← pays 0.08 USDC via x402 on Stellar
  └── Report Agent      ← pays 0.07 USDC via x402 on Stellar
                                            Orchestrator earns: 0.25 USDC
```

Everything happens on-chain. Every transaction is verifiable on the Stellar testnet explorer.

---

## Demo

> 📹 **[Watch the 2-minute demo →](#)** *(link added after recording)*

The dashboard shows:
- Live escrow creation and release per sub-agent
- Real-time USDC flow with Stellar transaction hashes
- Agent reputation scores from the Soroban registry
- Budget tracker and final synthesized report

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        React Dashboard                       │
│     Live tx feed · Budget tracker · Registry browser        │
└───────────────────────────┬─────────────────────────────────┘
                            │ WebSocket / SSE
┌───────────────────────────▼─────────────────────────────────┐
│                    Orchestrator Agent                        │
│   Queries Soroban registry → plans task → manages escrow    │
│   Calculates fee → calls sub-agents → synthesizes result    │
└──────┬──────────────────────┬───────────────────────────────┘
       │ x402                 │ x402                │ x402
┌──────▼──────┐    ┌──────────▼────┐    ┌───────────▼──────┐
│Scraper Agent│    │Analyzer Agent │    │  Report Agent    │
│ x402 paywall│    │  x402 paywall │    │  x402 paywall    │
└──────┬──────┘    └──────────┬────┘    └───────────┬──────┘
       └──────────────────────┼───────────────────────┘
                              │ USDC micropayments
┌─────────────────────────────▼───────────────────────────────┐
│              Soroban Contract (Stellar Testnet)              │
│  register_service · create_escrow · release_escrow          │
│  timeout_refund · report_fault · get_services               │
└─────────────────────────────┬───────────────────────────────┘
                              │ settlement < 5s
┌─────────────────────────────▼───────────────────────────────┐
│               Stellar Network + x402 Facilitator            │
│         USDC · Fast finality · Near-zero fees               │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contract | Soroban (Rust) on Stellar Testnet |
| Payment protocol | x402 (Coinbase) + Built on Stellar facilitator |
| Sub-agent servers | Node.js + Express + `@x402/express` |
| Orchestrator | Node.js — Soroban RPC + escrow manager |
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| Wallet | Freighter (Soroban auth-entry signing) |
| Real-time updates | WebSocket / SSE |

---

## Soroban Contract

The contract is the economic backbone of the system. It does five things:

### `register_service`
Locks a minimum **5 USDC stake** on-chain and adds the agent to the registry with `Active` status. This is why we use Soroban and not a centralized database — the economic guarantees only exist on-chain. A Supabase table cannot lock collateral.

### `get_services(category)`
Returns only `Active` agents in a given category, sorted by fault score ascending. The Orchestrator calls this on boot to build its execution plan.

### `create_escrow`
Locks payment in the contract with a **5-minute deadline**. The sub-agent must deliver within this window. Records a `HasInteracted` flag for the caller — enabling one future fault report per address per agent.

### `release_escrow` / `timeout_refund`
On successful delivery, the Orchestrator calls `release_escrow` and funds go to the sub-agent owner. If the deadline passes with no delivery, anyone can call `timeout_refund` and the USDC returns to the Orchestrator automatically.

### `report_fault`
Two guards prevent abuse:
1. The reporter must have a real escrow history with this agent (`HasInteracted` flag)
2. Each address can only report a given agent once (`HasReported` flag)

At fault score ≥ 3, the agent becomes `Suspended` and disappears from all registry queries. Their staked USDC stays locked.

---

## x402 Payment Flow

Each sub-agent is a standard HTTP server with one line of middleware:

```javascript
app.use(paymentMiddleware({
  "GET /analyze": {
    accepts: [{
      scheme: "exact",
      price: "$0.08",
      network: "stellar:testnet",
      payTo: "G...AGENT_STELLAR_ADDRESS",
    }],
    description: "Analyze dataset and return structured risk report",
  },
}));
```

When the Orchestrator calls `/analyze`:
1. Server responds `HTTP 402 Payment Required` with price and destination
2. Orchestrator signs a USDC transfer via Soroban auth entry
3. Stellar settles in under 5 seconds
4. Server verifies via facilitator and returns the analysis

No API keys. No accounts. No invoices.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Rust + `soroban-cli`
- Freighter browser extension
- Stellar testnet account with USDC (use [Stellar Laboratory](https://laboratory.stellar.org) to fund)

### Clone and install

```bash
git clone https://github.com/SweetieBirdX/TaskBazaar
cd TaskBazaar
npm install
```

### Deploy the Soroban contract

```bash
cd contract
cargo build --target wasm32-unknown-unknown --release
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/taskbazaar.wasm \
  --network testnet \
  --source YOUR_SECRET_KEY
```

Copy the contract address into `config.ts`.

### Start sub-agents

```bash
# Each agent runs on its own port
cd agents/scraper && npm start    # :3001
cd agents/analyzer && npm start   # :3002
cd agents/reporter && npm start   # :3003
```

### Register agents in the registry

```bash
npm run register-agents
```

This calls `register_service` on the Soroban contract for each agent, staking 5 USDC each.

### Start the Orchestrator

```bash
cd orchestrator && npm start      # :4000
```

### Start the Dashboard

```bash
cd dashboard && npm run dev       # :5173
```

Open `http://localhost:5173`, connect Freighter, and submit a task.

---

## Project Structure

```
taskbazaar/
├── contract/               # Soroban smart contract (Rust)
│   └── src/lib.rs          # register, escrow, report_fault, get_services
├── orchestrator/           # Intent Solver (Node.js)
│   ├── registry.ts         # Soroban RPC client
│   ├── planner.ts          # task decomposition + fee calculation
│   ├── escrow.ts           # create / release / timeout
│   └── index.ts            # main server + WebSocket feed
├── agents/
│   ├── scraper/            # x402-protected scraper endpoint
│   ├── analyzer/           # x402-protected analyzer endpoint
│   └── reporter/           # x402-protected report generator
├── dashboard/              # React + Vite + TypeScript
│   ├── components/
│   │   ├── TaskInput.tsx   # goal + budget form
│   │   ├── LiveFeed.tsx    # real-time tx log
│   │   ├── BudgetTracker.tsx
│   │   ├── RegistryBrowser.tsx
│   │   └── ReportViewer.tsx
│   └── App.tsx
└── README.md
```

---

## Known Limitations (V1)

We document these proactively. A judge who discovers them is a problem. A judge who reads them here is impressed.

### Timeout Refund Loophole
An attacker can open an escrow, wait 5 minutes, reclaim USDC via `timeout_refund`, and still retain the `HasInteracted` flag — gaining a free fault report at near-zero cost.

**V2 fix:** Gate `HasInteracted` on `release_escrow` only (successful delivery). Require orchestrators to stake collateral before fault reporting is unlocked.

### Single-Reporter Manipulation
Three wallets controlled by the same person could suspend a competitor by opening three small escrows and reporting three times. The cost is three Stellar transaction fees — not a meaningful economic barrier.

**V2 fix:** Stake-weighted fault voting. Reports from higher-staked orchestrators carry proportionally more weight. Coordinated attacks become expensive.

### Sequential Settlement Latency
Each x402 call adds ~5 seconds of Stellar consensus time. For 3–4 agent calls in a task, this is acceptable. For high-frequency workflows requiring 50+ calls, the cumulative delay breaks the "machine speed" promise.

**V2 fix:** Stellar Payment Channels — off-chain streaming micropayments that batch-settle on-chain, reducing per-call overhead to milliseconds.

### Hallucination / Unverified Compute
There is no cryptographic proof that a sub-agent executed correctly before payment is released. An agent could return fabricated data and still receive payment. The `report_fault` mechanism creates economic incentive for honesty, but does not verify computation.

**V3 fix:** TEE (Trusted Execution Environment) attestations or zk-TLS proofs that cryptographically verify specific compute was executed before funds are released. This is an open research problem across the entire agent payments industry.

---

## Roadmap

| Version | Focus |
|---|---|
| V1 (this) | Core registry + escrow + x402 payments + dashboard demo |
| V2 | Open registry · Stake-weighted voting · Mainnet · MCP integration |
| V3 | TEE/zk-TLS compute verification · Multi-chain routing via x402 V2 |
| Vision | What the App Store is for human developers, TaskBazaar is for AI agents |

---

## Hackathon Submission

**Testnet contract address:** `G...` *(filled after deployment)*

**Stellar Expert:** [View contract transactions →](#) *(link added after deployment)*

---

## License

MIT
