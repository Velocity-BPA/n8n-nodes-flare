/**
 * FTSO Rewards Resource Operations
 *
 * Handles FTSO reward claiming and management.
 * Rewards are distributed every reward epoch (~3.5 days) and must be claimed
 * within 90 days or they expire.
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { ethers } from 'ethers';
import { createFlareConnection, getFtsoRewardManagerContract, getClaimSetupManagerContract } from '../../transport/provider';
import { formatTokenAmount } from '../../utils/unitConverter';
import {
	getCurrentRewardEpoch,
	getRewardEpochInfo,
	getClaimableEpochs,
	getEpochsExpiringSoon,
	REWARD_EPOCH_DURATION_SECONDS,
	REWARD_EXPIRY_EPOCHS,
} from '../../utils/rewardUtils';

export const ftsoRewardsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['ftsoRewards'],
			},
		},
		options: [
			{
				name: 'Get Claimable Rewards',
				value: 'getClaimableRewards',
				description: 'Get total claimable rewards for an address',
				action: 'Get claimable rewards',
			},
			{
				name: 'Get Unclaimed Epochs',
				value: 'getUnclaimedEpochs',
				description: 'Get list of epochs with unclaimed rewards',
				action: 'Get unclaimed epochs',
			},
			{
				name: 'Claim Rewards',
				value: 'claimRewards',
				description: 'Claim FTSO rewards for specific epochs',
				action: 'Claim rewards',
			},
			{
				name: 'Claim All Rewards',
				value: 'claimAllRewards',
				description: 'Claim all available FTSO rewards',
				action: 'Claim all rewards',
			},
			{
				name: 'Claim to Address',
				value: 'claimToAddress',
				description: 'Claim rewards to a specific address',
				action: 'Claim to address',
			},
			{
				name: 'Get Reward Epoch Info',
				value: 'getRewardEpochInfo',
				description: 'Get information about a reward epoch',
				action: 'Get reward epoch info',
			},
			{
				name: 'Get Current Reward Epoch',
				value: 'getCurrentRewardEpoch',
				description: 'Get current reward epoch ID',
				action: 'Get current reward epoch',
			},
			{
				name: 'Get Epoch Rewards',
				value: 'getEpochRewards',
				description: 'Get rewards for a specific epoch',
				action: 'Get epoch rewards',
			},
			{
				name: 'Get Auto-Claim Status',
				value: 'getAutoClaimStatus',
				description: 'Check if auto-claim is enabled',
				action: 'Get auto-claim status',
			},
			{
				name: 'Enable Auto-Claim',
				value: 'enableAutoClaim',
				description: 'Enable automatic reward claiming',
				action: 'Enable auto-claim',
			},
			{
				name: 'Disable Auto-Claim',
				value: 'disableAutoClaim',
				description: 'Disable automatic reward claiming',
				action: 'Disable auto-claim',
			},
			{
				name: 'Get Executor Info',
				value: 'getExecutorInfo',
				description: 'Get auto-claim executor information',
				action: 'Get executor info',
			},
		],
		default: 'getClaimableRewards',
	},
];

export const ftsoRewardsFields: INodeProperties[] = [
	// Address for queries
	{
		displayName: 'Address',
		name: 'address',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Address to query rewards for',
		displayOptions: {
			show: {
				resource: ['ftsoRewards'],
				operation: ['getClaimableRewards', 'getUnclaimedEpochs', 'getAutoClaimStatus', 'getExecutorInfo', 'getEpochRewards'],
			},
		},
	},
	// Epoch ID
	{
		displayName: 'Epoch ID',
		name: 'epochId',
		type: 'number',
		required: true,
		default: 0,
		description: 'Reward epoch ID',
		displayOptions: {
			show: {
				resource: ['ftsoRewards'],
				operation: ['getRewardEpochInfo', 'getEpochRewards'],
			},
		},
	},
	// Epoch IDs for claiming
	{
		displayName: 'Epoch IDs',
		name: 'epochIds',
		type: 'string',
		required: true,
		default: '',
		placeholder: '100,101,102',
		description: 'Comma-separated list of epoch IDs to claim',
		displayOptions: {
			show: {
				resource: ['ftsoRewards'],
				operation: ['claimRewards'],
			},
		},
	},
	// Recipient address for claim to address
	{
		displayName: 'Recipient Address',
		name: 'recipientAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Address to receive the claimed rewards',
		displayOptions: {
			show: {
				resource: ['ftsoRewards'],
				operation: ['claimToAddress'],
			},
		},
	},
	// Auto-claim executor
	{
		displayName: 'Executor Address',
		name: 'executorAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Auto-claim executor address',
		displayOptions: {
			show: {
				resource: ['ftsoRewards'],
				operation: ['enableAutoClaim'],
			},
		},
	},
	// Max fee for auto-claim
	{
		displayName: 'Max Fee',
		name: 'maxFee',
		type: 'string',
		default: '0.01',
		description: 'Maximum fee to pay executor per claim',
		displayOptions: {
			show: {
				resource: ['ftsoRewards'],
				operation: ['enableAutoClaim'],
			},
		},
	},
	// Wrap rewards option
	{
		displayName: 'Wrap Rewards',
		name: 'wrapRewards',
		type: 'boolean',
		default: true,
		description: 'Whether to wrap claimed rewards to WFLR/WSGB',
		displayOptions: {
			show: {
				resource: ['ftsoRewards'],
				operation: ['claimRewards', 'claimAllRewards', 'claimToAddress'],
			},
		},
	},
];

export async function executeFtsoRewards(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;
	const credentials = await this.getCredentials('flareNetworkApi');
	const connection = await createFlareConnection(credentials as any);
	const rewardManager = getFtsoRewardManagerContract(connection);

	let result: any;

	switch (operation) {
		case 'getClaimableRewards': {
			const address = this.getNodeParameter('address', index) as string;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			// Get claimable epochs
			const currentEpoch = Number(await rewardManager.getCurrentRewardEpoch());
			const firstClaimableEpoch = Math.max(0, currentEpoch - REWARD_EXPIRY_EPOCHS);

			let totalRewards = 0n;
			const epochRewards: any[] = [];

			for (let epoch = firstClaimableEpoch; epoch < currentEpoch; epoch++) {
				try {
					const [claimable] = await rewardManager.getStateOfRewards(address, epoch);
					if (claimable > 0n) {
						totalRewards += claimable;
						epochRewards.push({
							epoch,
							amount: formatTokenAmount(claimable, 18),
							amountWei: claimable.toString(),
							expiresAt: new Date(Date.now() + (REWARD_EXPIRY_EPOCHS - epoch) * REWARD_EPOCH_DURATION_SECONDS * 1000).toISOString(),
						});
					}
				} catch {
					// Epoch may not have rewards
				}
			}

			result = {
				address,
				totalClaimable: formatTokenAmount(totalRewards, 18),
				totalClaimableWei: totalRewards.toString(),
				epochsWithRewards: epochRewards.length,
				rewards: epochRewards,
				currentEpoch,
			};
			break;
		}

		case 'getUnclaimedEpochs': {
			const address = this.getNodeParameter('address', index) as string;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const epochs = await getClaimableEpochs(rewardManager, address);

			result = {
				address,
				unclaimedEpochs: epochs,
				count: epochs.length,
			};
			break;
		}

		case 'claimRewards': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required for claiming');
			}

			const epochIdsStr = this.getNodeParameter('epochIds', index) as string;
			const wrapRewards = this.getNodeParameter('wrapRewards', index, true) as boolean;

			const epochIds = epochIdsStr.split(',').map(e => parseInt(e.trim(), 10));
			const senderAddress = await connection.wallet.getAddress();

			const tx = await rewardManager.claim(senderAddress, senderAddress, epochIds, wrapRewards);
			const receipt = await tx.wait();

			// Calculate total claimed from events
			let totalClaimed = 0n;
			for (const log of receipt?.logs || []) {
				try {
					const parsed = rewardManager.interface.parseLog(log);
					if (parsed?.name === 'RewardClaimed') {
						totalClaimed += parsed.args.amount;
					}
				} catch {
					// Not a RewardClaimed event
				}
			}

			result = {
				operation: 'claimRewards',
				epochs: epochIds,
				wrapped: wrapRewards,
				totalClaimed: formatTokenAmount(totalClaimed, 18),
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'success' : 'failed',
			};
			break;
		}

		case 'claimAllRewards': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required for claiming');
			}

			const wrapRewards = this.getNodeParameter('wrapRewards', index, true) as boolean;
			const senderAddress = await connection.wallet.getAddress();

			// Get all claimable epochs
			const epochs = await getClaimableEpochs(rewardManager, senderAddress);

			if (epochs.length === 0) {
				result = {
					operation: 'claimAllRewards',
					message: 'No rewards to claim',
					epochs: [],
				};
				break;
			}

			const tx = await rewardManager.claim(senderAddress, senderAddress, epochs, wrapRewards);
			const receipt = await tx.wait();

			// Calculate total claimed
			let totalClaimed = 0n;
			for (const log of receipt?.logs || []) {
				try {
					const parsed = rewardManager.interface.parseLog(log);
					if (parsed?.name === 'RewardClaimed') {
						totalClaimed += parsed.args.amount;
					}
				} catch {
					// Not a RewardClaimed event
				}
			}

			result = {
				operation: 'claimAllRewards',
				epochs,
				epochCount: epochs.length,
				wrapped: wrapRewards,
				totalClaimed: formatTokenAmount(totalClaimed, 18),
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'success' : 'failed',
			};
			break;
		}

		case 'claimToAddress': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required for claiming');
			}

			const recipientAddress = this.getNodeParameter('recipientAddress', index) as string;
			const wrapRewards = this.getNodeParameter('wrapRewards', index, true) as boolean;

			if (!ethers.isAddress(recipientAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid recipient address');
			}

			const senderAddress = await connection.wallet.getAddress();
			const epochs = await getClaimableEpochs(rewardManager, senderAddress);

			if (epochs.length === 0) {
				result = {
					operation: 'claimToAddress',
					message: 'No rewards to claim',
					epochs: [],
				};
				break;
			}

			const tx = await rewardManager.claim(senderAddress, recipientAddress, epochs, wrapRewards);
			const receipt = await tx.wait();

			result = {
				operation: 'claimToAddress',
				recipient: recipientAddress,
				epochs,
				wrapped: wrapRewards,
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'success' : 'failed',
			};
			break;
		}

		case 'getRewardEpochInfo': {
			const epochId = this.getNodeParameter('epochId', index) as number;
			const currentEpoch = Number(await rewardManager.getCurrentRewardEpoch());

			// Calculate epoch timing
			const startTime = await rewardManager.getRewardEpochStartTime(epochId);
			const endTime = startTime + BigInt(REWARD_EPOCH_DURATION_SECONDS);

			result = {
				epochId,
				startTime: Number(startTime),
				startTimeFormatted: new Date(Number(startTime) * 1000).toISOString(),
				endTime: Number(endTime),
				endTimeFormatted: new Date(Number(endTime) * 1000).toISOString(),
				durationSeconds: REWARD_EPOCH_DURATION_SECONDS,
				durationDays: (REWARD_EPOCH_DURATION_SECONDS / 86400).toFixed(2),
				isCurrent: epochId === currentEpoch,
				isFinalized: epochId < currentEpoch,
				expiresAt: new Date(Date.now() + (REWARD_EXPIRY_EPOCHS) * REWARD_EPOCH_DURATION_SECONDS * 1000).toISOString(),
			};
			break;
		}

		case 'getCurrentRewardEpoch': {
			const currentEpoch = Number(await rewardManager.getCurrentRewardEpoch());
			const startTime = await rewardManager.getRewardEpochStartTime(currentEpoch);
			const endTime = Number(startTime) + REWARD_EPOCH_DURATION_SECONDS;
			const now = Math.floor(Date.now() / 1000);

			result = {
				currentEpoch,
				startTime: Number(startTime),
				startTimeFormatted: new Date(Number(startTime) * 1000).toISOString(),
				endTime,
				endTimeFormatted: new Date(endTime * 1000).toISOString(),
				secondsRemaining: Math.max(0, endTime - now),
				progress: ((now - Number(startTime)) / REWARD_EPOCH_DURATION_SECONDS * 100).toFixed(2) + '%',
			};
			break;
		}

		case 'getEpochRewards': {
			const address = this.getNodeParameter('address', index) as string;
			const epochId = this.getNodeParameter('epochId', index) as number;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			try {
				const [claimable, claimed] = await rewardManager.getStateOfRewards(address, epochId);

				result = {
					address,
					epochId,
					claimable: formatTokenAmount(claimable, 18),
					claimableWei: claimable.toString(),
					claimed: formatTokenAmount(claimed, 18),
					claimedWei: claimed.toString(),
					hasClaimed: claimed > 0n,
				};
			} catch (error) {
				result = {
					address,
					epochId,
					claimable: '0',
					claimed: '0',
					error: 'No rewards data for this epoch',
				};
			}
			break;
		}

		case 'getAutoClaimStatus': {
			const address = this.getNodeParameter('address', index) as string;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const claimSetupManager = getClaimSetupManagerContract(connection);

			try {
				const executors = await claimSetupManager.claimExecutors(address);
				const allowedRecipients = await claimSetupManager.allowedClaimRecipients(address);

				result = {
					address,
					autoClaimEnabled: executors.length > 0,
					executors: executors,
					allowedRecipients: allowedRecipients,
				};
			} catch (error) {
				result = {
					address,
					autoClaimEnabled: false,
					executors: [],
					allowedRecipients: [],
				};
			}
			break;
		}

		case 'enableAutoClaim': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required');
			}

			const executorAddress = this.getNodeParameter('executorAddress', index) as string;
			const maxFee = this.getNodeParameter('maxFee', index, '0.01') as string;

			if (!ethers.isAddress(executorAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid executor address');
			}

			const claimSetupManager = getClaimSetupManagerContract(connection);
			const maxFeeWei = ethers.parseEther(maxFee);

			const tx = await claimSetupManager.setClaimExecutors([executorAddress], maxFeeWei);
			const receipt = await tx.wait();

			result = {
				operation: 'enableAutoClaim',
				executor: executorAddress,
				maxFee: maxFee,
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'success' : 'failed',
			};
			break;
		}

		case 'disableAutoClaim': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required');
			}

			const claimSetupManager = getClaimSetupManagerContract(connection);

			const tx = await claimSetupManager.setClaimExecutors([], 0);
			const receipt = await tx.wait();

			result = {
				operation: 'disableAutoClaim',
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'success' : 'failed',
			};
			break;
		}

		case 'getExecutorInfo': {
			const address = this.getNodeParameter('address', index) as string;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const claimSetupManager = getClaimSetupManagerContract(connection);

			try {
				const executors = await claimSetupManager.claimExecutors(address);

				result = {
					address,
					executors: executors,
					hasExecutors: executors.length > 0,
				};
			} catch {
				result = {
					address,
					executors: [],
					hasExecutors: false,
				};
			}
			break;
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
	}

	return [{ json: result }];
}
