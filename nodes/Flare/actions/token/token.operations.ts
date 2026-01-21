/**
 * ERC-20 Token Resource Operations
 *
 * Handles standard ERC-20 token operations on Flare/Songbird networks.
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { ethers } from 'ethers';
import { createFlareConnection, getContract } from '../../transport/provider';
import { ERC20_ABI } from '../../constants/abis';
import { formatTokenAmount, parseTokenAmount } from '../../utils/unitConverter';
import { NETWORK_TOKENS, getNetworkTokens } from '../../constants/tokens';

export const tokenOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['token'],
			},
		},
		options: [
			{
				name: 'Get Token Info',
				value: 'getTokenInfo',
				description: 'Get ERC-20 token information',
				action: 'Get token info',
			},
			{
				name: 'Get Token Balance',
				value: 'getBalance',
				description: 'Get token balance for an address',
				action: 'Get token balance',
			},
			{
				name: 'Get Multiple Balances',
				value: 'getMultipleBalances',
				description: 'Get balances for multiple tokens',
				action: 'Get multiple balances',
			},
			{
				name: 'Transfer Token',
				value: 'transfer',
				description: 'Transfer tokens to an address',
				action: 'Transfer token',
			},
			{
				name: 'Approve Spending',
				value: 'approve',
				description: 'Approve spender to use tokens',
				action: 'Approve spending',
			},
			{
				name: 'Get Allowance',
				value: 'getAllowance',
				description: 'Get approved spending amount',
				action: 'Get allowance',
			},
			{
				name: 'Transfer From',
				value: 'transferFrom',
				description: 'Transfer tokens on behalf of owner',
				action: 'Transfer from',
			},
			{
				name: 'Get Total Supply',
				value: 'getTotalSupply',
				description: 'Get total token supply',
				action: 'Get total supply',
			},
		],
		default: 'getTokenInfo',
	},
];

export const tokenFields: INodeProperties[] = [
	// Token address
	{
		displayName: 'Token Address',
		name: 'tokenAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'ERC-20 token contract address',
		displayOptions: {
			show: {
				resource: ['token'],
				operation: ['getTokenInfo', 'getBalance', 'transfer', 'approve', 'getAllowance', 'transferFrom', 'getTotalSupply'],
			},
		},
	},
	// Address for balance queries
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
				resource: ['token'],
				operation: ['getBalance', 'getMultipleBalances'],
			},
		},
	},
	// Token addresses for multiple balances
	{
		displayName: 'Token Addresses',
		name: 'tokenAddresses',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x..., 0x...',
		description: 'Comma-separated list of token addresses',
		displayOptions: {
			show: {
				resource: ['token'],
				operation: ['getMultipleBalances'],
			},
		},
	},
	// To address for transfers
	{
		displayName: 'To Address',
		name: 'toAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Recipient address',
		displayOptions: {
			show: {
				resource: ['token'],
				operation: ['transfer', 'transferFrom'],
			},
		},
	},
	// Amount for transfers
	{
		displayName: 'Amount',
		name: 'amount',
		type: 'string',
		required: true,
		default: '',
		placeholder: '100',
		description: 'Amount to transfer or approve',
		displayOptions: {
			show: {
				resource: ['token'],
				operation: ['transfer', 'approve', 'transferFrom'],
			},
		},
	},
	// Spender for approvals
	{
		displayName: 'Spender Address',
		name: 'spenderAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Address to approve as spender',
		displayOptions: {
			show: {
				resource: ['token'],
				operation: ['approve', 'getAllowance'],
			},
		},
	},
	// Owner for allowance and transferFrom
	{
		displayName: 'Owner Address',
		name: 'ownerAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Token owner address',
		displayOptions: {
			show: {
				resource: ['token'],
				operation: ['getAllowance', 'transferFrom'],
			},
		},
	},
];

export async function executeToken(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;
	const credentials = await this.getCredentials('flareNetworkApi');
	const connection = await createFlareConnection(credentials as any);

	let result: any;

	switch (operation) {
		case 'getTokenInfo': {
			const tokenAddress = this.getNodeParameter('tokenAddress', index) as string;

			if (!ethers.isAddress(tokenAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid token address');
			}

			const token = getContract(connection, tokenAddress, ERC20_ABI);

			const [name, symbol, decimals, totalSupply] = await Promise.all([
				token.name(),
				token.symbol(),
				token.decimals(),
				token.totalSupply(),
			]);

			result = {
				address: tokenAddress,
				name,
				symbol,
				decimals: Number(decimals),
				totalSupply: formatTokenAmount(totalSupply, Number(decimals)),
				totalSupplyWei: totalSupply.toString(),
			};
			break;
		}

		case 'getBalance': {
			const tokenAddress = this.getNodeParameter('tokenAddress', index) as string;
			const address = this.getNodeParameter('address', index) as string;

			if (!ethers.isAddress(tokenAddress) || !ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const token = getContract(connection, tokenAddress, ERC20_ABI);

			const [balance, symbol, decimals] = await Promise.all([
				token.balanceOf(address),
				token.symbol(),
				token.decimals(),
			]);

			result = {
				address,
				token: tokenAddress,
				symbol,
				balance: formatTokenAmount(balance, Number(decimals)),
				balanceWei: balance.toString(),
				decimals: Number(decimals),
			};
			break;
		}

		case 'getMultipleBalances': {
			const address = this.getNodeParameter('address', index) as string;
			const tokenAddressesStr = this.getNodeParameter('tokenAddresses', index) as string;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const tokenAddresses = tokenAddressesStr.split(',').map(a => a.trim());
			const balances = [];

			for (const tokenAddress of tokenAddresses) {
				if (!ethers.isAddress(tokenAddress)) continue;

				try {
					const token = getContract(connection, tokenAddress, ERC20_ABI);
					const [balance, symbol, decimals] = await Promise.all([
						token.balanceOf(address),
						token.symbol(),
						token.decimals(),
					]);

					balances.push({
						token: tokenAddress,
						symbol,
						balance: formatTokenAmount(balance, Number(decimals)),
						balanceWei: balance.toString(),
						decimals: Number(decimals),
					});
				} catch (error) {
					balances.push({
						token: tokenAddress,
						error: 'Failed to fetch balance',
					});
				}
			}

			result = {
				address,
				balances,
			};
			break;
		}

		case 'transfer': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required');
			}

			const tokenAddress = this.getNodeParameter('tokenAddress', index) as string;
			const toAddress = this.getNodeParameter('toAddress', index) as string;
			const amount = this.getNodeParameter('amount', index) as string;

			if (!ethers.isAddress(tokenAddress) || !ethers.isAddress(toAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const token = getContract(connection, tokenAddress, ERC20_ABI);
			const decimals = await token.decimals();
			const amountWei = parseTokenAmount(amount, Number(decimals));

			const tx = await token.transfer(toAddress, amountWei);
			const receipt = await tx.wait();

			result = {
				operation: 'transfer',
				token: tokenAddress,
				to: toAddress,
				amount,
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'success' : 'failed',
			};
			break;
		}

		case 'approve': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required');
			}

			const tokenAddress = this.getNodeParameter('tokenAddress', index) as string;
			const spenderAddress = this.getNodeParameter('spenderAddress', index) as string;
			const amount = this.getNodeParameter('amount', index) as string;

			if (!ethers.isAddress(tokenAddress) || !ethers.isAddress(spenderAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const token = getContract(connection, tokenAddress, ERC20_ABI);
			const decimals = await token.decimals();
			const amountWei = parseTokenAmount(amount, Number(decimals));

			const tx = await token.approve(spenderAddress, amountWei);
			const receipt = await tx.wait();

			result = {
				operation: 'approve',
				token: tokenAddress,
				spender: spenderAddress,
				amount,
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'success' : 'failed',
			};
			break;
		}

		case 'getAllowance': {
			const tokenAddress = this.getNodeParameter('tokenAddress', index) as string;
			const ownerAddress = this.getNodeParameter('ownerAddress', index) as string;
			const spenderAddress = this.getNodeParameter('spenderAddress', index) as string;

			if (!ethers.isAddress(tokenAddress) || !ethers.isAddress(ownerAddress) || !ethers.isAddress(spenderAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const token = getContract(connection, tokenAddress, ERC20_ABI);
			const [allowance, symbol, decimals] = await Promise.all([
				token.allowance(ownerAddress, spenderAddress),
				token.symbol(),
				token.decimals(),
			]);

			result = {
				token: tokenAddress,
				symbol,
				owner: ownerAddress,
				spender: spenderAddress,
				allowance: formatTokenAmount(allowance, Number(decimals)),
				allowanceWei: allowance.toString(),
			};
			break;
		}

		case 'transferFrom': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required');
			}

			const tokenAddress = this.getNodeParameter('tokenAddress', index) as string;
			const ownerAddress = this.getNodeParameter('ownerAddress', index) as string;
			const toAddress = this.getNodeParameter('toAddress', index) as string;
			const amount = this.getNodeParameter('amount', index) as string;

			if (!ethers.isAddress(tokenAddress) || !ethers.isAddress(ownerAddress) || !ethers.isAddress(toAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const token = getContract(connection, tokenAddress, ERC20_ABI);
			const decimals = await token.decimals();
			const amountWei = parseTokenAmount(amount, Number(decimals));

			const tx = await token.transferFrom(ownerAddress, toAddress, amountWei);
			const receipt = await tx.wait();

			result = {
				operation: 'transferFrom',
				token: tokenAddress,
				from: ownerAddress,
				to: toAddress,
				amount,
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'success' : 'failed',
			};
			break;
		}

		case 'getTotalSupply': {
			const tokenAddress = this.getNodeParameter('tokenAddress', index) as string;

			if (!ethers.isAddress(tokenAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid token address');
			}

			const token = getContract(connection, tokenAddress, ERC20_ABI);
			const [totalSupply, symbol, decimals] = await Promise.all([
				token.totalSupply(),
				token.symbol(),
				token.decimals(),
			]);

			result = {
				token: tokenAddress,
				symbol,
				totalSupply: formatTokenAmount(totalSupply, Number(decimals)),
				totalSupplyWei: totalSupply.toString(),
				decimals: Number(decimals),
			};
			break;
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
	}

	return [{ json: result }];
}
