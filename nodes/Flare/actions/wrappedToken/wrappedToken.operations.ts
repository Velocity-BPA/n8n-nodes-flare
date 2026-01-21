/**
 * Wrapped Token Resource Operations (WFLR/WSGB)
 *
 * Handles wrapping/unwrapping native tokens and vote power delegation.
 * On Flare/Songbird, you must wrap native tokens to WFLR/WSGB to:
 * - Delegate vote power to FTSO data providers
 * - Earn FTSO rewards
 * - Participate in governance
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { ethers } from 'ethers';
import { createFlareConnection, getWNatContract } from '../../transport/provider';
import { parseTokenAmount, formatTokenAmount } from '../../utils/unitConverter';
import { validateDelegation, MAX_DELEGATION_BIPS } from '../../utils/delegationUtils';

export const wrappedTokenOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['wrappedToken'],
			},
		},
		options: [
			{
				name: 'Wrap Native Token',
				value: 'wrap',
				description: 'Convert FLR to WFLR or SGB to WSGB',
				action: 'Wrap native token',
			},
			{
				name: 'Unwrap Token',
				value: 'unwrap',
				description: 'Convert WFLR to FLR or WSGB to SGB',
				action: 'Unwrap token',
			},
			{
				name: 'Get Wrapped Balance',
				value: 'getBalance',
				description: 'Get wrapped token balance for an address',
				action: 'Get wrapped balance',
			},
			{
				name: 'Get Total Vote Power',
				value: 'getTotalVotePower',
				description: 'Get total vote power across all holders',
				action: 'Get total vote power',
			},
			{
				name: 'Get Vote Power',
				value: 'getVotePower',
				description: 'Get vote power for an address',
				action: 'Get vote power',
			},
			{
				name: 'Get Vote Power at Block',
				value: 'getVotePowerAtBlock',
				description: 'Get vote power at a specific block',
				action: 'Get vote power at block',
			},
			{
				name: 'Delegate Vote Power',
				value: 'delegate',
				description: 'Delegate vote power to a data provider',
				action: 'Delegate vote power',
			},
			{
				name: 'Delegate by Percentage',
				value: 'delegateByPercentage',
				description: 'Delegate a percentage of vote power',
				action: 'Delegate by percentage',
			},
			{
				name: 'Undelegate All',
				value: 'undelegateAll',
				description: 'Remove all delegations',
				action: 'Undelegate all',
			},
			{
				name: 'Revoke Delegation',
				value: 'revokeDelegation',
				description: 'Revoke delegation from specific provider',
				action: 'Revoke delegation',
			},
			{
				name: 'Get Delegation Mode',
				value: 'getDelegationMode',
				description: 'Get delegation mode (percentage or amount)',
				action: 'Get delegation mode',
			},
			{
				name: 'Get Delegates',
				value: 'getDelegates',
				description: 'Get list of delegates for an address',
				action: 'Get delegates',
			},
			{
				name: 'Get Undelegated Vote Power',
				value: 'getUndelegatedVotePower',
				description: 'Get vote power not yet delegated',
				action: 'Get undelegated vote power',
			},
		],
		default: 'wrap',
	},
];

export const wrappedTokenFields: INodeProperties[] = [
	// Amount fields for wrap/unwrap
	{
		displayName: 'Amount',
		name: 'amount',
		type: 'string',
		required: true,
		default: '',
		placeholder: '100',
		description: 'Amount to wrap/unwrap',
		displayOptions: {
			show: {
				resource: ['wrappedToken'],
				operation: ['wrap', 'unwrap'],
			},
		},
	},
	// Address field for balance/vote power queries
	{
		displayName: 'Address',
		name: 'address',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Address to query',
		displayOptions: {
			show: {
				resource: ['wrappedToken'],
				operation: ['getBalance', 'getVotePower', 'getVotePowerAtBlock', 'getDelegationMode', 'getDelegates', 'getUndelegatedVotePower'],
			},
		},
	},
	// Block number for historical queries
	{
		displayName: 'Block Number',
		name: 'blockNumber',
		type: 'number',
		required: true,
		default: 0,
		description: 'Block number for historical query',
		displayOptions: {
			show: {
				resource: ['wrappedToken'],
				operation: ['getVotePowerAtBlock'],
			},
		},
	},
	// Delegation fields
	{
		displayName: 'Provider Address',
		name: 'providerAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'FTSO data provider address to delegate to',
		displayOptions: {
			show: {
				resource: ['wrappedToken'],
				operation: ['delegate', 'delegateByPercentage', 'revokeDelegation'],
			},
		},
	},
	{
		displayName: 'Percentage',
		name: 'percentage',
		type: 'number',
		required: true,
		default: 50,
		description: 'Percentage of vote power to delegate (0-100). Note: Total delegation cannot exceed 100%.',
		displayOptions: {
			show: {
				resource: ['wrappedToken'],
				operation: ['delegateByPercentage'],
			},
		},
	},
	{
		displayName: 'Vote Power Amount',
		name: 'votePowerAmount',
		type: 'string',
		required: true,
		default: '',
		placeholder: '1000',
		description: 'Amount of vote power to delegate',
		displayOptions: {
			show: {
				resource: ['wrappedToken'],
				operation: ['delegate'],
			},
		},
	},
	// Multi-delegation support
	{
		displayName: 'Second Provider (Optional)',
		name: 'secondProvider',
		type: 'string',
		default: '',
		placeholder: '0x...',
		description: 'Optional second provider address (max 2 delegations allowed)',
		displayOptions: {
			show: {
				resource: ['wrappedToken'],
				operation: ['delegateByPercentage'],
			},
		},
	},
	{
		displayName: 'Second Provider Percentage',
		name: 'secondPercentage',
		type: 'number',
		default: 0,
		description: 'Percentage for second provider',
		displayOptions: {
			show: {
				resource: ['wrappedToken'],
				operation: ['delegateByPercentage'],
			},
		},
	},
];

export async function executeWrappedToken(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;
	const credentials = await this.getCredentials('flareNetworkApi');
	const connection = await createFlareConnection(credentials as any);
	const wNat = getWNatContract(connection);

	let result: any;

	switch (operation) {
		case 'wrap': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required for wrapping tokens');
			}

			const amount = this.getNodeParameter('amount', index) as string;
			const value = parseTokenAmount(amount, 18);

			// Call deposit() with value to wrap native tokens
			const tx = await wNat.deposit({ value });
			const receipt = await tx.wait();

			result = {
				operation: 'wrap',
				amount: formatTokenAmount(value, 18),
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'success' : 'failed',
			};
			break;
		}

		case 'unwrap': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required for unwrapping tokens');
			}

			const amount = this.getNodeParameter('amount', index) as string;
			const value = parseTokenAmount(amount, 18);

			// Call withdraw() to unwrap tokens
			const tx = await wNat.withdraw(value);
			const receipt = await tx.wait();

			result = {
				operation: 'unwrap',
				amount: formatTokenAmount(value, 18),
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'success' : 'failed',
			};
			break;
		}

		case 'getBalance': {
			const address = this.getNodeParameter('address', index) as string;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const balance = await wNat.balanceOf(address);
			const symbol = await wNat.symbol();

			result = {
				address,
				balance: formatTokenAmount(balance, 18),
				balanceWei: balance.toString(),
				symbol,
			};
			break;
		}

		case 'getTotalVotePower': {
			const totalVotePower = await wNat.totalVotePower();

			result = {
				totalVotePower: formatTokenAmount(totalVotePower, 18),
				totalVotePowerWei: totalVotePower.toString(),
			};
			break;
		}

		case 'getVotePower': {
			const address = this.getNodeParameter('address', index) as string;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const votePower = await wNat.votePowerOf(address);

			result = {
				address,
				votePower: formatTokenAmount(votePower, 18),
				votePowerWei: votePower.toString(),
			};
			break;
		}

		case 'getVotePowerAtBlock': {
			const address = this.getNodeParameter('address', index) as string;
			const blockNumber = this.getNodeParameter('blockNumber', index) as number;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const votePower = await wNat.votePowerOfAt(address, blockNumber);

			result = {
				address,
				blockNumber,
				votePower: formatTokenAmount(votePower, 18),
				votePowerWei: votePower.toString(),
			};
			break;
		}

		case 'delegate': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required for delegation');
			}

			const providerAddress = this.getNodeParameter('providerAddress', index) as string;
			const votePowerAmount = this.getNodeParameter('votePowerAmount', index) as string;

			if (!ethers.isAddress(providerAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid provider address');
			}

			const value = parseTokenAmount(votePowerAmount, 18);
			const tx = await wNat.delegateExplicit(providerAddress, value);
			const receipt = await tx.wait();

			result = {
				operation: 'delegate',
				to: providerAddress,
				amount: formatTokenAmount(value, 18),
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'success' : 'failed',
			};
			break;
		}

		case 'delegateByPercentage': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required for delegation');
			}

			const providerAddress = this.getNodeParameter('providerAddress', index) as string;
			const percentage = this.getNodeParameter('percentage', index) as number;
			const secondProvider = this.getNodeParameter('secondProvider', index, '') as string;
			const secondPercentage = this.getNodeParameter('secondPercentage', index, 0) as number;

			if (!ethers.isAddress(providerAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid provider address');
			}

			// Validate total percentage
			const totalPercentage = percentage + (secondProvider ? secondPercentage : 0);
			if (totalPercentage > 100) {
				throw new NodeOperationError(this.getNode(), 'Total delegation cannot exceed 100%');
			}

			// Convert percentage to basis points (100% = 10000 bips)
			const bips1 = Math.round(percentage * 100);

			let tx;
			if (secondProvider && ethers.isAddress(secondProvider) && secondPercentage > 0) {
				const bips2 = Math.round(secondPercentage * 100);
				// Delegate to two providers
				tx = await wNat.batchDelegate([providerAddress, secondProvider], [bips1, bips2]);
			} else {
				// Delegate to single provider
				tx = await wNat.delegate(providerAddress, bips1);
			}

			const receipt = await tx.wait();

			result = {
				operation: 'delegateByPercentage',
				delegations: [
					{ provider: providerAddress, percentage: percentage },
					...(secondProvider && secondPercentage > 0
						? [{ provider: secondProvider, percentage: secondPercentage }]
						: []),
				],
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

		case 'revokeDelegation': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required');
			}

			const providerAddress = this.getNodeParameter('providerAddress', index) as string;

			if (!ethers.isAddress(providerAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid provider address');
			}

			// Revoke by delegating 0 to the provider
			const tx = await wNat.delegate(providerAddress, 0);
			const receipt = await tx.wait();

			result = {
				operation: 'revokeDelegation',
				from: providerAddress,
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'success' : 'failed',
			};
			break;
		}

		case 'getDelegationMode': {
			const address = this.getNodeParameter('address', index) as string;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const mode = await wNat.delegationModeOf(address);
			// 0 = NOTSET, 1 = PERCENTAGE, 2 = AMOUNT
			const modeNames = ['NOT_SET', 'PERCENTAGE', 'AMOUNT'];

			result = {
				address,
				delegationMode: modeNames[Number(mode)] || 'UNKNOWN',
				modeValue: Number(mode),
			};
			break;
		}

		case 'getDelegates': {
			const address = this.getNodeParameter('address', index) as string;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const [delegates, bips] = await wNat.delegatesOf(address);

			result = {
				address,
				delegates: delegates.map((delegate: string, i: number) => ({
					provider: delegate,
					percentage: Number(bips[i]) / 100, // Convert bips to percentage
					bips: Number(bips[i]),
				})),
				totalDelegated: delegates.reduce((sum: number, _: string, i: number) => sum + Number(bips[i]), 0) / 100,
			};
			break;
		}

		case 'getUndelegatedVotePower': {
			const address = this.getNodeParameter('address', index) as string;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const undelegated = await wNat.undelegatedVotePowerOf(address);

			result = {
				address,
				undelegatedVotePower: formatTokenAmount(undelegated, 18),
				undelegatedVotePowerWei: undelegated.toString(),
			};
			break;
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
	}

	return [{ json: result }];
}
