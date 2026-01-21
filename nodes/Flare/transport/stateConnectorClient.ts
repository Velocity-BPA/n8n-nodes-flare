/**
 * State Connector Client Transport Layer
 *
 * Handles interactions with Flare's State Connector - the cross-chain
 * data verification system that enables trustless bridging and external data.
 *
 * State Connector Flow:
 * 1. Request attestation (submit hash of data claim)
 * 2. Wait for attestation round to complete (~90 seconds)
 * 3. Attestation providers vote on validity
 * 4. If consensus reached, proof is available
 * 5. Verify proof on-chain to use attested data
 */

import { Contract, ethers } from 'ethers';
import type { FlareConnection } from './provider';
import { getStateConnectorContract, getContract } from './provider';
import { STATE_CONNECTOR_ABI } from '../constants/abis';
import {
	encodePaymentRequest,
	encodeBalanceDecreasingRequest,
	encodeConfirmedBlockHeightRequest,
	verifyMerkleProof,
	type AttestationRequest,
	type MerkleProof,
} from '../utils/attestationUtils';

export interface StateConnectorInfo {
	/** Contract address */
	address: string;
	/** Current round ID */
	currentRound: number;
	/** Last finalized round */
	lastFinalizedRound: number;
	/** Round duration in seconds */
	roundDuration: number;
	/** Time until next round */
	timeToNextRound: number;
}

export interface AttestationRound {
	/** Round ID */
	roundId: number;
	/** Start timestamp */
	startTime: number;
	/** End timestamp */
	endTime: number;
	/** Whether finalized */
	isFinalized: boolean;
	/** Merkle root (if finalized) */
	merkleRoot?: string;
	/** Number of attestations */
	attestationCount?: number;
}

export interface AttestationStatus {
	/** Request hash */
	requestHash: string;
	/** Round ID */
	roundId: number;
	/** Whether finalized */
	isFinalized: boolean;
	/** Whether verified */
	isVerified: boolean;
	/** Merkle proof (if available) */
	proof?: MerkleProof;
}

export interface AttestationType {
	/** Type ID */
	id: number;
	/** Type name */
	name: string;
	/** Description */
	description: string;
	/** Supported chains */
	supportedChains: string[];
}

/**
 * Get State Connector info
 */
export async function getStateConnectorInfo(
	connection: FlareConnection,
): Promise<StateConnectorInfo> {
	const stateConnector = getStateConnectorContract(connection);
	const address = await stateConnector.getAddress();

	// Get current round info
	const roundDuration = 90; // 90 seconds per round
	const now = Math.floor(Date.now() / 1000);

	// Calculate current round based on genesis
	const genesisTime = 1658429955; // Approximate State Connector genesis
	const currentRound = Math.floor((now - genesisTime) / roundDuration);
	const lastFinalizedRound = currentRound - 2; // 2-round finalization delay

	const roundStartTime = genesisTime + currentRound * roundDuration;
	const timeToNextRound = roundStartTime + roundDuration - now;

	return {
		address,
		currentRound,
		lastFinalizedRound,
		roundDuration,
		timeToNextRound: Math.max(0, timeToNextRound),
	};
}

/**
 * Get attestation round info
 */
export async function getAttestationRound(
	connection: FlareConnection,
	roundId: number,
): Promise<AttestationRound> {
	const stateConnector = getStateConnectorContract(connection);

	const roundDuration = 90;
	const genesisTime = 1658429955;
	const startTime = genesisTime + roundId * roundDuration;
	const endTime = startTime + roundDuration;

	const now = Math.floor(Date.now() / 1000);
	const currentRound = Math.floor((now - genesisTime) / roundDuration);
	const isFinalized = roundId <= currentRound - 2;

	let merkleRoot: string | undefined;
	if (isFinalized) {
		try {
			merkleRoot = await stateConnector.merkleRoots(roundId);
		} catch {
			// Round may not have merkle root
		}
	}

	return {
		roundId,
		startTime,
		endTime,
		isFinalized,
		merkleRoot,
	};
}

/**
 * Get last finalized round
 */
export async function getLastFinalizedRound(
	connection: FlareConnection,
): Promise<number> {
	const info = await getStateConnectorInfo(connection);
	return info.lastFinalizedRound;
}

/**
 * Request a payment attestation
 */
export async function requestPaymentAttestation(
	connection: FlareConnection,
	sourceChain: string,
	transactionId: string,
	inUtxo: number = 0,
	utxo: number = 0,
): Promise<{ requestHash: string; roundId: number }> {
	const stateConnector = getStateConnectorContract(connection);

	// Encode attestation request
	const encodedRequest = encodePaymentRequest(
		sourceChain,
		transactionId,
		inUtxo,
		utxo,
	);

	// Submit request
	const tx = await stateConnector.requestAttestations(encodedRequest);
	const receipt = await tx.wait();

	// Get current round for the request
	const info = await getStateConnectorInfo(connection);

	// Calculate request hash
	const requestHash = ethers.keccak256(encodedRequest);

	return {
		requestHash,
		roundId: info.currentRound,
	};
}

/**
 * Request a balance decreasing attestation
 */
export async function requestBalanceDecreasingAttestation(
	connection: FlareConnection,
	sourceChain: string,
	transactionId: string,
	sourceAddress: string,
): Promise<{ requestHash: string; roundId: number }> {
	const stateConnector = getStateConnectorContract(connection);

	const encodedRequest = encodeBalanceDecreasingRequest(
		sourceChain,
		transactionId,
		sourceAddress,
	);

	const tx = await stateConnector.requestAttestations(encodedRequest);
	await tx.wait();

	const info = await getStateConnectorInfo(connection);
	const requestHash = ethers.keccak256(encodedRequest);

	return {
		requestHash,
		roundId: info.currentRound,
	};
}

/**
 * Request a confirmed block height attestation
 */
export async function requestConfirmedBlockHeightAttestation(
	connection: FlareConnection,
	sourceChain: string,
	blockNumber: number,
	queryWindow: number = 86400,
): Promise<{ requestHash: string; roundId: number }> {
	const stateConnector = getStateConnectorContract(connection);

	const encodedRequest = encodeConfirmedBlockHeightRequest(
		sourceChain,
		blockNumber,
		queryWindow,
	);

	const tx = await stateConnector.requestAttestations(encodedRequest);
	await tx.wait();

	const info = await getStateConnectorInfo(connection);
	const requestHash = ethers.keccak256(encodedRequest);

	return {
		requestHash,
		roundId: info.currentRound,
	};
}

/**
 * Check attestation status
 */
export async function getAttestationStatus(
	connection: FlareConnection,
	requestHash: string,
	roundId: number,
): Promise<AttestationStatus> {
	const round = await getAttestationRound(connection, roundId);

	return {
		requestHash,
		roundId,
		isFinalized: round.isFinalized,
		isVerified: false, // Would need to check against merkle root
	};
}

/**
 * Get Merkle root for a round
 */
export async function getMerkleRoot(
	connection: FlareConnection,
	roundId: number,
): Promise<string | null> {
	const stateConnector = getStateConnectorContract(connection);

	try {
		const root = await stateConnector.merkleRoots(roundId);
		if (root === ethers.ZeroHash) {
			return null;
		}
		return root;
	} catch {
		return null;
	}
}

/**
 * Verify attestation proof
 */
export async function verifyAttestation(
	connection: FlareConnection,
	roundId: number,
	requestHash: string,
	proof: MerkleProof,
): Promise<boolean> {
	const merkleRoot = await getMerkleRoot(connection, roundId);
	if (!merkleRoot) {
		return false;
	}

	return verifyMerkleProof(requestHash, proof.proof, merkleRoot, proof.index);
}

/**
 * Get supported attestation types
 */
export function getSupportedAttestationTypes(): AttestationType[] {
	return [
		{
			id: 1,
			name: 'Payment',
			description: 'Proves a payment occurred on an external chain',
			supportedChains: ['BTC', 'XRP', 'DOGE', 'LTC', 'XLM', 'ALGO'],
		},
		{
			id: 2,
			name: 'BalanceDecreasingTransaction',
			description: 'Proves a balance-decreasing transaction',
			supportedChains: ['BTC', 'XRP', 'DOGE', 'LTC', 'XLM', 'ALGO'],
		},
		{
			id: 3,
			name: 'ConfirmedBlockHeightExists',
			description: 'Proves a block exists at a certain height',
			supportedChains: ['BTC', 'XRP', 'DOGE', 'LTC', 'XLM', 'ALGO', 'ETH'],
		},
		{
			id: 4,
			name: 'ReferencedPaymentNonexistence',
			description: 'Proves a referenced payment does not exist',
			supportedChains: ['BTC', 'XRP', 'DOGE', 'LTC', 'XLM', 'ALGO'],
		},
		{
			id: 5,
			name: 'EVMTransaction',
			description: 'Proves an EVM transaction occurred',
			supportedChains: ['ETH', 'AVAX', 'MATIC'],
		},
	];
}

/**
 * Get attestation providers (from known provider list)
 */
export async function getAttestationProviders(
	connection: FlareConnection,
): Promise<string[]> {
	// In practice, these would be queried from a registry or config
	// These are example attestation provider addresses
	return [
		'0x1000000000000000000000000000000000000001',
		'0x1000000000000000000000000000000000000002',
		'0x1000000000000000000000000000000000000003',
	];
}

/**
 * Wait for attestation to be finalized
 */
export async function waitForAttestation(
	connection: FlareConnection,
	roundId: number,
	maxWaitMs: number = 300000, // 5 minutes
): Promise<boolean> {
	const startTime = Date.now();

	while (Date.now() - startTime < maxWaitMs) {
		const round = await getAttestationRound(connection, roundId);
		if (round.isFinalized && round.merkleRoot) {
			return true;
		}

		// Wait 10 seconds before checking again
		await new Promise(resolve => setTimeout(resolve, 10000));
	}

	return false;
}

/**
 * Calculate round ID for a timestamp
 */
export function calculateRoundId(timestamp: number): number {
	const genesisTime = 1658429955;
	const roundDuration = 90;
	return Math.floor((timestamp - genesisTime) / roundDuration);
}

/**
 * Get time until round is finalized
 */
export async function getTimeUntilFinalized(
	connection: FlareConnection,
	roundId: number,
): Promise<number> {
	const roundDuration = 90;
	const genesisTime = 1658429955;

	// Round finalizes 2 rounds after it ends
	const finalizationTime = genesisTime + (roundId + 2) * roundDuration;
	const now = Math.floor(Date.now() / 1000);

	return Math.max(0, finalizationTime - now);
}

export default {
	getStateConnectorInfo,
	getAttestationRound,
	getLastFinalizedRound,
	requestPaymentAttestation,
	requestBalanceDecreasingAttestation,
	requestConfirmedBlockHeightAttestation,
	getAttestationStatus,
	getMerkleRoot,
	verifyAttestation,
	getSupportedAttestationTypes,
	getAttestationProviders,
	waitForAttestation,
	calculateRoundId,
	getTimeUntilFinalized,
};
