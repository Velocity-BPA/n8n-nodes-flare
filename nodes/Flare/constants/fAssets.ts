/**
 * FAssets Configuration
 *
 * FAssets are trustless representations of non-smart-contract assets on Flare.
 * They enable assets like BTC, XRP, and DOGE to be used in DeFi on Flare
 * without bridges or wrapped tokens requiring trust assumptions.
 *
 * Key concepts:
 * - Agents: Collateralized parties that mint FAssets
 * - Collateral Pool: Native token collateral backing FAssets
 * - Minting: Creating FAssets by locking underlying assets
 * - Redemption: Burning FAssets to receive underlying assets
 */

export interface FAssetInfo {
	/** FAsset symbol (e.g., FBTC) */
	symbol: string;
	/** Full name */
	name: string;
	/** Description */
	description: string;
	/** Underlying asset symbol */
	underlyingSymbol: string;
	/** Underlying asset network */
	underlyingNetwork: string;
	/** ERC-20 token address on Flare (if deployed) */
	tokenAddress?: string;
	/** FAssets Manager address (if deployed) */
	managerAddress?: string;
	/** Minimum collateral ratio in basis points */
	minCollateralRatioBips: number;
	/** Typical minting fee in basis points */
	typicalMintingFeeBips: number;
	/** Typical redemption fee in basis points */
	typicalRedemptionFeeBips: number;
	/** Whether this FAsset is currently active */
	active: boolean;
	/** Networks where this FAsset is available */
	availableOn: ('flare' | 'songbird' | 'coston2' | 'coston')[];
}

/**
 * FAssets configurations
 * Note: FAssets is still being rolled out, addresses will be updated as they're deployed
 */
export const FASSETS: Record<string, FAssetInfo> = {
	FBTC: {
		symbol: 'FBTC',
		name: 'FAsset Bitcoin',
		description: 'Trustless Bitcoin representation on Flare',
		underlyingSymbol: 'BTC',
		underlyingNetwork: 'Bitcoin',
		minCollateralRatioBips: 14000, // 140%
		typicalMintingFeeBips: 25, // 0.25%
		typicalRedemptionFeeBips: 20, // 0.20%
		active: true,
		availableOn: ['flare', 'coston2'],
	},
	FXRP: {
		symbol: 'FXRP',
		name: 'FAsset XRP',
		description: 'Trustless XRP representation on Flare',
		underlyingSymbol: 'XRP',
		underlyingNetwork: 'XRPL',
		minCollateralRatioBips: 13000, // 130%
		typicalMintingFeeBips: 20, // 0.20%
		typicalRedemptionFeeBips: 15, // 0.15%
		active: true,
		availableOn: ['flare', 'coston2'],
	},
	FDOGE: {
		symbol: 'FDOGE',
		name: 'FAsset Dogecoin',
		description: 'Trustless Dogecoin representation on Flare',
		underlyingSymbol: 'DOGE',
		underlyingNetwork: 'Dogecoin',
		minCollateralRatioBips: 15000, // 150%
		typicalMintingFeeBips: 30, // 0.30%
		typicalRedemptionFeeBips: 25, // 0.25%
		active: true,
		availableOn: ['flare', 'coston2'],
	},
	FLTC: {
		symbol: 'FLTC',
		name: 'FAsset Litecoin',
		description: 'Trustless Litecoin representation on Flare',
		underlyingSymbol: 'LTC',
		underlyingNetwork: 'Litecoin',
		minCollateralRatioBips: 14000, // 140%
		typicalMintingFeeBips: 25, // 0.25%
		typicalRedemptionFeeBips: 20, // 0.20%
		active: false,
		availableOn: ['coston2'],
	},
	FXLM: {
		symbol: 'FXLM',
		name: 'FAsset Stellar',
		description: 'Trustless Stellar Lumens representation on Flare',
		underlyingSymbol: 'XLM',
		underlyingNetwork: 'Stellar',
		minCollateralRatioBips: 13000, // 130%
		typicalMintingFeeBips: 20, // 0.20%
		typicalRedemptionFeeBips: 15, // 0.15%
		active: false,
		availableOn: ['coston2'],
	},
};

/**
 * Agent status types
 */
export enum AgentStatus {
	NORMAL = 'NORMAL',
	CCB = 'CCB', // Collateral Call Band - needs to add collateral
	LIQUIDATION = 'LIQUIDATION',
	FULL_LIQUIDATION = 'FULL_LIQUIDATION',
	DESTROYING = 'DESTROYING',
}

/**
 * FAsset operation types
 */
export enum FAssetOperation {
	MINT = 'MINT',
	REDEEM = 'REDEEM',
	SELF_MINT = 'SELF_MINT',
	AGENT_TOPUP = 'AGENT_TOPUP',
	POOL_TOPUP = 'POOL_TOPUP',
}

/**
 * Get FAsset info by symbol
 */
export function getFAssetInfo(symbol: string): FAssetInfo | undefined {
	return FASSETS[symbol.toUpperCase()];
}

/**
 * Get all active FAssets
 */
export function getActiveFAssets(): FAssetInfo[] {
	return Object.values(FASSETS).filter((f) => f.active);
}

/**
 * Get FAssets available on a specific network
 */
export function getFAssetsForNetwork(network: string): FAssetInfo[] {
	const networkKey = network.toLowerCase() as FAssetInfo['availableOn'][number];
	return Object.values(FASSETS).filter((f) => f.availableOn.includes(networkKey));
}

/**
 * FAsset dropdown options for n8n UI
 */
export const FASSET_OPTIONS = Object.entries(FASSETS).map(([symbol, info]) => ({
	name: `${info.name} (${symbol})`,
	value: symbol,
	description: `${info.description} - Underlying: ${info.underlyingSymbol}`,
}));

/**
 * Collateral types for FAssets
 */
export const COLLATERAL_TYPES = {
	VAULT: 'vault', // Agent vault collateral (stablecoins)
	POOL: 'pool', // Pool collateral (native token)
};

/**
 * Calculate required collateral for minting
 */
export function calculateRequiredCollateral(
	amount: bigint,
	price: bigint,
	collateralRatioBips: number,
): bigint {
	// collateral = (amount * price * collateralRatio) / 10000
	return (amount * price * BigInt(collateralRatioBips)) / BigInt(10000);
}

/**
 * Calculate maximum mintable amount given collateral
 */
export function calculateMaxMintable(
	collateral: bigint,
	price: bigint,
	collateralRatioBips: number,
): bigint {
	// maxMintable = (collateral * 10000) / (price * collateralRatio)
	return (collateral * BigInt(10000)) / (price * BigInt(collateralRatioBips));
}

export default FASSETS;
