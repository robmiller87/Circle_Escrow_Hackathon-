import { ethers } from 'ethers';
import { config } from 'dotenv';
config();

// Contract ABIs (minimal for interaction)
const ESCROW_ABI = [
  "function createJob(address worker, uint256 amount, uint256 duration, string calldata jobHash) external returns (bytes32)",
  "function acceptJob(bytes32 jobId) external",
  "function completeJob(bytes32 jobId) external",
  "function cancelJob(bytes32 jobId) external",
  "function disputeJob(bytes32 jobId) external",
  "function resolveDispute(bytes32 jobId) external",
  "function getJob(bytes32 jobId) external view returns (address client, address worker, uint256 amount, uint256 deadline, string memory jobHash, uint8 status, uint256 createdAt)",
  "function getAgentJobs(address agent) external view returns (bytes32[] memory)",
  "event JobCreated(bytes32 indexed jobId, address indexed client, uint256 amount, string jobHash)",
  "event JobCompleted(bytes32 indexed jobId, address indexed worker, uint256 payout)"
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)"
];

// Network configs
const NETWORKS = {
  'base-sepolia': {
    rpc: 'https://sepolia.base.org',
    chainId: 84532,
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    escrow: process.env.ESCROW_ADDRESS || '0xFc746B0f583b544377bd0A4bBb8db0F76E269eE8',
    explorer: 'https://sepolia.basescan.org'
  },
  'base': {
    rpc: 'https://mainnet.base.org',
    chainId: 8453,
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    escrow: process.env.ESCROW_ADDRESS_MAINNET || null,
    explorer: 'https://basescan.org'
  }
};

const JOB_STATUS = ['Created', 'Funded', 'Completed', 'Disputed', 'Resolved', 'Cancelled'];

/**
 * Get provider and wallet
 */
export function getWallet(privateKey, network = 'base-sepolia') {
  const config = NETWORKS[network];
  if (!config) throw new Error(`Unknown network: ${network}`);
  
  const provider = new ethers.JsonRpcProvider(config.rpc);
  const wallet = new ethers.Wallet(privateKey, provider);
  
  return { wallet, provider, config };
}

/**
 * Create a new escrow job
 */
export async function createJob({
  privateKey,
  worker = ethers.ZeroAddress,
  amount,
  duration,
  description,
  network = 'base-sepolia'
}) {
  const { wallet, config } = getWallet(privateKey, network);
  
  if (!config.escrow) throw new Error('Escrow contract not deployed on this network');
  
  const usdc = new ethers.Contract(config.usdc, ERC20_ABI, wallet);
  const escrow = new ethers.Contract(config.escrow, ESCROW_ABI, wallet);
  
  // Parse amount to USDC decimals (6)
  const amountWei = ethers.parseUnits(amount.toString(), 6);
  
  // Check balance
  const balance = await usdc.balanceOf(wallet.address);
  if (balance < amountWei) {
    throw new Error(`Insufficient USDC balance. Have: ${ethers.formatUnits(balance, 6)}, Need: ${amount}`);
  }
  
  // Approve if needed
  const allowance = await usdc.allowance(wallet.address, config.escrow);
  if (allowance < amountWei) {
    console.log('Approving USDC spend...');
    const approveTx = await usdc.approve(config.escrow, ethers.MaxUint256);
    await approveTx.wait();
    console.log('Approved!');
  }
  
  // Create job hash from description
  const jobHash = ethers.keccak256(ethers.toUtf8Bytes(description));
  
  console.log('Creating job...');
  const tx = await escrow.createJob(worker, amountWei, duration, jobHash);
  const receipt = await tx.wait();
  
  // Get job ID from event
  const event = receipt.logs.find(log => {
    try {
      return escrow.interface.parseLog(log)?.name === 'JobCreated';
    } catch { return false; }
  });
  
  const jobId = event ? escrow.interface.parseLog(event).args.jobId : null;
  
  console.log(`Job created! ID: ${jobId}`);
  console.log(`Explorer: ${config.explorer}/tx/${receipt.hash}`);
  
  return { jobId, txHash: receipt.hash };
}

/**
 * Accept an open job
 */
export async function acceptJob({
  privateKey,
  jobId,
  network = 'base-sepolia'
}) {
  const { wallet, config } = getWallet(privateKey, network);
  
  if (!config.escrow) throw new Error('Escrow contract not deployed');
  
  const escrow = new ethers.Contract(config.escrow, ESCROW_ABI, wallet);
  
  console.log('Accepting job...');
  const tx = await escrow.acceptJob(jobId);
  const receipt = await tx.wait();
  
  console.log(`Job accepted!`);
  console.log(`Explorer: ${config.explorer}/tx/${receipt.hash}`);
  
  return { txHash: receipt.hash };
}

/**
 * Complete job and release funds
 */
export async function completeJob({
  privateKey,
  jobId,
  network = 'base-sepolia'
}) {
  const { wallet, config } = getWallet(privateKey, network);
  
  if (!config.escrow) throw new Error('Escrow contract not deployed');
  
  const escrow = new ethers.Contract(config.escrow, ESCROW_ABI, wallet);
  
  console.log('Completing job and releasing funds...');
  const tx = await escrow.completeJob(jobId);
  const receipt = await tx.wait();
  
  console.log(`Job completed! Funds released.`);
  console.log(`Explorer: ${config.explorer}/tx/${receipt.hash}`);
  
  return { txHash: receipt.hash };
}

/**
 * Cancel a job (if no worker yet)
 */
export async function cancelJob({
  privateKey,
  jobId,
  network = 'base-sepolia'
}) {
  const { wallet, config } = getWallet(privateKey, network);
  
  if (!config.escrow) throw new Error('Escrow contract not deployed');
  
  const escrow = new ethers.Contract(config.escrow, ESCROW_ABI, wallet);
  
  console.log('Cancelling job...');
  const tx = await escrow.cancelJob(jobId);
  const receipt = await tx.wait();
  
  console.log(`Job cancelled! Funds returned.`);
  
  return { txHash: receipt.hash };
}

/**
 * Raise a dispute
 */
export async function disputeJob({
  privateKey,
  jobId,
  network = 'base-sepolia'
}) {
  const { wallet, config } = getWallet(privateKey, network);
  
  if (!config.escrow) throw new Error('Escrow contract not deployed');
  
  const escrow = new ethers.Contract(config.escrow, ESCROW_ABI, wallet);
  
  console.log('Raising dispute...');
  const tx = await escrow.disputeJob(jobId);
  const receipt = await tx.wait();
  
  console.log(`Dispute raised!`);
  
  return { txHash: receipt.hash };
}

/**
 * Get job details
 */
export async function getJob({
  jobId,
  network = 'base-sepolia'
}) {
  const config = NETWORKS[network];
  if (!config) throw new Error(`Unknown network: ${network}`);
  if (!config.escrow) throw new Error('Escrow contract not deployed');
  
  const provider = new ethers.JsonRpcProvider(config.rpc);
  const escrow = new ethers.Contract(config.escrow, ESCROW_ABI, provider);
  
  const [client, worker, amount, deadline, jobHash, status, createdAt] = await escrow.getJob(jobId);
  
  return {
    jobId,
    client,
    worker,
    amount: ethers.formatUnits(amount, 6),
    deadline: new Date(Number(deadline) * 1000).toISOString(),
    jobHash,
    status: JOB_STATUS[status],
    createdAt: new Date(Number(createdAt) * 1000).toISOString()
  };
}

/**
 * Get all jobs for an agent
 */
export async function getAgentJobs({
  address,
  network = 'base-sepolia'
}) {
  const config = NETWORKS[network];
  if (!config) throw new Error(`Unknown network: ${network}`);
  if (!config.escrow) throw new Error('Escrow contract not deployed');
  
  const provider = new ethers.JsonRpcProvider(config.rpc);
  const escrow = new ethers.Contract(config.escrow, ESCROW_ABI, provider);
  
  const jobIds = await escrow.getAgentJobs(address);
  
  const jobs = await Promise.all(
    jobIds.map(async (jobId) => {
      const job = await getJob({ jobId, network });
      return job;
    })
  );
  
  return jobs;
}

/**
 * Check USDC balance
 */
export async function getUsdcBalance({
  address,
  network = 'base-sepolia'
}) {
  const config = NETWORKS[network];
  if (!config) throw new Error(`Unknown network: ${network}`);
  
  const provider = new ethers.JsonRpcProvider(config.rpc);
  const usdc = new ethers.Contract(config.usdc, ERC20_ABI, provider);
  
  const balance = await usdc.balanceOf(address);
  return ethers.formatUnits(balance, 6);
}

export { NETWORKS, JOB_STATUS };
