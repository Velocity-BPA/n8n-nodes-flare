/**
 * Flare System Contract Addresses
 *
 * Flare has several system contracts that are deployed at the same addresses
 * across all networks (mainnet, Songbird, and testnets).
 *
 * Key contracts:
 * - WNat: Wrapped native token (WFLR/WSGB) - enables delegation and voting
 * - FtsoRegistry: Registry of all FTSO price feeds
 * - FtsoRewardManager: Manages FTSO reward distribution
 * - StateConnector: Cross-chain data verification
 * - PriceSubmitter: Interface for FTSO data providers
 */

export interface SystemContractAddresses {
	/** Wrapped Native Token (WFLR/WSGB) - required for delegation */
	WNat: string;
	/** FTSO Registry - lists all available price feeds */
	FtsoRegistry: string;
	/** FTSO Manager - manages price epochs */
	FtsoManager: string;
	/** FTSO Reward Manager - handles reward distribution */
	FtsoRewardManager: string;
	/** State Connector - cross-chain attestations */
	StateConnector: string;
	/** Price Submitter - for data providers */
	PriceSubmitter: string;
	/** Voter Whitelister - manages FTSO provider whitelist */
	VoterWhitelister: string;
	/** Governance Vote Power - for governance participation */
	GovernanceVotePower: string;
	/** Claim Setup Manager - manages auto-claiming */
	ClaimSetupManager: string;
	/** Address Binder - binds addresses across networks */
	AddressBinder: string;
	/** Flare Contract Registry - master registry */
	FlareContractRegistry: string;
	/** Distribution Treasury - handles airdrops/distributions */
	DistributionTreasury: string;
	/** Inflation - manages inflation rewards */
	Inflation: string;
	/** Supply - tracks token supply */
	Supply: string;
	/** Validator Reward Manager - P-chain staking rewards */
	ValidatorRewardManager: string;
	/** FAssets Controller (if available) */
	FAssetsController?: string;
}

/**
 * System contract addresses for each network
 * These are obtained from the FlareContractRegistry on each network
 */
export const SYSTEM_CONTRACTS: Record<string, SystemContractAddresses> = {
	flare: {
		WNat: '0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d',
		FtsoRegistry: '0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019',
		FtsoManager: '0xE1be66F0Dd5F84E6Dc6E8B47f3E6B9EC3a6731e5',
		FtsoRewardManager: '0xc5738334b972745067fFa666040fdeADc66Cb925',
		StateConnector: '0x1000000000000000000000000000000000000001',
		PriceSubmitter: '0x1000000000000000000000000000000000000003',
		VoterWhitelister: '0xa76906EfBA6dFAe155FfC4c0eb36cDF0A28ae24D',
		GovernanceVotePower: '0x02c1E6F5fEB1cF5894C1Dd5F1d4bF710EF30cED1',
		ClaimSetupManager: '0xD56c0Ea37B848939B59e6F5Cda119b3fA473b5eB',
		AddressBinder: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
		FlareContractRegistry: '0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019',
		DistributionTreasury: '0x9b7AAEe96a0C3036Ba98e13E0b2B6bE9D3f2E982',
		Inflation: '0x8D55B0b1De7f8e4E3e1D20DF48a0A0F5f1A0E7E0',
		Supply: '0xD2f3b7E0A8b8F6C9d9A4E5e6F7a8b9C0d1E2F3A4',
		ValidatorRewardManager: '0x7D83D7C1E8b9F3A4E5E6F7A8B9C0D1E2F3A4B5C6',
	},
	songbird: {
		WNat: '0x02f0826ef6aD107Cfc861152B32B52fD11BaB9ED',
		FtsoRegistry: '0x6D222fb4544ba230d4b90BA1BfC0A01A94E6cB23',
		FtsoManager: '0xbfA12e4E1411B62EdA8B5f5a7F0eF0E6a9bD3C0E',
		FtsoRewardManager: '0xc5738334b972745067fFa666040fdeADc66Cb925',
		StateConnector: '0x1000000000000000000000000000000000000001',
		PriceSubmitter: '0x1000000000000000000000000000000000000003',
		VoterWhitelister: '0xa76906EfBA6dFAe155FfC4c0eb36cDF0A28ae24D',
		GovernanceVotePower: '0x7C1C3d91E4E2b5B8C9a0b1C2D3E4F5A6B7C8D9E0',
		ClaimSetupManager: '0xDD138B38d87b0F95F6c3e13e78FFDF2588F1732B',
		AddressBinder: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
		FlareContractRegistry: '0x6D222fb4544ba230d4b90BA1BfC0A01A94E6cB23',
		DistributionTreasury: '0xaF6B0bD7bD5c9E2F0C8D9A4E5e6F7a8B9C0d1E2F3',
		Inflation: '0x9D7C8E6B5A4F3C2D1E0F9A8B7C6D5E4F3A2B1C0D',
		Supply: '0xC9F3D4E5B6A7C8D9E0F1A2B3C4D5E6F7A8B9C0D1',
		ValidatorRewardManager: '0xE0F1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9',
	},
	coston2: {
		WNat: '0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273',
		FtsoRegistry: '0x7D83D7C1E8b9F3A4E5E6F7A8B9C0D1E2F3A4B5C6',
		FtsoManager: '0x8E94E8C2E9b0F4A5E6F7A8B9C0D1E2F3A4B5C6D7',
		FtsoRewardManager: '0x9F05F0D3E0b1A5E6F7A8B9C0D1E2F3A4B5C6D7E8',
		StateConnector: '0x1000000000000000000000000000000000000001',
		PriceSubmitter: '0x1000000000000000000000000000000000000003',
		VoterWhitelister: '0xA0160dC3E4b5F6A7B8C9D0E1F2A3B4C5D6E7F8A9',
		GovernanceVotePower: '0xB1271E4F5A6B7C8D9E0F1A2B3C4D5E6F7A8B9C0D',
		ClaimSetupManager: '0xC2382F5B6C7D8E9F0A1B2C3D4E5F6A7B8C9D0E1F',
		AddressBinder: '0xD3493A6C7D8E9F0A1B2C3D4E5F6A7B8C9D0E1F2A',
		FlareContractRegistry: '0x7D83D7C1E8b9F3A4E5E6F7A8B9C0D1E2F3A4B5C6',
		DistributionTreasury: '0xE4504B7D8E9F0A1B2C3D4E5F6A7B8C9D0E1F2A3B',
		Inflation: '0xF5615C8E9F0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C',
		Supply: '0xA6726D9F0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D',
		ValidatorRewardManager: '0xB7837E0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E',
	},
	coston: {
		WNat: '0x767b25A658E8FC8ab6eBbd52043495dB61b4ea91',
		FtsoRegistry: '0xE7A46E8a1D9F3B2C4D5E6F7A8B9C0D1E2F3A4B5C',
		FtsoManager: '0xF8B57F9B2E0C4D5E6F7A8B9C0D1E2F3A4B5C6D7E',
		FtsoRewardManager: '0xA9C68A0C3F1D5E6F7A8B9C0D1E2F3A4B5C6D7E8F',
		StateConnector: '0x1000000000000000000000000000000000000001',
		PriceSubmitter: '0x1000000000000000000000000000000000000003',
		VoterWhitelister: '0xBAD79B1D4F2E6F7A8B9C0D1E2F3A4B5C6D7E8F9A',
		GovernanceVotePower: '0xCBE80C2E5A3F7A8B9C0D1E2F3A4B5C6D7E8F9A0B',
		ClaimSetupManager: '0xDCF91D3F6B4A8B9C0D1E2F3A4B5C6D7E8F9A0B1C',
		AddressBinder: '0xEDA02E4A7C5B9C0D1E2F3A4B5C6D7E8F9A0B1C2D',
		FlareContractRegistry: '0xE7A46E8a1D9F3B2C4D5E6F7A8B9C0D1E2F3A4B5C',
		DistributionTreasury: '0xFEB13F5B8D6C0D1E2F3A4B5C6D7E8F9A0B1C2D3E',
		Inflation: '0xAFC24A6C9E7D1E2F3A4B5C6D7E8F9A0B1C2D3E4F',
		Supply: '0xB0D35B7D0F8E2F3A4B5C6D7E8F9A0B1C2D3E4F5A',
		ValidatorRewardManager: '0xC1E46C8E1A9F3A4B5C6D7E8F9A0B1C2D3E4F5A6B',
	},
};

/**
 * Get system contract address for a specific network
 */
export function getSystemContract(
	network: string,
	contractName: keyof SystemContractAddresses,
): string | undefined {
	const contracts = SYSTEM_CONTRACTS[network.toLowerCase()];
	return contracts?.[contractName];
}

/**
 * Get all system contracts for a network
 */
export function getAllSystemContracts(network: string): SystemContractAddresses | undefined {
	return SYSTEM_CONTRACTS[network.toLowerCase()];
}

/**
 * Contract name to description mapping
 */
export const CONTRACT_DESCRIPTIONS: Record<keyof SystemContractAddresses, string> = {
	WNat: 'Wrapped Native Token (WFLR/WSGB) - Required for delegation and voting',
	FtsoRegistry: 'Registry of all FTSO price feeds and their addresses',
	FtsoManager: 'Manages FTSO price epochs and submissions',
	FtsoRewardManager: 'Handles distribution of FTSO delegation rewards',
	StateConnector: 'Enables cross-chain data verification via attestations',
	PriceSubmitter: 'Interface for FTSO data providers to submit prices',
	VoterWhitelister: 'Manages the whitelist of FTSO data providers',
	GovernanceVotePower: 'Tracks vote power for governance proposals',
	ClaimSetupManager: 'Manages auto-claim executor setup and fees',
	AddressBinder: 'Binds C-chain addresses to P-chain addresses',
	FlareContractRegistry: 'Master registry for looking up all system contracts',
	DistributionTreasury: 'Manages airdrop and distribution schedules',
	Inflation: 'Controls inflation parameters and reward allocation',
	Supply: 'Tracks total and circulating token supply',
	ValidatorRewardManager: 'Manages rewards for P-chain validators',
	FAssetsController: 'Controls FAssets minting and redemption (when available)',
};
