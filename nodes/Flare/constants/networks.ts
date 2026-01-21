/**
 * Flare Network Configurations
 *
 * Flare is the blockchain for data - it provides developers with secure decentralized access
 * to high-integrity data from other chains and the internet.
 *
 * Network Types:
 * - Flare (FLR): Main network with full functionality
 * - Songbird (SGB): Canary network for testing new features before Flare
 * - Coston2: Testnet for Flare mainnet
 * - Coston: Testnet for Songbird
 */

export interface FlareNetworkConfig {
	name: string;
	displayName: string;
	chainId: number;
	nativeCurrency: {
		name: string;
		symbol: string;
		decimals: number;
	};
	wrappedToken: {
		name: string;
		symbol: string;
		address: string;
	};
	rpcUrls: string[];
	blockExplorerUrls: string[];
	explorerApiUrl: string;
	isTestnet: boolean;
	/** Reward epoch duration in seconds (typically 3.5 days on mainnet) */
	rewardEpochDurationSeconds: number;
	/** Price epoch duration in seconds (typically 3 minutes) */
	priceEpochDurationSeconds: number;
}

export const FLARE_NETWORKS: Record<string, FlareNetworkConfig> = {
	flare: {
		name: 'flare',
		displayName: 'Flare Mainnet',
		chainId: 14,
		nativeCurrency: {
			name: 'Flare',
			symbol: 'FLR',
			decimals: 18,
		},
		wrappedToken: {
			name: 'Wrapped Flare',
			symbol: 'WFLR',
			address: '0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d',
		},
		rpcUrls: [
			'https://flare-api.flare.network/ext/C/rpc',
			'https://flare.public-rpc.com',
			'https://rpc.ftso.au/flare',
		],
		blockExplorerUrls: ['https://flare-explorer.flare.network'],
		explorerApiUrl: 'https://flare-explorer.flare.network/api',
		isTestnet: false,
		rewardEpochDurationSeconds: 302400, // 3.5 days
		priceEpochDurationSeconds: 180, // 3 minutes
	},
	songbird: {
		name: 'songbird',
		displayName: 'Songbird Canary Network',
		chainId: 19,
		nativeCurrency: {
			name: 'Songbird',
			symbol: 'SGB',
			decimals: 18,
		},
		wrappedToken: {
			name: 'Wrapped Songbird',
			symbol: 'WSGB',
			address: '0x02f0826ef6aD107Cfc861152B32B52fD11BaB9ED',
		},
		rpcUrls: [
			'https://songbird-api.flare.network/ext/C/rpc',
			'https://songbird.public-rpc.com',
			'https://rpc.ftso.au/songbird',
		],
		blockExplorerUrls: ['https://songbird-explorer.flare.network'],
		explorerApiUrl: 'https://songbird-explorer.flare.network/api',
		isTestnet: false,
		rewardEpochDurationSeconds: 302400,
		priceEpochDurationSeconds: 180,
	},
	coston2: {
		name: 'coston2',
		displayName: 'Coston2 Testnet (Flare)',
		chainId: 114,
		nativeCurrency: {
			name: 'Coston2 Flare',
			symbol: 'C2FLR',
			decimals: 18,
		},
		wrappedToken: {
			name: 'Wrapped Coston2 Flare',
			symbol: 'WC2FLR',
			address: '0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273',
		},
		rpcUrls: [
			'https://coston2-api.flare.network/ext/C/rpc',
			'https://coston2.enosys.global/ext/C/rpc',
		],
		blockExplorerUrls: ['https://coston2-explorer.flare.network'],
		explorerApiUrl: 'https://coston2-explorer.flare.network/api',
		isTestnet: true,
		rewardEpochDurationSeconds: 86400, // 1 day on testnet
		priceEpochDurationSeconds: 180,
	},
	coston: {
		name: 'coston',
		displayName: 'Coston Testnet (Songbird)',
		chainId: 16,
		nativeCurrency: {
			name: 'Coston Songbird',
			symbol: 'CFLR',
			decimals: 18,
		},
		wrappedToken: {
			name: 'Wrapped Coston',
			symbol: 'WCFLR',
			address: '0x767b25A658E8FC8ab6eBbd52043495dB61b4ea91',
		},
		rpcUrls: [
			'https://coston-api.flare.network/ext/C/rpc',
			'https://coston.enosys.global/ext/C/rpc',
		],
		blockExplorerUrls: ['https://coston-explorer.flare.network'],
		explorerApiUrl: 'https://coston-explorer.flare.network/api',
		isTestnet: true,
		rewardEpochDurationSeconds: 86400,
		priceEpochDurationSeconds: 180,
	},
};

/**
 * Get network configuration by name or chain ID
 */
export function getNetworkConfig(networkOrChainId: string | number): FlareNetworkConfig | undefined {
	if (typeof networkOrChainId === 'number') {
		return Object.values(FLARE_NETWORKS).find((n) => n.chainId === networkOrChainId);
	}
	return FLARE_NETWORKS[networkOrChainId.toLowerCase()];
}

/**
 * Get default RPC URL for a network
 */
export function getDefaultRpcUrl(network: string): string {
	const config = FLARE_NETWORKS[network.toLowerCase()];
	return config?.rpcUrls[0] ?? '';
}

/**
 * Network selection options for n8n UI
 */
export const NETWORK_OPTIONS = [
	{ name: 'Flare Mainnet', value: 'flare' },
	{ name: 'Songbird (Canary Network)', value: 'songbird' },
	{ name: 'Coston2 (Flare Testnet)', value: 'coston2' },
	{ name: 'Coston (Songbird Testnet)', value: 'coston' },
	{ name: 'Custom', value: 'custom' },
];

/**
 * Chain ID to network name mapping
 */
export const CHAIN_ID_TO_NETWORK: Record<number, string> = {
	14: 'flare',
	19: 'songbird',
	114: 'coston2',
	16: 'coston',
};
