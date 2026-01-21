/**
 * Common Token Configurations for Flare Networks
 *
 * This file contains addresses and information for commonly used tokens
 * on Flare and Songbird networks.
 */

export interface TokenInfo {
	/** Token address */
	address: string;
	/** Token symbol */
	symbol: string;
	/** Token name */
	name: string;
	/** Decimal places */
	decimals: number;
	/** Logo URL (optional) */
	logoUrl?: string;
	/** Is native wrapped token */
	isWrappedNative?: boolean;
	/** Is stablecoin */
	isStablecoin?: boolean;
}

export interface NetworkTokens {
	/** Wrapped native token */
	wrappedNative: TokenInfo;
	/** Stablecoins */
	stablecoins: TokenInfo[];
	/** Other common tokens */
	others: TokenInfo[];
}

/**
 * Flare Mainnet Tokens
 */
export const FLARE_TOKENS: NetworkTokens = {
	wrappedNative: {
		address: '0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d',
		symbol: 'WFLR',
		name: 'Wrapped Flare',
		decimals: 18,
		isWrappedNative: true,
	},
	stablecoins: [
		{
			address: '0xfbda5f676cb37624f28265a144a48b0d6e87d3b6',
			symbol: 'eUSDT',
			name: 'Enosys USDT',
			decimals: 6,
			isStablecoin: true,
		},
		{
			address: '0x96B41289D90444B8add57e6F265db5aE8651df29',
			symbol: 'USDC.e',
			name: 'USD Coin (Bridged)',
			decimals: 6,
			isStablecoin: true,
		},
		{
			address: '0xD8c6487B2F0d2B8B1A9C3aD30d7e2c69eF2D7f4A',
			symbol: 'USDT.e',
			name: 'Tether USD (Bridged)',
			decimals: 6,
			isStablecoin: true,
		},
	],
	others: [
		{
			address: '0x12e605bc104e93B45e1aD99F9e555f659051c2BB',
			symbol: 'sFLR',
			name: 'Staked FLR',
			decimals: 18,
		},
		{
			address: '0xE1c39A85Ec4b65176E4F4fB4219aB8d1e0D2A10D',
			symbol: 'SFLR',
			name: 'Sceptre Staked FLR',
			decimals: 18,
		},
	],
};

/**
 * Songbird Tokens
 */
export const SONGBIRD_TOKENS: NetworkTokens = {
	wrappedNative: {
		address: '0x02f0826ef6aD107Cfc861152B32B52fD11BaB9ED',
		symbol: 'WSGB',
		name: 'Wrapped Songbird',
		decimals: 18,
		isWrappedNative: true,
	},
	stablecoins: [
		{
			address: '0x1a7b46656B2b8b29B1694229e122D066020503D0',
			symbol: 'eUSDT',
			name: 'Enosys USDT',
			decimals: 6,
			isStablecoin: true,
		},
	],
	others: [
		{
			address: '0x70Ad7172EF0b131A1428D0c1F66457EB041f2176',
			symbol: 'EXFI',
			name: 'Experimental Finance',
			decimals: 18,
		},
		{
			address: '0xC348F894d0E939FE72c467156E6d7DcbD6f16e21',
			symbol: 'sSGB',
			name: 'Staked SGB',
			decimals: 18,
		},
	],
};

/**
 * Coston2 Testnet Tokens
 */
export const COSTON2_TOKENS: NetworkTokens = {
	wrappedNative: {
		address: '0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273',
		symbol: 'WC2FLR',
		name: 'Wrapped Coston2 FLR',
		decimals: 18,
		isWrappedNative: true,
	},
	stablecoins: [],
	others: [],
};

/**
 * Coston Testnet Tokens
 */
export const COSTON_TOKENS: NetworkTokens = {
	wrappedNative: {
		address: '0x767b25A658E8FC8ab6eBbd52043495dB61b4ea91',
		symbol: 'WCFLR',
		name: 'Wrapped Coston',
		decimals: 18,
		isWrappedNative: true,
	},
	stablecoins: [],
	others: [],
};

/**
 * All network tokens
 */
export const NETWORK_TOKENS: Record<string, NetworkTokens> = {
	flare: FLARE_TOKENS,
	songbird: SONGBIRD_TOKENS,
	coston2: COSTON2_TOKENS,
	coston: COSTON_TOKENS,
};

/**
 * Get tokens for a specific network
 */
export function getNetworkTokens(network: string): NetworkTokens | undefined {
	return NETWORK_TOKENS[network.toLowerCase()];
}

/**
 * Get wrapped native token for a network
 */
export function getWrappedNativeToken(network: string): TokenInfo | undefined {
	const tokens = NETWORK_TOKENS[network.toLowerCase()];
	return tokens?.wrappedNative;
}

/**
 * Get all tokens for a network as a flat array
 */
export function getAllTokens(network: string): TokenInfo[] {
	const tokens = NETWORK_TOKENS[network.toLowerCase()];
	if (!tokens) return [];

	return [tokens.wrappedNative, ...tokens.stablecoins, ...tokens.others];
}

/**
 * Find token by address on any network
 */
export function findTokenByAddress(address: string): { network: string; token: TokenInfo } | undefined {
	const normalizedAddress = address.toLowerCase();

	for (const [network, tokens] of Object.entries(NETWORK_TOKENS)) {
		const allTokens = [tokens.wrappedNative, ...tokens.stablecoins, ...tokens.others];

		const found = allTokens.find((t) => t.address.toLowerCase() === normalizedAddress);
		if (found) {
			return { network, token: found };
		}
	}

	return undefined;
}

/**
 * Get stablecoins for a network
 */
export function getStablecoins(network: string): TokenInfo[] {
	const tokens = NETWORK_TOKENS[network.toLowerCase()];
	return tokens?.stablecoins ?? [];
}

/**
 * Token type options for n8n UI
 */
export const TOKEN_TYPE_OPTIONS = [
	{ name: 'Wrapped Native (WFLR/WSGB)', value: 'wrappedNative' },
	{ name: 'Stablecoin', value: 'stablecoin' },
	{ name: 'Custom ERC-20', value: 'custom' },
];

/**
 * Common token decimals
 */
export const COMMON_DECIMALS = {
	NATIVE: 18,
	STABLECOIN: 6,
	WRAPPED: 18,
};

export default NETWORK_TOKENS;
