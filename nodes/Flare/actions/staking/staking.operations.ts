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
 * Staking Resource Operations
 * 
 * Flare Network uses a Proof-of-Stake consensus mechanism with validators.
 * This module provides operations for:
 * - Viewing validator information
 * - Staking FLR/SGB to validators
 * - Managing staking positions
 * - Claiming staking rewards
 * 
 * Note: Validator staking on Flare is different from FTSO delegation.
 * FTSO delegation earns inflation rewards, while validator staking
 * secures the network consensus.
 */

// Validator Manager ABI (simplified for common operations)
const VALIDATOR_MANAGER_ABI = [
	'function getValidators() view returns (address[])',
	'function getValidatorInfo(address validator) view returns (tuple(address nodeId, uint256 stake, uint256 delegatedStake, uint256 fee, bool active))',
	'function getTotalStake() view returns (uint256)',
	'function getStake(address staker) view returns (uint256)',
	'function getStakedValidators(address staker) view returns (address[])',
	'function getMinStake() view returns (uint256)',
	'function getMaxValidators() view returns (uint256)',
	'function stake(address validator) payable',
	'function unstake(address validator, uint256 amount)',
	'function claimRewards()',
	'function getUnclaimedRewards(address staker) view returns (uint256)',
	'function getUnstakingPeriod() view returns (uint256)',
	'event Staked(address indexed staker, address indexed validator, uint256 amount)',
	'event Unstaked(address indexed staker, address indexed validator, uint256 amount)',
	'event RewardsClaimed(address indexed staker, uint256 amount)',
];

// P-Chain staking info ABI
const PCHAIN_STAKE_MIRROR_ABI = [
	'function stakesOf(address owner) view returns (bytes20[] nodeIds, uint256[] amounts, uint64[] startTimes, uint64[] endTimes)',
	'function stakesOfAt(address owner, uint256 blockNumber) view returns (bytes20[] nodeIds, uint256[] amounts, uint64[] startTimes, uint64[] endTimes)',
];

export const stakingOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['staking'],
			},
		},
		options: [
			{
				name: 'Get Validators',
				value: 'getValidators',
				description: 'Get list of active validators',
				action: 'Get validators',
			},
			{
				name: 'Get Validator Info',
				value: 'getValidatorInfo',
				description: 'Get detailed information about a validator',
				action: 'Get validator info',
			},
			{
				name: 'Get Staking Amount',
				value: 'getStakingAmount',
				description: 'Get amount staked by an address',
				action: 'Get staking amount',
			},
			{
				name: 'Get Staking Rewards',
				value: 'getStakingRewards',
				description: 'Get unclaimed staking rewards',
				action: 'Get staking rewards',
			},
			{
				name: 'Get Staked Validators',
				value: 'getStakedValidators',
				description: 'Get validators that an address has staked to',
				action: 'Get staked validators',
			},
			{
				name: 'Stake',
				value: 'stake',
				description: 'Stake FLR/SGB to a validator',
				action: 'Stake to validator',
			},
			{
				name: 'Unstake',
				value: 'unstake',
				description: 'Unstake from a validator',
				action: 'Unstake from validator',
			},
			{
				name: 'Get Unstaking Period',
				value: 'getUnstakingPeriod',
				description: 'Get the unstaking cooldown period',
				action: 'Get unstaking period',
			},
			{
				name: 'Get Total Staked',
				value: 'getTotalStaked',
				description: 'Get total amount staked across all validators',
				action: 'Get total staked',
			},
			{
				name: 'Get Minimum Stake',
				value: 'getMinimumStake',
				description: 'Get minimum stake amount required',
				action: 'Get minimum stake',
			},
			{
				name: 'Claim Staking Rewards',
				value: 'claimStakingRewards',
				description: 'Claim accumulated staking rewards',
				action: 'Claim staking rewards',
			},
			{
				name: 'Get P-Chain Stakes',
				value: 'getPChainStakes',
				description: 'Get P-Chain staking information (mirrored to C-Chain)',
				action: 'Get P-Chain stakes',
			},
		],
		default: 'getValidators',
	},
];

export const stakingFields: INodeProperties[] = [
	// Validator Address
	{
		displayName: 'Validator Address',
		name: 'validatorAddress',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['staking'],
				operation: ['getValidatorInfo', 'stake', 'unstake'],
			},
		},
		default: '',
		placeholder: '0x...',
		description: 'The address of the validator',
	},

	// Address for queries
	{
		displayName: 'Address',
		name: 'address',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['staking'],
				operation: ['getStakingAmount', 'getStakingRewards', 'getStakedValidators', 'getPChainStakes'],
			},
		},
		default: '',
		placeholder: '0x...',
		description: 'The address to query',
	},

	// Stake Amount
	{
		displayName: 'Stake Amount',
		name: 'stakeAmount',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['staking'],
				operation: ['stake'],
			},
		},
		default: '',
		placeholder: '1000',
		description: 'Amount to stake in FLR/SGB (not wei)',
	},

	// Unstake Amount
	{
		displayName: 'Unstake Amount',
		name: 'unstakeAmount',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['staking'],
				operation: ['unstake'],
			},
		},
		default: '',
		placeholder: '1000',
		description: 'Amount to unstake in FLR/SGB (not wei)',
	},

	// Block Number for historical query
	{
		displayName: 'Block Number',
		name: 'blockNumber',
		type: 'number',
		displayOptions: {
			show: {
				resource: ['staking'],
				operation: ['getPChainStakes'],
			},
		},
		default: 0,
		description: 'Block number for historical query (0 for current)',
	},

	// Gas Options
	{
		displayName: 'Gas Options',
		name: 'gasOptions',
		type: 'collection',
		placeholder: 'Add Gas Option',
		displayOptions: {
			show: {
				resource: ['staking'],
				operation: ['stake', 'unstake', 'claimStakingRewards'],
			},
		},
		default: {},
		options: [
			{
				displayName: 'Gas Limit',
				name: 'gasLimit',
				type: 'number',
				default: 200000,
				description: 'Maximum gas to use',
			},
			{
				displayName: 'Max Fee Per Gas (Gwei)',
				name: 'maxFeePerGas',
				type: 'number',
				default: 0,
				description: 'Maximum fee per gas in gwei (0 for auto)',
			},
		],
	},
];

/**
 * Execute staking operations
 */
export async function executeStakingOperation(
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

	// Note: Flare's validator staking is primarily on P-Chain
	// C-Chain interactions are limited. This implementation provides
	// the available C-Chain staking interfaces and P-Chain stake mirroring.

	switch (operation) {
		case 'getValidators': {
			// Flare uses Avalanche-style consensus with P-Chain validators
			// On C-Chain, we can query the stake mirror for validator info
			
			// For now, return information about how to access validator data
			result = {
				success: true,
				network: network.name,
				message: 'Flare validators are registered on P-Chain',
				info: {
					description: 'Flare Network uses Avalanche-style consensus with validators on P-Chain',
					stakingMechanism: 'Proof-of-Stake with minimum stake requirements',
					cChainMirror: 'P-Chain stakes are mirrored to C-Chain for vote power calculation',
					explorerUrl: network.name === 'Flare' 
						? 'https://flare-explorer.flare.network/validators'
						: 'https://songbird-explorer.flare.network/validators',
				},
				note: 'Use getPChainStakes to query mirrored P-Chain staking data',
			};
			break;
		}

		case 'getValidatorInfo': {
			const validatorAddress = this.getNodeParameter('validatorAddress', index) as string;

			// Validate address
			if (!ethers.isAddress(validatorAddress)) {
				throw new NodeOperationError(
					this.getNode(),
					'Invalid validator address',
				);
			}

			// Query basic validator info from C-Chain perspective
			const balance = await provider.getBalance(validatorAddress);
			const code = await provider.getCode(validatorAddress);

			result = {
				success: true,
				network: network.name,
				validatorAddress,
				cChainBalance: ethers.formatEther(balance) + ` ${tokenSymbol}`,
				isContract: code !== '0x',
				message: 'For detailed validator info, query P-Chain or use the Flare Explorer API',
				explorerUrl: network.name === 'Flare'
					? `https://flare-explorer.flare.network/address/${validatorAddress}`
					: `https://songbird-explorer.flare.network/address/${validatorAddress}`,
			};
			break;
		}

		case 'getStakingAmount': {
			const address = this.getNodeParameter('address', index) as string;

			// Validate address
			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(
					this.getNode(),
					'Invalid address',
				);
			}

			// Query P-Chain stake mirror if available
			const pChainStakeMirror = SYSTEM_CONTRACTS[network.name]?.ValidatorRewardManager || '0x0000000000000000000000000000000000000000';
			
			if (pChainStakeMirror) {
				try {
					const mirror = new ethers.Contract(pChainStakeMirror, PCHAIN_STAKE_MIRROR_ABI, provider);
					const stakes = await mirror.stakesOf(address);
					
					let totalStaked = 0n;
					for (const amount of stakes.amounts) {
						totalStaked += amount;
					}

					result = {
						success: true,
						network: network.name,
						address,
						totalStaked: ethers.formatEther(totalStaked) + ` ${tokenSymbol}`,
						totalStakedWei: totalStaked.toString(),
						stakeCount: stakes.nodeIds.length,
						stakes: stakes.nodeIds.map((nodeId: string, i: number) => ({
							nodeId,
							amount: ethers.formatEther(stakes.amounts[i]) + ` ${tokenSymbol}`,
							startTime: new Date(Number(stakes.startTimes[i]) * 1000).toISOString(),
							endTime: new Date(Number(stakes.endTimes[i]) * 1000).toISOString(),
						})),
					};
				} catch (error) {
					result = {
						success: false,
						network: network.name,
						address,
						error: 'P-Chain stake mirror not available or query failed',
						message: 'Use Flare Explorer API for detailed staking information',
					};
				}
			} else {
				result = {
					success: false,
					network: network.name,
					address,
					message: 'P-Chain stake mirror contract not configured for this network',
				};
			}
			break;
		}

		case 'getStakingRewards': {
			const address = this.getNodeParameter('address', index) as string;

			// Validate address
			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(
					this.getNode(),
					'Invalid address',
				);
			}

			// Note: Staking rewards on Flare are distributed via FTSO reward mechanism
			// for delegated vote power. Direct validator staking rewards are handled differently.
			
			result = {
				success: true,
				network: network.name,
				address,
				message: 'Staking rewards on Flare are primarily through FTSO delegation',
				info: {
					ftsoRewards: 'Delegate wrapped tokens (WFLR/WSGB) to FTSO providers to earn rewards',
					validatorRewards: 'Validator operators receive network fees and inflation',
					claimMechanism: 'Use the FTSO Rewards resource to claim delegation rewards',
				},
				hint: 'Use the ftsoRewards resource to check and claim your delegation rewards',
			};
			break;
		}

		case 'getStakedValidators': {
			const address = this.getNodeParameter('address', index) as string;

			// Validate address
			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(
					this.getNode(),
					'Invalid address',
				);
			}

			// Query P-Chain stake mirror
			const pChainStakeMirror = SYSTEM_CONTRACTS[network.name]?.ValidatorRewardManager || '0x0000000000000000000000000000000000000000';
			
			if (pChainStakeMirror) {
				try {
					const mirror = new ethers.Contract(pChainStakeMirror, PCHAIN_STAKE_MIRROR_ABI, provider);
					const stakes = await mirror.stakesOf(address);
					
					result = {
						success: true,
						network: network.name,
						address,
						validatorCount: stakes.nodeIds.length,
						validators: stakes.nodeIds.map((nodeId: string, i: number) => ({
							nodeId,
							stakedAmount: ethers.formatEther(stakes.amounts[i]) + ` ${tokenSymbol}`,
							active: Number(stakes.endTimes[i]) * 1000 > Date.now(),
						})),
					};
				} catch (error) {
					result = {
						success: false,
						network: network.name,
						address,
						error: 'Failed to query P-Chain stake mirror',
					};
				}
			} else {
				result = {
					success: false,
					network: network.name,
					address,
					message: 'P-Chain stake mirror not available',
				};
			}
			break;
		}

		case 'stake': {
			const validatorAddress = this.getNodeParameter('validatorAddress', index) as string;
			const stakeAmount = this.getNodeParameter('stakeAmount', index) as string;

			// Flare P-Chain staking requires cross-chain operations
			// This cannot be done directly from C-Chain
			
			result = {
				success: false,
				network: network.name,
				validatorAddress,
				requestedAmount: stakeAmount + ` ${tokenSymbol}`,
				message: 'Direct staking to validators requires P-Chain operations',
				info: {
					process: [
						'1. Export tokens from C-Chain to P-Chain',
						'2. Stake on P-Chain to a validator',
						'3. Stakes are mirrored back to C-Chain for vote power',
					],
					alternative: 'For earning rewards without P-Chain operations, use FTSO delegation',
					delegationHint: 'Wrap your tokens (FLR→WFLR) and delegate to FTSO providers',
				},
				documentation: 'https://docs.flare.network/tech/validators/',
			};
			break;
		}

		case 'unstake': {
			const validatorAddress = this.getNodeParameter('validatorAddress', index) as string;
			const unstakeAmount = this.getNodeParameter('unstakeAmount', index) as string;

			result = {
				success: false,
				network: network.name,
				validatorAddress,
				requestedAmount: unstakeAmount + ` ${tokenSymbol}`,
				message: 'Unstaking from validators requires P-Chain operations',
				info: {
					process: [
						'1. End stake delegation on P-Chain',
						'2. Wait for unstaking period',
						'3. Import tokens back to C-Chain',
					],
					unstakingPeriod: '2 weeks typical unbonding period',
				},
			};
			break;
		}

		case 'getUnstakingPeriod': {
			result = {
				success: true,
				network: network.name,
				unstakingPeriod: {
					pChainStaking: '2 weeks',
					description: 'Minimum unbonding period for P-Chain stakes',
					note: 'Actual period may vary based on stake duration and validator',
				},
				ftsoUnstaking: {
					period: 'Immediate',
					description: 'FTSO delegation can be changed immediately',
					note: 'Vote power changes take effect after the vote power block snapshot',
				},
			};
			break;
		}

		case 'getTotalStaked': {
			// Query network statistics
			// This would typically come from an explorer API or node stats
			
			result = {
				success: true,
				network: network.name,
				message: 'Total staked amount available via Flare Explorer',
				explorerUrl: network.name === 'Flare'
					? 'https://flare-explorer.flare.network/stats'
					: 'https://songbird-explorer.flare.network/stats',
				hint: 'Use the Flare Explorer API for detailed staking statistics',
			};
			break;
		}

		case 'getMinimumStake': {
			result = {
				success: true,
				network: network.name,
				minimumStake: {
					validator: '1,000,000 ' + tokenSymbol,
					delegator: '50,000 ' + tokenSymbol,
					description: 'Minimum amounts for P-Chain staking',
					note: 'These are approximate values; check official documentation for current requirements',
				},
				ftsoMinimum: {
					amount: 'No minimum',
					description: 'Any amount of wrapped tokens can be delegated to FTSO providers',
				},
				documentation: 'https://docs.flare.network/tech/validators/',
			};
			break;
		}

		case 'claimStakingRewards': {
			if (!signer) {
				throw new NodeOperationError(
					this.getNode(),
					'Private key required for claiming rewards',
				);
			}

			result = {
				success: false,
				network: network.name,
				message: 'Direct staking reward claims are handled on P-Chain',
				alternative: {
					ftsoRewards: 'Use the ftsoRewards resource to claim FTSO delegation rewards',
					process: 'ftsoRewards → claimRewards operation',
				},
				hint: 'Most users earn rewards through FTSO delegation, not direct validator staking',
			};
			break;
		}

		case 'getPChainStakes': {
			const address = this.getNodeParameter('address', index) as string;
			const blockNumber = this.getNodeParameter('blockNumber', index, 0) as number;

			// Validate address
			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(
					this.getNode(),
					'Invalid address',
				);
			}

			const pChainStakeMirror = SYSTEM_CONTRACTS[network.name]?.ValidatorRewardManager || '0x0000000000000000000000000000000000000000';
			
			if (pChainStakeMirror) {
				try {
					const mirror = new ethers.Contract(pChainStakeMirror, PCHAIN_STAKE_MIRROR_ABI, provider);
					
					let stakes;
					if (blockNumber > 0) {
						stakes = await mirror.stakesOfAt(address, blockNumber);
					} else {
						stakes = await mirror.stakesOf(address);
					}
					
					let totalStaked = 0n;
					const activeStakes: Array<Record<string, unknown>> = [];
					const expiredStakes: Array<Record<string, unknown>> = [];
					const now = Date.now();

					for (let i = 0; i < stakes.nodeIds.length; i++) {
						totalStaked += stakes.amounts[i];
						const endTime = Number(stakes.endTimes[i]) * 1000;
						const stakeInfo = {
							nodeId: stakes.nodeIds[i],
							amount: ethers.formatEther(stakes.amounts[i]) + ` ${tokenSymbol}`,
							amountWei: stakes.amounts[i].toString(),
							startTime: new Date(Number(stakes.startTimes[i]) * 1000).toISOString(),
							endTime: new Date(endTime).toISOString(),
							durationDays: Math.floor((endTime - Number(stakes.startTimes[i]) * 1000) / (1000 * 60 * 60 * 24)),
						};

						if (endTime > now) {
							activeStakes.push(stakeInfo);
						} else {
							expiredStakes.push(stakeInfo);
						}
					}

					result = {
						success: true,
						network: network.name,
						address,
						blockNumber: blockNumber > 0 ? blockNumber : 'latest',
						totalStaked: ethers.formatEther(totalStaked) + ` ${tokenSymbol}`,
						totalStakedWei: totalStaked.toString(),
						activeStakeCount: activeStakes.length,
						expiredStakeCount: expiredStakes.length,
						activeStakes,
						expiredStakes,
					};
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : 'Unknown error';
					result = {
						success: false,
						network: network.name,
						address,
						error: errorMessage,
						message: 'Failed to query P-Chain stake mirror',
					};
				}
			} else {
				result = {
					success: false,
					network: network.name,
					address,
					message: 'P-Chain stake mirror contract not configured for this network',
					hint: 'This feature may not be available on testnets',
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
