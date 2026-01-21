/**
 * FAssets Client Transport Layer
 *
 * Handles interactions with Flare's FAssets system - trustless cross-chain
 * assets that bring BTC, XRP, DOGE, etc. to Flare as native tokens.
 */

import { Contract, ethers } from 'ethers';
import type { FlareConnection } from './provider';
import { getContract } from './provider';
import { ERC20_ABI } from '../constants/abis';
import { FASSETS, FAssetInfo as FAssetConfig } from '../constants/fAssets';

export interface FAssetInfo {
	symbol: string;
	name: string;
	address: string;
	underlyingSymbol: string;
	underlyingNetwork: string;
	decimals: number;
	totalSupply: string;
	minCollateralRatioBips: number;
	typicalMintingFeeBips: number;
	typicalRedemptionFeeBips: number;
	active: boolean;
}

export interface AgentInfo {
	address: string;
	vaultAddress: string;
	collateralPool: string;
	status: string;
	availableCollateral: string;
	mintedAmount: string;
	feePercentageBips: number;
}

export interface MintingRequest {
	requestId: string;
	requester: string;
	agentVault: string;
	underlyingAmount: string;
	fAssetAmount: string;
	paymentReference: string;
	status: string;
}

export interface RedemptionRequest {
	requestId: string;
	redeemer: string;
	fAssetAmount: string;
	underlyingAmount: string;
	paymentReference: string;
	status: string;
}

export interface CollateralPool {
	address: string;
	totalCollateral: string;
	availableCollateral: string;
	tokenAddress: string;
}

/**
 * Get FAsset info from constants
 */
export function getFAssetInfo(symbol: string): FAssetConfig | undefined {
	return FASSETS[symbol];
}

/**
 * Get FAsset balance for an address
 */
export async function getFAssetBalance(
	connection: FlareConnection,
	fAssetAddress: string,
	holderAddress: string,
): Promise<string> {
	const contract = getContract(connection, fAssetAddress, ERC20_ABI);
	const balance = await contract.balanceOf(holderAddress);
	return ethers.formatEther(balance);
}

/**
 * Get all available FAssets for a network
 */
export function getAvailableFAssets(networkName: string): FAssetConfig[] {
	return Object.values(FASSETS).filter(
		(fAsset) => fAsset.active && fAsset.availableOn.includes(networkName as any)
	);
}

/**
 * Get available agents (placeholder - requires FAssets Manager integration)
 */
export async function getAvailableAgents(
	connection: FlareConnection,
	fAssetSymbol: string,
): Promise<AgentInfo[]> {
	// FAssets system is still being deployed, return empty for now
	return [];
}

/**
 * Estimate minting cost
 */
export function estimateMintingCost(
	fAssetConfig: FAssetConfig,
	underlyingAmount: string,
): { fAssetAmount: string; fee: string; total: string } {
	const amount = parseFloat(underlyingAmount);
	const feeBips = fAssetConfig.typicalMintingFeeBips;
	const feePercent = feeBips / 10000;
	const fee = amount * feePercent;
	const fAssetAmount = amount - fee;

	return {
		fAssetAmount: fAssetAmount.toFixed(8),
		fee: fee.toFixed(8),
		total: amount.toFixed(8),
	};
}

/**
 * Estimate redemption proceeds
 */
export function estimateRedemptionProceeds(
	fAssetConfig: FAssetConfig,
	fAssetAmount: string,
): { underlyingAmount: string; fee: string; net: string } {
	const amount = parseFloat(fAssetAmount);
	const feeBips = fAssetConfig.typicalRedemptionFeeBips;
	const feePercent = feeBips / 10000;
	const fee = amount * feePercent;
	const underlyingAmount = amount - fee;

	return {
		underlyingAmount: underlyingAmount.toFixed(8),
		fee: fee.toFixed(8),
		net: underlyingAmount.toFixed(8),
	};
}

/**
 * Get collateral requirements for an FAsset
 */
export function getCollateralRequirements(config: FAssetConfig): {
	minRatioBips: number;
	minRatioPercent: number;
} {
	return {
		minRatioBips: config.minCollateralRatioBips,
		minRatioPercent: config.minCollateralRatioBips / 100,
	};
}

/**
 * Generate payment reference for minting
 */
export function generatePaymentReference(
	requesterAddress: string,
	nonce: number,
): string {
	const hash = ethers.keccak256(
		ethers.solidityPacked(['address', 'uint256'], [requesterAddress, nonce])
	);
	return hash.slice(0, 66); // 32 bytes
}

/**
 * Get FAsset total supply
 */
export async function getFAssetTotalSupply(
	connection: FlareConnection,
	fAssetAddress: string,
): Promise<string> {
	const contract = getContract(connection, fAssetAddress, ERC20_ABI);
	const totalSupply = await contract.totalSupply();
	return ethers.formatEther(totalSupply);
}

/**
 * Get collateral pools (placeholder)
 */
export async function getCollateralPools(
	connection: FlareConnection,
	fAssetSymbol: string,
): Promise<CollateralPool[]> {
	return [];
}

/**
 * Calculate collateral needed for minting
 */
export function calculateCollateralNeeded(
	fAssetConfig: FAssetConfig,
	mintAmount: string,
	collateralPrice: number,
	fAssetPrice: number,
): string {
	const mintValue = parseFloat(mintAmount) * fAssetPrice;
	const minRatio = fAssetConfig.minCollateralRatioBips / 10000;
	const collateralNeeded = (mintValue * minRatio) / collateralPrice;
	return collateralNeeded.toFixed(8);
}

/**
 * Check if agent has capacity
 */
export function hasCapacity(agent: AgentInfo, requiredAmount: string): boolean {
	return parseFloat(agent.availableCollateral) >= parseFloat(requiredAmount);
}

/**
 * Get underlying network info
 */
export function getUnderlyingNetworkInfo(symbol: string): {
	network: string;
	confirmations: number;
	avgBlockTime: number;
} | null {
	const networkInfo: Record<string, { network: string; confirmations: number; avgBlockTime: number }> = {
		BTC: { network: 'Bitcoin', confirmations: 6, avgBlockTime: 600 },
		XRP: { network: 'XRPL', confirmations: 1, avgBlockTime: 4 },
		DOGE: { network: 'Dogecoin', confirmations: 40, avgBlockTime: 60 },
		LTC: { network: 'Litecoin', confirmations: 12, avgBlockTime: 150 },
		XLM: { network: 'Stellar', confirmations: 1, avgBlockTime: 5 },
	};
	return networkInfo[symbol] || null;
}

/**
 * Validate underlying address format
 */
export function validateUnderlyingAddress(
	symbol: string,
	address: string,
): boolean {
	switch (symbol) {
		case 'BTC':
			// Basic Bitcoin address validation
			return /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
		case 'XRP':
			// Basic XRP address validation
			return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address);
		case 'DOGE':
			// Basic Dogecoin address validation
			return /^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$/.test(address);
		case 'LTC':
			// Basic Litecoin address validation
			return /^(L|M|ltc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
		case 'XLM':
			// Basic Stellar address validation
			return /^G[A-Z2-7]{55}$/.test(address);
		default:
			return false;
	}
}

export default {
	getFAssetInfo,
	getFAssetBalance,
	getAvailableFAssets,
	getAvailableAgents,
	estimateMintingCost,
	estimateRedemptionProceeds,
	getCollateralRequirements,
	generatePaymentReference,
	getFAssetTotalSupply,
	getCollateralPools,
	calculateCollateralNeeded,
	hasCapacity,
	getUnderlyingNetworkInfo,
	validateUnderlyingAddress,
};
