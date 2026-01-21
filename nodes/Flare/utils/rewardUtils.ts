/**
 * Reward Utilities
 *
 * FTSO rewards are distributed to delegators who delegate their vote power
 * to data providers. Rewards are distributed in epochs:
 *
 * - Reward Epoch: ~3.5 days, period for reward calculation
 * - Price Epoch: ~3 minutes, period for price submissions
 * - Claimable Period: Rewards can be claimed for 90 days
 *
 * Key concepts:
 * - Rewards accumulate each reward epoch
 * - Must be claimed before expiry (90 days)
 * - Can be claimed as native tokens or wrapped tokens
 * - Auto-claim can be set up with executors
 */

import { ethers, Contract } from 'ethers';

export interface RewardEpochInfo {
	/** Epoch ID */
	epochId: number;
	/** Epoch start timestamp */
	startTimestamp: number;
	/** Epoch end timestamp */
	endTimestamp: number;
	/** Vote power block for this epoch */
	votePowerBlock: number;
	/** Whether rewards have been distributed */
	rewardsDistributed: boolean;
	/** Total rewards for this epoch */
	totalRewards?: bigint;
	/** Whether this epoch's rewards have expired */
	expired: boolean;
}

export interface ClaimableReward {
	/** Reward epoch ID */
	epochId: number;
	/** Data provider address */
	dataProvider: string;
	/** Reward amount in wei */
	amount: bigint;
	/** Whether already claimed */
	claimed: boolean;
	/** Whether claimable (not expired, rewards distributed) */
	claimable: boolean;
}

export interface RewardSummary {
	/** Total claimable rewards across all epochs */
	totalClaimable: bigint;
	/** Number of epochs with claimable rewards */
	claimableEpochs: number;
	/** Total rewards already claimed */
	totalClaimed: bigint;
	/** Total rewards expired (not claimed in time) */
	totalExpired: bigint;
	/** Breakdown by epoch */
	epochBreakdown: ClaimableReward[];
}

/**
 * Reward epoch duration in seconds (3.5 days)
 */
export const REWARD_EPOCH_DURATION_SECONDS = 302400;

/**
 * Reward expiry period in epochs (~90 days)
 */
export const REWARD_EXPIRY_EPOCHS = 26;

/**
 * Get claimable reward epochs for an address
 */
export async function getClaimableEpochs(
	rewardManagerContract: Contract,
	address: string,
): Promise<number[]> {
	const epochIds = await rewardManagerContract.getEpochsWithUnclaimedRewards(address);
	return epochIds.map((id: bigint) => Number(id));
}

/**
 * Get reward state for a specific epoch
 */
export async function getRewardState(
	rewardManagerContract: Contract,
	address: string,
	epochId: number,
): Promise<ClaimableReward[]> {
	const [dataProviders, rewardAmounts, claimed, claimable] =
		await rewardManagerContract.getStateOfRewards(address, epochId);

	return dataProviders.map((provider: string, index: number) => ({
		epochId,
		dataProvider: provider,
		amount: rewardAmounts[index],
		claimed: claimed[index],
		claimable,
	}));
}

/**
 * Get comprehensive reward summary
 */
export async function getRewardSummary(
	rewardManagerContract: Contract,
	address: string,
): Promise<RewardSummary> {
	const claimableEpochIds = await getClaimableEpochs(rewardManagerContract, address);

	let totalClaimable = BigInt(0);
	let totalClaimed = BigInt(0);
	const epochBreakdown: ClaimableReward[] = [];

	for (const epochId of claimableEpochIds) {
		const rewards = await getRewardState(rewardManagerContract, address, epochId);

		for (const reward of rewards) {
			epochBreakdown.push(reward);

			if (reward.claimable && !reward.claimed) {
				totalClaimable += reward.amount;
			}
			if (reward.claimed) {
				totalClaimed += reward.amount;
			}
		}
	}

	return {
		totalClaimable,
		claimableEpochs: claimableEpochIds.length,
		totalClaimed,
		totalExpired: BigInt(0), // Would need historical data to calculate
		epochBreakdown,
	};
}

/**
 * Get current reward epoch ID
 */
export async function getCurrentRewardEpoch(
	rewardManagerContract: Contract,
): Promise<number> {
	return Number(await rewardManagerContract.getCurrentRewardEpoch());
}

/**
 * Get reward epoch info
 */
export async function getRewardEpochInfo(
	rewardManagerContract: Contract,
	epochId: number,
): Promise<RewardEpochInfo> {
	const [totalReward, claimedReward] = await rewardManagerContract.getEpochReward(epochId);
	const votePowerBlock = await rewardManagerContract.getRewardEpochVotePowerBlock(epochId);
	const currentEpoch = await getCurrentRewardEpoch(rewardManagerContract);
	const expiryEpoch = await rewardManagerContract.getRewardEpochToExpireNext();

	// Calculate timestamps (approximate)
	const currentTime = Math.floor(Date.now() / 1000);
	const epochDiff = currentEpoch - epochId;
	const epochStartTimestamp = currentTime - epochDiff * REWARD_EPOCH_DURATION_SECONDS;

	return {
		epochId,
		startTimestamp: epochStartTimestamp,
		endTimestamp: epochStartTimestamp + REWARD_EPOCH_DURATION_SECONDS,
		votePowerBlock: Number(votePowerBlock),
		rewardsDistributed: totalReward > BigInt(0),
		totalRewards: totalReward,
		expired: epochId < Number(expiryEpoch),
	};
}

/**
 * Calculate expected rewards for delegation
 */
export function calculateExpectedRewards(
	delegatedVotePower: bigint,
	totalNetworkVotePower: bigint,
	totalEpochRewards: bigint,
	providerFeePercentageBips: number,
): bigint {
	if (totalNetworkVotePower === BigInt(0)) return BigInt(0);

	// Calculate share of rewards based on vote power
	const share = (delegatedVotePower * totalEpochRewards) / totalNetworkVotePower;

	// Subtract provider fee
	const delegatorShare = share * BigInt(10000 - providerFeePercentageBips) / BigInt(10000);

	return delegatorShare;
}

/**
 * Create claim rewards transaction data
 */
export function createClaimRewardsData(
	recipient: string,
	epochIds: number[],
): string {
	const iface = new ethers.Interface([
		'function claimReward(address payable recipient, uint256[] rewardEpochs) returns (uint256 rewardAmount)',
	]);
	return iface.encodeFunctionData('claimReward', [recipient, epochIds]);
}

/**
 * Create claim from specific providers transaction data
 */
export function createClaimFromProvidersData(
	recipient: string,
	epochIds: number[],
	providerAddresses: string[],
): string {
	const iface = new ethers.Interface([
		'function claimRewardFromDataProviders(address payable recipient, uint256[] rewardEpochs, address[] dataProviders) returns (uint256 rewardAmount)',
	]);
	return iface.encodeFunctionData('claimRewardFromDataProviders', [
		recipient,
		epochIds,
		providerAddresses,
	]);
}

/**
 * Create claim with wrap option transaction data
 */
export function createClaimWithWrapData(
	rewardOwner: string,
	recipient: string,
	epochId: number,
	wrap: boolean,
): string {
	const iface = new ethers.Interface([
		'function claim(address rewardOwner, address payable recipient, uint256 rewardEpochId, bool wrap) returns (uint256 rewardAmount)',
	]);
	return iface.encodeFunctionData('claim', [rewardOwner, recipient, epochId, wrap]);
}

/**
 * Estimate APR from FTSO rewards
 */
export function estimateFtsoApr(
	totalNetworkVotePower: bigint,
	annualRewards: bigint,
): number {
	if (totalNetworkVotePower === BigInt(0)) return 0;

	// APR = (annualRewards / totalVotePower) * 100
	const aprBps = (annualRewards * BigInt(10000)) / totalNetworkVotePower;
	return Number(aprBps) / 100;
}

/**
 * Get epochs expiring soon
 */
export function getEpochsExpiringSoon(
	claimableEpochs: ClaimableReward[],
	currentEpoch: number,
	warningThreshold: number = 5, // epochs
): ClaimableReward[] {
	return claimableEpochs.filter((reward) => {
		const epochsUntilExpiry = REWARD_EXPIRY_EPOCHS - (currentEpoch - reward.epochId);
		return epochsUntilExpiry <= warningThreshold && epochsUntilExpiry > 0;
	});
}

/**
 * Format reward amount for display
 */
export function formatRewardAmount(amount: bigint, symbol: string = 'FLR'): string {
	const formatted = ethers.formatEther(amount);
	const num = parseFloat(formatted);

	if (num >= 1000000) {
		return `${(num / 1000000).toFixed(2)}M ${symbol}`;
	}
	if (num >= 1000) {
		return `${(num / 1000).toFixed(2)}K ${symbol}`;
	}
	return `${num.toFixed(4)} ${symbol}`;
}

/**
 * Calculate time until reward epoch ends
 */
export function timeUntilEpochEnd(epochStartTimestamp: number): {
	hours: number;
	minutes: number;
	seconds: number;
	totalSeconds: number;
} {
	const now = Math.floor(Date.now() / 1000);
	const epochEndTimestamp = epochStartTimestamp + REWARD_EPOCH_DURATION_SECONDS;
	const totalSeconds = Math.max(0, epochEndTimestamp - now);

	return {
		hours: Math.floor(totalSeconds / 3600),
		minutes: Math.floor((totalSeconds % 3600) / 60),
		seconds: totalSeconds % 60,
		totalSeconds,
	};
}

export default {
	REWARD_EPOCH_DURATION_SECONDS,
	REWARD_EXPIRY_EPOCHS,
	getClaimableEpochs,
	getRewardState,
	getRewardSummary,
	getCurrentRewardEpoch,
	getRewardEpochInfo,
	calculateExpectedRewards,
	createClaimRewardsData,
	createClaimFromProvidersData,
	createClaimWithWrapData,
	estimateFtsoApr,
	getEpochsExpiringSoon,
	formatRewardAmount,
	timeUntilEpochEnd,
};
