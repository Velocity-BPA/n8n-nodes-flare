/**
 * Transaction Resource Operations
 *
 * Handles transaction-related operations on Flare/Songbird networks.
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { ethers } from 'ethers';
import { createFlareConnection, sendTransaction, getTransaction, getTransactionReceipt, estimateGas, getGasPrice } from '../../transport/provider';
import { parseTokenAmount, formatTokenAmount } from '../../utils/unitConverter';

export const transactionOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['transaction'],
			},
		},
		options: [
			{
				name: 'Send Native Token',
				value: 'sendNative',
				description: 'Send FLR or SGB to an address',
				action: 'Send native token',
			},
			{
				name: 'Get Transaction',
				value: 'getTransaction',
				description: 'Get transaction details by hash',
				action: 'Get transaction',
			},
			{
				name: 'Get Transaction Receipt',
				value: 'getReceipt',
				description: 'Get transaction receipt with logs',
				action: 'Get transaction receipt',
			},
			{
				name: 'Get Transaction Status',
				value: 'getStatus',
				description: 'Check if transaction succeeded or failed',
				action: 'Get transaction status',
			},
			{
				name: 'Estimate Gas',
				value: 'estimateGas',
				description: 'Estimate gas for a transaction',
				action: 'Estimate gas',
			},
			{
				name: 'Get Gas Price',
				value: 'getGasPrice',
				description: 'Get current gas price',
				action: 'Get gas price',
			},
			{
				name: 'Get Base Fee',
				value: 'getBaseFee',
				description: 'Get current base fee per gas',
				action: 'Get base fee',
			},
			{
				name: 'Speed Up Transaction',
				value: 'speedUp',
				description: 'Replace pending transaction with higher gas',
				action: 'Speed up transaction',
			},
			{
				name: 'Cancel Transaction',
				value: 'cancel',
				description: 'Cancel pending transaction',
				action: 'Cancel transaction',
			},
			{
				name: 'Wait For Confirmation',
				value: 'waitForConfirmation',
				description: 'Wait for transaction to be confirmed',
				action: 'Wait for confirmation',
			},
			{
				name: 'Decode Transaction Input',
				value: 'decodeInput',
				description: 'Decode transaction input data',
				action: 'Decode transaction input',
			},
		],
		default: 'sendNative',
	},
];

export const transactionFields: INodeProperties[] = [
	// Send Native Token fields
	{
		displayName: 'To Address',
		name: 'toAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Recipient address',
		displayOptions: {
			show: {
				resource: ['transaction'],
				operation: ['sendNative'],
			},
		},
	},
	{
		displayName: 'Amount',
		name: 'amount',
		type: 'string',
		required: true,
		default: '',
		placeholder: '1.5',
		description: 'Amount to send in FLR/SGB',
		displayOptions: {
			show: {
				resource: ['transaction'],
				operation: ['sendNative'],
			},
		},
	},
	{
		displayName: 'Options',
		name: 'sendOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: {
			show: {
				resource: ['transaction'],
				operation: ['sendNative'],
			},
		},
		options: [
			{
				displayName: 'Gas Limit',
				name: 'gasLimit',
				type: 'number',
				default: 21000,
				description: 'Gas limit for the transaction',
			},
			{
				displayName: 'Max Fee Per Gas (Gwei)',
				name: 'maxFeePerGas',
				type: 'string',
				default: '',
				description: 'Maximum fee per gas in Gwei',
			},
			{
				displayName: 'Max Priority Fee (Gwei)',
				name: 'maxPriorityFeePerGas',
				type: 'string',
				default: '',
				description: 'Maximum priority fee per gas in Gwei',
			},
			{
				displayName: 'Nonce',
				name: 'nonce',
				type: 'number',
				default: 0,
				description: 'Transaction nonce (leave 0 for auto)',
			},
		],
	},
	// Transaction Hash field
	{
		displayName: 'Transaction Hash',
		name: 'txHash',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Transaction hash',
		displayOptions: {
			show: {
				resource: ['transaction'],
				operation: ['getTransaction', 'getReceipt', 'getStatus', 'waitForConfirmation', 'speedUp', 'cancel'],
			},
		},
	},
	// Wait for confirmation options
	{
		displayName: 'Confirmations',
		name: 'confirmations',
		type: 'number',
		default: 1,
		description: 'Number of confirmations to wait for',
		displayOptions: {
			show: {
				resource: ['transaction'],
				operation: ['waitForConfirmation'],
			},
		},
	},
	{
		displayName: 'Timeout (Seconds)',
		name: 'timeout',
		type: 'number',
		default: 60,
		description: 'Maximum time to wait in seconds',
		displayOptions: {
			show: {
				resource: ['transaction'],
				operation: ['waitForConfirmation'],
			},
		},
	},
	// Speed up / Cancel options
	{
		displayName: 'Gas Price Increase (%)',
		name: 'gasPriceIncrease',
		type: 'number',
		default: 20,
		description: 'Percentage to increase gas price',
		displayOptions: {
			show: {
				resource: ['transaction'],
				operation: ['speedUp', 'cancel'],
			},
		},
	},
	// Estimate Gas fields
	{
		displayName: 'To Address',
		name: 'estimateTo',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Target address',
		displayOptions: {
			show: {
				resource: ['transaction'],
				operation: ['estimateGas'],
			},
		},
	},
	{
		displayName: 'Value',
		name: 'estimateValue',
		type: 'string',
		default: '0',
		description: 'Value in FLR/SGB',
		displayOptions: {
			show: {
				resource: ['transaction'],
				operation: ['estimateGas'],
			},
		},
	},
	{
		displayName: 'Data',
		name: 'estimateData',
		type: 'string',
		default: '',
		placeholder: '0x...',
		description: 'Transaction data (hex)',
		displayOptions: {
			show: {
				resource: ['transaction'],
				operation: ['estimateGas'],
			},
		},
	},
	// Decode Input fields
	{
		displayName: 'Input Data',
		name: 'inputData',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Transaction input data to decode',
		displayOptions: {
			show: {
				resource: ['transaction'],
				operation: ['decodeInput'],
			},
		},
	},
	{
		displayName: 'ABI',
		name: 'abi',
		type: 'json',
		required: true,
		default: '[]',
		description: 'Contract ABI for decoding',
		displayOptions: {
			show: {
				resource: ['transaction'],
				operation: ['decodeInput'],
			},
		},
	},
];

export async function executeTransaction(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;
	const credentials = await this.getCredentials('flareNetworkApi');
	const connection = await createFlareConnection(credentials as any);

	let result: any;

	switch (operation) {
		case 'sendNative': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required for sending transactions');
			}

			const toAddress = this.getNodeParameter('toAddress', index) as string;
			const amount = this.getNodeParameter('amount', index) as string;
			const options = this.getNodeParameter('sendOptions', index, {}) as any;

			if (!ethers.isAddress(toAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid recipient address');
			}

			const tx: any = {
				to: toAddress,
				value: parseTokenAmount(amount, 18),
			};

			if (options.gasLimit) {
				tx.gasLimit = options.gasLimit;
			}
			if (options.maxFeePerGas) {
				tx.maxFeePerGas = ethers.parseUnits(options.maxFeePerGas, 'gwei');
			}
			if (options.maxPriorityFeePerGas) {
				tx.maxPriorityFeePerGas = ethers.parseUnits(options.maxPriorityFeePerGas, 'gwei');
			}
			if (options.nonce && options.nonce > 0) {
				tx.nonce = options.nonce;
			}

			const txResponse = await connection.wallet.sendTransaction(tx);
			const receipt = await txResponse.wait();

			result = {
				hash: txResponse.hash,
				from: txResponse.from,
				to: txResponse.to,
				value: formatTokenAmount(txResponse.value, 18),
				gasLimit: txResponse.gasLimit?.toString(),
				gasPrice: txResponse.gasPrice?.toString(),
				nonce: txResponse.nonce,
				blockNumber: receipt?.blockNumber,
				blockHash: receipt?.blockHash,
				status: receipt?.status === 1 ? 'success' : 'failed',
				gasUsed: receipt?.gasUsed?.toString(),
			};
			break;
		}

		case 'getTransaction': {
			const txHash = this.getNodeParameter('txHash', index) as string;
			const tx = await getTransaction(connection, txHash);

			if (!tx) {
				throw new NodeOperationError(this.getNode(), 'Transaction not found');
			}

			result = {
				hash: tx.hash,
				from: tx.from,
				to: tx.to,
				value: formatTokenAmount(tx.value, 18),
				gasLimit: tx.gasLimit?.toString(),
				gasPrice: tx.gasPrice?.toString(),
				maxFeePerGas: tx.maxFeePerGas?.toString(),
				maxPriorityFeePerGas: tx.maxPriorityFeePerGas?.toString(),
				nonce: tx.nonce,
				data: tx.data,
				blockNumber: tx.blockNumber,
				blockHash: tx.blockHash,
				chainId: tx.chainId?.toString(),
			};
			break;
		}

		case 'getReceipt': {
			const txHash = this.getNodeParameter('txHash', index) as string;
			const receipt = await getTransactionReceipt(connection, txHash);

			if (!receipt) {
				throw new NodeOperationError(this.getNode(), 'Transaction receipt not found');
			}

			result = {
				transactionHash: receipt.hash,
				from: receipt.from,
				to: receipt.to,
				blockNumber: receipt.blockNumber,
				blockHash: receipt.blockHash,
				status: receipt.status === 1 ? 'success' : 'failed',
				gasUsed: receipt.gasUsed?.toString(),
				cumulativeGasUsed: receipt.cumulativeGasUsed?.toString(),
				effectiveGasPrice: receipt.gasPrice?.toString(),
				contractAddress: receipt.contractAddress,
				logs: receipt.logs.map((log: any) => ({
					address: log.address,
					topics: log.topics,
					data: log.data,
					logIndex: log.index,
				})),
				logsBloom: receipt.logsBloom,
			};
			break;
		}

		case 'getStatus': {
			const txHash = this.getNodeParameter('txHash', index) as string;
			const receipt = await getTransactionReceipt(connection, txHash);

			if (!receipt) {
				result = {
					hash: txHash,
					status: 'pending',
					confirmed: false,
				};
			} else {
				result = {
					hash: txHash,
					status: receipt.status === 1 ? 'success' : 'failed',
					confirmed: true,
					blockNumber: receipt.blockNumber,
					gasUsed: receipt.gasUsed?.toString(),
				};
			}
			break;
		}

		case 'estimateGas': {
			const to = this.getNodeParameter('estimateTo', index) as string;
			const value = this.getNodeParameter('estimateValue', index) as string;
			const data = this.getNodeParameter('estimateData', index, '') as string;

			const valueWei = value && value !== '0' ? parseTokenAmount(value, 18) : undefined;

			const gasEstimate = await estimateGas(connection, to, data || '0x', valueWei);
			const gasPrice = await getGasPrice(connection);

			result = {
				gasEstimate: gasEstimate.toString(),
				gasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei',
				estimatedCost: formatTokenAmount(gasEstimate * gasPrice, 18),
			};
			break;
		}

		case 'getGasPrice': {
			const feeData = await connection.provider.getFeeData();

			result = {
				gasPrice: feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, 'gwei') + ' gwei' : null,
				maxFeePerGas: feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei') + ' gwei' : null,
				maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') + ' gwei' : null,
			};
			break;
		}

		case 'getBaseFee': {
			const block = await connection.provider.getBlock('latest');

			result = {
				blockNumber: block?.number,
				baseFeePerGas: block?.baseFeePerGas ? ethers.formatUnits(block.baseFeePerGas, 'gwei') + ' gwei' : null,
			};
			break;
		}

		case 'speedUp': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required');
			}

			const txHash = this.getNodeParameter('txHash', index) as string;
			const gasPriceIncrease = this.getNodeParameter('gasPriceIncrease', index) as number;

			const originalTx = await getTransaction(connection, txHash);
			if (!originalTx) {
				throw new NodeOperationError(this.getNode(), 'Original transaction not found');
			}

			const feeData = await connection.provider.getFeeData();
			const multiplier = BigInt(100 + gasPriceIncrease);

			const newTx: any = {
				to: originalTx.to,
				value: originalTx.value,
				data: originalTx.data,
				nonce: originalTx.nonce,
				gasLimit: originalTx.gasLimit,
			};

			if (feeData.maxFeePerGas) {
				newTx.maxFeePerGas = (feeData.maxFeePerGas * multiplier) / BigInt(100);
				newTx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas
					? (feeData.maxPriorityFeePerGas * multiplier) / BigInt(100)
					: undefined;
			} else if (feeData.gasPrice) {
				newTx.gasPrice = (feeData.gasPrice * multiplier) / BigInt(100);
			}

			const txResponse = await connection.wallet.sendTransaction(newTx);
			const receipt = await txResponse.wait();

			result = {
				originalHash: txHash,
				newHash: txResponse.hash,
				status: receipt?.status === 1 ? 'success' : 'failed',
				blockNumber: receipt?.blockNumber,
			};
			break;
		}

		case 'cancel': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required');
			}

			const txHash = this.getNodeParameter('txHash', index) as string;
			const gasPriceIncrease = this.getNodeParameter('gasPriceIncrease', index) as number;

			const originalTx = await getTransaction(connection, txHash);
			if (!originalTx) {
				throw new NodeOperationError(this.getNode(), 'Original transaction not found');
			}

			const feeData = await connection.provider.getFeeData();
			const multiplier = BigInt(100 + gasPriceIncrease);

			// Send 0 value to self to cancel
			const cancelTx: any = {
				to: await connection.wallet.getAddress(),
				value: 0n,
				nonce: originalTx.nonce,
				gasLimit: 21000n,
			};

			if (feeData.maxFeePerGas) {
				cancelTx.maxFeePerGas = (feeData.maxFeePerGas * multiplier) / BigInt(100);
				cancelTx.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas
					? (feeData.maxPriorityFeePerGas * multiplier) / BigInt(100)
					: undefined;
			} else if (feeData.gasPrice) {
				cancelTx.gasPrice = (feeData.gasPrice * multiplier) / BigInt(100);
			}

			const txResponse = await connection.wallet.sendTransaction(cancelTx);
			const receipt = await txResponse.wait();

			result = {
				originalHash: txHash,
				cancelHash: txResponse.hash,
				status: receipt?.status === 1 ? 'cancelled' : 'failed',
				blockNumber: receipt?.blockNumber,
			};
			break;
		}

		case 'waitForConfirmation': {
			const txHash = this.getNodeParameter('txHash', index) as string;
			const confirmations = this.getNodeParameter('confirmations', index) as number;
			const timeout = this.getNodeParameter('timeout', index) as number;

			const receipt = await Promise.race([
				connection.provider.waitForTransaction(txHash, confirmations),
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error('Timeout waiting for confirmation')), timeout * 1000),
				),
			]) as any;

			result = {
				hash: txHash,
				status: receipt.status === 1 ? 'success' : 'failed',
				blockNumber: receipt.blockNumber,
				confirmations: receipt.confirmations,
				gasUsed: receipt.gasUsed?.toString(),
			};
			break;
		}

		case 'decodeInput': {
			const inputData = this.getNodeParameter('inputData', index) as string;
			const abi = this.getNodeParameter('abi', index) as string;

			const iface = new ethers.Interface(JSON.parse(abi));
			const decoded = iface.parseTransaction({ data: inputData });

			if (!decoded) {
				throw new NodeOperationError(this.getNode(), 'Could not decode transaction input');
			}

			result = {
				functionName: decoded.name,
				signature: decoded.signature,
				args: decoded.args.map((arg: any) =>
					typeof arg === 'bigint' ? arg.toString() : arg,
				),
			};
			break;
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
	}

	return [{ json: result }];
}
