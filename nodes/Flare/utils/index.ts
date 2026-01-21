/**
 * Flare Utilities Index
 * Central export for all utility functions
 */

// Unit converter utilities
export {
	UNIT_MULTIPLIERS,
	weiToEther,
	etherToWei,
	weiToGwei,
	gweiToWei,
	convertUnits,
	formatTokenAmount,
	parseTokenAmount,
	formatNumber,
	formatWeiWithUnit,
	bipsToPercentage,
	percentageToBips,
	formatBipsAsPercentage,
	calculatePercentage,
	safeDivide,
	parseUserInput,
} from './unitConverter';

// Vote power utilities
export {
	getVotePowerInfo,
	type VotePowerInfo,
	type DelegationInfo,
} from './votePowerUtils';

// Delegation utilities
export {
	MAX_DELEGATION_PROVIDERS,
	MAX_DELEGATION_BIPS,
	createDelegationData,
	createUndelegateAllData,
	createExplicitUndelegateData,
	createRevokeDelegationData,
	validateDelegation,
	calculateOptimalSplit,
	calculateExpectedRewards as calculateDelegationExpectedRewards,
	formatDelegationInfo,
	isVerifiedProvider,
	getRecommendedProviders,
	type ProviderInfo,
	type DelegationRecommendation,
} from './delegationUtils';

// Reward utilities
export {
	REWARD_EPOCH_DURATION_SECONDS,
	REWARD_EXPIRY_EPOCHS,
	getClaimableEpochs,
	getRewardState,
	getRewardSummary,
	getCurrentRewardEpoch,
	getRewardEpochInfo,
	calculateExpectedRewards as calculateRewardExpectedRewards,
	createClaimRewardsData,
	createClaimFromProvidersData,
	createClaimWithWrapData,
	estimateFtsoApr,
	getEpochsExpiringSoon,
	formatRewardAmount,
	timeUntilEpochEnd,
	type RewardEpochInfo,
	type ClaimableReward,
	type RewardSummary,
} from './rewardUtils';

// Attestation utilities
export {
	AttestationType,
	SourceChain,
	SOURCE_CHAIN_IDS,
	ROUND_DURATION_SECONDS,
	FINALIZATION_ROUNDS,
	encodePaymentRequest,
	encodeBalanceDecreasingRequest,
	encodeConfirmedBlockHeightRequest,
	verifyMerkleProof,
	calculateAttestationHash,
	getCurrentRoundId,
	getTimeUntilNextRound,
	getRoundTimestamp,
	isAttestationFinalized,
	estimateFinalizationTime,
	parsePaymentReference,
	createPaymentReference,
	ATTESTATION_TYPE_OPTIONS,
	SOURCE_CHAIN_OPTIONS,
	type AttestationRequest,
	type PaymentAttestation,
	type BalanceDecreasingAttestation,
	type ConfirmedBlockHeightAttestation,
	type MerkleProof,
	type AttestationResponse,
} from './attestationUtils';
