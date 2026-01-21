/**
 * FTSO (Flare Time Series Oracle) Symbol Definitions
 *
 * FTSO provides decentralized price feeds for various assets. Data providers submit
 * prices, and a weighted median calculation determines the final price.
 *
 * Key concepts:
 * - Price Epoch: ~3 minute window for price submissions
 * - Vote Power: Weight given to each provider based on delegations
 * - Reveal Period: Time when providers reveal their submitted prices
 */

export interface FtsoSymbolInfo {
	symbol: string;
	displayName: string;
	description: string;
	category: 'crypto' | 'fiat' | 'commodity' | 'index';
	/** Default decimals for this price feed */
	decimals: number;
	/** Whether this feed is available on Flare mainnet */
	flare: boolean;
	/** Whether this feed is available on Songbird */
	songbird: boolean;
}

/**
 * Supported FTSO price feed symbols
 * Prices are typically quoted against USD
 */
export const FTSO_SYMBOLS: Record<string, FtsoSymbolInfo> = {
	// Native tokens
	FLR: {
		symbol: 'FLR',
		displayName: 'Flare',
		description: 'Flare native token price',
		category: 'crypto',
		decimals: 5,
		flare: true,
		songbird: false,
	},
	SGB: {
		symbol: 'SGB',
		displayName: 'Songbird',
		description: 'Songbird native token price',
		category: 'crypto',
		decimals: 5,
		flare: false,
		songbird: true,
	},

	// Major cryptocurrencies
	BTC: {
		symbol: 'BTC',
		displayName: 'Bitcoin',
		description: 'Bitcoin price in USD',
		category: 'crypto',
		decimals: 5,
		flare: true,
		songbird: true,
	},
	ETH: {
		symbol: 'ETH',
		displayName: 'Ethereum',
		description: 'Ethereum price in USD',
		category: 'crypto',
		decimals: 5,
		flare: true,
		songbird: true,
	},
	XRP: {
		symbol: 'XRP',
		displayName: 'Ripple',
		description: 'XRP price in USD',
		category: 'crypto',
		decimals: 5,
		flare: true,
		songbird: true,
	},
	LTC: {
		symbol: 'LTC',
		displayName: 'Litecoin',
		description: 'Litecoin price in USD',
		category: 'crypto',
		decimals: 5,
		flare: true,
		songbird: true,
	},
	XLM: {
		symbol: 'XLM',
		displayName: 'Stellar',
		description: 'Stellar Lumens price in USD',
		category: 'crypto',
		decimals: 5,
		flare: true,
		songbird: true,
	},
	DOGE: {
		symbol: 'DOGE',
		displayName: 'Dogecoin',
		description: 'Dogecoin price in USD',
		category: 'crypto',
		decimals: 5,
		flare: true,
		songbird: true,
	},
	ADA: {
		symbol: 'ADA',
		displayName: 'Cardano',
		description: 'Cardano price in USD',
		category: 'crypto',
		decimals: 5,
		flare: true,
		songbird: true,
	},
	ALGO: {
		symbol: 'ALGO',
		displayName: 'Algorand',
		description: 'Algorand price in USD',
		category: 'crypto',
		decimals: 5,
		flare: true,
		songbird: true,
	},
	AVAX: {
		symbol: 'AVAX',
		displayName: 'Avalanche',
		description: 'Avalanche price in USD',
		category: 'crypto',
		decimals: 5,
		flare: true,
		songbird: true,
	},
	BNB: {
		symbol: 'BNB',
		displayName: 'BNB',
		description: 'BNB price in USD',
		category: 'crypto',
		decimals: 5,
		flare: true,
		songbird: true,
	},
	MATIC: {
		symbol: 'MATIC',
		displayName: 'Polygon',
		description: 'Polygon MATIC price in USD',
		category: 'crypto',
		decimals: 5,
		flare: true,
		songbird: true,
	},
	SOL: {
		symbol: 'SOL',
		displayName: 'Solana',
		description: 'Solana price in USD',
		category: 'crypto',
		decimals: 5,
		flare: true,
		songbird: true,
	},
	USDC: {
		symbol: 'USDC',
		displayName: 'USD Coin',
		description: 'USDC price in USD',
		category: 'crypto',
		decimals: 5,
		flare: true,
		songbird: true,
	},
	USDT: {
		symbol: 'USDT',
		displayName: 'Tether',
		description: 'Tether USD price in USD',
		category: 'crypto',
		decimals: 5,
		flare: true,
		songbird: true,
	},
	XDC: {
		symbol: 'XDC',
		displayName: 'XDC Network',
		description: 'XDC price in USD',
		category: 'crypto',
		decimals: 5,
		flare: true,
		songbird: true,
	},
	FIL: {
		symbol: 'FIL',
		displayName: 'Filecoin',
		description: 'Filecoin price in USD',
		category: 'crypto',
		decimals: 5,
		flare: true,
		songbird: true,
	},
	ARB: {
		symbol: 'ARB',
		displayName: 'Arbitrum',
		description: 'Arbitrum price in USD',
		category: 'crypto',
		decimals: 5,
		flare: true,
		songbird: true,
	},
	ATOM: {
		symbol: 'ATOM',
		displayName: 'Cosmos',
		description: 'Cosmos ATOM price in USD',
		category: 'crypto',
		decimals: 5,
		flare: true,
		songbird: true,
	},
	DOT: {
		symbol: 'DOT',
		displayName: 'Polkadot',
		description: 'Polkadot price in USD',
		category: 'crypto',
		decimals: 5,
		flare: true,
		songbird: true,
	},
	LINK: {
		symbol: 'LINK',
		displayName: 'Chainlink',
		description: 'Chainlink price in USD',
		category: 'crypto',
		decimals: 5,
		flare: true,
		songbird: true,
	},
	NEAR: {
		symbol: 'NEAR',
		displayName: 'NEAR Protocol',
		description: 'NEAR Protocol price in USD',
		category: 'crypto',
		decimals: 5,
		flare: true,
		songbird: true,
	},
	UNI: {
		symbol: 'UNI',
		displayName: 'Uniswap',
		description: 'Uniswap price in USD',
		category: 'crypto',
		decimals: 5,
		flare: true,
		songbird: true,
	},
};

/**
 * Get symbol info by symbol name
 */
export function getSymbolInfo(symbol: string): FtsoSymbolInfo | undefined {
	return FTSO_SYMBOLS[symbol.toUpperCase()];
}

/**
 * Get all symbols available on a specific network
 */
export function getNetworkSymbols(network: 'flare' | 'songbird'): FtsoSymbolInfo[] {
	return Object.values(FTSO_SYMBOLS).filter((s) => s[network]);
}

/**
 * Get symbols by category
 */
export function getSymbolsByCategory(category: FtsoSymbolInfo['category']): FtsoSymbolInfo[] {
	return Object.values(FTSO_SYMBOLS).filter((s) => s.category === category);
}

/**
 * Symbol options for n8n UI dropdown
 */
export const SYMBOL_OPTIONS = Object.entries(FTSO_SYMBOLS).map(([symbol, info]) => ({
	name: `${info.displayName} (${symbol})`,
	value: symbol,
	description: info.description,
}));

/**
 * Category options for filtering
 */
export const CATEGORY_OPTIONS = [
	{ name: 'Cryptocurrency', value: 'crypto' },
	{ name: 'Fiat Currency', value: 'fiat' },
	{ name: 'Commodity', value: 'commodity' },
	{ name: 'Index', value: 'index' },
];

/**
 * Common symbol pairs for multi-price queries
 */
export const COMMON_SYMBOL_GROUPS = {
	majors: ['BTC', 'ETH', 'XRP', 'LTC'],
	stablecoins: ['USDC', 'USDT'],
	native: ['FLR', 'SGB'],
	defi: ['LINK', 'UNI', 'AVAX', 'SOL'],
	layer1: ['ETH', 'SOL', 'AVAX', 'ADA', 'DOT', 'NEAR'],
};

export default FTSO_SYMBOLS;
