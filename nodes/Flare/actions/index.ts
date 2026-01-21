/**
 * Actions Index
 *
 * Central export for all Flare resource operations.
 */

// Account operations
export {
	accountOperations,
	accountFields,
	executeAccountOperation,
} from './account/account.operations';

// Transaction operations
export {
	transactionOperations,
	transactionFields,
	executeTransaction,
} from './transaction/transaction.operations';

// Wrapped Token operations
export {
	wrappedTokenOperations,
	wrappedTokenFields,
	executeWrappedToken,
} from './wrappedToken/wrappedToken.operations';

// FTSO operations
export {
	ftsoOperations,
	ftsoFields,
	executeFtso,
} from './ftso/ftso.operations';

// FTSO Delegation operations
export {
	ftsoDelegationOperations,
	ftsoDelegationFields,
	executeFtsoDelegation,
} from './ftsoDelegation/ftsoDelegation.operations';

// FTSO Rewards operations
export {
	ftsoRewardsOperations,
	ftsoRewardsFields,
	executeFtsoRewards,
} from './ftsoRewards/ftsoRewards.operations';

// State Connector operations
export {
	stateConnectorOperations,
	stateConnectorFields,
	executeStateConnector,
} from './stateConnector/stateConnector.operations';

// FAssets operations
export {
	fAssetsOperations,
	fAssetsFields,
	executeFAssets,
} from './fAssets/fAssets.operations';

// Token operations
export {
	tokenOperations,
	tokenFields,
	executeToken,
} from './token/token.operations';

// NFT operations
export {
	nftOperations,
	nftFields,
	executeNFT,
} from './nft/nft.operations';

// Contract operations
export {
	contractOperations,
	contractFields,
	executeContractOperation,
} from './contract/contract.operations';

// Staking operations
export {
	stakingOperations,
	stakingFields,
	executeStakingOperation,
} from './staking/staking.operations';

// Block operations
export {
	blockOperations,
	blockFields,
	executeBlockOperation,
} from './block/block.operations';

// Governance operations
export {
	governanceOperations,
	governanceFields,
	executeGovernanceOperation,
} from './governance/governance.operations';

// Airdrop operations
export {
	airdropOperations,
	airdropFields,
	executeAirdrop,
} from './airdrop/airdrop.operations';

// Bridge operations
export {
	bridgeOperations,
	bridgeFields,
	executeBridge,
} from './bridge/bridge.operations';

// Network operations
export {
	networkOperations,
	networkFields,
	executeNetwork,
} from './network/network.operations';

// Utility operations
export {
	utilityOperations,
	utilityFields,
	executeUtility,
} from './utility/utility.operations';
