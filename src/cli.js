#!/usr/bin/env node
import { createJob, acceptJob, completeJob, cancelJob, disputeJob, getJob, getAgentJobs, getUsdcBalance } from './index.js';

const args = process.argv.slice(2);
const command = args[0];

function parseArgs(args) {
  const result = {};
  for (let i = 1; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    result[key] = args[i + 1];
  }
  return result;
}

async function main() {
  const params = parseArgs(args);
  const privateKey = process.env.PRIVATE_KEY;
  const network = params.network || 'base-sepolia';

  switch (command) {
    case 'create': {
      if (!privateKey) throw new Error('PRIVATE_KEY env required');
      const result = await createJob({
        privateKey,
        worker: params.worker || undefined,
        amount: params.amount,
        duration: parseInt(params.duration),
        description: params.description,
        network
      });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    
    case 'accept': {
      if (!privateKey) throw new Error('PRIVATE_KEY env required');
      const result = await acceptJob({
        privateKey,
        jobId: params.job,
        network
      });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    
    case 'complete': {
      if (!privateKey) throw new Error('PRIVATE_KEY env required');
      const result = await completeJob({
        privateKey,
        jobId: params.job,
        network
      });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    
    case 'cancel': {
      if (!privateKey) throw new Error('PRIVATE_KEY env required');
      const result = await cancelJob({
        privateKey,
        jobId: params.job,
        network
      });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    
    case 'dispute': {
      if (!privateKey) throw new Error('PRIVATE_KEY env required');
      const result = await disputeJob({
        privateKey,
        jobId: params.job,
        network
      });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    
    case 'status': {
      const result = await getJob({
        jobId: params.job,
        network
      });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    
    case 'jobs': {
      const result = await getAgentJobs({
        address: params.address,
        network
      });
      console.log(JSON.stringify(result, null, 2));
      break;
    }
    
    case 'balance': {
      const result = await getUsdcBalance({
        address: params.address,
        network
      });
      console.log(`USDC Balance: ${result}`);
      break;
    }
    
    default:
      console.log(`
USDC Escrow CLI - Agent-to-Agent Payments

Commands:
  create    Create a new escrow job
            --worker <address>  Worker address (optional, 0x0 for open)
            --amount <usdc>     Amount in USDC
            --duration <secs>   Duration in seconds
            --description <txt> Job description

  accept    Accept an open job
            --job <jobId>       Job ID to accept

  complete  Complete job & release funds
            --job <jobId>       Job ID to complete

  cancel    Cancel job (if no worker)
            --job <jobId>       Job ID to cancel

  dispute   Raise a dispute
            --job <jobId>       Job ID to dispute

  status    Get job status
            --job <jobId>       Job ID to check

  jobs      List agent's jobs
            --address <addr>    Agent address

  balance   Check USDC balance
            --address <addr>    Address to check

Options:
  --network <name>   Network (base-sepolia or base)

Environment:
  PRIVATE_KEY        Wallet private key (for write operations)
  ESCROW_ADDRESS     Deployed escrow contract address
      `);
  }
}

main().catch(console.error);
