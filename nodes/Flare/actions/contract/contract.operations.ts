import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { ethers } from 'ethers';
import { createFlareConnection } from '../../transport/provider';
import { MULTICALL3_ABI } from '../../constants/abis';
import { SYSTEM_CONTRACTS } from '../../constants/systemContracts';

/**
 * Contract Resource Operations
 * 
 * Provides smart contract interaction capabilities:
 * - Read contract state (call view/pure functions)
 * - Write to contracts (send transactions)
 * - ABI encoding/decoding
 * - Event querying
 * - Contract deployment
 * - Multicall batch operations
 */

export const contractOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['contract'],
			},
		},
		options: [
			{
				name: 'Read Contract',
				value: 'readContract',
				description: 'Call a read-only function on a smart contract',
				action: 'Read contract',
			},
			{
				name: 'Write Contract',
				value: 'writeContract',
				description: 'Send a transaction to a smart contract function',
				action: 'Write contract',
			},
			{
				name: 'Get Contract ABI',
				value: 'getContractAbi',
				description: 'Get the ABI for a verified contract from explorer',
				action: 'Get contract ABI',
			},
			{
				name: 'Encode Function Call',
				value: 'encodeFunctionCall',
				description: 'Encode a function call for manual transaction building',
				action: 'Encode function call',
			},
			{
				name: 'Decode Function Result',
				value: 'decodeFunctionResult',
				description: 'Decode the result of a contract call',
				action: 'Decode function result',
			},
			{
				name: 'Get Contract Events',
				value: 'getContractEvents',
				description: 'Query historical events from a contract',
				action: 'Get contract events',
			},
			{
				name: 'Deploy Contract',
				value: 'deployContract',
				description: 'Deploy a new smart contract',
				action: 'Deploy contract',
			},
			{
				name: 'Estimate Contract Gas',
				value: 'estimateContractGas',
				description: 'Estimate gas for a contract function call',
				action: 'Estimate contract gas',
			},
			{
				name: 'Get Contract Code',
				value: 'getContractCode',
				description: 'Get the bytecode deployed at an address',
				action: 'Get contract code',
			},
			{
				name: 'Multicall',
				value: 'multicall',
				description: 'Execute multiple contract reads in a single call',
				action: 'Multicall batch reads',
			},
		],
		default: 'readContract',
	},
];

export const contractFields: INodeProperties[] = [
	// Contract Address - used by most operations
	{
		displayName: 'Contract Address',
		name: 'contractAddress',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['contract'],
				operation: [
					'readContract',
					'writeContract',
					'getContractAbi',
					'getContractEvents',
					'estimateContractGas',
					'getContractCode',
				],
			},
		},
		default: '',
		placeholder: '0x...',
		description: 'The address of the smart contract',
	},

	// ABI Input
	{
		displayName: 'ABI',
		name: 'abi',
		type: 'json',
		required: true,
		displayOptions: {
			show: {
				resource: ['contract'],
				operation: [
					'readContract',
					'writeContract',
					'encodeFunctionCall',
					'decodeFunctionResult',
					'getContractEvents',
					'estimateContractGas',
					'deployContract',
				],
			},
		},
		default: '[]',
		placeholder: '[{"name": "balanceOf", "type": "function", ...}]',
		description: 'The ABI (Application Binary Interface) of the contract as JSON array',
	},

	// Function Name
	{
		displayName: 'Function Name',
		name: 'functionName',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['contract'],
				operation: [
					'readContract',
					'writeContract',
					'encodeFunctionCall',
					'decodeFunctionResult',
					'estimateContractGas',
				],
			},
		},
		default: '',
		placeholder: 'balanceOf',
		description: 'The name of the function to call',
	},

	// Function Arguments
	{
		displayName: 'Function Arguments',
		name: 'functionArgs',
		type: 'json',
		displayOptions: {
			show: {
				resource: ['contract'],
				operation: [
					'readContract',
					'writeContract',
					'encodeFunctionCall',
					'estimateContractGas',
				],
			},
		},
		default: '[]',
		placeholder: '["0x123...", 1000]',
		description: 'Arguments to pass to the function as JSON array. BigInt values should be strings.',
	},

	// Encoded Data for decoding
	{
		displayName: 'Encoded Data',
		name: 'encodedData',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['contract'],
				operation: ['decodeFunctionResult'],
			},
		},
		default: '',
		placeholder: '0x...',
		description: 'The hex-encoded data to decode',
	},

	// Event Name for querying events
	{
		displayName: 'Event Name',
		name: 'eventName',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['contract'],
				operation: ['getContractEvents'],
			},
		},
		default: '',
		placeholder: 'Transfer',
		description: 'The name of the event to query',
	},

	// Event Filter Topics
	{
		displayName: 'Event Filters',
		name: 'eventFilters',
		type: 'json',
		displayOptions: {
			show: {
				resource: ['contract'],
				operation: ['getContractEvents'],
			},
		},
		default: '{}',
		placeholder: '{"from": "0x...", "to": "0x..."}',
		description: 'Filter topics for the event query as JSON object',
	},

	// Block Range for events
	{
		displayName: 'From Block',
		name: 'fromBlock',
		type: 'number',
		displayOptions: {
			show: {
				resource: ['contract'],
				operation: ['getContractEvents'],
			},
		},
		default: 0,
		description: 'Starting block number for event query (0 for genesis)',
	},
	{
		displayName: 'To Block',
		name: 'toBlock',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['contract'],
				operation: ['getContractEvents'],
			},
		},
		default: 'latest',
		description: 'Ending block number or "latest"',
	},

	// Contract Bytecode for deployment
	{
		displayName: 'Contract Bytecode',
		name: 'bytecode',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['contract'],
				operation: ['deployContract'],
			},
		},
		default: '',
		placeholder: '0x608060...',
		description: 'The compiled contract bytecode',
	},

	// Constructor Arguments for deployment
	{
		displayName: 'Constructor Arguments',
		name: 'constructorArgs',
		type: 'json',
		displayOptions: {
			show: {
				resource: ['contract'],
				operation: ['deployContract'],
			},
		},
		default: '[]',
		placeholder: '["arg1", 123]',
		description: 'Arguments for the contract constructor as JSON array',
	},

	// Value to send with transaction
	{
		displayName: 'Value (Native Token)',
		name: 'value',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['contract'],
				operation: ['writeContract', 'deployContract', 'estimateContractGas'],
			},
		},
		default: '0',
		description: 'Amount of native token (FLR/SGB) to send with the transaction (in wei)',
	},

	// Gas options
	{
		displayName: 'Gas Options',
		name: 'gasOptions',
		type: 'collection',
		placeholder: 'Add Gas Option',
		displayOptions: {
			show: {
				resource: ['contract'],
				operation: ['writeContract', 'deployContract'],
			},
		},
		default: {},
		options: [
			{
				displayName: 'Gas Limit',
				name: 'gasLimit',
				type: 'number',
				default: 0,
				description: 'Maximum gas to use (0 for auto)',
			},
			{
				displayName: 'Max Fee Per Gas (Gwei)',
				name: 'maxFeePerGas',
				type: 'number',
				default: 0,
				description: 'Maximum fee per gas in gwei (0 for auto)',
			},
			{
				displayName: 'Max Priority Fee (Gwei)',
				name: 'maxPriorityFeePerGas',
				type: 'number',
				default: 0,
				description: 'Maximum priority fee per gas in gwei (0 for auto)',
			},
		],
	},

	// Multicall calls array
	{
		displayName: 'Calls',
		name: 'multicallCalls',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		displayOptions: {
			show: {
				resource: ['contract'],
				operation: ['multicall'],
			},
		},
		default: {},
		options: [
			{
				name: 'call',
				displayName: 'Call',
				values: [
					{
						displayName: 'Target Address',
						name: 'target',
						type: 'string',
						default: '',
						description: 'Contract address to call',
					},
					{
						displayName: 'ABI',
						name: 'abi',
						type: 'json',
						default: '[]',
						description: 'ABI of the function',
					},
					{
						displayName: 'Function Name',
						name: 'functionName',
						type: 'string',
						default: '',
						description: 'Function to call',
					},
					{
						displayName: 'Arguments',
						name: 'args',
						type: 'json',
						default: '[]',
						description: 'Function arguments as JSON array',
					},
				],
			},
		],
		description: 'Array of contract calls to execute in a single multicall',
	},
];

/**
 * Execute contract operations
 */
export async function executeContractOperation(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;
	const credentials = await this.getCredentials('flareNetworkApi');
	const connection = await createFlareConnection(credentials as any);
	const { provider, network, wallet: signer } = connection;

	let result: any;

	switch (operation) {
		case 'readContract': {
			const contractAddress = this.getNodeParameter('contractAddress', index) as string;
			const abi = JSON.parse(this.getNodeParameter('abi', index) as string);
			const functionName = this.getNodeParameter('functionName', index) as string;
			const functionArgs = JSON.parse(this.getNodeParameter('functionArgs', index) as string || '[]');

			// Create contract instance
			const contract = new ethers.Contract(contractAddress, abi, provider);

			// Check if function exists
			if (!contract[functionName]) {
				throw new NodeOperationError(
					this.getNode(),
					`Function '${functionName}' not found in contract ABI`,
				);
			}

			// Call the function
			const response = await contract[functionName](...functionArgs);

			// Format the response
			result = {
				success: true,
				network: network.name,
				contractAddress,
				functionName,
				arguments: functionArgs,
				result: formatContractResult(response),
				rawResult: response.toString ? response.toString() : response,
			};
			break;
		}

		case 'writeContract': {
			if (!signer) {
				throw new NodeOperationError(
					this.getNode(),
					'Private key required for write operations',
				);
			}

			const contractAddress = this.getNodeParameter('contractAddress', index) as string;
			const abi = JSON.parse(this.getNodeParameter('abi', index) as string);
			const functionName = this.getNodeParameter('functionName', index) as string;
			const functionArgs = JSON.parse(this.getNodeParameter('functionArgs', index) as string || '[]');
			const value = this.getNodeParameter('value', index, '0') as string;
			const gasOptions = this.getNodeParameter('gasOptions', index, {}) as Record<string, number>;

			// Create contract instance with signer
			const contract = new ethers.Contract(contractAddress, abi, signer);

			// Check if function exists
			if (!contract[functionName]) {
				throw new NodeOperationError(
					this.getNode(),
					`Function '${functionName}' not found in contract ABI`,
				);
			}

			// Build transaction options
			const txOptions: Record<string, unknown> = {};
			if (value && value !== '0') {
				txOptions.value = BigInt(value);
			}
			if (gasOptions.gasLimit) {
				txOptions.gasLimit = gasOptions.gasLimit;
			}
			if (gasOptions.maxFeePerGas) {
				txOptions.maxFeePerGas = ethers.parseUnits(gasOptions.maxFeePerGas.toString(), 'gwei');
			}
			if (gasOptions.maxPriorityFeePerGas) {
				txOptions.maxPriorityFeePerGas = ethers.parseUnits(gasOptions.maxPriorityFeePerGas.toString(), 'gwei');
			}

			// Send the transaction
			const tx = await contract[functionName](...functionArgs, txOptions);
			const receipt = await tx.wait();

			result = {
				success: true,
				network: network.name,
				contractAddress,
				functionName,
				arguments: functionArgs,
				transactionHash: receipt.hash,
				blockNumber: receipt.blockNumber,
				gasUsed: receipt.gasUsed.toString(),
				effectiveGasPrice: ethers.formatUnits(receipt.gasPrice || 0n, 'gwei') + ' gwei',
				status: receipt.status === 1 ? 'success' : 'failed',
				events: receipt.logs.map((log: ethers.Log) => ({
					address: log.address,
					topics: log.topics,
					data: log.data,
				})),
			};
			break;
		}

		case 'getContractAbi': {
			const contractAddress = this.getNodeParameter('contractAddress', index) as string;

			// This would typically call the explorer API
			// For now, we indicate it requires the explorer credentials
			result = {
				success: false,
				message: 'ABI retrieval requires Flare Explorer API credentials',
				contractAddress,
				network: network.name,
				explorerUrl: network.name === 'Flare' 
					? `https://flare-explorer.flare.network/address/${contractAddress}#code`
					: `https://songbird-explorer.flare.network/address/${contractAddress}#code`,
				hint: 'Use the Flare Explorer API with appropriate credentials to fetch verified contract ABIs',
			};
			break;
		}

		case 'encodeFunctionCall': {
			const abi = JSON.parse(this.getNodeParameter('abi', index) as string);
			const functionName = this.getNodeParameter('functionName', index) as string;
			const functionArgs = JSON.parse(this.getNodeParameter('functionArgs', index) as string || '[]');

			// Create interface from ABI
			const iface = new ethers.Interface(abi);

			// Encode the function call
			const encodedData = iface.encodeFunctionData(functionName, functionArgs);

			// Get the function signature
			const fragment = iface.getFunction(functionName);
			const selector = fragment ? iface.getFunction(functionName)?.selector : 'unknown';

			result = {
				success: true,
				functionName,
				arguments: functionArgs,
				selector,
				encodedData,
				dataLength: encodedData.length,
			};
			break;
		}

		case 'decodeFunctionResult': {
			const abi = JSON.parse(this.getNodeParameter('abi', index) as string);
			const functionName = this.getNodeParameter('functionName', index) as string;
			const encodedData = this.getNodeParameter('encodedData', index) as string;

			// Create interface from ABI
			const iface = new ethers.Interface(abi);

			// Decode the result
			const decodedResult = iface.decodeFunctionResult(functionName, encodedData);

			result = {
				success: true,
				functionName,
				encodedData,
				decodedResult: formatContractResult(decodedResult),
				resultCount: decodedResult.length,
			};
			break;
		}

		case 'getContractEvents': {
			const contractAddress = this.getNodeParameter('contractAddress', index) as string;
			const abi = JSON.parse(this.getNodeParameter('abi', index) as string);
			const eventName = this.getNodeParameter('eventName', index) as string;
			const eventFilters = JSON.parse(this.getNodeParameter('eventFilters', index) as string || '{}');
			const fromBlock = this.getNodeParameter('fromBlock', index, 0) as number;
			const toBlockInput = this.getNodeParameter('toBlock', index, 'latest') as string;

			const toBlock = toBlockInput === 'latest' ? 'latest' : parseInt(toBlockInput, 10);

			// Create contract instance
			const contract = new ethers.Contract(contractAddress, abi, provider);

			// Get the event filter
			const filter = contract.filters[eventName]?.(...Object.values(eventFilters));
			if (!filter) {
				throw new NodeOperationError(
					this.getNode(),
					`Event '${eventName}' not found in contract ABI`,
				);
			}

			// Query events
			const events = await contract.queryFilter(filter, fromBlock, toBlock);

			result = {
				success: true,
				network: network.name,
				contractAddress,
				eventName,
				filters: eventFilters,
				fromBlock,
				toBlock,
				eventCount: events.length,
				events: events.map((event: any) => ({
					blockNumber: event.blockNumber,
					transactionHash: event.transactionHash,
					logIndex: event.index,
					args: formatContractResult(event.args || {}),
				})),
			};
			break;
		}

		case 'deployContract': {
			if (!signer) {
				throw new NodeOperationError(
					this.getNode(),
					'Private key required for contract deployment',
				);
			}

			const abi = JSON.parse(this.getNodeParameter('abi', index) as string);
			const bytecode = this.getNodeParameter('bytecode', index) as string;
			const constructorArgs = JSON.parse(this.getNodeParameter('constructorArgs', index) as string || '[]');
			const value = this.getNodeParameter('value', index, '0') as string;
			const gasOptions = this.getNodeParameter('gasOptions', index, {}) as Record<string, number>;

			// Create contract factory
			const factory = new ethers.ContractFactory(abi, bytecode, signer);

			// Build deployment options
			const deployOptions: Record<string, unknown> = {};
			if (value && value !== '0') {
				deployOptions.value = BigInt(value);
			}
			if (gasOptions.gasLimit) {
				deployOptions.gasLimit = gasOptions.gasLimit;
			}
			if (gasOptions.maxFeePerGas) {
				deployOptions.maxFeePerGas = ethers.parseUnits(gasOptions.maxFeePerGas.toString(), 'gwei');
			}
			if (gasOptions.maxPriorityFeePerGas) {
				deployOptions.maxPriorityFeePerGas = ethers.parseUnits(gasOptions.maxPriorityFeePerGas.toString(), 'gwei');
			}

			// Deploy the contract
			const contract = await factory.deploy(...constructorArgs, deployOptions);
			const deployTx = contract.deploymentTransaction();
			
			// Wait for deployment
			await contract.waitForDeployment();
			const deployedAddress = await contract.getAddress();

			result = {
				success: true,
				network: network.name,
				contractAddress: deployedAddress,
				transactionHash: deployTx?.hash,
				blockNumber: deployTx?.blockNumber,
				deployer: await signer.getAddress(),
				constructorArgs,
				gasUsed: 'Check transaction receipt for gas used',
			};
			break;
		}

		case 'estimateContractGas': {
			const contractAddress = this.getNodeParameter('contractAddress', index) as string;
			const abi = JSON.parse(this.getNodeParameter('abi', index) as string);
			const functionName = this.getNodeParameter('functionName', index) as string;
			const functionArgs = JSON.parse(this.getNodeParameter('functionArgs', index) as string || '[]');
			const value = this.getNodeParameter('value', index, '0') as string;

			// Create contract instance
			const contract = new ethers.Contract(contractAddress, abi, provider);

			// Check if function exists
			if (!contract[functionName]) {
				throw new NodeOperationError(
					this.getNode(),
					`Function '${functionName}' not found in contract ABI`,
				);
			}

			// Build call options
			const callOptions: Record<string, unknown> = {};
			if (value && value !== '0') {
				callOptions.value = BigInt(value);
			}

			// Estimate gas
			const gasEstimate = await contract[functionName].estimateGas(...functionArgs, callOptions);
			
			// Get current gas price
			const feeData = await provider.getFeeData();
			const gasPrice = feeData.gasPrice || 0n;
			const maxFeePerGas = feeData.maxFeePerGas || gasPrice;

			// Calculate estimated cost
			const estimatedCost = gasEstimate * maxFeePerGas;

			result = {
				success: true,
				network: network.name,
				contractAddress,
				functionName,
				arguments: functionArgs,
				gasEstimate: gasEstimate.toString(),
				currentGasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei',
				maxFeePerGas: ethers.formatUnits(maxFeePerGas, 'gwei') + ' gwei',
				estimatedCost: ethers.formatEther(estimatedCost) + ` ${network.name === 'Flare' || network.name === 'Coston2' ? 'FLR' : 'SGB'}`,
				estimatedCostWei: estimatedCost.toString(),
			};
			break;
		}

		case 'getContractCode': {
			const contractAddress = this.getNodeParameter('contractAddress', index) as string;

			// Get the bytecode
			const code = await provider.getCode(contractAddress);

			result = {
				success: true,
				network: network.name,
				contractAddress,
				hasCode: code !== '0x',
				codeSize: code === '0x' ? 0 : (code.length - 2) / 2, // Bytes count
				code: code.length > 1000 ? code.substring(0, 1000) + '...' : code,
				fullCodeLength: code.length,
			};
			break;
		}

		case 'multicall': {
			const multicallCalls = this.getNodeParameter('multicallCalls', index) as { call: Array<{
				target: string;
				abi: string;
				functionName: string;
				args: string;
			}> };

			if (!multicallCalls.call || multicallCalls.call.length === 0) {
				throw new NodeOperationError(
					this.getNode(),
					'At least one call is required for multicall',
				);
			}

			// Get Multicall3 address (same across most EVM chains)
			const multicallAddress = '0xcA11bde05977b3631167028862bE2a173976CA11';

			// Create Multicall3 contract
			const multicall = new ethers.Contract(multicallAddress, MULTICALL3_ABI, provider);

			// Prepare the calls
			const calls = multicallCalls.call.map((call) => {
				const abi = JSON.parse(call.abi);
				const args = JSON.parse(call.args || '[]');
				const iface = new ethers.Interface(abi);
				const callData = iface.encodeFunctionData(call.functionName, args);
				
				return {
					target: call.target,
					allowFailure: true,
					callData,
				};
			});

			// Execute multicall
			const results = await multicall.aggregate3.staticCall(calls);

			// Decode results
			const decodedResults = results.map((res: { success: boolean; returnData: string }, i: number) => {
				if (!res.success) {
					return {
						success: false,
						error: 'Call failed',
						target: calls[i].target,
					};
				}

				try {
					const call = multicallCalls.call[i];
					const abi = JSON.parse(call.abi);
					const iface = new ethers.Interface(abi);
					const decoded = iface.decodeFunctionResult(call.functionName, res.returnData);
					
					return {
						success: true,
						target: call.target,
						functionName: call.functionName,
						result: formatContractResult(decoded),
					};
				} catch (error) {
					return {
						success: false,
						error: 'Failed to decode result',
						target: calls[i].target,
						rawData: res.returnData,
					};
				}
			});

			result = {
				success: true,
				network: network.name,
				multicallAddress,
				totalCalls: calls.length,
				successfulCalls: decodedResults.filter((r: { success: boolean }) => r.success).length,
				results: decodedResults,
			};
			break;
		}

		default:
			throw new NodeOperationError(
				this.getNode(),
				`Unknown operation: ${operation}`,
			);
	}

	return [{ json: result }];
}

/**
 * Format contract result for JSON output
 * Handles BigInt, arrays, and nested objects
 */
function formatContractResult(value: unknown): unknown {
	if (value === null || value === undefined) {
		return value;
	}

	if (typeof value === 'bigint') {
		return value.toString();
	}

	if (Array.isArray(value)) {
		// Check if it's a Result object (has numeric and named keys)
		const result: Record<string, unknown> = {};
		let hasNamedKeys = false;

		for (let i = 0; i < value.length; i++) {
			result[i.toString()] = formatContractResult(value[i]);
		}

		// Also check for named properties
		for (const key of Object.keys(value)) {
			if (isNaN(parseInt(key, 10))) {
				hasNamedKeys = true;
				result[key] = formatContractResult((value as any)[key]);
			}
		}

		// If it has named keys, return as object; otherwise as array
		if (hasNamedKeys) {
			return result;
		}
		return value.map(formatContractResult);
	}

	if (typeof value === 'object') {
		const formatted: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value)) {
			formatted[key] = formatContractResult(val);
		}
		return formatted;
	}

	return value;
}
