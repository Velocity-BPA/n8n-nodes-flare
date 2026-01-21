/**
 * Utility Resource Operations
 *
 * Provides helper functions for:
 * - Unit conversion (wei, gwei, FLR/SGB)
 * - ABI encoding/decoding
 * - Hashing and signing
 * - Address validation
 * - System contract lookups
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { ethers } from 'ethers';
import { createFlareConnection } from '../../transport/provider';
import { SYSTEM_CONTRACTS } from '../../constants/systemContracts';
import { FLARE_NETWORKS, getNetworkConfig } from '../../constants/networks';
import {
	weiToEther,
	etherToWei,
	weiToGwei,
	gweiToWei,
	formatTokenAmount,
	parseTokenAmount,
} from '../../utils/unitConverter';

export const utilityOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['utility'],
			},
		},
		options: [
			{
				name: 'Convert Units',
				value: 'convertUnits',
				description: 'Convert between wei, gwei, and FLR/SGB',
				action: 'Convert units',
			},
			{
				name: 'Parse Units',
				value: 'parseUnits',
				description: 'Parse human-readable amount to wei',
				action: 'Parse units',
			},
			{
				name: 'Format Units',
				value: 'formatUnits',
				description: 'Format wei to human-readable amount',
				action: 'Format units',
			},
			{
				name: 'Encode Function Call',
				value: 'encodeFunction',
				description: 'Encode function call data',
				action: 'Encode function call',
			},
			{
				name: 'Decode Function Call',
				value: 'decodeFunction',
				description: 'Decode function call data',
				action: 'Decode function call',
			},
			{
				name: 'Encode ABI Parameters',
				value: 'encodeAbi',
				description: 'Encode ABI parameters',
				action: 'Encode ABI parameters',
			},
			{
				name: 'Decode ABI Parameters',
				value: 'decodeAbi',
				description: 'Decode ABI encoded data',
				action: 'Decode ABI parameters',
			},
			{
				name: 'Keccak256 Hash',
				value: 'keccak256',
				description: 'Calculate Keccak256 hash',
				action: 'Keccak256 hash',
			},
			{
				name: 'Sign Message',
				value: 'signMessage',
				description: 'Sign a message with private key',
				action: 'Sign message',
			},
			{
				name: 'Verify Signature',
				value: 'verifySignature',
				description: 'Verify message signature',
				action: 'Verify signature',
			},
			{
				name: 'Validate Address',
				value: 'validateAddress',
				description: 'Validate Ethereum address format',
				action: 'Validate address',
			},
			{
				name: 'Checksum Address',
				value: 'checksumAddress',
				description: 'Convert to checksummed address',
				action: 'Checksum address',
			},
			{
				name: 'Get System Contracts',
				value: 'getSystemContracts',
				description: 'Get Flare system contract addresses',
				action: 'Get system contracts',
			},
			{
				name: 'Get Contract Registry',
				value: 'getContractRegistry',
				description: 'Look up contract from registry',
				action: 'Get contract registry',
			},
			{
				name: 'Generate Wallet',
				value: 'generateWallet',
				description: 'Generate a new random wallet',
				action: 'Generate wallet',
			},
			{
				name: 'Derive Address',
				value: 'deriveAddress',
				description: 'Derive address from private key',
				action: 'Derive address',
			},
		],
		default: 'convertUnits',
	},
];

export const utilityFields: INodeProperties[] = [
	// Value for conversions
	{
		displayName: 'Value',
		name: 'value',
		type: 'string',
		required: true,
		default: '',
		placeholder: '1000000000000000000',
		description: 'Value to convert',
		displayOptions: {
			show: {
				resource: ['utility'],
				operation: ['convertUnits', 'parseUnits', 'formatUnits'],
			},
		},
	},
	// From unit
	{
		displayName: 'From Unit',
		name: 'fromUnit',
		type: 'options',
		required: true,
		options: [
			{ name: 'Wei', value: 'wei' },
			{ name: 'Gwei', value: 'gwei' },
			{ name: 'Ether (FLR/SGB)', value: 'ether' },
		],
		default: 'wei',
		description: 'Source unit',
		displayOptions: {
			show: {
				resource: ['utility'],
				operation: ['convertUnits'],
			},
		},
	},
	// To unit
	{
		displayName: 'To Unit',
		name: 'toUnit',
		type: 'options',
		required: true,
		options: [
			{ name: 'Wei', value: 'wei' },
			{ name: 'Gwei', value: 'gwei' },
			{ name: 'Ether (FLR/SGB)', value: 'ether' },
		],
		default: 'ether',
		description: 'Target unit',
		displayOptions: {
			show: {
				resource: ['utility'],
				operation: ['convertUnits'],
			},
		},
	},
	// Decimals for parse/format
	{
		displayName: 'Decimals',
		name: 'decimals',
		type: 'number',
		required: false,
		default: 18,
		description: 'Token decimals (default: 18)',
		displayOptions: {
			show: {
				resource: ['utility'],
				operation: ['parseUnits', 'formatUnits'],
			},
		},
	},
	// Function signature
	{
		displayName: 'Function Signature',
		name: 'functionSignature',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'transfer(address,uint256)',
		description: 'Function signature (e.g., "transfer(address,uint256)")',
		displayOptions: {
			show: {
				resource: ['utility'],
				operation: ['encodeFunction', 'decodeFunction'],
			},
		},
	},
	// Function parameters
	{
		displayName: 'Parameters',
		name: 'parameters',
		type: 'string',
		required: true,
		default: '',
		placeholder: '["0x123...", "1000"]',
		description: 'Function parameters as JSON array',
		displayOptions: {
			show: {
				resource: ['utility'],
				operation: ['encodeFunction', 'encodeAbi'],
			},
		},
	},
	// Encoded data
	{
		displayName: 'Encoded Data',
		name: 'encodedData',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Encoded data to decode',
		displayOptions: {
			show: {
				resource: ['utility'],
				operation: ['decodeFunction', 'decodeAbi'],
			},
		},
	},
	// ABI types
	{
		displayName: 'ABI Types',
		name: 'abiTypes',
		type: 'string',
		required: true,
		default: '',
		placeholder: '["address", "uint256"]',
		description: 'ABI types as JSON array',
		displayOptions: {
			show: {
				resource: ['utility'],
				operation: ['encodeAbi', 'decodeAbi'],
			},
		},
	},
	// Data for hashing
	{
		displayName: 'Data',
		name: 'data',
		type: 'string',
		required: true,
		default: '',
		description: 'Data to hash',
		displayOptions: {
			show: {
				resource: ['utility'],
				operation: ['keccak256'],
			},
		},
	},
	// Hash type
	{
		displayName: 'Input Type',
		name: 'inputType',
		type: 'options',
		required: true,
		options: [
			{ name: 'Text', value: 'text' },
			{ name: 'Hex', value: 'hex' },
		],
		default: 'text',
		description: 'Type of input data',
		displayOptions: {
			show: {
				resource: ['utility'],
				operation: ['keccak256'],
			},
		},
	},
	// Message for signing
	{
		displayName: 'Message',
		name: 'message',
		type: 'string',
		required: true,
		default: '',
		description: 'Message to sign or verify',
		displayOptions: {
			show: {
				resource: ['utility'],
				operation: ['signMessage', 'verifySignature'],
			},
		},
	},
	// Signature
	{
		displayName: 'Signature',
		name: 'signature',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Signature to verify',
		displayOptions: {
			show: {
				resource: ['utility'],
				operation: ['verifySignature'],
			},
		},
	},
	// Expected signer
	{
		displayName: 'Expected Signer',
		name: 'expectedSigner',
		type: 'string',
		required: false,
		default: '',
		placeholder: '0x...',
		description: 'Expected signer address (optional)',
		displayOptions: {
			show: {
				resource: ['utility'],
				operation: ['verifySignature'],
			},
		},
	},
	// Address
	{
		displayName: 'Address',
		name: 'address',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Ethereum address',
		displayOptions: {
			show: {
				resource: ['utility'],
				operation: ['validateAddress', 'checksumAddress'],
			},
		},
	},
	// Contract name for registry
	{
		displayName: 'Contract Name',
		name: 'contractName',
		type: 'options',
		required: true,
		options: [
			{ name: 'WNat (Wrapped Native)', value: 'WNat' },
			{ name: 'FTSO Registry', value: 'FtsoRegistry' },
			{ name: 'FTSO Reward Manager', value: 'FtsoRewardManager' },
			{ name: 'State Connector', value: 'StateConnector' },
			{ name: 'Price Submitter', value: 'PriceSubmitter' },
			{ name: 'Voter Whitelister', value: 'VoterWhitelister' },
			{ name: 'Claim Setup Manager', value: 'ClaimSetupManager' },
			{ name: 'Governance Vote Power', value: 'GovernanceVotePower' },
			{ name: 'Distribution', value: 'Distribution' },
			{ name: 'Inflation', value: 'Inflation' },
		],
		default: 'WNat',
		description: 'System contract to look up',
		displayOptions: {
			show: {
				resource: ['utility'],
				operation: ['getContractRegistry'],
			},
		},
	},
	// Private key for deriving address
	{
		displayName: 'Private Key',
		name: 'privateKey',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Private key to derive address from',
		displayOptions: {
			show: {
				resource: ['utility'],
				operation: ['deriveAddress'],
			},
		},
		typeOptions: {
			password: true,
		},
	},
];

export async function executeUtility(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;
	const credentials = await this.getCredentials('flareNetworkApi');
	const connection = await createFlareConnection(credentials as any);

	const networkName = (credentials.network as string) || 'flare';

	let result: any;

	switch (operation) {
		case 'convertUnits': {
			const value = this.getNodeParameter('value', index) as string;
			const fromUnit = this.getNodeParameter('fromUnit', index) as string;
			const toUnit = this.getNodeParameter('toUnit', index) as string;

			let weiValue: bigint;

			// Convert to wei first
			switch (fromUnit) {
				case 'wei':
					weiValue = BigInt(value);
					break;
				case 'gwei':
					weiValue = gweiToWei(parseFloat(value));
					break;
				case 'ether':
					weiValue = etherToWei(value);
					break;
				default:
					throw new NodeOperationError(this.getNode(), `Unknown unit: ${fromUnit}`);
			}

			// Convert from wei to target
			let resultValue: string;
			switch (toUnit) {
				case 'wei':
					resultValue = weiValue.toString();
					break;
				case 'gwei':
					resultValue = weiToGwei(weiValue).toString();
					break;
				case 'ether':
					resultValue = weiToEther(weiValue);
					break;
				default:
					throw new NodeOperationError(this.getNode(), `Unknown unit: ${toUnit}`);
			}

			result = {
				input: value,
				fromUnit,
				toUnit,
				result: resultValue,
				weiValue: weiValue.toString(),
			};
			break;
		}

		case 'parseUnits': {
			const value = this.getNodeParameter('value', index) as string;
			const decimals = this.getNodeParameter('decimals', index, 18) as number;

			const weiValue = parseTokenAmount(value, decimals);

			result = {
				input: value,
				decimals,
				weiValue: weiValue.toString(),
			};
			break;
		}

		case 'formatUnits': {
			const value = this.getNodeParameter('value', index) as string;
			const decimals = this.getNodeParameter('decimals', index, 18) as number;

			const formatted = formatTokenAmount(BigInt(value), decimals);

			result = {
				input: value,
				decimals,
				formatted,
			};
			break;
		}

		case 'encodeFunction': {
			const functionSignature = this.getNodeParameter('functionSignature', index) as string;
			const parametersStr = this.getNodeParameter('parameters', index) as string;

			let parameters: any[];
			try {
				parameters = JSON.parse(parametersStr);
			} catch (e) {
				throw new NodeOperationError(this.getNode(), 'Invalid JSON parameters');
			}

			const iface = new ethers.Interface([`function ${functionSignature}`]);
			const functionName = functionSignature.split('(')[0];
			const encoded = iface.encodeFunctionData(functionName, parameters);

			result = {
				functionSignature,
				parameters,
				encoded,
				selector: encoded.slice(0, 10),
			};
			break;
		}

		case 'decodeFunction': {
			const functionSignature = this.getNodeParameter('functionSignature', index) as string;
			const encodedData = this.getNodeParameter('encodedData', index) as string;

			const iface = new ethers.Interface([`function ${functionSignature}`]);
			const functionName = functionSignature.split('(')[0];
			const decoded = iface.decodeFunctionData(functionName, encodedData);

			result = {
				functionSignature,
				encodedData,
				decoded: decoded.toArray().map((v: any) => v.toString()),
			};
			break;
		}

		case 'encodeAbi': {
			const abiTypesStr = this.getNodeParameter('abiTypes', index) as string;
			const parametersStr = this.getNodeParameter('parameters', index) as string;

			let abiTypes: string[];
			let parameters: any[];
			try {
				abiTypes = JSON.parse(abiTypesStr);
				parameters = JSON.parse(parametersStr);
			} catch (e) {
				throw new NodeOperationError(this.getNode(), 'Invalid JSON input');
			}

			const abiCoder = ethers.AbiCoder.defaultAbiCoder();
			const encoded = abiCoder.encode(abiTypes, parameters);

			result = {
				types: abiTypes,
				values: parameters,
				encoded,
			};
			break;
		}

		case 'decodeAbi': {
			const abiTypesStr = this.getNodeParameter('abiTypes', index) as string;
			const encodedData = this.getNodeParameter('encodedData', index) as string;

			let abiTypes: string[];
			try {
				abiTypes = JSON.parse(abiTypesStr);
			} catch (e) {
				throw new NodeOperationError(this.getNode(), 'Invalid JSON types');
			}

			const abiCoder = ethers.AbiCoder.defaultAbiCoder();
			const decoded = abiCoder.decode(abiTypes, encodedData);

			result = {
				types: abiTypes,
				encodedData,
				decoded: decoded.toArray().map((v: any) => v.toString()),
			};
			break;
		}

		case 'keccak256': {
			const data = this.getNodeParameter('data', index) as string;
			const inputType = this.getNodeParameter('inputType', index) as string;

			let hash: string;
			if (inputType === 'hex') {
				hash = ethers.keccak256(data);
			} else {
				hash = ethers.keccak256(ethers.toUtf8Bytes(data));
			}

			result = {
				input: data,
				inputType,
				hash,
			};
			break;
		}

		case 'signMessage': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required for signing');
			}

			const message = this.getNodeParameter('message', index) as string;
			const signature = await connection.wallet.signMessage(message);

			result = {
				message,
				signature,
				signer: connection.wallet.address,
			};
			break;
		}

		case 'verifySignature': {
			const message = this.getNodeParameter('message', index) as string;
			const signature = this.getNodeParameter('signature', index) as string;
			const expectedSigner = this.getNodeParameter('expectedSigner', index, '') as string;

			const recoveredAddress = ethers.verifyMessage(message, signature);
			const isValid = expectedSigner
				? recoveredAddress.toLowerCase() === expectedSigner.toLowerCase()
				: true;

			result = {
				message,
				signature,
				recoveredSigner: recoveredAddress,
				expectedSigner: expectedSigner || 'not specified',
				isValid,
			};
			break;
		}

		case 'validateAddress': {
			const address = this.getNodeParameter('address', index) as string;

			const isValid = ethers.isAddress(address);
			const checksumAddress = isValid ? ethers.getAddress(address) : null;
			const isChecksum = address === checksumAddress;

			result = {
				address,
				isValid,
				checksumAddress,
				isChecksum,
				length: address.length,
				hasPrefix: address.startsWith('0x'),
			};
			break;
		}

		case 'checksumAddress': {
			const address = this.getNodeParameter('address', index) as string;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const checksumAddress = ethers.getAddress(address);

			result = {
				input: address,
				checksumAddress,
				wasAlreadyChecksummed: address === checksumAddress,
			};
			break;
		}

		case 'getSystemContracts': {
			const contracts = SYSTEM_CONTRACTS[networkName] || SYSTEM_CONTRACTS.flare;
			const config = FLARE_NETWORKS[networkName] || FLARE_NETWORKS.flare;

			result = {
				network: networkName,
				chainId: config.chainId,
				contracts: {
					...contracts,
				},
				note: 'Addresses for Flare network system contracts',
			};
			break;
		}

		case 'getContractRegistry': {
			const contractName = this.getNodeParameter('contractName', index) as string;
			const contracts = SYSTEM_CONTRACTS[networkName] || SYSTEM_CONTRACTS.flare;

			const address = contracts[contractName as keyof typeof contracts];

			result = {
				network: networkName,
				contractName,
				address: address || null,
				available: !!address,
			};
			break;
		}

		case 'generateWallet': {
			const wallet = ethers.Wallet.createRandom();

			result = {
				address: wallet.address,
				privateKey: wallet.privateKey,
				mnemonic: wallet.mnemonic?.phrase,
				warning: 'SAVE THIS SECURELY - Private key provides full control of funds',
			};
			break;
		}

		case 'deriveAddress': {
			const privateKey = this.getNodeParameter('privateKey', index) as string;

			try {
				const wallet = new ethers.Wallet(privateKey);

				result = {
					address: wallet.address,
					checksumAddress: ethers.getAddress(wallet.address),
				};
			} catch (error) {
				throw new NodeOperationError(this.getNode(), 'Invalid private key');
			}
			break;
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
	}

	return [{ json: result }];
}
