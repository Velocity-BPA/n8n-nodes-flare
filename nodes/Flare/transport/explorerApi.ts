/**
 * Block Explorer API Client
 *
 * Handles interactions with Flare and Songbird block explorers
 * for transaction history, token transfers, and account data.
 */

import axios, { AxiosInstance } from 'axios';

export interface ExplorerCredentials {
	apiKey?: string;
	network: string;
	customUrl?: string;
}

export interface TransactionInfo {
	hash: string;
	blockNumber: number;
	timestamp: number;
	from: string;
	to: string;
	value: string;
	gasUsed: string;
	gasPrice: string;
	status: boolean;
	input: string;
	nonce: number;
	methodId?: string;
	functionName?: string;
}

export interface TokenTransfer {
	hash: string;
	blockNumber: number;
	timestamp: number;
	from: string;
	to: string;
	contractAddress: string;
	tokenName: string;
	tokenSymbol: string;
	tokenDecimals: number;
	value: string;
	tokenId?: string; // For NFTs
}

export interface TokenBalance {
	contractAddress: string;
	tokenName: string;
	tokenSymbol: string;
	tokenDecimals: number;
	balance: string;
}

export interface NFTHolding {
	contractAddress: string;
	tokenId: string;
	tokenName: string;
	tokenSymbol: string;
	tokenUri?: string;
	metadata?: Record<string, unknown>;
}

export interface ContractInfo {
	address: string;
	name?: string;
	symbol?: string;
	decimals?: number;
	isContract: boolean;
	isVerified: boolean;
	contractType?: string;
	abi?: string;
}

export interface InternalTransaction {
	hash: string;
	blockNumber: number;
	timestamp: number;
	from: string;
	to: string;
	value: string;
	type: string;
	input: string;
	isError: boolean;
	errCode?: string;
}

/**
 * Explorer API URLs by network
 */
const EXPLORER_URLS: Record<string, string> = {
	flare: 'https://flare-explorer.flare.network/api',
	songbird: 'https://songbird-explorer.flare.network/api',
	coston2: 'https://coston2-explorer.flare.network/api',
	coston: 'https://coston-explorer.flare.network/api',
};

/**
 * Create explorer API client
 */
export function createExplorerClient(credentials: ExplorerCredentials): AxiosInstance {
	const baseURL = credentials.customUrl || EXPLORER_URLS[credentials.network] || EXPLORER_URLS.flare;

	const client = axios.create({
		baseURL,
		params: credentials.apiKey ? { apikey: credentials.apiKey } : {},
	});

	return client;
}

/**
 * Get transaction history for an address
 */
export async function getTransactionHistory(
	credentials: ExplorerCredentials,
	address: string,
	options: {
		page?: number;
		offset?: number;
		sort?: 'asc' | 'desc';
		startBlock?: number;
		endBlock?: number;
	} = {},
): Promise<TransactionInfo[]> {
	const client = createExplorerClient(credentials);

	const params = {
		module: 'account',
		action: 'txlist',
		address,
		page: options.page || 1,
		offset: options.offset || 25,
		sort: options.sort || 'desc',
		startblock: options.startBlock || 0,
		endblock: options.endBlock || 99999999,
	};

	const response = await client.get('', { params });

	if (response.data.status !== '1') {
		if (response.data.message === 'No transactions found') {
			return [];
		}
		throw new Error(response.data.message || 'Failed to get transactions');
	}

	return response.data.result.map((tx: Record<string, string>) => ({
		hash: tx.hash,
		blockNumber: parseInt(tx.blockNumber, 10),
		timestamp: parseInt(tx.timeStamp, 10),
		from: tx.from,
		to: tx.to,
		value: tx.value,
		gasUsed: tx.gasUsed,
		gasPrice: tx.gasPrice,
		status: tx.isError === '0',
		input: tx.input,
		nonce: parseInt(tx.nonce, 10),
		methodId: tx.methodId,
		functionName: tx.functionName,
	}));
}

/**
 * Get ERC-20 token transfers for an address
 */
export async function getTokenTransfers(
	credentials: ExplorerCredentials,
	address: string,
	options: {
		contractAddress?: string;
		page?: number;
		offset?: number;
		sort?: 'asc' | 'desc';
	} = {},
): Promise<TokenTransfer[]> {
	const client = createExplorerClient(credentials);

	const params: Record<string, unknown> = {
		module: 'account',
		action: 'tokentx',
		address,
		page: options.page || 1,
		offset: options.offset || 25,
		sort: options.sort || 'desc',
	};

	if (options.contractAddress) {
		params.contractaddress = options.contractAddress;
	}

	const response = await client.get('', { params });

	if (response.data.status !== '1') {
		if (response.data.message === 'No token transfers found') {
			return [];
		}
		throw new Error(response.data.message || 'Failed to get token transfers');
	}

	return response.data.result.map((tx: Record<string, string>) => ({
		hash: tx.hash,
		blockNumber: parseInt(tx.blockNumber, 10),
		timestamp: parseInt(tx.timeStamp, 10),
		from: tx.from,
		to: tx.to,
		contractAddress: tx.contractAddress,
		tokenName: tx.tokenName,
		tokenSymbol: tx.tokenSymbol,
		tokenDecimals: parseInt(tx.tokenDecimal, 10),
		value: tx.value,
	}));
}

/**
 * Get NFT transfers for an address
 */
export async function getNFTTransfers(
	credentials: ExplorerCredentials,
	address: string,
	options: {
		contractAddress?: string;
		page?: number;
		offset?: number;
	} = {},
): Promise<TokenTransfer[]> {
	const client = createExplorerClient(credentials);

	const params: Record<string, unknown> = {
		module: 'account',
		action: 'tokennfttx',
		address,
		page: options.page || 1,
		offset: options.offset || 25,
	};

	if (options.contractAddress) {
		params.contractaddress = options.contractAddress;
	}

	const response = await client.get('', { params });

	if (response.data.status !== '1') {
		if (response.data.message === 'No NFT transfers found') {
			return [];
		}
		throw new Error(response.data.message || 'Failed to get NFT transfers');
	}

	return response.data.result.map((tx: Record<string, string>) => ({
		hash: tx.hash,
		blockNumber: parseInt(tx.blockNumber, 10),
		timestamp: parseInt(tx.timeStamp, 10),
		from: tx.from,
		to: tx.to,
		contractAddress: tx.contractAddress,
		tokenName: tx.tokenName,
		tokenSymbol: tx.tokenSymbol,
		tokenDecimals: 0,
		value: '1',
		tokenId: tx.tokenID,
	}));
}

/**
 * Get all token balances for an address
 */
export async function getTokenBalances(
	credentials: ExplorerCredentials,
	address: string,
): Promise<TokenBalance[]> {
	const client = createExplorerClient(credentials);

	const params = {
		module: 'account',
		action: 'tokenlist',
		address,
	};

	const response = await client.get('', { params });

	if (response.data.status !== '1') {
		if (response.data.message === 'No tokens found') {
			return [];
		}
		throw new Error(response.data.message || 'Failed to get token balances');
	}

	return response.data.result.map((token: Record<string, string>) => ({
		contractAddress: token.contractAddress,
		tokenName: token.name,
		tokenSymbol: token.symbol,
		tokenDecimals: parseInt(token.decimals, 10),
		balance: token.balance,
	}));
}

/**
 * Get internal transactions for an address
 */
export async function getInternalTransactions(
	credentials: ExplorerCredentials,
	address: string,
	options: {
		page?: number;
		offset?: number;
		sort?: 'asc' | 'desc';
	} = {},
): Promise<InternalTransaction[]> {
	const client = createExplorerClient(credentials);

	const params = {
		module: 'account',
		action: 'txlistinternal',
		address,
		page: options.page || 1,
		offset: options.offset || 25,
		sort: options.sort || 'desc',
	};

	const response = await client.get('', { params });

	if (response.data.status !== '1') {
		if (response.data.message === 'No internal transactions found') {
			return [];
		}
		throw new Error(response.data.message || 'Failed to get internal transactions');
	}

	return response.data.result.map((tx: Record<string, string>) => ({
		hash: tx.hash,
		blockNumber: parseInt(tx.blockNumber, 10),
		timestamp: parseInt(tx.timeStamp, 10),
		from: tx.from,
		to: tx.to,
		value: tx.value,
		type: tx.type,
		input: tx.input,
		isError: tx.isError === '1',
		errCode: tx.errCode,
	}));
}

/**
 * Get transaction by hash
 */
export async function getTransaction(
	credentials: ExplorerCredentials,
	txHash: string,
): Promise<TransactionInfo | null> {
	const client = createExplorerClient(credentials);

	const params = {
		module: 'transaction',
		action: 'gettxinfo',
		txhash: txHash,
	};

	const response = await client.get('', { params });

	if (response.data.status !== '1') {
		return null;
	}

	const tx = response.data.result;
	return {
		hash: tx.hash,
		blockNumber: parseInt(tx.blockNumber, 10),
		timestamp: parseInt(tx.timeStamp, 10),
		from: tx.from,
		to: tx.to,
		value: tx.value,
		gasUsed: tx.gasUsed,
		gasPrice: tx.gasPrice,
		status: tx.isError === '0',
		input: tx.input,
		nonce: parseInt(tx.nonce, 10),
	};
}

/**
 * Get contract info
 */
export async function getContractInfo(
	credentials: ExplorerCredentials,
	contractAddress: string,
): Promise<ContractInfo> {
	const client = createExplorerClient(credentials);

	// Get contract ABI if verified
	const abiParams = {
		module: 'contract',
		action: 'getabi',
		address: contractAddress,
	};

	let abi: string | undefined;
	let isVerified = false;

	try {
		const abiResponse = await client.get('', { params: abiParams });
		if (abiResponse.data.status === '1') {
			abi = abiResponse.data.result;
			isVerified = true;
		}
	} catch {
		// Contract not verified
	}

	// Get source code info if verified
	const sourceParams = {
		module: 'contract',
		action: 'getsourcecode',
		address: contractAddress,
	};

	let name: string | undefined;
	let contractType: string | undefined;

	try {
		const sourceResponse = await client.get('', { params: sourceParams });
		if (sourceResponse.data.status === '1' && sourceResponse.data.result[0]) {
			const source = sourceResponse.data.result[0];
			name = source.ContractName;
			contractType = source.CompilerVersion ? 'Solidity' : undefined;
		}
	} catch {
		// Source not available
	}

	return {
		address: contractAddress,
		name,
		isContract: true,
		isVerified,
		contractType,
		abi,
	};
}

/**
 * Get contract ABI
 */
export async function getContractABI(
	credentials: ExplorerCredentials,
	contractAddress: string,
): Promise<string | null> {
	const client = createExplorerClient(credentials);

	const params = {
		module: 'contract',
		action: 'getabi',
		address: contractAddress,
	};

	const response = await client.get('', { params });

	if (response.data.status !== '1') {
		return null;
	}

	return response.data.result;
}

/**
 * Get block by number
 */
export async function getBlock(
	credentials: ExplorerCredentials,
	blockNumber: number | 'latest',
): Promise<Record<string, unknown> | null> {
	const client = createExplorerClient(credentials);

	const params = {
		module: 'block',
		action: 'getblockreward',
		blockno: blockNumber,
	};

	const response = await client.get('', { params });

	if (response.data.status !== '1') {
		return null;
	}

	return response.data.result;
}

/**
 * Get block countdown to a target block
 */
export async function getBlockCountdown(
	credentials: ExplorerCredentials,
	targetBlock: number,
): Promise<{ currentBlock: number; countdownBlock: number; remainingBlocks: number; estimatedTime: number } | null> {
	const client = createExplorerClient(credentials);

	const params = {
		module: 'block',
		action: 'getblockcountdown',
		blockno: targetBlock,
	};

	const response = await client.get('', { params });

	if (response.data.status !== '1') {
		return null;
	}

	const result = response.data.result;
	return {
		currentBlock: parseInt(result.CurrentBlock, 10),
		countdownBlock: parseInt(result.CountdownBlock, 10),
		remainingBlocks: parseInt(result.RemainingBlock, 10),
		estimatedTime: parseFloat(result.EstimateTimeInSec),
	};
}

/**
 * Get native balance for address
 */
export async function getNativeBalance(
	credentials: ExplorerCredentials,
	address: string,
): Promise<string> {
	const client = createExplorerClient(credentials);

	const params = {
		module: 'account',
		action: 'balance',
		address,
	};

	const response = await client.get('', { params });

	if (response.data.status !== '1') {
		throw new Error(response.data.message || 'Failed to get balance');
	}

	return response.data.result;
}

/**
 * Get multiple native balances
 */
export async function getNativeBalances(
	credentials: ExplorerCredentials,
	addresses: string[],
): Promise<{ address: string; balance: string }[]> {
	const client = createExplorerClient(credentials);

	const params = {
		module: 'account',
		action: 'balancemulti',
		address: addresses.join(','),
	};

	const response = await client.get('', { params });

	if (response.data.status !== '1') {
		throw new Error(response.data.message || 'Failed to get balances');
	}

	return response.data.result.map((item: { account: string; balance: string }) => ({
		address: item.account,
		balance: item.balance,
	}));
}

/**
 * Get logs by address
 */
export async function getLogs(
	credentials: ExplorerCredentials,
	address: string,
	options: {
		fromBlock?: number;
		toBlock?: number;
		topic0?: string;
		topic1?: string;
		topic2?: string;
		topic3?: string;
	} = {},
): Promise<unknown[]> {
	const client = createExplorerClient(credentials);

	const params: Record<string, unknown> = {
		module: 'logs',
		action: 'getLogs',
		address,
		fromBlock: options.fromBlock || 0,
		toBlock: options.toBlock || 'latest',
	};

	if (options.topic0) params.topic0 = options.topic0;
	if (options.topic1) params.topic1 = options.topic1;
	if (options.topic2) params.topic2 = options.topic2;
	if (options.topic3) params.topic3 = options.topic3;

	const response = await client.get('', { params });

	if (response.data.status !== '1') {
		if (response.data.message === 'No logs found') {
			return [];
		}
		throw new Error(response.data.message || 'Failed to get logs');
	}

	return response.data.result;
}

export default {
	createExplorerClient,
	getTransactionHistory,
	getTokenTransfers,
	getNFTTransfers,
	getTokenBalances,
	getInternalTransactions,
	getTransaction,
	getContractInfo,
	getContractABI,
	getBlock,
	getBlockCountdown,
	getNativeBalance,
	getNativeBalances,
	getLogs,
};
