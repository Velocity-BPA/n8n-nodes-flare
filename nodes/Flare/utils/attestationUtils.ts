/**
 * Attestation Utilities for State Connector
 *
 * The State Connector is Flare's system for bringing external data onto the network
 * in a decentralized and trustless manner. It uses a commit-reveal scheme with
 * multiple attestation providers.
 *
 * Key concepts:
 * - Attestation Request: Request for external data verification
 * - Attestation Providers: Decentralized nodes that verify data
 * - Merkle Proof: Cryptographic proof that an attestation is valid
 * - Round: Time period for attestation collection (90 seconds)
 *
 * Attestation Types:
 * - Payment: Verify a payment on an external chain
 * - Balance Decreasing: Verify balance decrease on external chain
 * - Confirmed Block Height: Verify block height on external chain
 * - Referenced Payment Nonexistence: Prove a payment didn't happen
 */

import { ethers } from 'ethers';

/**
 * Supported attestation types
 */
export enum AttestationType {
	Payment = 'Payment',
	BalanceDecreasingTransaction = 'BalanceDecreasingTransaction',
	ConfirmedBlockHeightExists = 'ConfirmedBlockHeightExists',
	ReferencedPaymentNonexistence = 'ReferencedPaymentNonexistence',
	AddressValidity = 'AddressValidity',
}

/**
 * Supported source chains for attestations
 */
export enum SourceChain {
	BTC = 'BTC',
	DOGE = 'DOGE',
	XRP = 'XRP',
	LTC = 'LTC',
	testBTC = 'testBTC',
	testDOGE = 'testDOGE',
	testXRP = 'testXRP',
}

/**
 * Source chain IDs
 */
export const SOURCE_CHAIN_IDS: Record<SourceChain, number> = {
	[SourceChain.BTC]: 0,
	[SourceChain.DOGE]: 2,
	[SourceChain.XRP]: 3,
	[SourceChain.LTC]: 1,
	[SourceChain.testBTC]: 0,
	[SourceChain.testDOGE]: 2,
	[SourceChain.testXRP]: 3,
};

export interface AttestationRequest {
	/** Type of attestation */
	attestationType: AttestationType;
	/** Source blockchain */
	sourceChain: SourceChain;
	/** Request data (type-specific) */
	requestData: unknown;
	/** Timestamp of request */
	timestamp: number;
}

export interface PaymentAttestation {
	/** Transaction hash on source chain */
	transactionHash: string;
	/** In-block index */
	inUtxo: number;
	/** Out-block index */
	utxo: number;
	/** Source address */
	sourceAddress: string;
	/** Destination address */
	destinationAddress: string;
	/** Payment amount */
	amount: bigint;
	/** Payment reference (32 bytes) */
	paymentReference: string;
	/** Block number */
	blockNumber: number;
	/** Block timestamp */
	blockTimestamp: number;
}

export interface BalanceDecreasingAttestation {
	/** Transaction hash */
	transactionHash: string;
	/** Source address */
	sourceAddress: string;
	/** Spent amount */
	spentAmount: bigint;
	/** Payment reference */
	paymentReference: string;
	/** Block number */
	blockNumber: number;
	/** Block timestamp */
	blockTimestamp: number;
}

export interface ConfirmedBlockHeightAttestation {
	/** Block number */
	blockNumber: number;
	/** Block timestamp */
	blockTimestamp: number;
	/** Number of confirmations */
	numberOfConfirmations: number;
	/** Lowest query window block number */
	lowestQueryWindowBlockNumber: number;
	/** Lowest query window block timestamp */
	lowestQueryWindowBlockTimestamp: number;
}

export interface MerkleProof {
	/** Merkle root */
	merkleRoot: string;
	/** Proof elements */
	proof: string[];
	/** Index in the tree */
	index: number;
}

export interface AttestationResponse {
	/** Round ID */
	roundId: number;
	/** Attestation hash */
	hash: string;
	/** Request data */
	request: AttestationRequest;
	/** Response data (if verified) */
	response?: unknown;
	/** Merkle proof (if verified) */
	merkleProof?: MerkleProof;
	/** Status */
	status: 'pending' | 'verified' | 'rejected' | 'expired';
}

/**
 * State Connector round duration in seconds
 */
export const ROUND_DURATION_SECONDS = 90;

/**
 * Number of rounds to finalize
 */
export const FINALIZATION_ROUNDS = 2;

/**
 * Encode payment attestation request
 */
export function encodePaymentRequest(
	sourceChain: SourceChain | string,
	transactionHash: string,
	inUtxo: number,
	utxo: number,
): string {
	const abiCoder = new ethers.AbiCoder();

	const attestationTypeHash = ethers.keccak256(
		ethers.toUtf8Bytes('Payment'),
	);

	// Handle both enum and string source chain
	const chainId = typeof sourceChain === 'string'
		? SOURCE_CHAIN_IDS[sourceChain as SourceChain] || 0
		: SOURCE_CHAIN_IDS[sourceChain];

	return abiCoder.encode(
		['bytes32', 'uint32', 'bytes32', 'uint8', 'uint8'],
		[
			attestationTypeHash,
			chainId,
			transactionHash,
			inUtxo,
			utxo,
		],
	);
}

/**
 * Encode balance decreasing attestation request
 */
export function encodeBalanceDecreasingRequest(
	sourceChain: SourceChain | string,
	transactionHash: string,
	sourceAddress: string,
): string {
	const abiCoder = new ethers.AbiCoder();

	const attestationTypeHash = ethers.keccak256(
		ethers.toUtf8Bytes('BalanceDecreasingTransaction'),
	);

	const chainId = typeof sourceChain === 'string'
		? SOURCE_CHAIN_IDS[sourceChain as SourceChain] || 0
		: SOURCE_CHAIN_IDS[sourceChain];

	return abiCoder.encode(
		['bytes32', 'uint32', 'bytes32', 'bytes32'],
		[
			attestationTypeHash,
			chainId,
			transactionHash,
			ethers.keccak256(ethers.toUtf8Bytes(sourceAddress)),
		],
	);
}

/**
 * Encode confirmed block height request
 */
export function encodeConfirmedBlockHeightRequest(
	sourceChain: SourceChain | string,
	blockNumber: number,
	queryWindow: number,
): string {
	const abiCoder = new ethers.AbiCoder();

	const attestationTypeHash = ethers.keccak256(
		ethers.toUtf8Bytes('ConfirmedBlockHeightExists'),
	);

	const chainId = typeof sourceChain === 'string'
		? SOURCE_CHAIN_IDS[sourceChain as SourceChain] || 0
		: SOURCE_CHAIN_IDS[sourceChain];

	return abiCoder.encode(
		['bytes32', 'uint32', 'uint64', 'uint64'],
		[
			attestationTypeHash,
			chainId,
			blockNumber,
			queryWindow,
		],
	);
}

/**
 * Verify Merkle proof
 */
export function verifyMerkleProof(
	leaf: string,
	proof: string[],
	root: string,
	index: number,
): boolean {
	let computedHash = leaf;
	let idx = index;

	for (const proofElement of proof) {
		if (idx % 2 === 0) {
			computedHash = ethers.keccak256(
				ethers.concat([computedHash, proofElement]),
			);
		} else {
			computedHash = ethers.keccak256(
				ethers.concat([proofElement, computedHash]),
			);
		}
		idx = Math.floor(idx / 2);
	}

	return computedHash === root;
}

/**
 * Calculate attestation hash
 */
export function calculateAttestationHash(
	attestationType: AttestationType,
	sourceChain: SourceChain,
	requestData: string,
): string {
	const typeHash = ethers.keccak256(ethers.toUtf8Bytes(attestationType));
	const chainId = SOURCE_CHAIN_IDS[sourceChain];

	return ethers.keccak256(
		ethers.concat([
			typeHash,
			ethers.toBeHex(chainId, 4),
			requestData,
		]),
	);
}

/**
 * Get current round ID
 */
export function getCurrentRoundId(genesisTimestamp: number): number {
	const now = Math.floor(Date.now() / 1000);
	return Math.floor((now - genesisTimestamp) / ROUND_DURATION_SECONDS);
}

/**
 * Get time until next round
 */
export function getTimeUntilNextRound(genesisTimestamp: number): number {
	const now = Math.floor(Date.now() / 1000);
	const currentRoundStart = genesisTimestamp + getCurrentRoundId(genesisTimestamp) * ROUND_DURATION_SECONDS;
	const nextRoundStart = currentRoundStart + ROUND_DURATION_SECONDS;
	return nextRoundStart - now;
}

/**
 * Get round timestamp
 */
export function getRoundTimestamp(
	roundId: number,
	genesisTimestamp: number,
): { start: number; end: number } {
	const start = genesisTimestamp + roundId * ROUND_DURATION_SECONDS;
	const end = start + ROUND_DURATION_SECONDS;
	return { start, end };
}

/**
 * Check if attestation is finalized
 */
export function isAttestationFinalized(
	requestRoundId: number,
	currentRoundId: number,
): boolean {
	return currentRoundId >= requestRoundId + FINALIZATION_ROUNDS;
}

/**
 * Estimate finalization time
 */
export function estimateFinalizationTime(requestTimestamp: number): number {
	return requestTimestamp + (FINALIZATION_ROUNDS + 1) * ROUND_DURATION_SECONDS;
}

/**
 * Parse payment reference from hex
 */
export function parsePaymentReference(hexReference: string): string {
	// Remove 0x prefix if present
	const cleanHex = hexReference.startsWith('0x') ? hexReference.slice(2) : hexReference;

	// Convert to UTF-8 string if possible
	try {
		const bytes = Buffer.from(cleanHex, 'hex');
		// Check if it's printable ASCII
		const isPrintable = bytes.every((b) => b >= 32 && b <= 126);
		if (isPrintable) {
			return bytes.toString('utf-8').replace(/\0/g, '');
		}
	} catch {
		// Not a valid UTF-8 string
	}

	return hexReference;
}

/**
 * Create payment reference from string
 */
export function createPaymentReference(reference: string): string {
	// Pad to 32 bytes
	const bytes = Buffer.alloc(32);
	Buffer.from(reference, 'utf-8').copy(bytes);
	return '0x' + bytes.toString('hex');
}

/**
 * Attestation type options for n8n UI
 */
export const ATTESTATION_TYPE_OPTIONS = Object.values(AttestationType).map((type) => ({
	name: type.replace(/([A-Z])/g, ' $1').trim(),
	value: type,
}));

/**
 * Source chain options for n8n UI
 */
export const SOURCE_CHAIN_OPTIONS = Object.values(SourceChain).map((chain) => ({
	name: chain,
	value: chain,
}));

export default {
	AttestationType,
	SourceChain,
	SOURCE_CHAIN_IDS,
	ROUND_DURATION_SECONDS,
	FINALIZATION_ROUNDS,
	encodePaymentRequest,
	encodeBalanceDecreasingRequest,
	encodeConfirmedBlockHeightRequest,
	verifyMerkleProof,
	calculateAttestationHash,
	getCurrentRoundId,
	getTimeUntilNextRound,
	getRoundTimestamp,
	isAttestationFinalized,
	estimateFinalizationTime,
	parsePaymentReference,
	createPaymentReference,
	ATTESTATION_TYPE_OPTIONS,
	SOURCE_CHAIN_OPTIONS,
};
