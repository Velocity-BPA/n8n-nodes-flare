/**
 * FAssets Resource Operations
 *
 * Handles FAssets - trustless bridging of non-smart contract assets to Flare.
 * FAssets allow BTC, XRP, DOGE, LTC, and XLM to be used on Flare as ERC-20 tokens.
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties, IDataObject } from 'n8n-workflow';
import { createFlareConnection } from '../../transport/provider';
import {
	getFAssetInfo,
	getFAssetBalance,
	getAvailableFAssets,
	getAvailableAgents,
	estimateMintingCost,
	estimateRedemptionProceeds,
	getCollateralRequirements,
	generatePaymentReference,
	getFAssetTotalSupply,
	getUnderlyingNetworkInfo,
	validateUnderlyingAddress,
} from '../../transport/fAssetsClient';
import { FASSETS, type FAssetInfo } from '../../constants/fAssets';

export const fAssetsOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['fAssets'],
			},
		},
		options: [
			{
				name: 'Get FAsset Info',
				value: 'getFAssetInfo',
				description: 'Get information about an FAsset',
				action: 'Get FAsset info',
			},
			{
				name: 'Get FAsset Balance',
				value: 'getFAssetBalance',
				description: 'Get FAsset balance for an address',
				action: 'Get FAsset balance',
			},
			{
				name: 'Get Available FAssets',
				value: 'getAvailableFAssets',
				description: 'Get list of available FAssets on the network',
				action: 'Get available FAssets',
			},
			{
				name: 'Get Available Agents',
				value: 'getAvailableAgents',
				description: 'Get list of available agents for minting',
				action: 'Get available agents',
			},
			{
				name: 'Estimate Minting Cost',
				value: 'estimateMintingCost',
				description: 'Estimate cost to mint FAssets',
				action: 'Estimate minting cost',
			},
			{
				name: 'Estimate Redemption',
				value: 'estimateRedemption',
				description: 'Estimate redemption proceeds',
				action: 'Estimate redemption',
			},
			{
				name: 'Get Collateral Requirements',
				value: 'getCollateralRequirements',
				description: 'Get collateral requirements for an FAsset',
				action: 'Get collateral requirements',
			},
			{
				name: 'Generate Payment Reference',
				value: 'generatePaymentReference',
				description: 'Generate a payment reference for minting',
				action: 'Generate payment reference',
			},
			{
				name: 'Get Total Supply',
				value: 'getTotalSupply',
				description: 'Get total supply of an FAsset',
				action: 'Get total supply',
			},
			{
				name: 'Get Underlying Network Info',
				value: 'getUnderlyingNetworkInfo',
				description: 'Get information about the underlying network',
				action: 'Get underlying network info',
			},
			{
				name: 'Validate Underlying Address',
				value: 'validateUnderlyingAddress',
				description: 'Validate an address on the underlying network',
				action: 'Validate underlying address',
			},
		],
		default: 'getFAssetInfo',
	},
];

export const fAssetsFields: INodeProperties[] = [
	// FAsset Symbol field
	{
		displayName: 'FAsset Symbol',
		name: 'fAssetSymbol',
		type: 'options',
		options: [
			{ name: 'FBTC (Bitcoin)', value: 'FBTC' },
			{ name: 'FXRP (XRP)', value: 'FXRP' },
			{ name: 'FDOGE (Dogecoin)', value: 'FDOGE' },
			{ name: 'FLTC (Litecoin)', value: 'FLTC' },
			{ name: 'FXLM (Stellar)', value: 'FXLM' },
		],
		default: 'FBTC',
		required: true,
		displayOptions: {
			show: {
				resource: ['fAssets'],
				operation: [
					'getFAssetInfo',
					'getFAssetBalance',
					'getAvailableAgents',
					'estimateMintingCost',
					'estimateRedemption',
					'getCollateralRequirements',
					'getTotalSupply',
				],
			},
		},
		description: 'The FAsset symbol',
	},
	// Address field
	{
		displayName: 'Address',
		name: 'address',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['fAssets'],
				operation: ['getFAssetBalance', 'generatePaymentReference'],
			},
		},
		description: 'The wallet address',
	},
	// Amount field
	{
		displayName: 'Amount',
		name: 'amount',
		type: 'string',
		default: '0',
		required: true,
		displayOptions: {
			show: {
				resource: ['fAssets'],
				operation: ['estimateMintingCost', 'estimateRedemption'],
			},
		},
		description: 'The amount of underlying asset or FAsset',
	},
	// Nonce field
	{
		displayName: 'Nonce',
		name: 'nonce',
		type: 'number',
		default: 0,
		required: true,
		displayOptions: {
			show: {
				resource: ['fAssets'],
				operation: ['generatePaymentReference'],
			},
		},
		description: 'Nonce for generating unique payment reference',
	},
	// Underlying Symbol field
	{
		displayName: 'Underlying Symbol',
		name: 'underlyingSymbol',
		type: 'options',
		options: [
			{ name: 'BTC (Bitcoin)', value: 'BTC' },
			{ name: 'XRP', value: 'XRP' },
			{ name: 'DOGE (Dogecoin)', value: 'DOGE' },
			{ name: 'LTC (Litecoin)', value: 'LTC' },
			{ name: 'XLM (Stellar)', value: 'XLM' },
		],
		default: 'BTC',
		required: true,
		displayOptions: {
			show: {
				resource: ['fAssets'],
				operation: ['getUnderlyingNetworkInfo', 'validateUnderlyingAddress'],
			},
		},
		description: 'The underlying asset symbol',
	},
	// Underlying Address field
	{
		displayName: 'Underlying Address',
		name: 'underlyingAddress',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['fAssets'],
				operation: ['validateUnderlyingAddress'],
			},
		},
		description: 'The address on the underlying network to validate',
	},
	// FAsset Address field (for getTotalSupply when token is deployed)
	{
		displayName: 'FAsset Contract Address',
		name: 'fAssetAddress',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				resource: ['fAssets'],
				operation: ['getTotalSupply', 'getFAssetBalance'],
			},
		},
		description: 'The FAsset token contract address (if deployed)',
	},
];

export async function executeFAssets(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;
	const credentials = await this.getCredentials('flareNetworkApi');

	const connection = await createFlareConnection({
		network: credentials.network as string,
		rpcUrl: credentials.rpcUrl as string,
		privateKey: credentials.privateKey as string | undefined,
	});

	let result: IDataObject;

	switch (operation) {
		case 'getFAssetInfo': {
			const symbol = this.getNodeParameter('fAssetSymbol', index) as string;
			const info = getFAssetInfo(symbol);

			if (!info) {
				throw new Error(`FAsset ${symbol} not found`);
			}

			result = {
				symbol: info.symbol,
				name: info.name,
				description: info.description,
				underlyingSymbol: info.underlyingSymbol,
				underlyingNetwork: info.underlyingNetwork,
				minCollateralRatioBips: info.minCollateralRatioBips,
				typicalMintingFeeBips: info.typicalMintingFeeBips,
				typicalRedemptionFeeBips: info.typicalRedemptionFeeBips,
				active: info.active,
				availableOn: info.availableOn,
			};
			break;
		}

		case 'getFAssetBalance': {
			const symbol = this.getNodeParameter('fAssetSymbol', index) as string;
			const address = this.getNodeParameter('address', index) as string;
			const fAssetAddress = this.getNodeParameter('fAssetAddress', index, '') as string;

			const info = getFAssetInfo(symbol);
			const tokenAddress = fAssetAddress || info?.tokenAddress;

			if (!tokenAddress) {
				result = {
					address,
					symbol,
					balance: '0',
					message: 'FAsset not yet deployed on this network',
				};
			} else {
				const balance = await getFAssetBalance(connection, tokenAddress, address);
				result = {
					address,
					symbol,
					balance,
					tokenAddress,
				};
			}
			break;
		}

		case 'getAvailableFAssets': {
			const networkName = credentials.network as string;
			const fAssets = getAvailableFAssets(networkName);

			result = {
				network: networkName,
				count: fAssets.length,
				fAssets: fAssets.map((f) => ({
					symbol: f.symbol,
					name: f.name,
					underlyingSymbol: f.underlyingSymbol,
					active: f.active,
				})),
			};
			break;
		}

		case 'getAvailableAgents': {
			const symbol = this.getNodeParameter('fAssetSymbol', index) as string;
			const agents = await getAvailableAgents(connection, symbol);

			result = {
				symbol,
				agentCount: agents.length,
				agents,
				message: agents.length === 0 ? 'FAssets agents not yet deployed' : undefined,
			};
			break;
		}

		case 'estimateMintingCost': {
			const symbol = this.getNodeParameter('fAssetSymbol', index) as string;
			const amount = this.getNodeParameter('amount', index) as string;
			const info = getFAssetInfo(symbol);

			if (!info) {
				throw new Error(`FAsset ${symbol} not found`);
			}

			const estimate = estimateMintingCost(info, amount);

			result = {
				symbol,
				underlyingAmount: amount,
				...estimate,
				feePercentage: (info.typicalMintingFeeBips / 100).toFixed(2) + '%',
			};
			break;
		}

		case 'estimateRedemption': {
			const symbol = this.getNodeParameter('fAssetSymbol', index) as string;
			const amount = this.getNodeParameter('amount', index) as string;
			const info = getFAssetInfo(symbol);

			if (!info) {
				throw new Error(`FAsset ${symbol} not found`);
			}

			const estimate = estimateRedemptionProceeds(info, amount);

			result = {
				symbol,
				fAssetAmount: amount,
				...estimate,
				feePercentage: (info.typicalRedemptionFeeBips / 100).toFixed(2) + '%',
			};
			break;
		}

		case 'getCollateralRequirements': {
			const symbol = this.getNodeParameter('fAssetSymbol', index) as string;
			const info = getFAssetInfo(symbol);

			if (!info) {
				throw new Error(`FAsset ${symbol} not found`);
			}

			const requirements = getCollateralRequirements(info);

			result = {
				symbol,
				...requirements,
			};
			break;
		}

		case 'generatePaymentReference': {
			const address = this.getNodeParameter('address', index) as string;
			const nonce = this.getNodeParameter('nonce', index) as number;

			const reference = generatePaymentReference(address, nonce);

			result = {
				address,
				nonce,
				paymentReference: reference,
			};
			break;
		}

		case 'getTotalSupply': {
			const symbol = this.getNodeParameter('fAssetSymbol', index) as string;
			const fAssetAddress = this.getNodeParameter('fAssetAddress', index, '') as string;

			const info = getFAssetInfo(symbol);
			const tokenAddress = fAssetAddress || info?.tokenAddress;

			if (!tokenAddress) {
				result = {
					symbol,
					totalSupply: '0',
					message: 'FAsset not yet deployed on this network',
				};
			} else {
				const totalSupply = await getFAssetTotalSupply(connection, tokenAddress);
				result = {
					symbol,
					tokenAddress,
					totalSupply,
				};
			}
			break;
		}

		case 'getUnderlyingNetworkInfo': {
			const symbol = this.getNodeParameter('underlyingSymbol', index) as string;
			const networkInfo = getUnderlyingNetworkInfo(symbol);

			if (!networkInfo) {
				throw new Error(`Unknown underlying asset: ${symbol}`);
			}

			result = {
				symbol,
				...networkInfo,
			};
			break;
		}

		case 'validateUnderlyingAddress': {
			const symbol = this.getNodeParameter('underlyingSymbol', index) as string;
			const address = this.getNodeParameter('underlyingAddress', index) as string;

			const isValid = validateUnderlyingAddress(symbol, address);

			result = {
				symbol,
				address,
				isValid,
			};
			break;
		}

		default:
			throw new Error(`Unknown operation: ${operation}`);
	}

	return [{ json: result }];
}
