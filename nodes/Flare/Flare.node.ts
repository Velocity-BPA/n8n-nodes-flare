/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Flare Node
 *
 * Main action node for Flare Network blockchain operations.
 *
 * Flare Network is an EVM-compatible Layer 1 blockchain designed for
 * cross-chain interoperability and decentralized data acquisition.
 *
 * Key Flare Concepts:
 * - FTSO (Flare Time Series Oracle): Decentralized price feeds
 * - State Connector: Cross-chain data verification
 * - FAssets: Trustless bridging for non-smart contract chains
 * - Vote Power: Wrapped tokens enable voting and delegation
 * - Delegation: Delegate vote power to FTSO providers for rewards
 */

import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

// Import all operations
import {
	accountOperations, accountFields, executeAccountOperation,
	transactionOperations, transactionFields, executeTransaction,
	wrappedTokenOperations, wrappedTokenFields, executeWrappedToken,
	ftsoOperations, ftsoFields, executeFtso,
	ftsoDelegationOperations, ftsoDelegationFields, executeFtsoDelegation,
	ftsoRewardsOperations, ftsoRewardsFields, executeFtsoRewards,
	stateConnectorOperations, stateConnectorFields, executeStateConnector,
	fAssetsOperations, fAssetsFields, executeFAssets,
	tokenOperations, tokenFields, executeToken,
	nftOperations, nftFields, executeNFT,
	contractOperations, contractFields, executeContractOperation,
	stakingOperations, stakingFields, executeStakingOperation,
	blockOperations, blockFields, executeBlockOperation,
	governanceOperations, governanceFields, executeGovernanceOperation,
	airdropOperations, airdropFields, executeAirdrop,
	bridgeOperations, bridgeFields, executeBridge,
	networkOperations, networkFields, executeNetwork,
	utilityOperations, utilityFields, executeUtility,
} from './actions';

// Licensing notice flag - logged once per node load
let licensingNoticeLogged = false;

const LICENSING_NOTICE = `[Velocity BPA Licensing Notice]

This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).

Use of this node by for-profit organizations in production environments requires a commercial license from Velocity BPA.

For licensing information, visit https://velobpa.com/licensing or contact licensing@velobpa.com.`;

export class Flare implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Flare',
		name: 'flare',
		icon: 'file:flare.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Flare Network blockchain - FTSO, State Connector, FAssets, delegation, and more',
		defaults: {
			name: 'Flare',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'flareNetworkApi',
				required: true,
			},
			{
				name: 'flareExplorerApi',
				required: false,
			},
		],
		properties: [
			// Resource selection
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Account',
						value: 'account',
						description: 'Account balances, transaction history, and info',
					},
					{
						name: 'Airdrop',
						value: 'airdrop',
						description: 'FlareDrop distribution claiming',
					},
					{
						name: 'Block',
						value: 'block',
						description: 'Block information and queries',
					},
					{
						name: 'Bridge',
						value: 'bridge',
						description: 'LayerCake cross-chain bridge operations',
					},
					{
						name: 'Contract',
						value: 'contract',
						description: 'Smart contract interactions',
					},
					{
						name: 'FAssets',
						value: 'fAssets',
						description: 'Cross-chain FAssets (FBTC, FXRP, etc.)',
					},
					{
						name: 'FTSO',
						value: 'ftso',
						description: 'Flare Time Series Oracle price feeds',
					},
					{
						name: 'FTSO Delegation',
						value: 'ftsoDelegation',
						description: 'Delegate vote power to FTSO providers',
					},
					{
						name: 'FTSO Rewards',
						value: 'ftsoRewards',
						description: 'Claim FTSO delegation rewards',
					},
					{
						name: 'Governance',
						value: 'governance',
						description: 'Governance proposals and voting',
					},
					{
						name: 'Network',
						value: 'network',
						description: 'Network info and protocol parameters',
					},
					{
						name: 'NFT',
						value: 'nft',
						description: 'ERC-721 and ERC-1155 NFT operations',
					},
					{
						name: 'Staking',
						value: 'staking',
						description: 'Validator staking operations',
					},
					{
						name: 'State Connector',
						value: 'stateConnector',
						description: 'Cross-chain attestation requests',
					},
					{
						name: 'Token',
						value: 'token',
						description: 'ERC-20 token operations',
					},
					{
						name: 'Transaction',
						value: 'transaction',
						description: 'Send and query transactions',
					},
					{
						name: 'Utility',
						value: 'utility',
						description: 'Unit conversion and helper functions',
					},
					{
						name: 'Wrapped Token',
						value: 'wrappedToken',
						description: 'WFLR/WSGB wrapping and vote power',
					},
				],
				default: 'account',
			},

			// Account operations
			...accountOperations,
			...accountFields,

			// Transaction operations
			...transactionOperations,
			...transactionFields,

			// Wrapped Token operations
			...wrappedTokenOperations,
			...wrappedTokenFields,

			// FTSO operations
			...ftsoOperations,
			...ftsoFields,

			// FTSO Delegation operations
			...ftsoDelegationOperations,
			...ftsoDelegationFields,

			// FTSO Rewards operations
			...ftsoRewardsOperations,
			...ftsoRewardsFields,

			// State Connector operations
			...stateConnectorOperations,
			...stateConnectorFields,

			// FAssets operations
			...fAssetsOperations,
			...fAssetsFields,

			// Token operations
			...tokenOperations,
			...tokenFields,

			// NFT operations
			...nftOperations,
			...nftFields,

			// Contract operations
			...contractOperations,
			...contractFields,

			// Staking operations
			...stakingOperations,
			...stakingFields,

			// Block operations
			...blockOperations,
			...blockFields,

			// Governance operations
			...governanceOperations,
			...governanceFields,

			// Airdrop operations
			...airdropOperations,
			...airdropFields,

			// Bridge operations
			...bridgeOperations,
			...bridgeFields,

			// Network operations
			...networkOperations,
			...networkFields,

			// Utility operations
			...utilityOperations,
			...utilityFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		// Log licensing notice once per node load (non-blocking, informational only)
		if (!licensingNoticeLogged) {
			console.warn(LICENSING_NOTICE);
			licensingNoticeLogged = true;
		}

		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				let result: INodeExecutionData[];

				switch (resource) {
					case 'account':
						result = await executeAccountOperation.call(this, i);
						break;
					case 'transaction':
						result = await executeTransaction.call(this, i);
						break;
					case 'wrappedToken':
						result = await executeWrappedToken.call(this, i);
						break;
					case 'ftso':
						result = await executeFtso.call(this, i);
						break;
					case 'ftsoDelegation':
						result = await executeFtsoDelegation.call(this, i);
						break;
					case 'ftsoRewards':
						result = await executeFtsoRewards.call(this, i);
						break;
					case 'stateConnector':
						result = await executeStateConnector.call(this, i);
						break;
					case 'fAssets':
						result = await executeFAssets.call(this, i);
						break;
					case 'token':
						result = await executeToken.call(this, i);
						break;
					case 'nft':
						result = await executeNFT.call(this, i);
						break;
					case 'contract':
						result = await executeContractOperation.call(this, i);
						break;
					case 'staking':
						result = await executeStakingOperation.call(this, i);
						break;
					case 'block':
						result = await executeBlockOperation.call(this, i);
						break;
					case 'governance':
						result = await executeGovernanceOperation.call(this, i);
						break;
					case 'airdrop':
						result = await executeAirdrop.call(this, i);
						break;
					case 'bridge':
						result = await executeBridge.call(this, i);
						break;
					case 'network':
						result = await executeNetwork.call(this, i);
						break;
					case 'utility':
						result = await executeUtility.call(this, i);
						break;
					default:
						throw new NodeOperationError(
							this.getNode(),
							`Unknown resource: ${resource}`,
						);
				}

				returnData.push(...result);
			} catch (error: unknown) {
				if (this.continueOnFail()) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					returnData.push({
						json: {
							error: errorMessage,
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
