/**
 * FTSO Client Transport Layer
 *
 * Handles interactions with Flare Time Series Oracle (FTSO) contracts.
 * FTSO provides decentralized price feeds for various assets.
 */

import { Contract, ethers } from 'ethers';
import type { FlareConnection } from './provider';
import { getContract, getFtsoRegistryContract } from './provider';
import { FTSO_ABI, FTSO_REGISTRY_ABI } from '../constants/abis';

export interface PriceData {
	/** Price value (scaled by decimals) */
	price: bigint;
	/** Price in human-readable format */
	priceFormatted: string;
	/** Timestamp when price was finalized */
	timestamp: number;
	/** Number of decimal places */
	decimals: number;
	/** Symbol */
	symbol: string;
	/** Epoch ID */
	epochId?: number;
}

export interface PriceEpochData {
	/** Current epoch ID */
	epochId: number;
	/** Submit end time */
	submitEndTime: number;
	/** Reveal end time */
	revealEndTime: number;
	/** Vote power block */
	votePowerBlock: number;
	/** Whether in fallback mode */
	fallbackMode: boolean;
}

export interface FtsoProviderInfo {
	/** Provider address */
	address: string;
	/** Provider's vote power */
	votePower: bigint;
	/** Provider's fee percentage */
	feePercentage: number;
	/** Whether whitelisted */
	isWhitelisted: boolean;
	/** Symbols the provider submits prices for */
	symbols: string[];
}

/**
 * Get current price for a symbol
 */
export async function getCurrentPrice(
	connection: FlareConnection,
	symbol: string,
): Promise<PriceData> {
	const registry = getFtsoRegistryContract(connection);

	try {
		const [price, timestamp, decimals] = await registry.getCurrentPriceWithDecimals(symbol);

		const divisor = BigInt(10 ** Number(decimals));
		const priceFormatted = (Number(price) / Number(divisor)).toFixed(Number(decimals));

		return {
			price,
			priceFormatted,
			timestamp: Number(timestamp),
			decimals: Number(decimals),
			symbol,
		};
	} catch (error) {
		throw new Error(`Failed to get price for ${symbol}: ${error}`);
	}
}

/**
 * Get current prices for multiple symbols
 */
export async function getCurrentPrices(
	connection: FlareConnection,
	symbols: string[],
): Promise<PriceData[]> {
	const registry = getFtsoRegistryContract(connection);

	// Get indices for symbols
	const indices: number[] = [];
	for (const symbol of symbols) {
		try {
			const index = await registry.getFtsoIndex(symbol);
			indices.push(Number(index));
		} catch {
			// Symbol not found, skip
		}
	}

	if (indices.length === 0) {
		return [];
	}

	const [prices, timestamps, decimalsArr] = await registry.getCurrentPricesByIndices(indices);

	return symbols.map((symbol, i) => {
		const decimals = Number(decimalsArr[i]);
		const divisor = BigInt(10 ** decimals);
		const priceFormatted = (Number(prices[i]) / Number(divisor)).toFixed(decimals);

		return {
			price: prices[i],
			priceFormatted,
			timestamp: Number(timestamps[i]),
			decimals,
			symbol,
		};
	});
}

/**
 * Get all current prices
 */
export async function getAllCurrentPrices(
	connection: FlareConnection,
): Promise<PriceData[]> {
	const registry = getFtsoRegistryContract(connection);

	const [prices, timestamps, decimalsArr, symbols] = await registry.getAllCurrentPrices();

	return symbols.map((symbol: string, i: number) => {
		const decimals = Number(decimalsArr[i]);
		const divisor = BigInt(10 ** decimals);
		const priceFormatted = (Number(prices[i]) / Number(divisor)).toFixed(decimals);

		return {
			price: prices[i],
			priceFormatted,
			timestamp: Number(timestamps[i]),
			decimals,
			symbol,
		};
	});
}

/**
 * Get supported symbols
 */
export async function getSupportedSymbols(
	connection: FlareConnection,
): Promise<string[]> {
	const registry = getFtsoRegistryContract(connection);
	return registry.getSupportedSymbols();
}

/**
 * Get FTSO contract address for a symbol
 */
export async function getFtsoAddress(
	connection: FlareConnection,
	symbol: string,
): Promise<string> {
	const registry = getFtsoRegistryContract(connection);
	return registry.getFtsoBySymbol(symbol);
}

/**
 * Get FTSO contract for a symbol
 */
export async function getFtsoContract(
	connection: FlareConnection,
	symbol: string,
): Promise<Contract> {
	const address = await getFtsoAddress(connection, symbol);
	return getContract(connection, address, FTSO_ABI);
}

/**
 * Get price epoch data for a symbol
 */
export async function getPriceEpochData(
	connection: FlareConnection,
	symbol: string,
): Promise<PriceEpochData> {
	const ftso = await getFtsoContract(connection, symbol);

	const [epochId, submitEndTime, revealEndTime, votePowerBlock, fallbackMode] =
		await ftso.getPriceEpochData();

	return {
		epochId: Number(epochId),
		submitEndTime: Number(submitEndTime),
		revealEndTime: Number(revealEndTime),
		votePowerBlock: Number(votePowerBlock),
		fallbackMode,
	};
}

/**
 * Get current epoch ID for a symbol
 */
export async function getCurrentEpochId(
	connection: FlareConnection,
	symbol: string,
): Promise<number> {
	const ftso = await getFtsoContract(connection, symbol);
	return Number(await ftso.getCurrentEpochId());
}

/**
 * Get historical price for a specific epoch
 */
export async function getEpochPrice(
	connection: FlareConnection,
	symbol: string,
	epochId: number,
): Promise<bigint> {
	const ftso = await getFtsoContract(connection, symbol);
	return ftso.getEpochPrice(epochId);
}

/**
 * Get price details with finalization info
 */
export async function getPriceDetails(
	connection: FlareConnection,
	symbol: string,
): Promise<{
	price: bigint;
	timestamp: number;
	finalizationType: number;
	lastEpochFinalizationTimestamp: number;
	lastEpochFinalizationType: number;
}> {
	const ftso = await getFtsoContract(connection, symbol);

	const [price, timestamp, finalizationType, lastTimestamp, lastType] =
		await ftso.getCurrentPriceDetails();

	return {
		price,
		timestamp: Number(timestamp),
		finalizationType: Number(finalizationType),
		lastEpochFinalizationTimestamp: Number(lastTimestamp),
		lastEpochFinalizationType: Number(lastType),
	};
}

/**
 * Get price epoch configuration
 */
export async function getPriceEpochConfiguration(
	connection: FlareConnection,
	symbol: string,
): Promise<{
	firstEpochStartTimestamp: number;
	submitPeriodSeconds: number;
	revealPeriodSeconds: number;
}> {
	const ftso = await getFtsoContract(connection, symbol);

	const [firstEpoch, submitPeriod, revealPeriod] =
		await ftso.getPriceEpochConfiguration();

	return {
		firstEpochStartTimestamp: Number(firstEpoch),
		submitPeriodSeconds: Number(submitPeriod),
		revealPeriodSeconds: Number(revealPeriod),
	};
}

/**
 * Get vote power block for an epoch
 */
export async function getVotePowerBlock(
	connection: FlareConnection,
	symbol: string,
	epochId: number,
): Promise<number> {
	const ftso = await getFtsoContract(connection, symbol);
	return Number(await ftso.getVotePowerBlock(epochId));
}

/**
 * Calculate time until next price finalization
 */
export async function getTimeUntilFinalization(
	connection: FlareConnection,
	symbol: string,
): Promise<number> {
	const epochData = await getPriceEpochData(connection, symbol);
	const now = Math.floor(Date.now() / 1000);

	// Time until reveal ends (when price is finalized)
	return Math.max(0, epochData.revealEndTime - now);
}

/**
 * Check if symbol is supported
 */
export async function isSymbolSupported(
	connection: FlareConnection,
	symbol: string,
): Promise<boolean> {
	try {
		const registry = getFtsoRegistryContract(connection);
		await registry.getFtsoBySymbol(symbol);
		return true;
	} catch {
		return false;
	}
}

/**
 * Get all FTSO addresses
 */
export async function getAllFtsoAddresses(
	connection: FlareConnection,
): Promise<string[]> {
	const registry = getFtsoRegistryContract(connection);
	return registry.getSupportedFtsos();
}

/**
 * Format price for display
 */
export function formatPrice(
	price: bigint,
	decimals: number,
	displayDecimals: number = 4,
): string {
	const divisor = BigInt(10 ** decimals);
	const value = Number(price) / Number(divisor);
	return value.toFixed(displayDecimals);
}

/**
 * Convert price to USD value
 */
export function calculateUsdValue(
	amount: bigint,
	amountDecimals: number,
	price: bigint,
	priceDecimals: number,
): string {
	const amountValue = Number(amount) / 10 ** amountDecimals;
	const priceValue = Number(price) / 10 ** priceDecimals;
	return (amountValue * priceValue).toFixed(2);
}

export default {
	getCurrentPrice,
	getCurrentPrices,
	getAllCurrentPrices,
	getSupportedSymbols,
	getFtsoAddress,
	getFtsoContract,
	getPriceEpochData,
	getCurrentEpochId,
	getEpochPrice,
	getPriceDetails,
	getPriceEpochConfiguration,
	getVotePowerBlock,
	getTimeUntilFinalization,
	isSymbolSupported,
	getAllFtsoAddresses,
	formatPrice,
	calculateUsdValue,
};
