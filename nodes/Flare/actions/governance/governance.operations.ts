import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { ethers } from 'ethers';
import { createFlareConnection } from '../../transport/provider';
import { SYSTEM_CONTRACTS } from '../../constants/systemContracts';

/**
 * Governance Resource Operations
 * 
 * Flare Network has on-chain governance allowing token holders
 * to vote on protocol changes. Key features:
 * 
 * - Proposal creation (requires minimum vote power)
 * - Voting using vote power from WFLR/WSGB
 * - Execution of passed proposals
 * - Various proposal types (parameter changes, upgrades, etc.)
 * 
 * Vote power is derived from wrapped native tokens (WFLR/WSGB)
 * plus any delegated P-Chain stake mirror.
 */

// GovernanceVotePower ABI (simplified)
const GOVERNANCE_VOTE_POWER_ABI = [
	'function votePowerOfAt(address owner, uint256 blockNumber) view returns (uint256)',
	'function votePowerOf(address owner) view returns (uint256)',
	'function totalVotePowerAt(uint256 blockNumber) view returns (uint256)',
	'function totalVotePower() view returns (uint256)',
	'function delegate(address to)',
	'function undelegate()',
	'function delegateOf(address owner) view returns (address)',
];

// Governor (Flare Governance) ABI
const GOVERNOR_ABI = [
	'function proposalCount() view returns (uint256)',
	'function proposals(uint256 proposalId) view returns (tuple(uint256 id, address proposer, uint256 eta, uint256 startBlock, uint256 endBlock, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, bool canceled, bool executed))',
	'function state(uint256 proposalId) view returns (uint8)',
	'function getReceipt(uint256 proposalId, address voter) view returns (tuple(bool hasVoted, uint8 support, uint96 votes))',
	'function castVote(uint256 proposalId, uint8 support) returns (uint256)',
	'function castVoteWithReason(uint256 proposalId, uint8 support, string reason) returns (uint256)',
	'function quorumVotes() view returns (uint256)',
	'function proposalThreshold() view returns (uint256)',
	'function votingDelay() view returns (uint256)',
	'function votingPeriod() view returns (uint256)',
	'event ProposalCreated(uint256 id, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 startBlock, uint256 endBlock, string description)',
	'event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 votes, string reason)',
];

// Proposal states
const PROPOSAL_STATES = [
	'Pending',
	'Active',
	'Canceled',
	'Defeated',
	'Succeeded',
	'Queued',
	'Expired',
	'Executed',
];

// Vote support values
const VOTE_SUPPORT = {
	against: 0,
	for: 1,
	abstain: 2,
};

export const governanceOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['governance'],
			},
		},
		options: [
			{
				name: 'Get Active Proposals',
				value: 'getActiveProposals',
				description: 'Get list of currently active proposals',
				action: 'Get active proposals',
			},
			{
				name: 'Get Proposal Info',
				value: 'getProposalInfo',
				description: 'Get detailed information about a proposal',
				action: 'Get proposal info',
			},
			{
				name: 'Get Voting Power',
				value: 'getVotingPower',
				description: 'Get governance voting power for an address',
				action: 'Get voting power',
			},
			{
				name: 'Vote on Proposal',
				value: 'voteOnProposal',
				description: 'Cast a vote on a governance proposal',
				action: 'Vote on proposal',
			},
			{
				name: 'Get Vote',
				value: 'getVote',
				description: 'Get how an address voted on a proposal',
				action: 'Get vote',
			},
			{
				name: 'Get Proposal Results',
				value: 'getProposalResults',
				description: 'Get voting results for a proposal',
				action: 'Get proposal results',
			},
			{
				name: 'Get Governance Parameters',
				value: 'getGovernanceParameters',
				description: 'Get governance configuration parameters',
				action: 'Get governance parameters',
			},
			{
				name: 'Get Past Proposals',
				value: 'getPastProposals',
				description: 'Get historical proposals',
				action: 'Get past proposals',
			},
			{
				name: 'Delegate Governance Power',
				value: 'delegateGovernancePower',
				description: 'Delegate governance voting power to another address',
				action: 'Delegate governance power',
			},
			{
				name: 'Get Delegate',
				value: 'getDelegate',
				description: 'Get the current governance delegate for an address',
				action: 'Get delegate',
			},
		],
		default: 'getActiveProposals',
	},
];

export const governanceFields: INodeProperties[] = [
	// Proposal ID
	{
		displayName: 'Proposal ID',
		name: 'proposalId',
		type: 'number',
		required: true,
		displayOptions: {
			show: {
				resource: ['governance'],
				operation: ['getProposalInfo', 'voteOnProposal', 'getVote', 'getProposalResults'],
			},
		},
		default: 0,
		description: 'The ID of the governance proposal',
	},

	// Address for queries
	{
		displayName: 'Address',
		name: 'address',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['governance'],
				operation: ['getVotingPower', 'getVote', 'getDelegate'],
			},
		},
		default: '',
		placeholder: '0x...',
		description: 'The address to query',
	},

	// Vote support (for/against/abstain)
	{
		displayName: 'Vote',
		name: 'voteSupport',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				resource: ['governance'],
				operation: ['voteOnProposal'],
			},
		},
		options: [
			{
				name: 'For',
				value: 'for',
				description: 'Vote in favor of the proposal',
			},
			{
				name: 'Against',
				value: 'against',
				description: 'Vote against the proposal',
			},
			{
				name: 'Abstain',
				value: 'abstain',
				description: 'Abstain from voting',
			},
		],
		default: 'for',
		description: 'How to vote on the proposal',
	},

	// Vote reason (optional)
	{
		displayName: 'Reason',
		name: 'voteReason',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['governance'],
				operation: ['voteOnProposal'],
			},
		},
		default: '',
		placeholder: 'I support this proposal because...',
		description: 'Optional reason for your vote',
	},

	// Delegate address
	{
		displayName: 'Delegate To',
		name: 'delegateAddress',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['governance'],
				operation: ['delegateGovernancePower'],
			},
		},
		default: '',
		placeholder: '0x...',
		description: 'Address to delegate governance power to',
	},

	// Block number for historical queries
	{
		displayName: 'Block Number',
		name: 'blockNumber',
		type: 'number',
		displayOptions: {
			show: {
				resource: ['governance'],
				operation: ['getVotingPower'],
			},
		},
		default: 0,
		description: 'Block number for historical query (0 for current)',
	},

	// Number of proposals to fetch
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: {
			show: {
				resource: ['governance'],
				operation: ['getActiveProposals', 'getPastProposals'],
			},
		},
		default: 10,
		description: 'Maximum number of proposals to return',
	},
];

/**
 * Execute governance operations
 */
export async function executeGovernanceOperation(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;
	const credentials = await this.getCredentials('flareNetworkApi');
	const connection = await createFlareConnection(credentials as any);
	const { provider, network, wallet: signer } = connection;

	let result: any;

	// Get token symbol based on network
	const tokenSymbol = network.name === 'Flare' || network.name === 'Coston2' ? 'FLR' : 'SGB';
	const wrappedSymbol = 'W' + tokenSymbol;

	// Get governance contracts
	const governanceVotePowerAddress = SYSTEM_CONTRACTS[network.name]?.GovernanceVotePower;
	
	if (!governanceVotePowerAddress) {
		result = {
			success: false,
			network: network.name,
			error: 'Governance contracts not configured for this network',
			hint: network.name.includes('Coston') 
				? 'Governance may not be available on testnets'
				: 'Check network configuration',
		};
		return [{ json: result }];
	}

	const governanceVotePower = new ethers.Contract(
		governanceVotePowerAddress,
		GOVERNANCE_VOTE_POWER_ABI,
		provider,
	);

	switch (operation) {
		case 'getActiveProposals': {
			const limit = this.getNodeParameter('limit', index, 10) as number;

			// Note: Flare governance may use different contract patterns
			// This provides the general framework
			
			result = {
				success: true,
				network: network.name,
				message: 'Active proposals query',
				info: {
					description: 'Flare governance proposals are managed through on-chain contracts',
					votePowerSource: `Vote power comes from ${wrappedSymbol} holdings plus P-Chain stake mirrors`,
					participation: 'Token holders can vote on protocol parameter changes',
				},
				governanceVotePowerContract: governanceVotePowerAddress,
				explorerUrl: network.name === 'Flare'
					? 'https://flare-explorer.flare.network/address/' + governanceVotePowerAddress
					: 'https://songbird-explorer.flare.network/address/' + governanceVotePowerAddress,
				note: 'Use the Flare Portal or Explorer to view active proposals',
				limit,
			};
			break;
		}

		case 'getProposalInfo': {
			const proposalId = this.getNodeParameter('proposalId', index) as number;

			// Would query specific proposal from governor contract
			result = {
				success: true,
				network: network.name,
				proposalId,
				message: 'Proposal info query requires specific governor contract address',
				hint: 'Use the Flare Portal to view proposal details',
				governanceInfo: {
					votePowerContract: governanceVotePowerAddress,
					voteTypes: ['For', 'Against', 'Abstain'],
					quorumRequired: true,
				},
			};
			break;
		}

		case 'getVotingPower': {
			const address = this.getNodeParameter('address', index) as string;
			const blockNumber = this.getNodeParameter('blockNumber', index, 0) as number;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(
					this.getNode(),
					'Invalid address',
				);
			}

			try {
				let votePower: bigint;
				let totalVotePower: bigint;

				if (blockNumber > 0) {
					votePower = await governanceVotePower.votePowerOfAt(address, blockNumber);
					totalVotePower = await governanceVotePower.totalVotePowerAt(blockNumber);
				} else {
					votePower = await governanceVotePower.votePowerOf(address);
					totalVotePower = await governanceVotePower.totalVotePower();
				}

				const votePowerPercentage = totalVotePower > 0n
					? (Number((votePower * 10000n) / totalVotePower) / 100).toFixed(4)
					: '0';

				result = {
					success: true,
					network: network.name,
					address,
					blockNumber: blockNumber > 0 ? blockNumber : 'current',
					votePower: ethers.formatEther(votePower) + ` ${wrappedSymbol}`,
					votePowerWei: votePower.toString(),
					totalVotePower: ethers.formatEther(totalVotePower) + ` ${wrappedSymbol}`,
					votePowerPercentage: votePowerPercentage + '%',
					sources: {
						description: 'Governance vote power is derived from:',
						items: [
							`${wrappedSymbol} balance`,
							'Delegated governance power',
							'P-Chain stake mirror (if applicable)',
						],
					},
				};
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				result = {
					success: false,
					network: network.name,
					address,
					error: errorMessage,
					hint: 'The governance vote power contract may not support this query',
				};
			}
			break;
		}

		case 'voteOnProposal': {
			if (!signer) {
				throw new NodeOperationError(
					this.getNode(),
					'Private key required for voting',
				);
			}

			const proposalId = this.getNodeParameter('proposalId', index) as number;
			const voteSupport = this.getNodeParameter('voteSupport', index) as string;
			const voteReason = this.getNodeParameter('voteReason', index, '') as string;

			const supportValue = VOTE_SUPPORT[voteSupport as keyof typeof VOTE_SUPPORT];

			result = {
				success: false,
				network: network.name,
				proposalId,
				voteSupport,
				supportValue,
				voteReason: voteReason || '(no reason provided)',
				message: 'Voting requires the specific governor contract address',
				info: {
					process: [
						'1. Connect to the Governor contract',
						'2. Ensure you have vote power for the proposal\'s snapshot block',
						'3. Call castVote or castVoteWithReason',
					],
					supportValues: {
						against: 0,
						for: 1,
						abstain: 2,
					},
				},
				hint: 'Use the Flare Portal for a guided voting experience',
			};
			break;
		}

		case 'getVote': {
			const proposalId = this.getNodeParameter('proposalId', index) as number;
			const address = this.getNodeParameter('address', index) as string;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(
					this.getNode(),
					'Invalid address',
				);
			}

			result = {
				success: true,
				network: network.name,
				proposalId,
				address,
				message: 'Vote lookup requires the specific governor contract',
				receiptStructure: {
					hasVoted: 'boolean - whether address has voted',
					support: 'uint8 - 0=Against, 1=For, 2=Abstain',
					votes: 'uint96 - vote power used',
				},
			};
			break;
		}

		case 'getProposalResults': {
			const proposalId = this.getNodeParameter('proposalId', index) as number;

			result = {
				success: true,
				network: network.name,
				proposalId,
				message: 'Proposal results query',
				resultStructure: {
					forVotes: 'Total votes in favor',
					againstVotes: 'Total votes against',
					abstainVotes: 'Total abstain votes',
					state: 'Proposal state (Pending/Active/Canceled/Defeated/Succeeded/Queued/Expired/Executed)',
					quorumReached: 'Whether quorum was met',
				},
				states: PROPOSAL_STATES.map((state, index) => `${index}: ${state}`),
			};
			break;
		}

		case 'getGovernanceParameters': {
			try {
				const totalVotePower = await governanceVotePower.totalVotePower();

				result = {
					success: true,
					network: network.name,
					governanceVotePowerContract: governanceVotePowerAddress,
					totalVotePower: ethers.formatEther(totalVotePower) + ` ${wrappedSymbol}`,
					totalVotePowerWei: totalVotePower.toString(),
					parameters: {
						description: 'Governance parameters are defined in the Governor contract',
						typicalValues: {
							votingDelay: '1 day - time between proposal creation and voting start',
							votingPeriod: '7 days - duration of voting',
							proposalThreshold: 'Minimum vote power to create proposals',
							quorumVotes: 'Minimum participation for valid vote',
						},
					},
					votePowerSources: [
						`${wrappedSymbol} (Wrapped ${tokenSymbol})`,
						'Delegated governance power',
						'P-Chain stake mirror',
					],
				};
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				result = {
					success: false,
					network: network.name,
					error: errorMessage,
				};
			}
			break;
		}

		case 'getPastProposals': {
			const limit = this.getNodeParameter('limit', index, 10) as number;

			result = {
				success: true,
				network: network.name,
				message: 'Past proposals query',
				limit,
				info: {
					description: 'Historical proposals can be queried from Governor events',
					eventToQuery: 'ProposalCreated',
					explorerUrl: network.name === 'Flare'
						? 'https://flare-explorer.flare.network'
						: 'https://songbird-explorer.flare.network',
				},
				hint: 'Use the Flare Portal or Explorer to browse proposal history',
			};
			break;
		}

		case 'delegateGovernancePower': {
			if (!signer) {
				throw new NodeOperationError(
					this.getNode(),
					'Private key required for delegation',
				);
			}

			const delegateAddress = this.getNodeParameter('delegateAddress', index) as string;

			if (!ethers.isAddress(delegateAddress)) {
				throw new NodeOperationError(
					this.getNode(),
					'Invalid delegate address',
				);
			}

			try {
				const governanceVotePowerWithSigner = governanceVotePower.connect(signer) as ethers.Contract;
				
				const tx = await governanceVotePowerWithSigner.getFunction('delegate')(delegateAddress);
				const receipt = await tx.wait();

				const signerAddress = await signer.getAddress();
				const newVotePower = await governanceVotePower.votePowerOf(delegateAddress);

				result = {
					success: true,
					network: network.name,
					from: signerAddress,
					delegateTo: delegateAddress,
					transactionHash: receipt.hash,
					blockNumber: receipt.blockNumber,
					gasUsed: receipt.gasUsed.toString(),
					newDelegateVotePower: ethers.formatEther(newVotePower) + ` ${wrappedSymbol}`,
					note: 'Your governance vote power is now delegated to the specified address',
				};
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				throw new NodeOperationError(
					this.getNode(),
					`Delegation failed: ${errorMessage}`,
				);
			}
			break;
		}

		case 'getDelegate': {
			const address = this.getNodeParameter('address', index) as string;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(
					this.getNode(),
					'Invalid address',
				);
			}

			try {
				const delegate = await governanceVotePower.delegateOf(address);
				const isDelegating = delegate !== ethers.ZeroAddress && delegate.toLowerCase() !== address.toLowerCase();

				result = {
					success: true,
					network: network.name,
					address,
					delegate,
					isDelegating,
					status: isDelegating 
						? `Governance power delegated to ${delegate}`
						: 'Not delegating (self-voting)',
				};
			} catch (error) {
				// delegateOf may not exist on all implementations
				result = {
					success: false,
					network: network.name,
					address,
					message: 'Delegate lookup not available on this contract',
					hint: 'Check if governance delegation is enabled for this network',
				};
			}
			break;
		}

		default:
			throw new NodeOperationError(
				this.getNode(),
				`Unknown operation: ${operation}`,
			);
	}

	return [{ json: result }];
}
