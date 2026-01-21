/**
 * State Connector Resource Operations
 *
 * Handles cross-chain data attestation through Flare's State Connector.
 * The State Connector enables trustless verification of external blockchain
 * events like payments, balances, and block confirmations.
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties, IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { ethers } from 'ethers';
import { createFlareConnection, getStateConnectorContract } from '../../transport/provider';
import {
	getStateConnectorInfo,
	getAttestationStatus,
	verifyAttestation,
	getLastFinalizedRound,
	requestPaymentAttestation,
	requestBalanceDecreasingAttestation,
	requestConfirmedBlockHeightAttestation,
	getSupportedAttestationTypes,
} from '../../transport/stateConnectorClient';
import {
	encodePaymentRequest,
	encodeBalanceDecreasingRequest,
	encodeConfirmedBlockHeightRequest,
	verifyMerkleProof,
	AttestationType,
	ATTESTATION_TYPE_OPTIONS,
} from '../../utils/attestationUtils';

export const stateConnectorOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['stateConnector'],
			},
		},
		options: [
			{
				name: 'Get State Connector Info',
				value: 'getInfo',
				description: 'Get State Connector contract information',
				action: 'Get state connector info',
			},
			{
				name: 'Get Current Round',
				value: 'getStateConnectorInfo',
				description: 'Get current attestation round',
				action: 'Get current round',
			},
			{
				name: 'Get Last Finalized Round',
				value: 'getLastFinalizedRound',
				description: 'Get last finalized attestation round',
				action: 'Get last finalized round',
			},
			{
				name: 'Request Payment Attestation',
				value: 'requestPaymentAttestation',
				description: 'Request attestation for a payment on external chain',
				action: 'Request payment attestation',
			},
			{
				name: 'Request Balance Decreasing Attestation',
				value: 'requestBalanceDecreasing',
				description: 'Request attestation for balance decrease',
				action: 'Request balance decreasing attestation',
			},
			{
				name: 'Request Block Height Attestation',
				value: 'requestBlockHeight',
				description: 'Request attestation for confirmed block height',
				action: 'Request block height attestation',
			},
			{
				name: 'Get Attestation Status',
				value: 'getAttestationStatus',
				description: 'Check status of an attestation request',
				action: 'Get attestation status',
			},
			{
				name: 'Verify Attestation',
				value: 'verifyAttestation',
				description: 'Verify an attestation with Merkle proof',
				action: 'Verify attestation',
			},
			{
				name: 'Get Attestation Types',
				value: 'getAttestationTypes',
				description: 'Get supported attestation types',
				action: 'Get attestation types',
			},
			{
				name: 'Get Merkle Root',
				value: 'getMerkleRoot',
				description: 'Get Merkle root for a finalized round',
				action: 'Get merkle root',
			},
		],
		default: 'getInfo',
	},
];

export const stateConnectorFields: INodeProperties[] = [
	// Source chain for attestations
	{
		displayName: 'Source Chain',
		name: 'sourceChain',
		type: 'options',
		required: true,
		default: 'BTC',
		description: 'Source blockchain for attestation',
		options: [
			{ name: 'Bitcoin', value: 'BTC' },
			{ name: 'Dogecoin', value: 'DOGE' },
			{ name: 'XRP Ledger', value: 'XRP' },
			{ name: 'Litecoin', value: 'LTC' },
			{ name: 'Ethereum', value: 'ETH' },
			{ name: 'Algorand', value: 'ALGO' },
		],
		displayOptions: {
			show: {
				resource: ['stateConnector'],
				operation: ['requestPaymentAttestation', 'requestBalanceDecreasing', 'requestBlockHeight'],
			},
		},
	},
	// Transaction ID for payment attestation
	{
		displayName: 'Transaction ID',
		name: 'transactionId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Transaction hash or ID',
		description: 'Transaction ID on the source chain',
		displayOptions: {
			show: {
				resource: ['stateConnector'],
				operation: ['requestPaymentAttestation', 'requestBalanceDecreasing'],
			},
		},
	},
	// Inbound/Outbound for payment attestation
	{
		displayName: 'Payment Direction',
		name: 'paymentDirection',
		type: 'options',
		required: true,
		default: 'inbound',
		options: [
			{ name: 'Inbound (Receiving)', value: 'inbound' },
			{ name: 'Outbound (Sending)', value: 'outbound' },
		],
		description: 'Whether payment was received or sent',
		displayOptions: {
			show: {
				resource: ['stateConnector'],
				operation: ['requestPaymentAttestation'],
			},
		},
	},
	// Block number for block height attestation
	{
		displayName: 'Block Number',
		name: 'blockNumber',
		type: 'number',
		required: true,
		default: 0,
		description: 'Block number to attest',
		displayOptions: {
			show: {
				resource: ['stateConnector'],
				operation: ['requestBlockHeight'],
			},
		},
	},
	// Round ID for queries
	{
		displayName: 'Round ID',
		name: 'roundId',
		type: 'number',
		required: true,
		default: 0,
		description: 'Attestation round ID',
		displayOptions: {
			show: {
				resource: ['stateConnector'],
				operation: ['getAttestationStatus', 'getMerkleRoot'],
			},
		},
	},
	// Request ID for attestation queries
	{
		displayName: 'Request ID',
		name: 'requestId',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Attestation request ID (hash)',
		displayOptions: {
			show: {
				resource: ['stateConnector'],
				operation: ['getAttestationStatus', 'verifyAttestation'],
			},
		},
	},
	// Merkle proof for verification
	{
		displayName: 'Merkle Proof',
		name: 'merkleProof',
		type: 'json',
		required: true,
		default: '[]',
		description: 'Merkle proof as array of hashes',
		displayOptions: {
			show: {
				resource: ['stateConnector'],
				operation: ['verifyAttestation'],
			},
		},
	},
	// Response data for verification
	{
		displayName: 'Response Data',
		name: 'responseData',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Attestation response data',
		displayOptions: {
			show: {
				resource: ['stateConnector'],
				operation: ['verifyAttestation'],
			},
		},
	},
];

export async function executeStateConnector(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;
	const credentials = await this.getCredentials('flareNetworkApi');
	const connection = await createFlareConnection(credentials as any);
	const stateConnector = getStateConnectorContract(connection);

	let result: any;

	switch (operation) {
		case 'getInfo': {
			const info = await getStateConnectorInfo(connection);

			result = {
				address: await stateConnector.getAddress(),
				...info,
				network: credentials.network,
			};
			break;
		}

		case 'getStateConnectorInfo': {
			const currentRound = await getStateConnectorInfo(connection);
			const roundDuration = 90; // seconds

			result = {
				currentRound,
				roundDurationSeconds: roundDuration,
				nextRoundEstimate: new Date(Date.now() + roundDuration * 1000).toISOString(),
			};
			break;
		}

		case 'getLastFinalizedRound': {
			const lastFinalized = await getLastFinalizedRound(connection);
			const info = await getStateConnectorInfo(connection);
			const currentRound = info.currentRound || 0;

			result = {
				lastFinalizedRound: lastFinalized,
				currentRound,
				roundsBehind: Number(currentRound) - Number(lastFinalized),
				note: 'Attestations are finalized 2 rounds after submission',
			};
			break;
		}

		case 'requestPaymentAttestation': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required');
			}

			const sourceChain = this.getNodeParameter('sourceChain', index) as string;
			const transactionId = this.getNodeParameter('transactionId', index) as string;
			const inUtxo = this.getNodeParameter('inUtxo', index, 0) as number;
			const utxo = this.getNodeParameter('utxo', index, 0) as number;

			const attestationData = encodePaymentRequest(sourceChain, transactionId, inUtxo, utxo);

			const txResult = await requestPaymentAttestation(connection, sourceChain, transactionId);

			result = {
				operation: 'requestPaymentAttestation',
				sourceChain,
				transactionId,
				requestHash: txResult.requestHash,
				roundId: txResult.roundId,
			};
			break;
		}

		case 'requestBalanceDecreasing': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required');
			}

			const sourceChain = this.getNodeParameter('sourceChain', index) as string;
			const transactionId = this.getNodeParameter('transactionId', index) as string;
			const sourceAddress = this.getNodeParameter('sourceAddress', index, '') as string;

			const attestationData = encodeBalanceDecreasingRequest(sourceChain, transactionId, sourceAddress);

			const txResult = await requestBalanceDecreasingAttestation(connection, sourceChain, transactionId, sourceAddress);

			result = {
				operation: 'requestBalanceDecreasing',
				sourceChain,
				transactionId,
				requestHash: txResult.requestHash,
				roundId: txResult.roundId,
			};
			break;
		}

		case 'requestBlockHeight': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required');
			}

			const sourceChain = this.getNodeParameter('sourceChain', index) as string;
			const blockNumber = this.getNodeParameter('blockNumber', index) as number;
			const queryWindow = this.getNodeParameter('queryWindow', index, 86400) as number;

			const attestationData = encodeConfirmedBlockHeightRequest(sourceChain, blockNumber, queryWindow);

			const txResult = await requestConfirmedBlockHeightAttestation(connection, sourceChain, blockNumber);

			result = {
				operation: 'requestBlockHeight',
				sourceChain,
				blockNumber,
				requestHash: txResult.requestHash,
				roundId: txResult.roundId,
			};
			break;
		}

		case 'getAttestationStatus': {
			const roundId = this.getNodeParameter('roundId', index) as number;
			const requestId = this.getNodeParameter('requestId', index) as string;

			const status = await getAttestationStatus(connection, requestId, roundId);

			result = {
				roundId,
				requestId,
				...status,
			};
			break;
		}

		case 'verifyAttestation': {
			const roundId = this.getNodeParameter('roundId', index) as number;
			const requestHash = this.getNodeParameter('requestId', index) as string;
			const merkleProofStr = this.getNodeParameter('merkleProof', index) as string;

			const merkleProof = JSON.parse(merkleProofStr);
			const verified = await verifyAttestation(connection, roundId, requestHash, merkleProof);

			result = {
				roundId,
				requestHash,
				verified,
			};
			break;
		}

		case 'getAttestationTypes': {
			const types = getSupportedAttestationTypes();
			result = {
				types: types.map((t) => ({
					name: t.name,
					typeId: t.id,
					description: t.description,
					supportedChains: t.supportedChains,
				})),
			};
			break;
		}

		case 'getMerkleRoot': {
			const roundId = this.getNodeParameter('roundId', index) as number;

			try {
				const merkleRoot = await stateConnector.merkleRoot(roundId);

				result = {
					roundId,
					merkleRoot,
					isFinalized: merkleRoot !== ethers.ZeroHash,
				};
			} catch (error) {
				result = {
					roundId,
					merkleRoot: null,
					isFinalized: false,
					error: 'Round not yet finalized',
				};
			}
			break;
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
	}

	return [{ json: result }];
}
