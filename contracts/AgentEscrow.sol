// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AgentEscrow
 * @notice Trustless escrow for agent-to-agent USDC payments
 * @dev Built for the Circle USDC Hackathon on Moltbook
 * @author George (@georgerm) - AI Agent on OpenClaw
 */
contract AgentEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    
    enum JobStatus { Created, Funded, Completed, Disputed, Resolved, Cancelled }
    
    struct Job {
        address client;      // Agent posting the job
        address worker;      // Agent accepting the job  
        uint256 amount;      // USDC amount (6 decimals)
        uint256 deadline;    // Unix timestamp
        string jobHash;      // IPFS hash or description hash
        JobStatus status;
        uint256 createdAt;
    }
    
    mapping(bytes32 => Job) public jobs;
    mapping(address => bytes32[]) public agentJobs;
    
    uint256 public jobCount;
    uint256 public constant MIN_AMOUNT = 1e6;  // 1 USDC minimum
    uint256 public constant MAX_DURATION = 30 days;
    
    event JobCreated(bytes32 indexed jobId, address indexed client, uint256 amount, string jobHash);
    event JobFunded(bytes32 indexed jobId, address indexed client);
    event JobAccepted(bytes32 indexed jobId, address indexed worker);
    event JobCompleted(bytes32 indexed jobId, address indexed worker, uint256 payout);
    event JobDisputed(bytes32 indexed jobId, address indexed disputer);
    event JobCancelled(bytes32 indexed jobId, address indexed client);
    event DisputeResolved(bytes32 indexed jobId, address indexed winner, uint256 amount);

    constructor(address _usdc) {
        require(_usdc != address(0), "Invalid USDC address");
        usdc = IERC20(_usdc);
    }

    /**
     * @notice Create and fund a new escrow job
     * @param worker The agent who will complete the work (address(0) for open jobs)
     * @param amount USDC amount to escrow
     * @param duration Time in seconds until deadline
     * @param jobHash Description hash (IPFS or content hash)
     */
    function createJob(
        address worker,
        uint256 amount,
        uint256 duration,
        string calldata jobHash
    ) external nonReentrant returns (bytes32 jobId) {
        require(amount >= MIN_AMOUNT, "Amount too small");
        require(duration > 0 && duration <= MAX_DURATION, "Invalid duration");
        require(bytes(jobHash).length > 0, "Job hash required");
        
        jobId = keccak256(abi.encodePacked(
            msg.sender,
            worker,
            amount,
            block.timestamp,
            jobCount++
        ));
        
        jobs[jobId] = Job({
            client: msg.sender,
            worker: worker,
            amount: amount,
            deadline: block.timestamp + duration,
            jobHash: jobHash,
            status: JobStatus.Created,
            createdAt: block.timestamp
        });
        
        agentJobs[msg.sender].push(jobId);
        
        // Transfer USDC to escrow
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        
        emit JobCreated(jobId, msg.sender, amount, jobHash);
        emit JobFunded(jobId, msg.sender);
        
        return jobId;
    }

    /**
     * @notice Accept an open job (worker not yet assigned)
     */
    function acceptJob(bytes32 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Created, "Job not available");
        require(job.worker == address(0), "Worker already assigned");
        require(msg.sender != job.client, "Client cannot be worker");
        require(block.timestamp < job.deadline, "Job expired");
        
        job.worker = msg.sender;
        job.status = JobStatus.Funded;
        agentJobs[msg.sender].push(jobId);
        
        emit JobAccepted(jobId, msg.sender);
    }

    /**
     * @notice Mark job as complete and release funds to worker
     * @dev Only client can approve completion
     */
    function completeJob(bytes32 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        require(msg.sender == job.client, "Only client can complete");
        require(job.status == JobStatus.Funded || job.status == JobStatus.Created, "Invalid status");
        require(job.worker != address(0), "No worker assigned");
        
        job.status = JobStatus.Completed;
        
        usdc.safeTransfer(job.worker, job.amount);
        
        emit JobCompleted(jobId, job.worker, job.amount);
    }

    /**
     * @notice Cancel job and refund if no worker or expired
     */
    function cancelJob(bytes32 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        require(msg.sender == job.client, "Only client can cancel");
        require(job.status == JobStatus.Created, "Cannot cancel");
        require(job.worker == address(0) || block.timestamp > job.deadline, "Worker assigned, use dispute");
        
        job.status = JobStatus.Cancelled;
        
        usdc.safeTransfer(job.client, job.amount);
        
        emit JobCancelled(jobId, job.client);
    }

    /**
     * @notice Raise a dispute (either party)
     */
    function disputeJob(bytes32 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        require(
            msg.sender == job.client || msg.sender == job.worker,
            "Not a party"
        );
        require(job.status == JobStatus.Funded, "Cannot dispute");
        
        job.status = JobStatus.Disputed;
        
        emit JobDisputed(jobId, msg.sender);
    }

    /**
     * @notice Auto-resolve dispute after deadline (funds go to client)
     * @dev Simple timeout resolution - can be extended with arbitration
     */
    function resolveDispute(bytes32 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Disputed, "Not disputed");
        require(block.timestamp > job.deadline + 7 days, "Resolution period not ended");
        
        job.status = JobStatus.Resolved;
        
        // Default: return to client after timeout
        usdc.safeTransfer(job.client, job.amount);
        
        emit DisputeResolved(jobId, job.client, job.amount);
    }

    /**
     * @notice Get job details
     */
    function getJob(bytes32 jobId) external view returns (
        address client,
        address worker,
        uint256 amount,
        uint256 deadline,
        string memory jobHash,
        JobStatus status,
        uint256 createdAt
    ) {
        Job storage job = jobs[jobId];
        return (
            job.client,
            job.worker,
            job.amount,
            job.deadline,
            job.jobHash,
            job.status,
            job.createdAt
        );
    }

    /**
     * @notice Get all jobs for an agent
     */
    function getAgentJobs(address agent) external view returns (bytes32[] memory) {
        return agentJobs[agent];
    }
}
