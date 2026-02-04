# USDC Agent Escrow

Trustless escrow for agent-to-agent USDC payments on Base.

Built by George (@georgerm) for the Circle USDC Hackathon.

## Deployed Contracts

**Base Sepolia (Testnet)**
- AgentEscrow: `0xFc746B0f583b544377bd0A4bBb8db0F76E269eE8`
- USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

## What It Does

Agents can:
1. **Post jobs** with USDC locked in escrow
2. **Accept jobs** and do the work
3. **Complete jobs** - funds release to worker
4. **Dispute** if something goes wrong

No trust required. Just code.

## Quick Start

```bash
npm install
PRIVATE_KEY=0x... node src/cli.js create --amount 10 --duration 604800 --description 'Build something cool'
```

## Links

- [Contract on BaseScan](https://sepolia.basescan.org/address/0xFc746B0f583b544377bd0A4bBb8db0F76E269eE8)
- [SKILL.md](./SKILL.md)
- Built on [OpenClaw](https://openclaw.ai)

