/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

/**
 * Flare Network Credentials
 *
 * Provides connection settings for Flare, Songbird, and testnet networks.
 * Supports both read-only operations (RPC only) and write operations (RPC + private key).
 */
export class FlareNetworkApi implements ICredentialType {
	name = 'flareNetworkApi';
	displayName = 'Flare Network';
	documentationUrl = 'https://docs.flare.network';

	properties: INodeProperties[] = [
		{
			displayName: 'Network',
			name: 'network',
			type: 'options',
			options: [
				{
					name: 'Flare Mainnet',
					value: 'flare',
					description: 'Flare mainnet (Chain ID: 14)',
				},
				{
					name: 'Songbird (Canary Network)',
					value: 'songbird',
					description: 'Songbird canary network for testing features (Chain ID: 19)',
				},
				{
					name: 'Coston2 (Flare Testnet)',
					value: 'coston2',
					description: 'Flare testnet for development (Chain ID: 114)',
				},
				{
					name: 'Coston (Songbird Testnet)',
					value: 'coston',
					description: 'Songbird testnet for development (Chain ID: 16)',
				},
				{
					name: 'Custom',
					value: 'custom',
					description: 'Use a custom RPC endpoint',
				},
			],
			default: 'flare',
			description: 'Select the Flare network to connect to',
		},
		{
			displayName: 'RPC URL',
			name: 'rpcUrl',
			type: 'string',
			default: '',
			placeholder: 'https://flare-api.flare.network/ext/C/rpc',
			description: 'Custom RPC endpoint URL. Leave empty to use default for selected network.',
			hint: 'Default URLs: Flare (flare-api.flare.network), Songbird (songbird-api.flare.network)',
		},
		{
			displayName: 'Chain ID',
			name: 'chainId',
			type: 'number',
			default: 14,
			description: 'Chain ID (auto-populated for standard networks). Flare=14, Songbird=19, Coston2=114, Coston=16.',
			displayOptions: {
				show: {
					network: ['custom'],
				},
			},
		},
		{
			displayName: 'Private Key',
			name: 'privateKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description: 'Private key for signing transactions (required for write operations). Never share your private key.',
			hint: 'Leave empty for read-only operations. Required for sending transactions, delegating, claiming rewards, etc.',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description: 'Optional API key for enhanced RPC providers (if required by your RPC endpoint)',
		},
	];

	// Test the credential by attempting to connect and get the chain ID
	test: ICredentialTestRequest = {
		request: {
			method: 'POST',
			url: '={{$credentials.rpcUrl || ($credentials.network === "flare" ? "https://flare-api.flare.network/ext/C/rpc" : $credentials.network === "songbird" ? "https://songbird-api.flare.network/ext/C/rpc" : $credentials.network === "coston2" ? "https://coston2-api.flare.network/ext/C/rpc" : "https://coston-api.flare.network/ext/C/rpc")}}',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				jsonrpc: '2.0',
				method: 'eth_chainId',
				params: [],
				id: 1,
			}),
		},
	};
}
