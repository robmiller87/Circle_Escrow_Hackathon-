---
name: usdc-escrow
description: Agent-to-agent escrow using USDC on Base. Create jobs, fund escrow, release on completion. Trustless payments between AI agents.
metadata: {"openclaw":{"emoji":"💰","requires":{"bins":["node"],"env":["PRIVATE_KEY"]}}}
---

# USDC Escrow Skill

Trustless escrow for agent-to-agent payments using USDC on Base.

Built by George (@georgerm) for the Circle USDC Hackathon.

## When to Use This Skill

Use this skill when:
- You need to pay another agent for work
- You want to post a job with guaranteed payment
- You need trustless escrow for agent-to-agent transactions
- You want to accept paid work from other agents

## How It Works

```
Client Agent                    Escrow Contract                 Worker Agent
     |                                |                              |
     |-- createJob(amount, desc) ---->|                              |
     |    [USDC locked in escrow]     |                              |
     |                                |<---- acceptJob(jobId) -------|
     |                                |                              |
     |                                |      [Work happens]          |
     |                                |                              |
     |-- completeJob(jobId) --------->|                              |
     |                                |---- USDC transfer ---------->|
     |                                |                              |
```

## Quick Start

### 1. Create a Job (Client Agent)

```javascript
const { createJob } = require('./src');

// Post a job with 10 USDC escrow
const jobId = await createJob({
  privateKey: process.env.PRIVATE_KEY,
  worker: '0x...',           // Worker address (or address(0) for open job)
  amount: '10',              // USDC amount
  duration: 7 * 24 * 60 * 60, // 7 days
  description: 'Write a blog post about AI agents'
});

console.log('Job created:', jobId);
```

### 2. Accept a Job (Worker Agent)

```javascript
const { acceptJob } = require('./src');

await acceptJob({
  privateKey: process.env.PRIVATE_KEY,
  jobId: '0x...'
});
```

### 3. Complete & Release (Client Agent)

```javascript
const { completeJob } = require('./src');

// Release funds to worker
await completeJob({
  privateKey: process.env.PRIVATE_KEY,
  jobId: '0x...'
});
```

## Contract Addresses

### Base Sepolia (Testnet)
- **AgentEscrow:** `0xFc746B0f583b544377bd0A4bBb8db0F76E269eE8`
- **USDC:** `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

### Base Mainnet
- **AgentEscrow:** `TBD`
- **USDC:** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

## CLI Usage

```bash
# Create a job
PRIVATE_KEY=0x... node src/cli.js create \
  --worker 0x... \
  --amount 10 \
  --duration 604800 \
  --description "Build an OpenClaw skill"

# Accept a job
PRIVATE_KEY=0x... node src/cli.js accept --job 0x...

# Complete a job
PRIVATE_KEY=0x... node src/cli.js complete --job 0x...

# Check job status
node src/cli.js status --job 0x...
```

## Job Lifecycle

| Status | Description |
|--------|-------------|
| Created | Job posted, USDC in escrow, waiting for worker |
| Funded | Worker accepted, work in progress |
| Completed | Client approved, funds released to worker |
| Disputed | Either party raised dispute |
| Resolved | Dispute resolved (after 7-day timeout) |
| Cancelled | Client cancelled before worker accepted |

## Dispute Resolution

If there's a disagreement:
1. Either party calls `disputeJob()`
2. 7-day resolution period begins
3. After timeout, funds return to client (default)

Future versions will add:
- Third-party arbitration
- Split payments
- Milestone-based release

## Security

- Uses OpenZeppelin's SafeERC20 and ReentrancyGuard
- Minimum 1 USDC per job (prevents spam)
- Maximum 30-day duration
- Only parties can modify job state

## Get Testnet USDC

1. Go to https://faucet.circle.com/
2. Connect wallet
3. Request USDC on Base Sepolia

## Why This Matters

Agents need to pay each other. Current options:
- Trust (doesn't scale)
- Centralized platforms (single point of failure)
- Complex DAOs (too much overhead)

AgentEscrow provides simple, trustless, on-chain escrow that any agent can use. No trust required. No intermediaries. Just code.

## Links

- Contract: [GitHub](https://github.com/georgerm/usdc-escrow)
- Author: [@georgerm on Farcaster](https://farcaster.xyz/georgerm)
- Built on: [OpenClaw](https://openclaw.ai)
