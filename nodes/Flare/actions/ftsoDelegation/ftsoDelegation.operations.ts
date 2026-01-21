/**
 * FTSO Delegation Resource Operations
 *
 * Handles delegation of vote power to FTSO data providers.
 * Data providers submit prices to the FTSO system and earn rewards
 * which are shared with delegators.
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties, IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { ethers } from 'ethers';
import { createFlareConnection, getWNatContract } from '../../transport/provider';
import { formatTokenAmount, parseTokenAmount, weiToEther, bipsToPercentage } from '../../utils/unitConverter';
import {
	validateDelegation,
	formatDelegationInfo,
	calculateOptimalSplit,
	calculateExpectedRewards,
	MAX_DELEGATION_BIPS,
} from '../../utils/delegationUtils';

export const ftsoDelegationOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['ftsoDelegation'],
			},
		},
		options: [
			{
				name: 'Get Current Delegations',
				value: 'getCurrentDelegations',
				description: 'Get delegation info for an address',
				action: 'Get current delegations',
			},
			{
				name: 'Get Provider Info',
				value: 'getProviderInfo',
				description: 'Get information about a data provider',
				action: 'Get provider info',
			},
			{
				name: 'Get Provider Vote Power',
				value: 'getProviderVotePower',
				description: 'Get total vote power delegated to a provider',
				action: 'Get provider vote power',
			},
			{
				name: 'Delegate to Provider',
				value: 'delegateToProvider',
				description: 'Delegate vote power to an FTSO data provider',
				action: 'Delegate to provider',
			},
			{
				name: 'Delegate to Multiple Providers',
				value: 'delegateToMultiple',
				description: 'Delegate to up to 2 providers at once',
				action: 'Delegate to multiple providers',
			},
			{
				name: 'Undelegate from Provider',
				value: 'undelegateFromProvider',
				description: 'Remove delegation from a provider',
				action: 'Undelegate from provider',
			},
			{
				name: 'Undelegate All',
				value: 'undelegateAll',
				description: 'Remove all delegations',
				action: 'Undelegate all',
			},
			{
				name: 'Get Delegation Percentage',
				value: 'getDelegationPercentage',
				description: 'Get percentage delegated to a provider',
				action: 'Get delegation percentage',
			},
			{
				name: 'Calculate Expected Rewards',
				value: 'calculateExpectedRewards',
				description: 'Estimate rewards based on delegation',
				action: 'Calculate expected rewards',
			},
			{
				name: 'Get Optimal Split',
				value: 'getOptimalSplit',
				description: 'Calculate optimal delegation split',
				action: 'Get optimal split',
			},
		],
		default: 'getCurrentDelegations',
	},
];

export const ftsoDelegationFields: INodeProperties[] = [
	// Address for queries
	{
		displayName: 'Address',
		name: 'address',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Address to query delegations for',
		displayOptions: {
			show: {
				resource: ['ftsoDelegation'],
				operation: ['getCurrentDelegations', 'getDelegationPercentage'],
			},
		},
	},
	// Provider address
	{
		displayName: 'Provider Address',
		name: 'providerAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'FTSO data provider address',
		displayOptions: {
			show: {
				resource: ['ftsoDelegation'],
				operation: ['getProviderInfo', 'getProviderVotePower', 'delegateToProvider', 'undelegateFromProvider', 'getDelegationPercentage'],
			},
		},
	},
	// Delegation percentage
	{
		displayName: 'Percentage',
		name: 'percentage',
		type: 'number',
		required: true,
		default: 50,
		description: 'Percentage of vote power to delegate (0-100)',
		displayOptions: {
			show: {
				resource: ['ftsoDelegation'],
				operation: ['delegateToProvider'],
			},
		},
	},
	// Multi-delegation fields
	{
		displayName: 'First Provider Address',
		name: 'firstProviderAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'First FTSO data provider address',
		displayOptions: {
			show: {
				resource: ['ftsoDelegation'],
				operation: ['delegateToMultiple'],
			},
		},
	},
	{
		displayName: 'First Provider Percentage',
		name: 'firstPercentage',
		type: 'number',
		required: true,
		default: 50,
		description: 'Percentage for first provider',
		displayOptions: {
			show: {
				resource: ['ftsoDelegation'],
				operation: ['delegateToMultiple'],
			},
		},
	},
	{
		displayName: 'Second Provider Address',
		name: 'secondProviderAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Second FTSO data provider address',
		displayOptions: {
			show: {
				resource: ['ftsoDelegation'],
				operation: ['delegateToMultiple'],
			},
		},
	},
	{
		displayName: 'Second Provider Percentage',
		name: 'secondPercentage',
		type: 'number',
		required: true,
		default: 50,
		description: 'Percentage for second provider',
		displayOptions: {
			show: {
				resource: ['ftsoDelegation'],
				operation: ['delegateToMultiple'],
			},
		},
	},
	// For reward calculations
	{
		displayName: 'Vote Power Amount',
		name: 'votePowerAmount',
		type: 'string',
		required: true,
		default: '',
		placeholder: '1000',
		description: 'Vote power amount for calculations',
		displayOptions: {
			show: {
				resource: ['ftsoDelegation'],
				operation: ['calculateExpectedRewards', 'getOptimalSplit'],
			},
		},
	},
	{
		displayName: 'Provider Reward Rate (%)',
		name: 'providerRewardRate',
		type: 'number',
		default: 10,
		description: 'Expected provider reward rate percentage',
		displayOptions: {
			show: {
				resource: ['ftsoDelegation'],
				operation: ['calculateExpectedRewards'],
			},
		},
	},
];

export async function executeFtsoDelegation(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;
	const credentials = await this.getCredentials('flareNetworkApi');
	const connection = await createFlareConnection(credentials as any);
	const wNat = getWNatContract(connection);

	let result: any;

	switch (operation) {
		case 'getCurrentDelegations': {
			const address = this.getNodeParameter('address', index) as string;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const [delegates, bips] = await wNat.delegatesOf(address);
			const votePower = await wNat.votePowerOf(address);
			const undelegated = await wNat.undelegatedVotePowerOf(address);

			const delegations = delegates.map((delegate: string, i: number) => ({
				provider: delegate,
				percentage: Number(bips[i]) / 100,
				bips: Number(bips[i]),
				estimatedVotePower: formatTokenAmount(
					(votePower * BigInt(bips[i])) / BigInt(10000),
					18,
				),
			}));

			result = {
				address,
				totalVotePower: formatTokenAmount(votePower, 18),
				undelegatedVotePower: formatTokenAmount(undelegated, 18),
				totalDelegatedPercentage: delegations.reduce((sum: number, d: any) => sum + d.percentage, 0),
				delegationCount: delegates.length,
				maxDelegations: 2,
				delegations,
			};
			break;
		}

		case 'getProviderInfo': {
			const providerAddress = this.getNodeParameter('providerAddress', index) as string;

			if (!ethers.isAddress(providerAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid provider address');
			}

			const votePower = BigInt(await wNat.votePowerOf(providerAddress));
			const balance = BigInt(await wNat.balanceOf(providerAddress));

			// Get delegations received by this provider
			const [fromDelegators, fromBips] = await wNat.delegatesOf(providerAddress);

			result = {
				address: providerAddress,
				votePower: formatTokenAmount(votePower, 18),
				ownBalance: formatTokenAmount(balance, 18),
				delegatedVotePower: formatTokenAmount(votePower - balance, 18),
				selfDelegations: fromDelegators.map((d: string, i: number) => ({
					delegate: d,
					percentage: Number(fromBips[i]) / 100,
				})),
			};
			break;
		}

		case 'getProviderVotePower': {
			const providerAddress = this.getNodeParameter('providerAddress', index) as string;

			if (!ethers.isAddress(providerAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid provider address');
			}

			const votePower = await wNat.votePowerOf(providerAddress);
			const totalVotePower = await wNat.totalVotePower();

			result = {
				provider: providerAddress,
				votePower: formatTokenAmount(votePower, 18),
				votePowerWei: votePower.toString(),
				totalNetworkVotePower: formatTokenAmount(totalVotePower, 18),
				networkShare: ((Number(votePower) / Number(totalVotePower)) * 100).toFixed(4) + '%',
			};
			break;
		}

		case 'delegateToProvider': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required for delegation');
			}

			const providerAddress = this.getNodeParameter('providerAddress', index) as string;
			const percentage = this.getNodeParameter('percentage', index) as number;

			if (!ethers.isAddress(providerAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid provider address');
			}

			// Convert percentage to bips (100% = 10000 bips)
			const bips = Math.round(percentage * 100);
			if (bips < 0 || bips > MAX_DELEGATION_BIPS) {
				throw new NodeOperationError(this.getNode(), `Percentage must be between 0 and 100`);
			}

			const tx = await wNat.delegate(providerAddress, bips);
			const receipt = await tx.wait();

			// Get updated delegation info
			const [delegates, delegateBips] = await wNat.delegatesOf(await connection.wallet.getAddress());

			result = {
				operation: 'delegate',
				provider: providerAddress,
				percentage,
				bips,
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'success' : 'failed',
				currentDelegations: delegates.map((d: string, i: number) => ({
					provider: d,
					percentage: Number(delegateBips[i]) / 100,
				})),
			};
			break;
		}

		case 'delegateToMultiple': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required for delegation');
			}

			const firstProvider = this.getNodeParameter('firstProviderAddress', index) as string;
			const firstPercentage = this.getNodeParameter('firstPercentage', index) as number;
			const secondProvider = this.getNodeParameter('secondProviderAddress', index) as string;
			const secondPercentage = this.getNodeParameter('secondPercentage', index) as number;

			if (!ethers.isAddress(firstProvider) || !ethers.isAddress(secondProvider)) {
				throw new NodeOperationError(this.getNode(), 'Invalid provider address');
			}

			if (firstPercentage + secondPercentage > 100) {
				throw new NodeOperationError(this.getNode(), 'Total percentage cannot exceed 100%');
			}

			const bips1 = Math.round(firstPercentage * 100);
			const bips2 = Math.round(secondPercentage * 100);

			const tx = await wNat.batchDelegate(
				[firstProvider, secondProvider],
				[bips1, bips2],
			);
			const receipt = await tx.wait();

			result = {
				operation: 'delegateToMultiple',
				delegations: [
					{ provider: firstProvider, percentage: firstPercentage, bips: bips1 },
					{ provider: secondProvider, percentage: secondPercentage, bips: bips2 },
				],
				totalPercentage: firstPercentage + secondPercentage,
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'success' : 'failed',
			};
			break;
		}

		case 'undelegateFromProvider': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required');
			}

			const providerAddress = this.getNodeParameter('providerAddress', index) as string;

			if (!ethers.isAddress(providerAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid provider address');
			}

			// Delegate 0% to remove delegation
			const tx = await wNat.delegate(providerAddress, 0);
			const receipt = await tx.wait();

			result = {
				operation: 'undelegate',
				provider: providerAddress,
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'success' : 'failed',
			};
			break;
		}

		case 'undelegateAll': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required');
			}

			const tx = await wNat.undelegateAll();
			const receipt = await tx.wait();

			result = {
				operation: 'undelegateAll',
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'success' : 'failed',
			};
			break;
		}

		case 'getDelegationPercentage': {
			const address = this.getNodeParameter('address', index) as string;
			const providerAddress = this.getNodeParameter('providerAddress', index) as string;

			if (!ethers.isAddress(address) || !ethers.isAddress(providerAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const [delegates, bips] = await wNat.delegatesOf(address);

			const providerIndex = delegates.findIndex(
				(d: string) => d.toLowerCase() === providerAddress.toLowerCase(),
			);

			if (providerIndex === -1) {
				result = {
					delegator: address,
					provider: providerAddress,
					percentage: 0,
					bips: 0,
					isDelegated: false,
				};
			} else {
				result = {
					delegator: address,
					provider: providerAddress,
					percentage: Number(bips[providerIndex]) / 100,
					bips: Number(bips[providerIndex]),
					isDelegated: true,
				};
			}
			break;
		}

		case 'calculateExpectedRewards': {
			const votePowerAmount = this.getNodeParameter('votePowerAmount', index) as string;
			const providerRewardRate = this.getNodeParameter('providerRewardRate', index) as number;

			const votePower = parseTokenAmount(votePowerAmount, 18);
			
			// Calculate rewards for different periods (assuming ~3.5 day epochs)
			const epochsPerDay = 1 / 3.5;
			const epochsPerWeek = 2;
			const epochsPerMonth = 8.57;
			const epochsPerYear = 104;
			
			// Simplified estimate: reward rate * vote power * time period
			const dailyReward = (votePower * BigInt(Math.floor(providerRewardRate * epochsPerDay))) / 100n;
			const weeklyReward = (votePower * BigInt(Math.floor(providerRewardRate * epochsPerWeek))) / 100n;
			const monthlyReward = (votePower * BigInt(Math.floor(providerRewardRate * epochsPerMonth))) / 100n;
			const yearlyReward = (votePower * BigInt(Math.floor(providerRewardRate * epochsPerYear))) / 100n;

			result = {
				votePower: formatTokenAmount(votePower, 18),
				providerRewardRate: providerRewardRate + '%',
				estimatedRewards: {
					daily: formatTokenAmount(dailyReward, 18),
					weekly: formatTokenAmount(weeklyReward, 18),
					monthly: formatTokenAmount(monthlyReward, 18),
					yearly: formatTokenAmount(yearlyReward, 18),
				},
				apr: (providerRewardRate * 365 / 100).toFixed(2) + '%',
				note: 'Estimates based on constant reward rate. Actual rewards vary.',
			};
			break;
		}

		case 'getOptimalSplit': {
			const votePowerAmount = this.getNodeParameter('votePowerAmount', index) as string;
			const votePower = parseTokenAmount(votePowerAmount, 18);

			// Default recommendation: split 50/50 between two providers
			result = {
				totalVotePower: formatTokenAmount(votePower, 18),
				recommendation: [
					{ percentage: 50, bips: 5000 },
					{ percentage: 50, bips: 5000 },
				],
				note: 'Splitting delegation across 2 providers can reduce risk of reward loss if one provider fails.',
			};
			break;
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
	}

	return [{ json: result }];
}
