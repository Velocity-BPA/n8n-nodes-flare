/**
 * Vote Power Utilities
 *
 * Vote power on Flare is derived from wrapped tokens (WFLR/WSGB).
 * When you wrap native tokens, you receive vote power that can be:
 * - Self-delegated (default)
 * - Delegated to FTSO data providers to earn rewards
 * - Used for governance voting
 *
 * Key concepts:
 * - Vote Power: The weight of your tokens in voting/delegation
 * - Vote Power Block: A specific block used for vote power snapshots
 * - Delegation: Assigning your vote power to a data provider
 */

import { ethers } from 'ethers';
import type { Contract } from 'ethers';
import { WNAT_ABI } from '../constants/abis';

export interface VotePowerInfo {
	/** Total vote power owned */
	totalVotePower: bigint;
	/** Vote power from wrapped tokens */
	wrappedBalance: bigint;
	/** Vote power delegated to others */
	delegatedVotePower: bigint;
	/** Undelegated (self-delegated) vote power */
	undelegatedVotePower: bigint;
	/** Vote power received from others */
	receivedVotePower: bigint;
}

export interface DelegationInfo {
	/** Address delegated to */
	delegatee: string;
	/** Delegation percentage in basis points (100 = 1%) */
	bips: number;
	/** Amount delegated in wei */
	amountWei: bigint;
}

/**
 * Get comprehensive vote power info for an address
 */
export async function getVotePowerInfo(
	wnatContract: Contract,
	address: string,
): Promise<VotePowerInfo> {
	const [totalVotePowerRaw, wrappedBalanceRaw, undelegatedVotePowerRaw] = await Promise.all([
		wnatContract.votePowerOf(address),
		wnatContract.balanceOf(address),
		wnatContract.undelegatedVotePowerOf(address),
	]);

	// Ensure bigint types
	const totalVotePower = BigInt(totalVotePowerRaw.toString());
	const wrappedBalance = BigInt(wrappedBalanceRaw.toString());
	const undelegatedVotePower = BigInt(undelegatedVotePowerRaw.toString());

	const delegatedVotePower = wrappedBalance - undelegatedVotePower;
	const receivedVotePower = totalVotePower - undelegatedVotePower;

	return {
		totalVotePower,
		wrappedBalance,
		delegatedVotePower,
		undelegatedVotePower,
		receivedVotePower,
	};
}

/**
 * Get vote power at a specific block
 */
export async function getVotePowerAtBlock(
	wnatContract: Contract,
	address: string,
	blockNumber: number,
): Promise<bigint> {
	return wnatContract.votePowerOfAt(address, blockNumber);
}

/**
 * Get current delegations for an address
 */
export async function getDelegations(
	wnatContract: Contract,
	address: string,
): Promise<DelegationInfo[]> {
	const [delegates, bips] = await wnatContract.delegatesOf(address);
	const balance = await wnatContract.balanceOf(address);

	return delegates.map((delegatee: string, index: number) => ({
		delegatee,
		bips: Number(bips[index]),
		amountWei: (balance * BigInt(bips[index])) / BigInt(10000),
	}));
}

/**
 * Get delegations at a specific block
 */
export async function getDelegationsAtBlock(
	wnatContract: Contract,
	address: string,
	blockNumber: number,
): Promise<DelegationInfo[]> {
	const [delegates, bips] = await wnatContract.delegatesOfAt(address, blockNumber);

	// Note: We can't get historical balance easily, so amounts are not included
	return delegates.map((delegatee: string, index: number) => ({
		delegatee,
		bips: Number(bips[index]),
		amountWei: BigInt(0), // Historical balance not available
	}));
}

/**
 * Calculate delegation percentage from bips
 */
export function bipsToPercentage(bips: number): number {
	return bips / 100;
}

/**
 * Convert percentage to bips
 */
export function percentageToBips(percentage: number): number {
	return Math.round(percentage * 100);
}

/**
 * Validate delegation percentages
 * Total delegations cannot exceed 100% (10000 bips)
 */
export function validateDelegationPercentages(currentDelegations: DelegationInfo[], newBips: number): {
	valid: boolean;
	remainingBips: number;
	error?: string;
} {
	const totalCurrentBips = currentDelegations.reduce((sum, d) => sum + d.bips, 0);
	const totalAfterNew = totalCurrentBips + newBips;

	if (totalAfterNew > 10000) {
		return {
			valid: false,
			remainingBips: 10000 - totalCurrentBips,
			error: `Total delegation would exceed 100%. Current: ${totalCurrentBips / 100}%, New: ${newBips / 100}%, Max remaining: ${(10000 - totalCurrentBips) / 100}%`,
		};
	}

	return {
		valid: true,
		remainingBips: 10000 - totalAfterNew,
	};
}

/**
 * Calculate expected vote power after delegation
 */
export function calculateExpectedVotePower(
	wrappedBalance: bigint,
	delegationBips: number,
): bigint {
	return (wrappedBalance * BigInt(delegationBips)) / BigInt(10000);
}

/**
 * Get delegation mode for an address
 * 0 = Not set
 * 1 = Percentage delegation (default)
 * 2 = Amount delegation (explicit)
 */
export async function getDelegationMode(
	wnatContract: Contract,
	address: string,
): Promise<number> {
	return Number(await wnatContract.delegationModeOf(address));
}

/**
 * Get total network vote power
 */
export async function getTotalVotePower(wnatContract: Contract): Promise<bigint> {
	return wnatContract.totalVotePower();
}

/**
 * Get total vote power at a specific block
 */
export async function getTotalVotePowerAtBlock(
	wnatContract: Contract,
	blockNumber: number,
): Promise<bigint> {
	return wnatContract.totalVotePowerAt(blockNumber);
}

/**
 * Calculate vote power share as a percentage
 */
export function calculateVotePowerShare(
	addressVotePower: bigint,
	totalVotePower: bigint,
): number {
	if (totalVotePower === BigInt(0)) return 0;

	// Calculate with precision
	const share = (addressVotePower * BigInt(10000)) / totalVotePower;
	return Number(share) / 100;
}

/**
 * Check if delegation to an address is allowed
 * Some addresses may be blacklisted or be system contracts
 */
export function isValidDelegationTarget(address: string): {
	valid: boolean;
	error?: string;
} {
	// Check if valid address format
	if (!ethers.isAddress(address)) {
		return { valid: false, error: 'Invalid Ethereum address format' };
	}

	// Check for zero address
	if (address === ethers.ZeroAddress) {
		return { valid: false, error: 'Cannot delegate to zero address' };
	}

	return { valid: true };
}

/**
 * Format vote power for display
 */
export function formatVotePower(votePower: bigint, decimals: number = 18): string {
	const formatted = ethers.formatUnits(votePower, decimals);
	const num = parseFloat(formatted);

	if (num >= 1000000) {
		return `${(num / 1000000).toFixed(2)}M`;
	}
	if (num >= 1000) {
		return `${(num / 1000).toFixed(2)}K`;
	}
	return num.toFixed(4);
}

export default {
	getVotePowerInfo,
	getVotePowerAtBlock,
	getDelegations,
	getDelegationsAtBlock,
	bipsToPercentage,
	percentageToBips,
	validateDelegationPercentages,
	calculateExpectedVotePower,
	getDelegationMode,
	getTotalVotePower,
	getTotalVotePowerAtBlock,
	calculateVotePowerShare,
	isValidDelegationTarget,
	formatVotePower,
};
