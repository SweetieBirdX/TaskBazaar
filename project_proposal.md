# TaskBazaar — Project Proposal
**Agents on Stellar Hackathon · April 2026**

---

## One-Line Pitch

> *An autonomous economy where AI agents discover staked services from a Soroban registry, earn profit by coordinating sub-agents via x402 micropayments on Stellar, and settle autonomously — no subscriptions, no API keys, no humans in the loop.*

---

## The Problem

AI agents can reason, plan, and act — but they hit a hard stop the moment they need to pay for something. Buying API access today means API keys, monthly subscriptions, manual billing, and a human in the loop to authorize every payment. This fundamentally breaks autonomous workflows. An agent cannot operate economically on its own.

The deeper problem: even if payments were solved, agents have no way to discover what services exist, what they cost, or which ones are trustworthy. There is no marketplace for machine-to-machine commerce. There is no reputation layer. There is no economic enforcement.

---

## The Solution

TaskBazaar is three things working together:

**1. An on-chain service registry (Soroban).**
Any agent can register its service by staking USDC as collateral. The registry is permissionless — no admin approval, no API key to get in. Agents query the registry to discover available services by category, sorted by reputation score. Bad actors get reported and suspended. Their stake stays locked. This is why we need Soroban and not a Supabase database: the economic guarantees only work on-chain.

**2. An Intent Solver Orchestrator.**
The user states a goal — "analyze the security of this smart contract" — and sets a budget. The Orchestrator queries the registry, selects the most cost-efficient and reputable sub-agents for each part of the task, opens escrow contracts for each payment, and synthesizes the final result. The Orchestrator earns the margin between the user's budget and what it actually spent. This margin is not arbitrary commission — it is the price of complexity abstraction. The user pays for not having to know which agents exist, which is cheapest, or how to coordinate them.

**3. x402 micropayments on Stellar.**
Every sub-agent exposes an x402-protected HTTP endpoint. When the Orchestrator calls a sub-agent, it gets an HTTP 402 response with the price. It pays in USDC via Stellar, settlement happens in under 5 seconds, and the resource is delivered. No API keys. No invoices. One HTTP round-trip.

---

## How It Works — End to End

```
User writes: "Collect all ETH L2 TVL data from the last 7 days 
              and produce a risk analysis report."
User sets max budget: 0.50 USDC
```

The Orchestrator boots, reads the Soroban registry, and plans:

| Step | Sub-Agent | Payment | Method |
|---|---|---|---|
| 1 | Scraper Agent | 0.10 USDC | x402 on Stellar |
| 2 | Analyzer Agent | 0.08 USDC | x402 on Stellar |
| 3 | Report Agent | 0.07 USDC | x402 on Stellar |
| — | Orchestrator fee | 0.25 USDC | margin kept |

Every payment goes through a Soroban escrow contract. The sub-agent has 5 minutes to deliver. If it delivers, the Orchestrator calls `release_escrow`. If it goes silent, anyone can call `timeout_refund` after the deadline — the USDC comes back automatically. No stuck funds, no manual intervention.

The React dashboard shows all of this happening live: who paid whom, when, how much, the transaction hash on Stellar, the remaining budget, and the final report.

---

## Soroban Contract — What It Does

The contract has five responsibilities:

**`register_service`** — locks 5 USDC minimum stake, adds agent to the registry with Active status.

**`get_services(category)`** — returns only Active agents in a given category, ordered by fault score ascending.

**`create_escrow`** — locks payment in contract, sets a 5-minute deadline, records that this orchestrator has interacted with this agent (enabling future fault reporting).

**`release_escrow` / `timeout_refund`** — releases funds to agent on delivery, or refunds orchestrator on timeout.

**`report_fault`** — increments an agent's fault score. Two guards protect against abuse: the reporter must have a real escrow history with this agent, and each address can only report a given agent once. At fault score ≥ 3, the agent becomes Suspended and disappears from registry queries.

---

## Known Limitations (V1)

We document these proactively because a judge who discovers them on their own is a problem — a judge who reads them in the README is impressed.

**Timeout Refund Loophole.** An attacker can open an escrow, wait 5 minutes, reclaim their USDC via `timeout_refund`, and still have the `HasInteracted` flag set — enabling a free fault report. Fix in V2: gate `HasInteracted` on `release_escrow` only (successful delivery), and require orchestrators to stake collateral before reporting.

**Single-Reporter Trust.** Three wallets controlled by the same person could suspend a competitor for the cost of three Stellar transaction fees. Fix in V2: stake-weighted fault voting — reports from higher-staked orchestrators carry more weight, coordinated attacks become expensive.

**Sequential Settlement Latency.** Each x402 call adds ~5 seconds of Stellar consensus time. For 3–4 agent calls this is acceptable. For high-frequency workflows it is not. Fix in V2: Stellar Payment Channels for off-chain streaming micropayments that settle on-chain in batches.

**Hallucination / Bad Data.** There is no cryptographic proof that a sub-agent executed correctly before payment is released. This is an industry-wide open problem. The `report_fault` mechanism creates economic incentive for honesty but does not verify compute. Fix in V3: TEE or zk-TLS proofs.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Smart contract | Soroban (Rust) on Stellar Testnet |
| Sub-agent servers | Node.js + Express + `@x402/express` middleware |
| Orchestrator | Node.js — queries Soroban, manages escrow, calls sub-agents |
| Payment protocol | x402 (Coinbase) + Stellar facilitator |
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| Wallet | Freighter (auth-entry signing for Soroban) |
| Real-time feed | WebSocket / SSE — live transaction log to dashboard |

---

## Why This Wins

The hackathon text says: *"Build apps where agents can buy, sell, coordinate, and earn."* TaskBazaar hits all four words simultaneously. Most submissions will show an agent paying for one API call. Ours shows an agent earning profit by running an autonomous sub-economy.

The Soroban registry answers "why blockchain?" with real on-chain economic enforcement — not just a decentralized database. The escrow pattern answers the timeout problem. The `report_fault` guards answer the manipulation problem. The proactive README answers everything else.

The demo is the strongest possible: a user types a goal, sets a budget, and watches real USDC move between agents on Stellar in real time. Every transaction is verifiable on the testnet explorer. The dashboard is the product.

---

## V2 Roadmap (Post-Hackathon)

Open registry where anyone registers services. Stake-weighted fault voting. Mainnet deployment with real USDC. MCP server integration so agents discover TaskBazaar services automatically. Multi-chain routing via x402 V2.

The long-term vision: what the App Store is for human developers, TaskBazaar is for AI agents.

---

## Submission Checklist

- Public GitHub repo with full source and detailed README
- 2–3 minute video demo showing live agent coordination and Stellar transactions
- Real Stellar testnet interactions (escrow creation, x402 payments, registry calls)
