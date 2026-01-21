/**
 * Flare Contract ABIs
 *
 * These are the Application Binary Interfaces (ABIs) for interacting with
 * Flare's smart contracts. ABIs define the interface for calling contract functions.
 */

/**
 * Wrapped Native Token (WNat) ABI
 * WFLR on Flare, WSGB on Songbird
 *
 * The WNat contract wraps native tokens and enables:
 * - Vote power delegation to FTSO providers
 * - Governance participation
 * - ERC-20 compatibility
 */
export const WNAT_ABI = [
	// ERC-20 Standard Functions
	'function name() view returns (string)',
	'function symbol() view returns (string)',
	'function decimals() view returns (uint8)',
	'function totalSupply() view returns (uint256)',
	'function balanceOf(address account) view returns (uint256)',
	'function transfer(address to, uint256 amount) returns (bool)',
	'function allowance(address owner, address spender) view returns (uint256)',
	'function approve(address spender, uint256 amount) returns (bool)',
	'function transferFrom(address from, address to, uint256 amount) returns (bool)',

	// Wrapping Functions
	'function deposit() payable',
	'function withdraw(uint256 amount)',
	'function depositTo(address recipient) payable',
	'function withdrawFrom(address owner, uint256 amount)',

	// Vote Power Functions (Flare-specific)
	'function votePowerOf(address owner) view returns (uint256)',
	'function votePowerOfAt(address owner, uint256 blockNumber) view returns (uint256)',
	'function totalVotePower() view returns (uint256)',
	'function totalVotePowerAt(uint256 blockNumber) view returns (uint256)',
	'function votePowerFromTo(address from, address to) view returns (uint256)',
	'function votePowerFromToAt(address from, address to, uint256 blockNumber) view returns (uint256)',

	// Delegation Functions
	'function delegate(address to, uint256 bips) returns ()',
	'function delegateExplicit(address to, uint256 amount) returns ()',
	'function undelegateAll() returns ()',
	'function undelegateAllExplicit(address[] delegateAddresses) returns ()',
	'function revokeDelegationAt(address who, uint256 blockNumber) returns ()',
	'function delegatesOf(address owner) view returns (address[] delegates, uint256[] bips)',
	'function delegatesOfAt(address owner, uint256 blockNumber) view returns (address[] delegates, uint256[] bips)',
	'function delegationModeOf(address owner) view returns (uint256)',
	'function undelegatedVotePowerOf(address owner) view returns (uint256)',
	'function undelegatedVotePowerOfAt(address owner, uint256 blockNumber) view returns (uint256)',

	// Events
	'event Transfer(address indexed from, address indexed to, uint256 value)',
	'event Approval(address indexed owner, address indexed spender, uint256 value)',
	'event Deposit(address indexed dst, uint256 amount)',
	'event Withdrawal(address indexed src, uint256 amount)',
	'event Delegate(address indexed from, address indexed to, uint256 priorVotePower, uint256 newVotePower)',
	'event Revoke(address indexed delegator, address indexed delegatee, uint256 votePower, uint256 blockNumber)',
];

/**
 * FTSO Registry ABI
 * Central registry for all Flare Time Series Oracle price feeds
 */
export const FTSO_REGISTRY_ABI = [
	'function getFtsos() view returns (address[])',
	'function getFtsoBySymbol(string symbol) view returns (address)',
	'function getFtsoIndex(string symbol) view returns (uint256)',
	'function getFtsoSymbol(address ftso) view returns (string)',
	'function getSupportedIndices() view returns (uint256[])',
	'function getSupportedSymbols() view returns (string[])',
	'function getSupportedFtsos() view returns (address[])',
	'function getCurrentPrice(string symbol) view returns (uint256 price, uint256 timestamp, uint256 decimals)',
	'function getCurrentPriceWithDecimals(string symbol) view returns (uint256 price, uint256 timestamp, uint256 decimals)',
	'function getCurrentPricesByIndices(uint256[] indices) view returns (uint256[] prices, uint256[] timestamps, uint256[] decimals)',
	'function getAllCurrentPrices() view returns (uint256[] prices, uint256[] timestamps, uint256[] decimals, string[] symbols)',
];

/**
 * FTSO ABI (Individual Price Feed)
 * Each FTSO handles a specific price pair (e.g., FLR/USD, BTC/USD)
 */
export const FTSO_ABI = [
	'function symbol() view returns (string)',
	'function getCurrentPrice() view returns (uint256 price, uint256 timestamp)',
	'function getCurrentPriceWithDecimals() view returns (uint256 price, uint256 timestamp, uint256 decimals)',
	'function getCurrentPriceFromTrustedProviders() view returns (uint256 price, uint256 timestamp)',
	'function getCurrentPriceDetails() view returns (uint256 price, uint256 priceTimestamp, uint8 priceFinalizationType, uint256 lastPriceEpochFinalizationTimestamp, uint8 lastPriceEpochFinalizationType)',
	'function getPriceEpochData() view returns (uint256 epochId, uint256 epochSubmitEndTime, uint256 epochRevealEndTime, uint256 votePowerBlock, bool fallbackMode)',
	'function getPriceEpochConfiguration() view returns (uint256 firstEpochStartTs, uint256 submitPeriodSeconds, uint256 revealPeriodSeconds)',
	'function getCurrentEpochId() view returns (uint256)',
	'function getEpochPrice(uint256 epochId) view returns (uint256)',
	'function getEpochPriceForVoter(uint256 epochId, address voter) view returns (uint256)',
	'function getRandom(uint256 epochId) view returns (uint256)',
	'function getVotePowerBlock(uint256 epochId) view returns (uint256)',
	'function getPriceSubmitter() view returns (address)',
	'function getAsset() view returns (address)',
	'function getAssetFtsos() view returns (address[])',
	'function epochsConfiguration() view returns (uint256 firstEpochStartTime, uint256 epochPeriod)',
];

/**
 * FTSO Reward Manager ABI
 * Manages distribution of rewards to delegators
 */
export const FTSO_REWARD_MANAGER_ABI = [
	// Claim functions
	'function claimReward(address payable recipient, uint256[] rewardEpochs) returns (uint256 rewardAmount)',
	'function claimRewardFromDataProviders(address payable recipient, uint256[] rewardEpochs, address[] dataProviders) returns (uint256 rewardAmount)',
	'function claim(address rewardOwner, address payable recipient, uint256 rewardEpochId, bool wrap) returns (uint256 rewardAmount)',
	'function claimFromDataProviders(address rewardOwner, address payable recipient, uint256[] rewardEpochIds, address[] dataProviders, bool wrap) returns (uint256 rewardAmount)',
	'function autoClaim(address[] rewardOwners, uint256 rewardEpochId) returns ()',

	// Query functions
	'function getEpochsWithClaimableRewards() view returns (uint256 startEpochId, uint256 endEpochId)',
	'function getEpochsWithUnclaimedRewards(address beneficiary) view returns (uint256[] epochIds)',
	'function getStateOfRewards(address beneficiary, uint256 rewardEpoch) view returns (address[] dataProviders, uint256[] rewardAmounts, bool[] claimed, bool claimable)',
	'function getDataProviderCurrentFeePercentage(address dataProvider) view returns (uint256)',
	'function getDataProviderFeePercentage(address dataProvider, uint256 rewardEpoch) view returns (uint256)',
	'function getDataProviderScheduledFeePercentageChanges(address dataProvider) view returns (uint256[] feePercentageBIPS, uint256[] validFromEpoch, bool[] fixed)',
	'function getClaimedReward(uint256 rewardEpoch, address dataProvider, address claimer) view returns (bool claimed, uint256 amount)',
	'function getRewardEpochToExpireNext() view returns (uint256)',
	'function getCurrentRewardEpoch() view returns (uint256)',
	'function getRewardEpochVotePowerBlock(uint256 rewardEpoch) view returns (uint256)',
	'function getInitialRewardEpoch() view returns (uint256)',
	'function nextClaimableRewardEpoch(address rewardOwner) view returns (uint256)',

	// Reward epoch info
	'function getEpochReward(uint256 rewardEpoch) view returns (uint256 totalReward, uint256 claimedReward)',
	'function getTotals() view returns (uint256 totalAwardedWei, uint256 totalClaimedWei, uint256 totalExpiredWei, uint256 totalUnearnedWei, uint256 totalBurnedWei, uint256 totalInflationAuthorizedWei, uint256 totalInflationReceivedWei, uint256 lastInflationAuthorizationReceivedTs, uint256 dailyAuthorizedInflation)',

	// Events
	'event RewardClaimed(address indexed dataProvider, address indexed whoClaimed, address indexed sentTo, uint256 rewardEpoch, uint256 amount)',
	'event RewardsDistributed(address indexed ftso, uint256 epochId, address[] addresses, uint256[] rewards)',
];

/**
 * State Connector ABI
 * Enables cross-chain data verification through attestations
 */
export const STATE_CONNECTOR_ABI = [
	'function requestAttestations(bytes calldata data) external',
	'function getAttestation(uint256 roundId) view returns (bytes32)',
	'function merkleRoot(uint256 roundId) view returns (bytes32)',
	'function lastFinalizedRoundId() view returns (uint256)',
	'function BUFFER_TIMESTAMP_OFFSET() view returns (uint256)',
	'function BUFFER_WINDOW() view returns (uint256)',
	'function roundId() view returns (uint256)',

	// Events
	'event AttestationRequest(address indexed sender, uint256 indexed timestamp, bytes data)',
	'event RoundFinalised(uint256 indexed roundId, bytes32 merkleRoot)',
];

/**
 * Claim Setup Manager ABI
 * Manages auto-claim executor setup
 */
export const CLAIM_SETUP_MANAGER_ABI = [
	'function setAutoClaiming(address[] executors, bool enableDelegationAccount) external',
	'function setClaimExecutors(address[] executors) external',
	'function setAllowedClaimRecipients(address[] recipients) external',
	'function getRegisteredExecutors(uint256 start, uint256 end) view returns (address[] registeredExecutors, uint256 totalLength)',
	'function getExecutorInfo(address executor) view returns (bool registered, uint256 currentFeeValue)',
	'function claimExecutors(address owner) view returns (address[])',
	'function allowedClaimRecipients(address owner) view returns (address[])',
	'function isClaimExecutor(address owner, address executor) view returns (bool)',

	// Events
	'event ClaimExecutorsChanged(address indexed owner, address[] executors)',
	'event AllowedClaimRecipientsChanged(address indexed owner, address[] recipients)',
	'event ClaimExecutorFeeChanged(address indexed executor, uint256 feeValue)',
];

/**
 * Governance Vote Power ABI
 * Tracks vote power for governance proposals
 */
export const GOVERNANCE_VOTE_POWER_ABI = [
	'function votePowerOf(address who) view returns (uint256)',
	'function votePowerOfAt(address who, uint256 blockNumber) view returns (uint256)',
	'function delegate(address to) external',
	'function undelegate() external',
	'function getDelegateOf(address who) view returns (address)',
	'function getDelegateOfAt(address who, uint256 blockNumber) view returns (address)',

	// Events
	'event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate)',
];

/**
 * Standard ERC-20 ABI
 */
export const ERC20_ABI = [
	'function name() view returns (string)',
	'function symbol() view returns (string)',
	'function decimals() view returns (uint8)',
	'function totalSupply() view returns (uint256)',
	'function balanceOf(address account) view returns (uint256)',
	'function transfer(address to, uint256 amount) returns (bool)',
	'function allowance(address owner, address spender) view returns (uint256)',
	'function approve(address spender, uint256 amount) returns (bool)',
	'function transferFrom(address from, address to, uint256 amount) returns (bool)',
	'event Transfer(address indexed from, address indexed to, uint256 value)',
	'event Approval(address indexed owner, address indexed spender, uint256 value)',
];

/**
 * Standard ERC-721 (NFT) ABI
 */
export const ERC721_ABI = [
	'function name() view returns (string)',
	'function symbol() view returns (string)',
	'function tokenURI(uint256 tokenId) view returns (string)',
	'function balanceOf(address owner) view returns (uint256)',
	'function ownerOf(uint256 tokenId) view returns (address)',
	'function safeTransferFrom(address from, address to, uint256 tokenId)',
	'function safeTransferFrom(address from, address to, uint256 tokenId, bytes data)',
	'function transferFrom(address from, address to, uint256 tokenId)',
	'function approve(address to, uint256 tokenId)',
	'function setApprovalForAll(address operator, bool approved)',
	'function getApproved(uint256 tokenId) view returns (address)',
	'function isApprovedForAll(address owner, address operator) view returns (bool)',
	'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
	'event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)',
	'event ApprovalForAll(address indexed owner, address indexed operator, bool approved)',
];

/**
 * Standard ERC-1155 (Multi-Token) ABI
 */
export const ERC1155_ABI = [
	'function uri(uint256 id) view returns (string)',
	'function balanceOf(address account, uint256 id) view returns (uint256)',
	'function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])',
	'function setApprovalForAll(address operator, bool approved)',
	'function isApprovedForAll(address account, address operator) view returns (bool)',
	'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)',
	'function safeBatchTransferFrom(address from, address to, uint256[] ids, uint256[] amounts, bytes data)',
	'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
	'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)',
	'event ApprovalForAll(address indexed account, address indexed operator, bool approved)',
	'event URI(string value, uint256 indexed id)',
];

/**
 * Distribution (Airdrop) ABI
 */
export const DISTRIBUTION_ABI = [
	'function claim(address rewardOwner, address recipient, uint256 month, bool wrap) returns (uint256)',
	'function optOutOfAirdrop()',
	'function getClaimableAmount(uint256 month) view returns (uint256)',
	'function getClaimableAmountOf(address account, uint256 month) view returns (uint256)',
	'function getCurrentMonth() view returns (uint256)',
	'function getMonthToExpireNext() view returns (uint256)',
	'function nextClaimableMonth(address account) view returns (uint256)',
	'function totalEntitlementWei() view returns (uint256)',
	'function totalClaimedWei() view returns (uint256)',
	'function totalDistributedWei() view returns (uint256)',

	// Events
	'event AccountClaimed(address indexed whoClaimed, address indexed sentTo, uint256 month, uint256 amountWei)',
	'event AccountOptOut(address indexed account, bool confirmed)',
];

/**
 * Multicall3 ABI for batching read calls
 */
export const MULTICALL3_ABI = [
	'function aggregate(tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes[] returnData)',
	'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
	'function aggregate3Value(tuple(address target, bool allowFailure, uint256 value, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
	'function blockAndAggregate(tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes32 blockHash, tuple(bool success, bytes returnData)[] returnData)',
	'function getBasefee() view returns (uint256 basefee)',
	'function getBlockHash(uint256 blockNumber) view returns (bytes32 blockHash)',
	'function getBlockNumber() view returns (uint256 blockNumber)',
	'function getChainId() view returns (uint256 chainid)',
	'function getCurrentBlockCoinbase() view returns (address coinbase)',
	'function getCurrentBlockDifficulty() view returns (uint256 difficulty)',
	'function getCurrentBlockGasLimit() view returns (uint256 gaslimit)',
	'function getCurrentBlockTimestamp() view returns (uint256 timestamp)',
	'function getEthBalance(address addr) view returns (uint256 balance)',
	'function getLastBlockHash() view returns (bytes32 blockHash)',
	'function tryAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
	'function tryBlockAndAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) payable returns (uint256 blockNumber, bytes32 blockHash, tuple(bool success, bytes returnData)[] returnData)',
];

/**
 * P-Chain Stake Mirror ABI (for validator staking)
 */
export const PCHAIN_STAKE_MIRROR_ABI = [
	'function stakesOf(address owner) view returns (bytes20[] nodeIds, uint256[] amounts)',
	'function stakesOfAt(address owner, uint256 blockNumber) view returns (bytes20[] nodeIds, uint256[] amounts)',
	'function totalSupply() view returns (uint256)',
	'function totalSupplyAt(uint256 blockNumber) view returns (uint256)',
	'function votePowerOf(address owner) view returns (uint256)',
	'function votePowerOfAt(address owner, uint256 blockNumber) view returns (uint256)',
];

/**
 * FAssets Manager ABI (for cross-chain asset operations)
 */
export const FASSETS_MANAGER_ABI = [
	'function getCollateralPool() view returns (address)',
	'function getFAsset() view returns (address)',
	'function mintingFee() view returns (uint256)',
	'function redemptionFee() view returns (uint256)',
	'function collateralRatioBIPS() view returns (uint256)',
	'function minCollateralRatioBIPS() view returns (uint256)',
	'function getAvailableAgents() view returns (address[])',
	'function getAgentInfo(address agent) view returns (tuple(address vaultAddress, uint256 totalCollateralNATWei, uint256 freeCollateralNATWei, uint256 mintedUBA, uint256 reservedUBA, uint256 redeemingUBA, uint256 poolCollateralRatioBIPS, uint256 agentCollateralRatioBIPS) info)',

	// Events
	'event MintingStarted(address indexed agentVault, address indexed minter, uint256 lots, uint256 agentFeeUBA, uint256 poolFeeUBA)',
	'event MintingExecuted(address indexed agentVault, address indexed minter, uint256 lots, uint256 mintedAmountUBA)',
	'event RedemptionRequested(address indexed agentVault, address indexed redeemer, uint256 lots, uint256 redemptionAmountUBA, uint256 ticketId)',
	'event RedemptionPerformed(address indexed agentVault, address indexed redeemer, uint256 lots, uint256 ticketId)',
];

export default {
	WNAT_ABI,
	FTSO_REGISTRY_ABI,
	FTSO_ABI,
	FTSO_REWARD_MANAGER_ABI,
	STATE_CONNECTOR_ABI,
	CLAIM_SETUP_MANAGER_ABI,
	GOVERNANCE_VOTE_POWER_ABI,
	ERC20_ABI,
	ERC721_ABI,
	ERC1155_ABI,
	DISTRIBUTION_ABI,
	MULTICALL3_ABI,
	PCHAIN_STAKE_MIRROR_ABI,
	FASSETS_MANAGER_ABI,
};
