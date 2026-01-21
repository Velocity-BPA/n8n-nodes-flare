import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { ethers } from 'ethers';
import { createFlareConnection } from '../../transport/provider';

/**
 * Block Resource Operations
 * 
 * Provides blockchain block data access:
 * - Query blocks by number or hash
 * - Get latest/finalized blocks
 * - Access block transactions
 * - Block timestamp queries
 * 
 * Flare Network produces blocks approximately every 1-2 seconds
 * on the C-Chain (EVM-compatible layer).
 */

export const blockOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['block'],
			},
		},
		options: [
			{
				name: 'Get Block',
				value: 'getBlock',
				description: 'Get block by number or hash',
				action: 'Get block',
			},
			{
				name: 'Get Latest Block',
				value: 'getLatestBlock',
				description: 'Get the most recent block',
				action: 'Get latest block',
			},
			{
				name: 'Get Block Transactions',
				value: 'getBlockTransactions',
				description: 'Get all transactions in a block',
				action: 'Get block transactions',
			},
			{
				name: 'Get Block Number',
				value: 'getBlockNumber',
				description: 'Get the current block number',
				action: 'Get block number',
			},
			{
				name: 'Get Block Timestamp',
				value: 'getBlockTimestamp',
				description: 'Get the timestamp of a specific block',
				action: 'Get block timestamp',
			},
			{
				name: 'Get Finalized Block',
				value: 'getFinalizedBlock',
				description: 'Get the latest finalized (confirmed) block',
				action: 'Get finalized block',
			},
			{
				name: 'Get Block by Timestamp',
				value: 'getBlockByTimestamp',
				description: 'Find the block closest to a given timestamp',
				action: 'Get block by timestamp',
			},
			{
				name: 'Get Block Range',
				value: 'getBlockRange',
				description: 'Get multiple blocks in a range',
				action: 'Get block range',
			},
			{
				name: 'Get Uncle Block',
				value: 'getUncleBlock',
				description: 'Get an uncle (ommer) block',
				action: 'Get uncle block',
			},
		],
		default: 'getBlock',
	},
];

export const blockFields: INodeProperties[] = [
	// Block identifier (number or hash)
	{
		displayName: 'Block Identifier',
		name: 'blockIdentifier',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				resource: ['block'],
				operation: ['getBlock', 'getBlockTransactions', 'getBlockTimestamp'],
			},
		},
		default: '',
		placeholder: '12345 or 0xabc...',
		description: 'Block number or block hash',
	},

	// Timestamp for block lookup
	{
		displayName: 'Timestamp',
		name: 'timestamp',
		type: 'number',
		required: true,
		displayOptions: {
			show: {
				resource: ['block'],
				operation: ['getBlockByTimestamp'],
			},
		},
		default: 0,
		description: 'Unix timestamp in seconds to find nearest block',
	},

	// Block range parameters
	{
		displayName: 'Start Block',
		name: 'startBlock',
		type: 'number',
		required: true,
		displayOptions: {
			show: {
				resource: ['block'],
				operation: ['getBlockRange'],
			},
		},
		default: 0,
		description: 'Starting block number',
	},
	{
		displayName: 'End Block',
		name: 'endBlock',
		type: 'number',
		required: true,
		displayOptions: {
			show: {
				resource: ['block'],
				operation: ['getBlockRange'],
			},
		},
		default: 0,
		description: 'Ending block number (max 100 blocks per query)',
	},

	// Uncle block parameters
	{
		displayName: 'Uncle Index',
		name: 'uncleIndex',
		type: 'number',
		required: true,
		displayOptions: {
			show: {
				resource: ['block'],
				operation: ['getUncleBlock'],
			},
		},
		default: 0,
		description: 'Index of the uncle block (0-based)',
	},

	// Include transaction details option
	{
		displayName: 'Include Full Transactions',
		name: 'includeTransactions',
		type: 'boolean',
		displayOptions: {
			show: {
				resource: ['block'],
				operation: ['getBlock', 'getLatestBlock', 'getFinalizedBlock', 'getBlockRange'],
			},
		},
		default: false,
		description: 'Whether to include full transaction objects (true) or just hashes (false)',
	},
];

/**
 * Execute block operations
 */
export async function executeBlockOperation(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;
	const credentials = await this.getCredentials('flareNetworkApi');
	const { provider, network } = await createFlareConnection(credentials as any);

	let result: any;

	switch (operation) {
		case 'getBlock': {
			const blockIdentifier = this.getNodeParameter('blockIdentifier', index) as string;
			const includeTransactions = this.getNodeParameter('includeTransactions', index, false) as boolean;

			// Determine if identifier is a number or hash
			let block;
			if (blockIdentifier.startsWith('0x') && blockIdentifier.length === 66) {
				// It's a block hash
				block = await provider.getBlock(blockIdentifier, includeTransactions);
			} else {
				// It's a block number
				const blockNumber = parseInt(blockIdentifier, 10);
				if (isNaN(blockNumber)) {
					throw new NodeOperationError(
						this.getNode(),
						'Invalid block identifier. Provide a block number or 32-byte hash.',
					);
				}
				block = await provider.getBlock(blockNumber, includeTransactions);
			}

			if (!block) {
				throw new NodeOperationError(
					this.getNode(),
					`Block not found: ${blockIdentifier}`,
				);
			}

			result = formatBlockData(block, network.name, includeTransactions);
			break;
		}

		case 'getLatestBlock': {
			const includeTransactions = this.getNodeParameter('includeTransactions', index, false) as boolean;

			const block = await provider.getBlock('latest', includeTransactions);

			if (!block) {
				throw new NodeOperationError(
					this.getNode(),
					'Failed to fetch latest block',
				);
			}

			result = formatBlockData(block, network.name, includeTransactions);
			break;
		}

		case 'getBlockTransactions': {
			const blockIdentifier = this.getNodeParameter('blockIdentifier', index) as string;

			// Get block with full transaction details
			let block;
			if (blockIdentifier.startsWith('0x') && blockIdentifier.length === 66) {
				block = await provider.getBlock(blockIdentifier, true);
			} else {
				const blockNumber = parseInt(blockIdentifier, 10);
				if (isNaN(blockNumber)) {
					throw new NodeOperationError(
						this.getNode(),
						'Invalid block identifier',
					);
				}
				block = await provider.getBlock(blockNumber, true);
			}

			if (!block) {
				throw new NodeOperationError(
					this.getNode(),
					`Block not found: ${blockIdentifier}`,
				);
			}

			// Get token symbol for formatting
			const tokenSymbol = network.name === 'Flare' || network.name === 'Coston2' ? 'FLR' : 'SGB';

			// Format transactions with prefetched data
			const transactions = [];
			if (block.prefetchedTransactions) {
				for (const tx of block.prefetchedTransactions) {
					transactions.push({
						hash: tx.hash,
						from: tx.from,
						to: tx.to,
						value: ethers.formatEther(tx.value) + ` ${tokenSymbol}`,
						valueWei: tx.value.toString(),
						gasLimit: tx.gasLimit.toString(),
						gasPrice: tx.gasPrice ? ethers.formatUnits(tx.gasPrice, 'gwei') + ' gwei' : null,
						maxFeePerGas: tx.maxFeePerGas ? ethers.formatUnits(tx.maxFeePerGas, 'gwei') + ' gwei' : null,
						maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? ethers.formatUnits(tx.maxPriorityFeePerGas, 'gwei') + ' gwei' : null,
						nonce: tx.nonce,
						data: tx.data.length > 66 ? tx.data.substring(0, 66) + '...' : tx.data,
						type: tx.type,
					});
				}
			}

			result = {
				success: true,
				network: network.name,
				blockNumber: block.number,
				blockHash: block.hash,
				transactionCount: transactions.length,
				transactions,
			};
			break;
		}

		case 'getBlockNumber': {
			const blockNumber = await provider.getBlockNumber();

			result = {
				success: true,
				network: network.name,
				blockNumber,
				timestamp: new Date().toISOString(),
			};
			break;
		}

		case 'getBlockTimestamp': {
			const blockIdentifier = this.getNodeParameter('blockIdentifier', index) as string;

			let block;
			if (blockIdentifier.startsWith('0x') && blockIdentifier.length === 66) {
				block = await provider.getBlock(blockIdentifier);
			} else {
				const blockNumber = parseInt(blockIdentifier, 10);
				if (isNaN(blockNumber)) {
					throw new NodeOperationError(
						this.getNode(),
						'Invalid block identifier',
					);
				}
				block = await provider.getBlock(blockNumber);
			}

			if (!block) {
				throw new NodeOperationError(
					this.getNode(),
					`Block not found: ${blockIdentifier}`,
				);
			}

			result = {
				success: true,
				network: network.name,
				blockNumber: block.number,
				blockHash: block.hash,
				timestamp: block.timestamp,
				timestampISO: new Date(block.timestamp * 1000).toISOString(),
				age: formatAge(block.timestamp),
			};
			break;
		}

		case 'getFinalizedBlock': {
			const includeTransactions = this.getNodeParameter('includeTransactions', index, false) as boolean;

			// Get the finalized block
			const block = await provider.getBlock('finalized', includeTransactions);

			if (!block) {
				// If 'finalized' tag not supported, fall back to latest
				const latestBlock = await provider.getBlock('latest', includeTransactions);
				if (!latestBlock) {
					throw new NodeOperationError(
						this.getNode(),
						'Failed to fetch block',
					);
				}
				result = {
					...formatBlockData(latestBlock, network.name, includeTransactions),
					note: 'Finalized tag not supported, returned latest block',
				};
			} else {
				result = {
					...formatBlockData(block, network.name, includeTransactions),
					finalized: true,
				};
			}
			break;
		}

		case 'getBlockByTimestamp': {
			const targetTimestamp = this.getNodeParameter('timestamp', index) as number;

			// Binary search for the block
			const latestBlock = await provider.getBlock('latest');
			if (!latestBlock) {
				throw new NodeOperationError(this.getNode(), 'Failed to fetch latest block');
			}

			// Start binary search
			let low = 0;
			let high = latestBlock.number;
			let closestBlock: ethers.Block | null = null;
			let closestDiff = Infinity;

			while (low <= high) {
				const mid = Math.floor((low + high) / 2);
				const block = await provider.getBlock(mid);
				
				if (!block) {
					high = mid - 1;
					continue;
				}

				const diff = Math.abs(block.timestamp - targetTimestamp);
				
				if (diff < closestDiff) {
					closestDiff = diff;
					closestBlock = block;
				}

				if (block.timestamp === targetTimestamp) {
					break;
				} else if (block.timestamp < targetTimestamp) {
					low = mid + 1;
				} else {
					high = mid - 1;
				}
			}

			if (!closestBlock) {
				throw new NodeOperationError(
					this.getNode(),
					'Could not find block near timestamp',
				);
			}

			result = {
				success: true,
				network: network.name,
				targetTimestamp,
				targetTimestampISO: new Date(targetTimestamp * 1000).toISOString(),
				foundBlock: formatBlockData(closestBlock, network.name, false),
				timeDifference: closestDiff,
				timeDifferenceReadable: formatDuration(closestDiff),
			};
			break;
		}

		case 'getBlockRange': {
			const startBlock = this.getNodeParameter('startBlock', index) as number;
			const endBlock = this.getNodeParameter('endBlock', index) as number;
			const includeTransactions = this.getNodeParameter('includeTransactions', index, false) as boolean;

			// Limit range to 100 blocks
			const range = endBlock - startBlock;
			if (range < 0) {
				throw new NodeOperationError(
					this.getNode(),
					'End block must be greater than or equal to start block',
				);
			}
			if (range > 100) {
				throw new NodeOperationError(
					this.getNode(),
					'Block range cannot exceed 100 blocks',
				);
			}

			const blocks: Array<Record<string, unknown>> = [];
			
			// Fetch blocks in parallel (batches of 10)
			for (let i = startBlock; i <= endBlock; i += 10) {
				const batchPromises: Array<Promise<ethers.Block | null>> = [];
				for (let j = i; j < Math.min(i + 10, endBlock + 1); j++) {
					batchPromises.push(provider.getBlock(j, includeTransactions));
				}
				
				const batchResults = await Promise.all(batchPromises);
				
				for (const block of batchResults) {
					if (block) {
						blocks.push(formatBlockData(block, network.name, includeTransactions));
					}
				}
			}

			result = {
				success: true,
				network: network.name,
				startBlock,
				endBlock,
				blocksReturned: blocks.length,
				blocks,
			};
			break;
		}

		case 'getUncleBlock': {
			const blockIdentifier = this.getNodeParameter('blockIdentifier', index) as string;
			const uncleIndex = this.getNodeParameter('uncleIndex', index) as number;

			// Note: Flare/Avalanche doesn't have uncles in the traditional sense
			// This is provided for API completeness
			
			result = {
				success: false,
				network: network.name,
				blockIdentifier,
				uncleIndex,
				message: 'Uncle blocks are not applicable to Flare Network',
				info: 'Flare uses Avalanche consensus which does not produce uncle blocks',
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
 * Format block data for consistent output
 */
function formatBlockData(
	block: ethers.Block,
	networkName: string,
	includeTransactions: boolean,
): Record<string, unknown> {
	const tokenSymbol = networkName === 'Flare' || networkName === 'Coston2' ? 'FLR' : 'SGB';

	const formatted: Record<string, unknown> = {
		success: true,
		network: networkName,
		blockNumber: block.number,
		blockHash: block.hash,
		parentHash: block.parentHash,
		timestamp: block.timestamp,
		timestampISO: new Date(block.timestamp * 1000).toISOString(),
		age: formatAge(block.timestamp),
		nonce: block.nonce,
		difficulty: block.difficulty?.toString() || '0',
		gasLimit: block.gasLimit.toString(),
		gasUsed: block.gasUsed.toString(),
		gasUsedPercentage: ((Number(block.gasUsed) / Number(block.gasLimit)) * 100).toFixed(2) + '%',
		baseFeePerGas: block.baseFeePerGas 
			? ethers.formatUnits(block.baseFeePerGas, 'gwei') + ' gwei'
			: null,
		miner: block.miner,
		extraData: block.extraData,
		transactionCount: block.transactions?.length || 0,
	};

	if (includeTransactions && block.prefetchedTransactions) {
		formatted.transactions = block.prefetchedTransactions.map((tx) => ({
			hash: tx.hash,
			from: tx.from,
			to: tx.to,
			value: ethers.formatEther(tx.value) + ` ${tokenSymbol}`,
			nonce: tx.nonce,
		}));
	} else if (block.transactions) {
		formatted.transactionHashes = block.transactions;
	}

	return formatted;
}

/**
 * Format timestamp age in human-readable format
 */
function formatAge(timestamp: number): string {
	const now = Math.floor(Date.now() / 1000);
	const diff = now - timestamp;

	if (diff < 0) {
		return 'in the future';
	}
	if (diff < 60) {
		return `${diff} seconds ago`;
	}
	if (diff < 3600) {
		const minutes = Math.floor(diff / 60);
		return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
	}
	if (diff < 86400) {
		const hours = Math.floor(diff / 3600);
		return `${hours} hour${hours === 1 ? '' : 's'} ago`;
	}
	const days = Math.floor(diff / 86400);
	return `${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * Format duration in human-readable format
 */
function formatDuration(seconds: number): string {
	if (seconds < 60) {
		return `${seconds} second${seconds === 1 ? '' : 's'}`;
	}
	if (seconds < 3600) {
		const minutes = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${minutes} minute${minutes === 1 ? '' : 's'}${secs > 0 ? ` ${secs} second${secs === 1 ? '' : 's'}` : ''}`;
	}
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	return `${hours} hour${hours === 1 ? '' : 's'}${minutes > 0 ? ` ${minutes} minute${minutes === 1 ? '' : 's'}` : ''}`;
}
