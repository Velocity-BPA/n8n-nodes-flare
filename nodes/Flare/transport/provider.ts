/**
 * Flare Provider Transport Layer
 *
 * Handles connection to Flare/Songbird networks via JSON-RPC.
 * Supports both read-only operations and signed transactions.
 */

import { ethers, JsonRpcProvider, Wallet, Contract } from 'ethers';
import type { IExecuteFunctions, ILoadOptionsFunctions, ICredentialDataDecryptedObject } from 'n8n-workflow';
import {
	FLARE_NETWORKS,
	getNetworkConfig,
	getDefaultRpcUrl,
	type FlareNetworkConfig,
} from '../constants/networks';
import { SYSTEM_CONTRACTS, type SystemContractAddresses } from '../constants/systemContracts';
import {
	WNAT_ABI,
	FTSO_REGISTRY_ABI,
	FTSO_REWARD_MANAGER_ABI,
	STATE_CONNECTOR_ABI,
	CLAIM_SETUP_MANAGER_ABI,
} from '../constants/abis';

export interface FlareConnection {
	/** JSON-RPC Provider for read operations */
	provider: JsonRpcProvider;
	/** Wallet for signed transactions (if private key provided) */
	wallet?: Wallet;
	/** Network configuration */
	network: FlareNetworkConfig;
	/** System contract addresses */
	contracts: SystemContractAddresses;
	/** Whether write operations are available */
	canWrite: boolean;
}

export interface FlareCredentials {
	network: string;
	rpcUrl?: string;
	chainId?: number;
	privateKey?: string;
	apiKey?: string;
}

/**
 * Get Flare credentials from n8n context
 */
export async function getFlareCredentials(
	context: IExecuteFunctions | ILoadOptionsFunctions,
	credentialName: string = 'flareNetwork',
): Promise<FlareCredentials> {
	const credentials = await context.getCredentials(credentialName) as ICredentialDataDecryptedObject;

	return {
		network: credentials.network as string,
		rpcUrl: credentials.rpcUrl as string | undefined,
		chainId: credentials.chainId as number | undefined,
		privateKey: credentials.privateKey as string | undefined,
		apiKey: credentials.apiKey as string | undefined,
	};
}

/**
 * Create a Flare connection from credentials
 */
export async function createFlareConnection(
	credentials: FlareCredentials,
): Promise<FlareConnection> {
	const { network, rpcUrl, chainId, privateKey, apiKey } = credentials;

	// Get network configuration
	let networkConfig: FlareNetworkConfig;

	if (network === 'custom') {
		if (!rpcUrl) {
			throw new Error('RPC URL is required for custom network');
		}
		if (!chainId) {
			throw new Error('Chain ID is required for custom network');
		}

		// Create custom network config
		networkConfig = {
			name: 'custom',
			displayName: 'Custom Network',
			chainId,
			nativeCurrency: {
				name: 'Native',
				symbol: 'NATIVE',
				decimals: 18,
			},
			wrappedToken: {
				name: 'Wrapped Native',
				symbol: 'WNATIVE',
				address: '', // Will be determined from chain
			},
			rpcUrls: [rpcUrl],
			blockExplorerUrls: [],
			explorerApiUrl: '',
			isTestnet: false,
			rewardEpochDurationSeconds: 302400,
			priceEpochDurationSeconds: 180,
		};
	} else {
		const config = getNetworkConfig(network);
		if (!config) {
			throw new Error(`Unknown network: ${network}`);
		}
		networkConfig = config;
	}

	// Determine RPC URL
	const finalRpcUrl = rpcUrl || networkConfig.rpcUrls[0];

	// Add API key to URL if provided
	let rpcUrlWithAuth = finalRpcUrl;
	if (apiKey) {
		const separator = finalRpcUrl.includes('?') ? '&' : '?';
		rpcUrlWithAuth = `${finalRpcUrl}${separator}apikey=${apiKey}`;
	}

	// Create provider
	const provider = new JsonRpcProvider(rpcUrlWithAuth, {
		chainId: networkConfig.chainId,
		name: networkConfig.name,
	});

	// Verify connection
	try {
		const networkInfo = await provider.getNetwork();
		if (Number(networkInfo.chainId) !== networkConfig.chainId) {
			throw new Error(
				`Chain ID mismatch. Expected ${networkConfig.chainId}, got ${networkInfo.chainId}`,
			);
		}
	} catch (error) {
		if (error instanceof Error && error.message.includes('Chain ID mismatch')) {
			throw error;
		}
		throw new Error(`Failed to connect to ${networkConfig.displayName}: ${error}`);
	}

	// Create wallet if private key provided
	let wallet: Wallet | undefined;
	let canWrite = false;

	if (privateKey) {
		try {
			wallet = new Wallet(privateKey, provider);
			canWrite = true;
		} catch (error) {
			throw new Error(`Invalid private key: ${error}`);
		}
	}

	// Get system contracts
	const contracts = SYSTEM_CONTRACTS[network] || SYSTEM_CONTRACTS.flare;

	return {
		provider,
		wallet,
		network: networkConfig,
		contracts,
		canWrite,
	};
}

/**
 * Get a connected contract instance
 */
export function getContract(
	connection: FlareConnection,
	address: string,
	abi: string[],
	requireWrite: boolean = false,
): Contract {
	if (requireWrite && !connection.canWrite) {
		throw new Error('Private key required for write operations');
	}

	const signer = requireWrite ? connection.wallet : connection.provider;
	return new Contract(address, abi, signer);
}

/**
 * Get the WNat (wrapped native token) contract
 */
export function getWNatContract(
	connection: FlareConnection,
	requireWrite: boolean = false,
): Contract {
	return getContract(
		connection,
		connection.contracts.WNat,
		WNAT_ABI,
		requireWrite,
	);
}

/**
 * Get the FTSO Registry contract
 */
export function getFtsoRegistryContract(connection: FlareConnection): Contract {
	return getContract(
		connection,
		connection.contracts.FtsoRegistry,
		FTSO_REGISTRY_ABI,
	);
}

/**
 * Get the FTSO Reward Manager contract
 */
export function getFtsoRewardManagerContract(
	connection: FlareConnection,
	requireWrite: boolean = false,
): Contract {
	return getContract(
		connection,
		connection.contracts.FtsoRewardManager,
		FTSO_REWARD_MANAGER_ABI,
		requireWrite,
	);
}

/**
 * Get the State Connector contract
 */
export function getStateConnectorContract(
	connection: FlareConnection,
	requireWrite: boolean = false,
): Contract {
	return getContract(
		connection,
		connection.contracts.StateConnector,
		STATE_CONNECTOR_ABI,
		requireWrite,
	);
}

/**
 * Get the Claim Setup Manager contract
 */
export function getClaimSetupManagerContract(
	connection: FlareConnection,
	requireWrite: boolean = false,
): Contract {
	return getContract(
		connection,
		connection.contracts.ClaimSetupManager,
		CLAIM_SETUP_MANAGER_ABI,
		requireWrite,
	);
}

/**
 * Get the signer address
 */
export function getSignerAddress(connection: FlareConnection): string {
	if (!connection.wallet) {
		throw new Error('No wallet connected - private key required');
	}
	return connection.wallet.address;
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(
	connection: FlareConnection,
	txHash: string,
	confirmations: number = 1,
): Promise<ethers.TransactionReceipt | null> {
	return connection.provider.waitForTransaction(txHash, confirmations);
}

/**
 * Estimate gas for a transaction
 */
export async function estimateGas(
	connection: FlareConnection,
	to: string,
	data: string,
	value?: bigint,
): Promise<bigint> {
	const tx: ethers.TransactionRequest = {
		to,
		data,
		value,
	};

	if (connection.wallet) {
		tx.from = connection.wallet.address;
	}

	return connection.provider.estimateGas(tx);
}

/**
 * Get current gas price
 */
export async function getGasPrice(connection: FlareConnection): Promise<bigint> {
	const feeData = await connection.provider.getFeeData();
	return feeData.gasPrice || BigInt(0);
}

/**
 * Get current base fee
 */
export async function getBaseFee(connection: FlareConnection): Promise<bigint> {
	const block = await connection.provider.getBlock('latest');
	return block?.baseFeePerGas || BigInt(0);
}

/**
 * Send a signed transaction
 */
export async function sendTransaction(
	connection: FlareConnection,
	to: string,
	data: string,
	value?: bigint,
	gasLimit?: bigint,
): Promise<ethers.TransactionResponse> {
	if (!connection.wallet) {
		throw new Error('Private key required to send transactions');
	}

	const tx: ethers.TransactionRequest = {
		to,
		data,
		value,
	};

	if (gasLimit) {
		tx.gasLimit = gasLimit;
	}

	return connection.wallet.sendTransaction(tx);
}

/**
 * Send native tokens
 */
export async function sendNativeTokens(
	connection: FlareConnection,
	to: string,
	amount: bigint,
): Promise<ethers.TransactionResponse> {
	if (!connection.wallet) {
		throw new Error('Private key required to send transactions');
	}

	return connection.wallet.sendTransaction({
		to,
		value: amount,
	});
}

/**
 * Get balance of native tokens
 */
export async function getNativeBalance(
	connection: FlareConnection,
	address: string,
): Promise<bigint> {
	return connection.provider.getBalance(address);
}

/**
 * Get the current block number
 */
export async function getBlockNumber(connection: FlareConnection): Promise<number> {
	return connection.provider.getBlockNumber();
}

/**
 * Get a block by number or hash
 */
export async function getBlock(
	connection: FlareConnection,
	blockHashOrNumber: string | number,
): Promise<ethers.Block | null> {
	return connection.provider.getBlock(blockHashOrNumber);
}

/**
 * Get transaction by hash
 */
export async function getTransaction(
	connection: FlareConnection,
	txHash: string,
): Promise<ethers.TransactionResponse | null> {
	return connection.provider.getTransaction(txHash);
}

/**
 * Get transaction receipt
 */
export async function getTransactionReceipt(
	connection: FlareConnection,
	txHash: string,
): Promise<ethers.TransactionReceipt | null> {
	return connection.provider.getTransactionReceipt(txHash);
}

/**
 * Check if an address is valid
 */
export function isValidAddress(address: string): boolean {
	return ethers.isAddress(address);
}

/**
 * Normalize address to checksum format
 */
export function normalizeAddress(address: string): string {
	return ethers.getAddress(address);
}

export default {
	getFlareCredentials,
	createFlareConnection,
	getContract,
	getWNatContract,
	getFtsoRegistryContract,
	getFtsoRewardManagerContract,
	getStateConnectorContract,
	getClaimSetupManagerContract,
	getSignerAddress,
	waitForTransaction,
	estimateGas,
	getGasPrice,
	getBaseFee,
	sendTransaction,
	sendNativeTokens,
	getNativeBalance,
	getBlockNumber,
	getBlock,
	getTransaction,
	getTransactionReceipt,
	isValidAddress,
	normalizeAddress,
};
