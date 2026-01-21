/**
 * LayerCake Bridge Resource Operations
 *
 * Handles cross-chain bridge operations using LayerCake protocol.
 * LayerCake enables secure asset transfers between Flare and other chains.
 *
 * Key features:
 * - Trustless bridging using State Connector attestations
 * - Support for multiple asset types
 * - Fee estimation and liquidity checking
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { ethers } from 'ethers';
import { createFlareConnection, getContract } from '../../transport/provider';
import { formatTokenAmount, parseTokenAmount } from '../../utils/unitConverter';

// LayerCake bridge ABI (simplified)
const LAYERCAKE_BRIDGE_ABI = [
	'function bridge(address token, uint256 amount, uint32 destinationChainId, address recipient) external payable returns (bytes32)',
	'function getBridgeFee(address token, uint256 amount, uint32 destinationChainId) external view returns (uint256)',
	'function getSupportedTokens() external view returns (address[] memory)',
	'function getSupportedChains() external view returns (uint32[] memory)',
	'function getBridgeStatus(bytes32 transferId) external view returns (uint8 status, uint256 amount, address token, address recipient)',
	'function getLiquidity(address token) external view returns (uint256)',
	'function getMinBridgeAmount(address token) external view returns (uint256)',
	'function getMaxBridgeAmount(address token) external view returns (uint256)',
	'function estimateBridgeTime(uint32 destinationChainId) external view returns (uint256)',
	'function pendingTransfers(address user) external view returns (bytes32[] memory)',
	'function completedTransfers(address user) external view returns (bytes32[] memory)',
	'function claimBridgedTokens(bytes32 transferId) external',
	'function paused() external view returns (bool)',
];

// Supported chains (example - actual values depend on deployment)
const SUPPORTED_CHAINS: Record<number, string> = {
	1: 'Ethereum',
	14: 'Flare',
	19: 'Songbird',
	56: 'BSC',
	137: 'Polygon',
	42161: 'Arbitrum',
	43114: 'Avalanche',
};

// Bridge status codes
const BRIDGE_STATUS: Record<number, string> = {
	0: 'Pending',
	1: 'InProgress',
	2: 'Completed',
	3: 'Failed',
	4: 'Refunded',
};

export const bridgeOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['bridge'],
			},
		},
		options: [
			{
				name: 'Get Supported Assets',
				value: 'getSupportedAssets',
				description: 'Get list of supported bridge assets',
				action: 'Get supported assets',
			},
			{
				name: 'Get Supported Chains',
				value: 'getSupportedChains',
				description: 'Get list of supported destination chains',
				action: 'Get supported chains',
			},
			{
				name: 'Get Bridge Fee',
				value: 'getBridgeFee',
				description: 'Calculate fee for bridge transfer',
				action: 'Get bridge fee',
			},
			{
				name: 'Estimate Bridge Time',
				value: 'estimateBridgeTime',
				description: 'Estimate time for bridge completion',
				action: 'Estimate bridge time',
			},
			{
				name: 'Get Liquidity',
				value: 'getLiquidity',
				description: 'Get available liquidity for token',
				action: 'Get liquidity',
			},
			{
				name: 'Get Bridge Limits',
				value: 'getBridgeLimits',
				description: 'Get min/max bridge amounts for token',
				action: 'Get bridge limits',
			},
			{
				name: 'Initiate Bridge Transfer',
				value: 'initiateBridge',
				description: 'Start a cross-chain bridge transfer',
				action: 'Initiate bridge transfer',
			},
			{
				name: 'Get Bridge Status',
				value: 'getBridgeStatus',
				description: 'Check status of bridge transfer',
				action: 'Get bridge status',
			},
			{
				name: 'Get Pending Bridges',
				value: 'getPendingBridges',
				description: 'Get pending bridge transfers for address',
				action: 'Get pending bridges',
			},
			{
				name: 'Get Bridge History',
				value: 'getBridgeHistory',
				description: 'Get completed bridge history for address',
				action: 'Get bridge history',
			},
			{
				name: 'Claim Bridged Tokens',
				value: 'claimBridged',
				description: 'Claim tokens from completed bridge',
				action: 'Claim bridged tokens',
			},
		],
		default: 'getSupportedAssets',
	},
];

export const bridgeFields: INodeProperties[] = [
	// Token address
	{
		displayName: 'Token Address',
		name: 'tokenAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x... (use 0x0 for native token)',
		description: 'Token contract address or 0x0 for native token',
		displayOptions: {
			show: {
				resource: ['bridge'],
				operation: ['getBridgeFee', 'getLiquidity', 'getBridgeLimits', 'initiateBridge'],
			},
		},
	},
	// Amount
	{
		displayName: 'Amount',
		name: 'amount',
		type: 'string',
		required: true,
		default: '',
		placeholder: '100',
		description: 'Amount to bridge',
		displayOptions: {
			show: {
				resource: ['bridge'],
				operation: ['getBridgeFee', 'initiateBridge'],
			},
		},
	},
	// Destination chain
	{
		displayName: 'Destination Chain',
		name: 'destinationChain',
		type: 'options',
		required: true,
		options: [
			{ name: 'Ethereum', value: 1 },
			{ name: 'Flare', value: 14 },
			{ name: 'Songbird', value: 19 },
			{ name: 'BSC', value: 56 },
			{ name: 'Polygon', value: 137 },
			{ name: 'Arbitrum', value: 42161 },
			{ name: 'Avalanche', value: 43114 },
		],
		default: 1,
		description: 'Destination chain for bridge',
		displayOptions: {
			show: {
				resource: ['bridge'],
				operation: ['getBridgeFee', 'estimateBridgeTime', 'initiateBridge'],
			},
		},
	},
	// Recipient address
	{
		displayName: 'Recipient Address',
		name: 'recipientAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Recipient address on destination chain',
		displayOptions: {
			show: {
				resource: ['bridge'],
				operation: ['initiateBridge'],
			},
		},
	},
	// Transfer ID
	{
		displayName: 'Transfer ID',
		name: 'transferId',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Bridge transfer ID (bytes32)',
		displayOptions: {
			show: {
				resource: ['bridge'],
				operation: ['getBridgeStatus', 'claimBridged'],
			},
		},
	},
	// User address for history
	{
		displayName: 'Address',
		name: 'address',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Address to query bridges for',
		displayOptions: {
			show: {
				resource: ['bridge'],
				operation: ['getPendingBridges', 'getBridgeHistory'],
			},
		},
	},
	// Bridge contract address (optional override)
	{
		displayName: 'Bridge Contract',
		name: 'bridgeContract',
		type: 'string',
		required: false,
		default: '',
		placeholder: '0x... (leave empty for default)',
		description: 'LayerCake bridge contract address (optional)',
		displayOptions: {
			show: {
				resource: ['bridge'],
			},
		},
	},
];

export async function executeBridge(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;
	const credentials = await this.getCredentials('flareNetworkApi');
	const connection = await createFlareConnection(credentials as any);

	const networkName = (credentials.network as string) || 'flare';

	// Default LayerCake bridge address (placeholder - actual address from deployment)
	const customBridge = this.getNodeParameter('bridgeContract', index, '') as string;
	const bridgeAddress = customBridge || '0x0000000000000000000000000000000000000000'; // Placeholder

	let result: any;

	switch (operation) {
		case 'getSupportedAssets': {
			try {
				const bridge = getContract(connection, bridgeAddress, LAYERCAKE_BRIDGE_ABI);
				const tokens = await bridge.getSupportedTokens();

				result = {
					supportedTokens: tokens,
					count: tokens.length,
					note: 'Use 0x0000000000000000000000000000000000000000 for native token (FLR/SGB)',
				};
			} catch (error) {
				// Return common bridgeable assets as fallback
				result = {
					supportedTokens: [
						'0x0000000000000000000000000000000000000000', // Native
						'0x...',  // WFLR/WSGB (would be actual address)
					],
					note: 'Bridge contract not available - showing common assets',
					bridgeContractProvided: !!customBridge,
				};
			}
			break;
		}

		case 'getSupportedChains': {
			try {
				const bridge = getContract(connection, bridgeAddress, LAYERCAKE_BRIDGE_ABI);
				const chains = await bridge.getSupportedChains();

				result = {
					supportedChains: chains.map((chainId: bigint) => ({
						chainId: Number(chainId),
						name: SUPPORTED_CHAINS[Number(chainId)] || 'Unknown',
					})),
					count: chains.length,
				};
			} catch (error) {
				// Return known supported chains as fallback
				result = {
					supportedChains: Object.entries(SUPPORTED_CHAINS).map(([id, name]) => ({
						chainId: Number(id),
						name,
					})),
					note: 'Bridge contract not available - showing typical supported chains',
				};
			}
			break;
		}

		case 'getBridgeFee': {
			const tokenAddress = this.getNodeParameter('tokenAddress', index) as string;
			const amount = this.getNodeParameter('amount', index) as string;
			const destinationChain = this.getNodeParameter('destinationChain', index) as number;

			if (!ethers.isAddress(tokenAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid token address');
			}

			try {
				const bridge = getContract(connection, bridgeAddress, LAYERCAKE_BRIDGE_ABI);
				const amountWei = parseTokenAmount(amount, 18);
				const fee = await bridge.getBridgeFee(tokenAddress, amountWei, destinationChain);

				result = {
					token: tokenAddress,
					amount,
					destinationChain,
					destinationName: SUPPORTED_CHAINS[destinationChain] || 'Unknown',
					bridgeFee: formatTokenAmount(fee, 18),
					bridgeFeeWei: fee.toString(),
					totalRequired: formatTokenAmount(amountWei + fee, 18),
				};
			} catch (error) {
				// Estimate fee as percentage
				const estimatedFee = parseFloat(amount) * 0.003; // 0.3% typical
				result = {
					token: tokenAddress,
					amount,
					destinationChain,
					destinationName: SUPPORTED_CHAINS[destinationChain] || 'Unknown',
					estimatedFee: estimatedFee.toFixed(6),
					note: 'Estimated fee (bridge contract not available)',
					feePercentage: '0.3%',
				};
			}
			break;
		}

		case 'estimateBridgeTime': {
			const destinationChain = this.getNodeParameter('destinationChain', index) as number;

			try {
				const bridge = getContract(connection, bridgeAddress, LAYERCAKE_BRIDGE_ABI);
				const estimatedTime = await bridge.estimateBridgeTime(destinationChain);

				result = {
					destinationChain,
					destinationName: SUPPORTED_CHAINS[destinationChain] || 'Unknown',
					estimatedSeconds: Number(estimatedTime),
					estimatedMinutes: Math.ceil(Number(estimatedTime) / 60),
					note: 'Actual time may vary based on network conditions',
				};
			} catch (error) {
				// Estimate based on typical confirmation times
				const estimates: Record<number, number> = {
					1: 15, // Ethereum ~15 min
					14: 3, // Flare ~3 min
					19: 3, // Songbird ~3 min
					56: 5, // BSC ~5 min
					137: 5, // Polygon ~5 min
					42161: 10, // Arbitrum ~10 min
					43114: 5, // Avalanche ~5 min
				};

				const mins = estimates[destinationChain] || 10;
				result = {
					destinationChain,
					destinationName: SUPPORTED_CHAINS[destinationChain] || 'Unknown',
					estimatedMinutes: mins,
					note: 'Typical bridge time estimate',
				};
			}
			break;
		}

		case 'getLiquidity': {
			const tokenAddress = this.getNodeParameter('tokenAddress', index) as string;

			if (!ethers.isAddress(tokenAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid token address');
			}

			try {
				const bridge = getContract(connection, bridgeAddress, LAYERCAKE_BRIDGE_ABI);
				const liquidity = await bridge.getLiquidity(tokenAddress);

				result = {
					token: tokenAddress,
					availableLiquidity: formatTokenAmount(liquidity, 18),
					liquidityWei: liquidity.toString(),
					hasLiquidity: liquidity > 0n,
				};
			} catch (error) {
				result = {
					token: tokenAddress,
					error: 'Unable to query liquidity',
					note: 'Bridge contract not available',
				};
			}
			break;
		}

		case 'getBridgeLimits': {
			const tokenAddress = this.getNodeParameter('tokenAddress', index) as string;

			if (!ethers.isAddress(tokenAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid token address');
			}

			try {
				const bridge = getContract(connection, bridgeAddress, LAYERCAKE_BRIDGE_ABI);
				const [minAmount, maxAmount] = await Promise.all([
					bridge.getMinBridgeAmount(tokenAddress),
					bridge.getMaxBridgeAmount(tokenAddress),
				]);

				result = {
					token: tokenAddress,
					minimumAmount: formatTokenAmount(minAmount, 18),
					maximumAmount: formatTokenAmount(maxAmount, 18),
					minimumWei: minAmount.toString(),
					maximumWei: maxAmount.toString(),
				};
			} catch (error) {
				result = {
					token: tokenAddress,
					minimumAmount: '0.01',
					maximumAmount: '10000',
					note: 'Default limits (bridge contract not available)',
				};
			}
			break;
		}

		case 'initiateBridge': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required for bridging');
			}

			const tokenAddress = this.getNodeParameter('tokenAddress', index) as string;
			const amount = this.getNodeParameter('amount', index) as string;
			const destinationChain = this.getNodeParameter('destinationChain', index) as number;
			const recipientAddress = this.getNodeParameter('recipientAddress', index) as string;

			if (!ethers.isAddress(tokenAddress) || !ethers.isAddress(recipientAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const bridge = getContract(connection, bridgeAddress, LAYERCAKE_BRIDGE_ABI);
			const amountWei = parseTokenAmount(amount, 18);

			// Get bridge fee
			const fee = await bridge.getBridgeFee(tokenAddress, amountWei, destinationChain);

			// Check if bridge is paused
			const paused = await bridge.paused();
			if (paused) {
				throw new NodeOperationError(this.getNode(), 'Bridge is currently paused');
			}

			// If not native token, need to approve first
			const isNativeToken = tokenAddress === '0x0000000000000000000000000000000000000000';
			const value = isNativeToken ? amountWei + fee : fee;

			const tx = await bridge.bridge(tokenAddress, amountWei, destinationChain, recipientAddress, { value });
			const receipt = await tx.wait();

			// Extract transfer ID from event
			let transferId = '';
			for (const log of receipt?.logs || []) {
				try {
					const parsed = bridge.interface.parseLog(log);
					if (parsed?.name === 'BridgeInitiated') {
						transferId = parsed.args.transferId;
						break;
					}
				} catch (e) {
					// Not the event we're looking for
				}
			}

			result = {
				operation: 'bridge',
				token: tokenAddress,
				amount,
				fee: formatTokenAmount(fee, 18),
				destinationChain,
				destinationName: SUPPORTED_CHAINS[destinationChain] || 'Unknown',
				recipient: recipientAddress,
				transferId,
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'initiated' : 'failed',
				note: 'Use transferId to track bridge status',
			};
			break;
		}

		case 'getBridgeStatus': {
			const transferId = this.getNodeParameter('transferId', index) as string;

			try {
				const bridge = getContract(connection, bridgeAddress, LAYERCAKE_BRIDGE_ABI);
				const [status, amount, token, recipient] = await bridge.getBridgeStatus(transferId);

				result = {
					transferId,
					status: Number(status),
					statusName: BRIDGE_STATUS[Number(status)] || 'Unknown',
					amount: formatTokenAmount(amount, 18),
					token,
					recipient,
					isComplete: Number(status) === 2,
					canClaim: Number(status) === 2,
				};
			} catch (error) {
				result = {
					transferId,
					error: 'Transfer not found or bridge contract not available',
				};
			}
			break;
		}

		case 'getPendingBridges': {
			const address = this.getNodeParameter('address', index) as string;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			try {
				const bridge = getContract(connection, bridgeAddress, LAYERCAKE_BRIDGE_ABI);
				const pendingIds = await bridge.pendingTransfers(address);

				const transfers = await Promise.all(
					pendingIds.map(async (id: string) => {
						const [status, amount, token, recipient] = await bridge.getBridgeStatus(id);
						return {
							transferId: id,
							status: Number(status),
							statusName: BRIDGE_STATUS[Number(status)] || 'Unknown',
							amount: formatTokenAmount(amount, 18),
							token,
							recipient,
						};
					})
				);

				result = {
					address,
					pendingTransfers: transfers,
					count: transfers.length,
				};
			} catch (error) {
				result = {
					address,
					pendingTransfers: [],
					note: 'Bridge contract not available',
				};
			}
			break;
		}

		case 'getBridgeHistory': {
			const address = this.getNodeParameter('address', index) as string;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			try {
				const bridge = getContract(connection, bridgeAddress, LAYERCAKE_BRIDGE_ABI);
				const completedIds = await bridge.completedTransfers(address);

				const transfers = await Promise.all(
					completedIds.map(async (id: string) => {
						const [status, amount, token, recipient] = await bridge.getBridgeStatus(id);
						return {
							transferId: id,
							status: Number(status),
							statusName: BRIDGE_STATUS[Number(status)] || 'Unknown',
							amount: formatTokenAmount(amount, 18),
							token,
							recipient,
						};
					})
				);

				result = {
					address,
					completedTransfers: transfers,
					count: transfers.length,
				};
			} catch (error) {
				result = {
					address,
					completedTransfers: [],
					note: 'Bridge contract not available',
				};
			}
			break;
		}

		case 'claimBridged': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required for claiming');
			}

			const transferId = this.getNodeParameter('transferId', index) as string;

			const bridge = getContract(connection, bridgeAddress, LAYERCAKE_BRIDGE_ABI);

			// Check status first
			const [status, amount, token, recipient] = await bridge.getBridgeStatus(transferId);
			if (Number(status) !== 2) {
				throw new NodeOperationError(this.getNode(), `Transfer not ready for claim (status: ${BRIDGE_STATUS[Number(status)]})`);
			}

			const tx = await bridge.claimBridgedTokens(transferId);
			const receipt = await tx.wait();

			result = {
				operation: 'claim',
				transferId,
				amount: formatTokenAmount(amount, 18),
				token,
				recipient,
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'claimed' : 'failed',
			};
			break;
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
	}

	return [{ json: result }];
}
