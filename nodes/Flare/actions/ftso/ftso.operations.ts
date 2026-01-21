/**
 * FTSO Resource Operations (Flare Time Series Oracle)
 *
 * Handles interactions with Flare's decentralized oracle system.
 * FTSO provides price feeds for various assets updated every ~3 minutes.
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { createFlareConnection, getFtsoRegistryContract } from '../../transport/provider';
import {
	getCurrentPrice,
	getCurrentPrices,
	getAllCurrentPrices,
	getSupportedSymbols,
	getFtsoContract,
	getPriceEpochData,
	getCurrentEpochId,
	getEpochPrice,
	getPriceDetails,
	getPriceEpochConfiguration,
	getVotePowerBlock,
	getTimeUntilFinalization,
	formatPrice,
} from '../../transport/ftsoClient';
import { FTSO_SYMBOLS, type FtsoSymbolInfo } from '../../constants/ftsoSymbols';

export const ftsoOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['ftso'],
			},
		},
		options: [
			{
				name: 'Get Current Price',
				value: 'getCurrentPrice',
				description: 'Get current price for a symbol',
				action: 'Get current price',
			},
			{
				name: 'Get Price with Timestamp',
				value: 'getPriceWithTimestamp',
				description: 'Get price with finalization timestamp',
				action: 'Get price with timestamp',
			},
			{
				name: 'Get Multiple Prices',
				value: 'getMultiplePrices',
				description: 'Get prices for multiple symbols at once',
				action: 'Get multiple prices',
			},
			{
				name: 'Get All Prices',
				value: 'getAllPrices',
				description: 'Get all available price feeds',
				action: 'Get all prices',
			},
			{
				name: 'Get Supported Symbols',
				value: 'getSupportedSymbols',
				description: 'List all supported price feed symbols',
				action: 'Get supported symbols',
			},
			{
				name: 'Get Price Epoch Data',
				value: 'getPriceEpochData',
				description: 'Get current epoch timing information',
				action: 'Get price epoch data',
			},
			{
				name: 'Get FTSO Registry',
				value: 'getFtsoRegistry',
				description: 'Get FTSO registry contract address',
				action: 'Get FTSO registry',
			},
			{
				name: 'Get FTSO Contract',
				value: 'getFtsoContract',
				description: 'Get FTSO contract address for a symbol',
				action: 'Get FTSO contract',
			},
			{
				name: 'Get Current Epoch ID',
				value: 'getCurrentEpochId',
				description: 'Get current price epoch ID',
				action: 'Get current epoch ID',
			},
			{
				name: 'Get Vote Power Block',
				value: 'getVotePowerBlock',
				description: 'Get vote power block for an epoch',
				action: 'Get vote power block',
			},
			{
				name: 'Get Historical Price',
				value: 'getHistoricalPrice',
				description: 'Get price for a specific epoch',
				action: 'Get historical price',
			},
			{
				name: 'Get Price Details',
				value: 'getPriceDetails',
				description: 'Get detailed price information including finalization type',
				action: 'Get price details',
			},
			{
				name: 'Get Epoch Configuration',
				value: 'getEpochConfiguration',
				description: 'Get epoch timing configuration',
				action: 'Get epoch configuration',
			},
			{
				name: 'Get Time Until Finalization',
				value: 'getTimeUntilFinalization',
				description: 'Get seconds until next price finalization',
				action: 'Get time until finalization',
			},
		],
		default: 'getCurrentPrice',
	},
];

export const ftsoFields: INodeProperties[] = [
	// Symbol selection for single price queries
	{
		displayName: 'Symbol',
		name: 'symbol',
		type: 'options',
		required: true,
		default: 'FLR',
		description: 'Price feed symbol',
		displayOptions: {
			show: {
				resource: ['ftso'],
				operation: ['getCurrentPrice', 'getPriceWithTimestamp', 'getFtsoContract', 'getPriceEpochData', 'getCurrentEpochId', 'getHistoricalPrice', 'getPriceDetails', 'getEpochConfiguration', 'getTimeUntilFinalization', 'getVotePowerBlock'],
			},
		},
		options: Object.values(FTSO_SYMBOLS).map((s: FtsoSymbolInfo) => ({
			name: `${s.symbol} - ${s.displayName}`,
			value: s.symbol,
			description: s.description,
		})),
	},
	// Multiple symbols selection
	{
		displayName: 'Symbols',
		name: 'symbols',
		type: 'multiOptions',
		required: true,
		default: ['FLR', 'SGB', 'BTC', 'ETH'],
		description: 'Select multiple symbols to query',
		displayOptions: {
			show: {
				resource: ['ftso'],
				operation: ['getMultiplePrices'],
			},
		},
		options: Object.values(FTSO_SYMBOLS).map((s: FtsoSymbolInfo) => ({
			name: `${s.symbol} - ${s.displayName}`,
			value: s.symbol,
		})),
	},
	// Epoch ID for historical queries
	{
		displayName: 'Epoch ID',
		name: 'epochId',
		type: 'number',
		required: true,
		default: 0,
		description: 'Price epoch ID',
		displayOptions: {
			show: {
				resource: ['ftso'],
				operation: ['getHistoricalPrice', 'getVotePowerBlock'],
			},
		},
	},
	// Decimal places for formatting
	{
		displayName: 'Display Decimals',
		name: 'displayDecimals',
		type: 'number',
		default: 4,
		description: 'Number of decimal places to display',
		displayOptions: {
			show: {
				resource: ['ftso'],
				operation: ['getCurrentPrice', 'getPriceWithTimestamp', 'getMultiplePrices', 'getAllPrices', 'getHistoricalPrice'],
			},
		},
	},
	// Include metadata option
	{
		displayName: 'Include Symbol Metadata',
		name: 'includeMetadata',
		type: 'boolean',
		default: false,
		description: 'Whether to include symbol metadata (category, network availability)',
		displayOptions: {
			show: {
				resource: ['ftso'],
				operation: ['getCurrentPrice', 'getMultiplePrices', 'getAllPrices', 'getSupportedSymbols'],
			},
		},
	},
];

export async function executeFtso(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;
	const credentials = await this.getCredentials('flareNetworkApi');
	const connection = await createFlareConnection(credentials as any);

	let result: any;

	switch (operation) {
		case 'getCurrentPrice': {
			const symbol = this.getNodeParameter('symbol', index) as string;
			const displayDecimals = this.getNodeParameter('displayDecimals', index, 4) as number;
			const includeMetadata = this.getNodeParameter('includeMetadata', index, false) as boolean;

			const priceData = await getCurrentPrice(connection, symbol);

			result = {
				symbol: priceData.symbol,
				price: formatPrice(priceData.price, priceData.decimals, displayDecimals),
				priceRaw: priceData.price.toString(),
				decimals: priceData.decimals,
				timestamp: priceData.timestamp,
				timestampFormatted: new Date(priceData.timestamp * 1000).toISOString(),
			};

			if (includeMetadata) {
				const symbolInfo = FTSO_SYMBOLS[symbol];
				if (symbolInfo) {
					result.metadata = {
						name: symbolInfo.displayName,
						category: symbolInfo.category,
						description: symbolInfo.description,
						networks: { flare: symbolInfo.flare, songbird: symbolInfo.songbird },
					};
				}
			}
			break;
		}

		case 'getPriceWithTimestamp': {
			const symbol = this.getNodeParameter('symbol', index) as string;
			const displayDecimals = this.getNodeParameter('displayDecimals', index, 4) as number;

			const details = await getPriceDetails(connection, symbol);
			const symbolInfo = FTSO_SYMBOLS[symbol];
			const decimals = symbolInfo?.decimals || 5;

			result = {
				symbol,
				price: formatPrice(details.price, decimals, displayDecimals),
				priceRaw: details.price.toString(),
				timestamp: details.timestamp,
				timestampFormatted: new Date(details.timestamp * 1000).toISOString(),
				finalizationType: details.finalizationType,
				finalizationTypeDesc: getFinalizationTypeDesc(details.finalizationType),
				lastEpochTimestamp: details.lastEpochFinalizationTimestamp,
				lastEpochType: details.lastEpochFinalizationType,
			};
			break;
		}

		case 'getMultiplePrices': {
			const symbols = this.getNodeParameter('symbols', index) as string[];
			const displayDecimals = this.getNodeParameter('displayDecimals', index, 4) as number;
			const includeMetadata = this.getNodeParameter('includeMetadata', index, false) as boolean;

			const prices = await getCurrentPrices(connection, symbols);

			result = {
				prices: prices.map(p => {
					const priceResult: any = {
						symbol: p.symbol,
						price: formatPrice(p.price, p.decimals, displayDecimals),
						priceRaw: p.price.toString(),
						decimals: p.decimals,
						timestamp: p.timestamp,
					};

					if (includeMetadata) {
						const symbolInfo = FTSO_SYMBOLS[p.symbol];
						if (symbolInfo) {
							priceResult.name = symbolInfo.displayName;
							priceResult.category = symbolInfo.category;
						}
					}

					return priceResult;
				}),
				queriedAt: new Date().toISOString(),
				count: prices.length,
			};
			break;
		}

		case 'getAllPrices': {
			const displayDecimals = this.getNodeParameter('displayDecimals', index, 4) as number;
			const includeMetadata = this.getNodeParameter('includeMetadata', index, false) as boolean;

			const prices = await getAllCurrentPrices(connection);

			result = {
				prices: prices.map(p => {
					const priceResult: any = {
						symbol: p.symbol,
						price: formatPrice(p.price, p.decimals, displayDecimals),
						priceRaw: p.price.toString(),
						decimals: p.decimals,
						timestamp: p.timestamp,
					};

					if (includeMetadata) {
						const symbolInfo = FTSO_SYMBOLS[p.symbol];
						if (symbolInfo) {
							priceResult.name = symbolInfo.displayName;
							priceResult.category = symbolInfo.category;
						}
					}

					return priceResult;
				}),
				queriedAt: new Date().toISOString(),
				count: prices.length,
			};
			break;
		}

		case 'getSupportedSymbols': {
			const includeMetadata = this.getNodeParameter('includeMetadata', index, false) as boolean;
			const symbols = await getSupportedSymbols(connection);

			if (includeMetadata) {
				result = {
					symbols: symbols.map((symbol: string) => {
						const info = FTSO_SYMBOLS[symbol];
						return info ? {
							symbol,
							name: info.displayName,
							category: info.category,
							description: info.description,
							decimals: info.decimals,
							networks: { flare: info.flare, songbird: info.songbird },
						} : { symbol };
					}),
					count: symbols.length,
				};
			} else {
				result = {
					symbols,
					count: symbols.length,
				};
			}
			break;
		}

		case 'getPriceEpochData': {
			const symbol = this.getNodeParameter('symbol', index) as string;
			const epochData = await getPriceEpochData(connection, symbol);

			const now = Math.floor(Date.now() / 1000);

			result = {
				symbol,
				epochId: epochData.epochId,
				submitEndTime: epochData.submitEndTime,
				submitEndTimeFormatted: new Date(epochData.submitEndTime * 1000).toISOString(),
				revealEndTime: epochData.revealEndTime,
				revealEndTimeFormatted: new Date(epochData.revealEndTime * 1000).toISOString(),
				votePowerBlock: epochData.votePowerBlock,
				fallbackMode: epochData.fallbackMode,
				// Calculated fields
				submitPhaseActive: now < epochData.submitEndTime,
				revealPhaseActive: now >= epochData.submitEndTime && now < epochData.revealEndTime,
				secondsUntilSubmitEnd: Math.max(0, epochData.submitEndTime - now),
				secondsUntilRevealEnd: Math.max(0, epochData.revealEndTime - now),
			};
			break;
		}

		case 'getFtsoRegistry': {
			const registry = getFtsoRegistryContract(connection);

			result = {
				address: await registry.getAddress(),
				network: credentials.network,
			};
			break;
		}

		case 'getFtsoContract': {
			const symbol = this.getNodeParameter('symbol', index) as string;
			const ftso = await getFtsoContract(connection, symbol);

			result = {
				symbol,
				address: await ftso.getAddress(),
			};
			break;
		}

		case 'getCurrentEpochId': {
			const symbol = this.getNodeParameter('symbol', index) as string;
			const epochId = await getCurrentEpochId(connection, symbol);

			result = {
				symbol,
				epochId,
			};
			break;
		}

		case 'getVotePowerBlock': {
			const symbol = this.getNodeParameter('symbol', index) as string;
			const epochId = this.getNodeParameter('epochId', index) as number;
			const votePowerBlock = await getVotePowerBlock(connection, symbol, epochId);

			result = {
				symbol,
				epochId,
				votePowerBlock,
			};
			break;
		}

		case 'getHistoricalPrice': {
			const symbol = this.getNodeParameter('symbol', index) as string;
			const epochId = this.getNodeParameter('epochId', index) as number;
			const displayDecimals = this.getNodeParameter('displayDecimals', index, 4) as number;

			const price = await getEpochPrice(connection, symbol, epochId);
			const symbolInfo = FTSO_SYMBOLS[symbol];
			const decimals = symbolInfo?.decimals || 5;

			result = {
				symbol,
				epochId,
				price: formatPrice(price, decimals, displayDecimals),
				priceRaw: price.toString(),
				decimals,
			};
			break;
		}

		case 'getPriceDetails': {
			const symbol = this.getNodeParameter('symbol', index) as string;
			const details = await getPriceDetails(connection, symbol);
			const symbolInfo = FTSO_SYMBOLS[symbol];
			const decimals = symbolInfo?.decimals || 5;

			result = {
				symbol,
				price: formatPrice(details.price, decimals, 6),
				priceRaw: details.price.toString(),
				timestamp: details.timestamp,
				timestampFormatted: new Date(details.timestamp * 1000).toISOString(),
				finalizationType: details.finalizationType,
				finalizationTypeDesc: getFinalizationTypeDesc(details.finalizationType),
				lastEpochFinalizationTimestamp: details.lastEpochFinalizationTimestamp,
				lastEpochFinalizationType: details.lastEpochFinalizationType,
			};
			break;
		}

		case 'getEpochConfiguration': {
			const symbol = this.getNodeParameter('symbol', index) as string;
			const config = await getPriceEpochConfiguration(connection, symbol);

			result = {
				symbol,
				firstEpochStartTimestamp: config.firstEpochStartTimestamp,
				firstEpochStart: new Date(config.firstEpochStartTimestamp * 1000).toISOString(),
				submitPeriodSeconds: config.submitPeriodSeconds,
				revealPeriodSeconds: config.revealPeriodSeconds,
				totalEpochDuration: config.submitPeriodSeconds + config.revealPeriodSeconds,
				epochsPerHour: Math.floor(3600 / (config.submitPeriodSeconds + config.revealPeriodSeconds)),
			};
			break;
		}

		case 'getTimeUntilFinalization': {
			const symbol = this.getNodeParameter('symbol', index) as string;
			const seconds = await getTimeUntilFinalization(connection, symbol);

			result = {
				symbol,
				secondsUntilFinalization: seconds,
				minutesUntilFinalization: (seconds / 60).toFixed(2),
				finalizationTime: new Date(Date.now() + seconds * 1000).toISOString(),
			};
			break;
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
	}

	return [{ json: result }];
}

function getFinalizationTypeDesc(type: number): string {
	switch (type) {
		case 0:
			return 'NOT_FINALIZED';
		case 1:
			return 'WEIGHTED_MEDIAN';
		case 2:
			return 'TRUSTED_ADDRESSES';
		case 3:
			return 'PREVIOUS_PRICE_COPIED';
		case 4:
			return 'TRUSTED_ADDRESSES_EXCEPTED';
		case 5:
			return 'FALLBACK';
		default:
			return `UNKNOWN (${type})`;
	}
}
