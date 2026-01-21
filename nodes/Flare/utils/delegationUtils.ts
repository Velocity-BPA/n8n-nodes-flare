/**
 * Delegation Utilities
 *
 * Delegation on Flare allows token holders to delegate their vote power
 * to FTSO data providers. In return, delegators earn a share of the
 * rewards that providers receive for accurate price submissions.
 *
 * Key concepts:
 * - Multi-delegation: Up to 2 providers can be delegated to
 * - Percentage-based: Delegation is specified in basis points (100 = 1%)
 * - Reward sharing: Providers take a fee, rest goes to delegators
 */

import { ethers, Contract } from 'ethers';

export interface ProviderInfo {
	/** Provider address */
	address: string;
	/** Provider name (if available) */
	name?: string;
	/** Current fee percentage in basis points */
	feePercentageBips: number;
	/** Total vote power delegated to this provider */
	totalVotePower: bigint;
	/** Provider's success rate (if available) */
	successRate?: number;
	/** Whether the provider is whitelisted */
	isWhitelisted: boolean;
	/** Provider's reward rate (rewards per vote power) */
	rewardRate?: number;
}

export interface DelegationRecommendation {
	provider: ProviderInfo;
	reason: string;
	expectedApr: number;
}

/**
 * Maximum number of providers that can be delegated to simultaneously
 */
export const MAX_DELEGATION_PROVIDERS = 2;

/**
 * Maximum delegation percentage in basis points
 */
export const MAX_DELEGATION_BIPS = 10000; // 100%

/**
 * Create delegation transaction data
 */
export function createDelegationData(
	providerAddress: string,
	percentageBips: number,
): string {
	const iface = new ethers.Interface([
		'function delegate(address to, uint256 bips)',
	]);
	return iface.encodeFunctionData('delegate', [providerAddress, percentageBips]);
}

/**
 * Create undelegate all transaction data
 */
export function createUndelegateAllData(): string {
	const iface = new ethers.Interface(['function undelegateAll()']);
	return iface.encodeFunctionData('undelegateAll', []);
}

/**
 * Create explicit undelegation transaction data
 */
export function createExplicitUndelegateData(providerAddresses: string[]): string {
	const iface = new ethers.Interface([
		'function undelegateAllExplicit(address[] delegateAddresses)',
	]);
	return iface.encodeFunctionData('undelegateAllExplicit', [providerAddresses]);
}

/**
 * Create revoke delegation at block transaction data
 */
export function createRevokeDelegationData(
	providerAddress: string,
	blockNumber: number,
): string {
	const iface = new ethers.Interface([
		'function revokeDelegationAt(address who, uint256 blockNumber)',
	]);
	return iface.encodeFunctionData('revokeDelegationAt', [providerAddress, blockNumber]);
}

/**
 * Validate delegation parameters
 */
export function validateDelegation(
	providerAddress: string,
	percentageBips: number,
	currentDelegations: { bips: number }[],
): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	// Check address format
	if (!ethers.isAddress(providerAddress)) {
		errors.push('Invalid provider address format');
	}

	// Check for zero address
	if (providerAddress === ethers.ZeroAddress) {
		errors.push('Cannot delegate to zero address');
	}

	// Check percentage is valid
	if (percentageBips < 0 || percentageBips > MAX_DELEGATION_BIPS) {
		errors.push(`Delegation percentage must be between 0 and ${MAX_DELEGATION_BIPS} bips (100%)`);
	}

	// Check total delegations don't exceed 100%
	const currentTotalBips = currentDelegations.reduce((sum, d) => sum + d.bips, 0);
	if (currentTotalBips + percentageBips > MAX_DELEGATION_BIPS) {
		const remaining = MAX_DELEGATION_BIPS - currentTotalBips;
		errors.push(
			`Total delegation would exceed 100%. Current: ${currentTotalBips / 100}%, Remaining available: ${remaining / 100}%`,
		);
	}

	// Check max providers
	if (currentDelegations.length >= MAX_DELEGATION_PROVIDERS) {
		errors.push(`Maximum of ${MAX_DELEGATION_PROVIDERS} delegation providers reached`);
	}

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Calculate optimal delegation split between providers
 * Based on provider performance and fees
 */
export function calculateOptimalSplit(
	providers: ProviderInfo[],
	totalBips: number = MAX_DELEGATION_BIPS,
): { provider: string; bips: number }[] {
	if (providers.length === 0) return [];

	// Filter to whitelisted providers
	const whitelisted = providers.filter((p) => p.isWhitelisted);
	if (whitelisted.length === 0) return [];

	// Sort by expected reward rate (success rate / fee)
	const scored = whitelisted.map((p) => ({
		...p,
		score: (p.successRate ?? 80) * (1 - p.feePercentageBips / 10000),
	}));

	scored.sort((a, b) => b.score - a.score);

	// Take top providers up to MAX_DELEGATION_PROVIDERS
	const topProviders = scored.slice(0, MAX_DELEGATION_PROVIDERS);

	// Split evenly among top providers
	const bipsPerProvider = Math.floor(totalBips / topProviders.length);
	const remainder = totalBips % topProviders.length;

	return topProviders.map((p, index) => ({
		provider: p.address,
		bips: bipsPerProvider + (index === 0 ? remainder : 0),
	}));
}

/**
 * Calculate expected rewards from delegation
 */
export function calculateExpectedRewards(
	delegatedAmount: bigint,
	providerFeePercentageBips: number,
	epochRewardRate: number,
	epochs: number = 1,
): bigint {
	// Provider takes their fee from rewards
	const delegatorShareBips = MAX_DELEGATION_BIPS - providerFeePercentageBips;

	// Calculate base reward
	const baseReward = (delegatedAmount * BigInt(Math.floor(epochRewardRate * 1e18))) / BigInt(1e18);

	// Apply delegator share
	const delegatorReward = (baseReward * BigInt(delegatorShareBips)) / BigInt(MAX_DELEGATION_BIPS);

	// Multiply by epochs
	return delegatorReward * BigInt(epochs);
}

/**
 * Format delegation info for display
 */
export function formatDelegationInfo(delegation: {
	delegatee: string;
	bips: number;
	amountWei: bigint;
}): string {
	const percentage = delegation.bips / 100;
	const amount = ethers.formatEther(delegation.amountWei);

	return `${percentage}% to ${delegation.delegatee.slice(0, 8)}...${delegation.delegatee.slice(-6)} (${Number(amount).toFixed(2)} tokens)`;
}

/**
 * Check if a provider is a known/verified FTSO provider
 */
export async function isVerifiedProvider(
	voterWhitelisterContract: Contract,
	providerAddress: string,
): Promise<boolean> {
	try {
		// Check if provider is whitelisted for any FTSO
		// This is a simplified check - in production you'd check specific FTSOs
		const isWhitelisted = await voterWhitelisterContract.isWhitelisted(providerAddress);
		return isWhitelisted;
	} catch {
		return false;
	}
}

/**
 * Get recommended providers based on current market conditions
 */
export function getRecommendedProviders(
	providers: ProviderInfo[],
	criteria: {
		maxFeePercentage?: number;
		minSuccessRate?: number;
		minVotePower?: bigint;
	} = {},
): DelegationRecommendation[] {
	const {
		maxFeePercentage = 20, // 20% max fee
		minSuccessRate = 70, // 70% min success
		minVotePower = BigInt(0),
	} = criteria;

	return providers
		.filter((p) => {
			if (!p.isWhitelisted) return false;
			if (p.feePercentageBips > maxFeePercentage * 100) return false;
			if (p.successRate !== undefined && p.successRate < minSuccessRate) return false;
			if (p.totalVotePower < minVotePower) return false;
			return true;
		})
		.map((p) => {
			// Calculate expected APR (simplified)
			const baseFtsoApr = 5; // ~5% base APR from FTSO rewards
			const successMultiplier = (p.successRate ?? 80) / 100;
			const feeMultiplier = 1 - p.feePercentageBips / 10000;
			const expectedApr = baseFtsoApr * successMultiplier * feeMultiplier;

			return {
				provider: p,
				reason: `${p.feePercentageBips / 100}% fee, ${p.successRate ?? 'N/A'}% success rate`,
				expectedApr,
			};
		})
		.sort((a, b) => b.expectedApr - a.expectedApr);
}

export default {
	MAX_DELEGATION_PROVIDERS,
	MAX_DELEGATION_BIPS,
	createDelegationData,
	createUndelegateAllData,
	createExplicitUndelegateData,
	createRevokeDelegationData,
	validateDelegation,
	calculateOptimalSplit,
	calculateExpectedRewards,
	formatDelegationInfo,
	isVerifiedProvider,
	getRecommendedProviders,
};
