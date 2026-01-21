/**
 * Account Resource Actions
 *
 * Operations for querying account balances, transaction history,
 * delegation info, and vote power on Flare/Songbird networks.
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties, IDataObject } from 'n8n-workflow';
import { createFlareConnection, getNativeBalance, getWNatContract } from '../../transport/provider';
import {
	getTransactionHistory,
	getTokenTransfers,
	getNFTTransfers,
	getTokenBalances,
} from '../../transport/explorerApi';
import { weiToEther, formatTokenAmount } from '../../utils/unitConverter';
import { getVotePowerInfo } from '../../utils/votePowerUtils';
import { getRewardSummary } from '../../utils/rewardUtils';
import { ethers } from 'ethers';

export const accountOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['account'],
			},
		},
		options: [
			{
				name: 'Get Balance',
				value: 'getBalance',
				description: 'Get native token balance (FLR/SGB)',
				action: 'Get native balance',
			},
			{
				name: 'Get Wrapped Balance',
				value: 'getWrappedBalance',
				description: 'Get wrapped token balance (WFLR/WSGB)',
				action: 'Get wrapped balance',
			},
			{
				name: 'Get Token Balance',
				value: 'getTokenBalance',
				description: 'Get ERC-20 token balance',
				action: 'Get token balance',
			},
			{
				name: 'Get All Token Balances',
				value: 'getAllTokenBalances',
				description: 'Get all token balances for an address',
				action: 'Get all token balances',
			},
			{
				name: 'Get Transaction History',
				value: 'getTransactionHistory',
				description: 'Get transaction history for an address',
				action: 'Get transaction history',
			},
			{
				name: 'Get Token Transfers',
				value: 'getTokenTransfers',
				description: 'Get ERC-20 token transfers',
				action: 'Get token transfers',
			},
			{
				name: 'Get NFT Holdings',
				value: 'getNFTHoldings',
				description: 'Get NFTs owned by an address',
				action: 'Get NFT holdings',
			},
			{
				name: 'Get Transaction Count',
				value: 'getTransactionCount',
				description: 'Get transaction count (nonce)',
				action: 'Get transaction count',
			},
			{
				name: 'Validate Address',
				value: 'validateAddress',
				description: 'Check if an address is valid',
				action: 'Validate address',
			},
			{
				name: 'Get Delegation Info',
				value: 'getDelegationInfo',
				description: 'Get FTSO delegation information',
				action: 'Get delegation info',
			},
			{
				name: 'Get Claimable Rewards',
				value: 'getClaimableRewards',
				description: 'Get unclaimed FTSO rewards',
				action: 'Get claimable rewards',
			},
			{
				name: 'Get Vote Power',
				value: 'getVotePower',
				description: 'Get vote power for an address',
				action: 'Get vote power',
			},
		],
		default: 'getBalance',
	},
];

export const accountFields: INodeProperties[] = [
	// Address field - common to most operations
	{
		displayName: 'Address',
		name: 'address',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'The wallet address to query',
		displayOptions: {
			show: {
				resource: ['account'],
				operation: [
					'getBalance',
					'getWrappedBalance',
					'getTokenBalance',
					'getAllTokenBalances',
					'getTransactionHistory',
					'getTokenTransfers',
					'getNFTHoldings',
					'getTransactionCount',
					'validateAddress',
					'getDelegationInfo',
					'getClaimableRewards',
					'getVotePower',
				],
			},
		},
	},
	// Token contract address for specific token balance
	{
		displayName: 'Token Contract Address',
		name: 'tokenAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'The ERC-20 token contract address',
		displayOptions: {
			show: {
				resource: ['account'],
				operation: ['getTokenBalance'],
			},
		},
	},
	// Block number for vote power
	{
		displayName: 'Block Number',
		name: 'blockNumber',
		type: 'number',
		default: 0,
		description: 'Block number to query vote power at (0 for current)',
		displayOptions: {
			show: {
				resource: ['account'],
				operation: ['getVotePower'],
			},
		},
	},
	// Pagination options
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['account'],
				operation: ['getTransactionHistory', 'getTokenTransfers', 'getNFTHoldings'],
			},
		},
		options: [
			{
				displayName: 'Page',
				name: 'page',
				type: 'number',
				default: 1,
				description: 'Page number for pagination',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 25,
				description: 'Number of results per page (max 100)',
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				options: [
					{ name: 'Newest First', value: 'desc' },
					{ name: 'Oldest First', value: 'asc' },
				],
				default: 'desc',
				description: 'Sort order for results',
			},
		],
	},
	// Format options for balance queries
	{
		displayName: 'Format Options',
		name: 'formatOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['account'],
				operation: ['getBalance', 'getWrappedBalance', 'getVotePower'],
			},
		},
		options: [
			{
				displayName: 'Return Raw Wei',
				name: 'returnRawWei',
				type: 'boolean',
				default: false,
				description: 'Whether to return the raw value in wei instead of formatted',
			},
			{
				displayName: 'Decimal Places',
				name: 'decimals',
				type: 'number',
				default: 4,
				description: 'Number of decimal places for formatted output',
			},
		],
	},
];

/**
 * Execute account operations
 */
export async function executeAccountOperation(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;
	const credentials = await this.getCredentials('flareNetworkApi');

	const connection = await createFlareConnection({
		network: credentials.network as string,
		rpcUrl: credentials.rpcUrl as string,
		privateKey: credentials.privateKey as string | undefined,
		chainId: credentials.chainId as number | undefined,
	});

	let result: IDataObject;

	switch (operation) {
		case 'getBalance': {
			const address = this.getNodeParameter('address', index) as string;
			const formatOptions = this.getNodeParameter('formatOptions', index, {}) as {
				returnRawWei?: boolean;
				decimals?: number;
			};

			const balance = await getNativeBalance(connection, address);

			result = {
				address,
				balanceWei: balance.toString(),
				balance: formatOptions.returnRawWei
					? balance.toString()
					: weiToEther(balance),
				symbol: connection.network.nativeCurrency.symbol,
				network: connection.network.name,
			};
			break;
		}

		case 'getWrappedBalance': {
			const address = this.getNodeParameter('address', index) as string;
			const formatOptions = this.getNodeParameter('formatOptions', index, {}) as {
				returnRawWei?: boolean;
				decimals?: number;
			};

			const wNat = getWNatContract(connection);
			const balance = await wNat.balanceOf(address);

			const symbol = connection.network.chainId === 14 ? 'WFLR' : 'WSGB';

			result = {
				address,
				balanceWei: balance.toString(),
				balance: formatOptions.returnRawWei
					? balance.toString()
					: weiToEther(balance),
				symbol,
				network: connection.network.name,
			};
			break;
		}

		case 'getTokenBalance': {
			const address = this.getNodeParameter('address', index) as string;
			const tokenAddress = this.getNodeParameter('tokenAddress', index) as string;

			const tokenAbi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)', 'function symbol() view returns (string)', 'function name() view returns (string)'];

			const token = new ethers.Contract(tokenAddress, tokenAbi, connection.provider);

			const [balance, decimals, symbol, name] = await Promise.all([
				token.balanceOf(address),
				token.decimals(),
				token.symbol(),
				token.name(),
			]);

			result = {
				address,
				tokenAddress,
				balanceRaw: balance.toString(),
				balance: ethers.formatUnits(balance, Number(decimals)),
				decimals: Number(decimals),
				symbol,
				name,
			};
			break;
		}

		case 'getAllTokenBalances': {
			const address = this.getNodeParameter('address', index) as string;

			const explorerCreds = {
				network: credentials.network as string,
				apiKey: (credentials as Record<string, unknown>).explorerApiKey as string | undefined,
			};

			const balances = await getTokenBalances(explorerCreds, address);

			result = {
				address,
				tokenCount: balances.length,
				tokens: balances.map(token => ({
					contractAddress: token.contractAddress,
					name: token.tokenName,
					symbol: token.tokenSymbol,
					decimals: token.tokenDecimals,
					balanceRaw: token.balance,
					balance: ethers.formatUnits(BigInt(token.balance), token.tokenDecimals),
				})),
			};
			break;
		}

		case 'getTransactionHistory': {
			const address = this.getNodeParameter('address', index) as string;
			const options = this.getNodeParameter('options', index, {}) as {
				page?: number;
				limit?: number;
				sort?: 'asc' | 'desc';
			};

			const explorerCreds = {
				network: credentials.network as string,
				apiKey: (credentials as Record<string, unknown>).explorerApiKey as string | undefined,
			};

			const transactions = await getTransactionHistory(explorerCreds, address, {
				page: options.page,
				offset: options.limit,
				sort: options.sort,
			});

			result = {
				address,
				transactionCount: transactions.length,
				transactions: transactions.map(tx => ({
					...tx,
					valueFormatted: weiToEther(BigInt(tx.value)),
					timestamp: new Date(tx.timestamp * 1000).toISOString(),
				})),
			};
			break;
		}

		case 'getTokenTransfers': {
			const address = this.getNodeParameter('address', index) as string;
			const options = this.getNodeParameter('options', index, {}) as {
				page?: number;
				limit?: number;
				sort?: 'asc' | 'desc';
			};

			const explorerCreds = {
				network: credentials.network as string,
				apiKey: (credentials as Record<string, unknown>).explorerApiKey as string | undefined,
			};

			const transfers = await getTokenTransfers(explorerCreds, address, {
				page: options.page,
				offset: options.limit,
				sort: options.sort,
			});

			result = {
				address,
				transferCount: transfers.length,
				transfers: transfers.map(tx => ({
					...tx,
					valueFormatted: ethers.formatUnits(BigInt(tx.value), tx.tokenDecimals),
					timestamp: new Date(tx.timestamp * 1000).toISOString(),
				})),
			};
			break;
		}

		case 'getNFTHoldings': {
			const address = this.getNodeParameter('address', index) as string;
			const options = this.getNodeParameter('options', index, {}) as {
				page?: number;
				limit?: number;
			};

			const explorerCreds = {
				network: credentials.network as string,
				apiKey: (credentials as Record<string, unknown>).explorerApiKey as string | undefined,
			};

			const transfers = await getNFTTransfers(explorerCreds, address, {
				page: options.page,
				offset: options.limit,
			});

			// Filter to only NFTs currently owned (received but not sent)
			const owned = new Map<string, typeof transfers[0]>();
			for (const tx of transfers) {
				const key = `${tx.contractAddress}-${tx.tokenId}`;
				if (tx.to.toLowerCase() === address.toLowerCase()) {
					owned.set(key, tx);
				} else if (tx.from.toLowerCase() === address.toLowerCase()) {
					owned.delete(key);
				}
			}

			result = {
				address,
				nftCount: owned.size,
				nfts: Array.from(owned.values()).map(nft => ({
					contractAddress: nft.contractAddress,
					tokenId: nft.tokenId,
					tokenName: nft.tokenName,
					tokenSymbol: nft.tokenSymbol,
				})),
			};
			break;
		}

		case 'getTransactionCount': {
			const address = this.getNodeParameter('address', index) as string;

			const nonce = await connection.provider.getTransactionCount(address);

			result = {
				address,
				transactionCount: nonce,
				nonce,
			};
			break;
		}

		case 'validateAddress': {
			const address = this.getNodeParameter('address', index) as string;

			const isValid = ethers.isAddress(address);
			const checksumAddress = isValid ? ethers.getAddress(address) : null;

			result = {
				address,
				isValid,
				checksumAddress,
				isChecksumValid: isValid && address === checksumAddress,
			};
			break;
		}

		case 'getDelegationInfo': {
			const address = this.getNodeParameter('address', index) as string;

			const wNat = getWNatContract(connection);
			const [delegates, percentages] = await wNat.delegatesOf(address);

			const delegations = [];
			for (let i = 0; i < delegates.length; i++) {
				delegations.push({
					provider: delegates[i],
					percentage: Number(percentages[i]) / 100, // Convert from bips to percent
					bips: Number(percentages[i]),
				});
			}

			result = {
				address,
				delegationCount: delegations.length,
				delegations,
			};
			break;
		}

		case 'getClaimableRewards': {
			const address = this.getNodeParameter('address', index) as string;

			// Get reward info from FtsoRewardManager
			const rewardManager = new ethers.Contract(
				connection.contracts.FtsoRewardManager,
				['function getEpochsWithClaimableRewards(address) view returns (uint256[])'],
				connection.provider
			);

			const claimableEpochs = await rewardManager.getEpochsWithClaimableRewards(address);

			result = {
				address,
				claimableEpochCount: claimableEpochs.length,
				claimableEpochs: claimableEpochs.map((e: bigint) => Number(e)),
				message: claimableEpochs.length === 0 ? 'No claimable rewards' : `${claimableEpochs.length} epochs with claimable rewards`,
			};
			break;
		}

		case 'getVotePower': {
			const address = this.getNodeParameter('address', index) as string;
			const blockNumber = this.getNodeParameter('blockNumber', index, 0) as number;

			const wNat = getWNatContract(connection);
			let votePower: bigint;

			if (blockNumber && blockNumber > 0) {
				votePower = await wNat.votePowerOfAt(address, blockNumber);
			} else {
				votePower = await wNat.votePowerOf(address);
			}

			result = {
				address,
				blockNumber: blockNumber || 'current',
				votePowerWei: votePower.toString(),
				votePower: weiToEther(votePower),
			};
			break;
		}

		default:
			throw new Error(`Unknown operation: ${operation}`);
	}

	return [{ json: result }];
}
