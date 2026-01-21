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
 * Flare Explorer API Credentials
 *
 * Provides access to the Flare/Songbird block explorer APIs for
 * enhanced data queries like transaction history, token transfers,
 * and contract verification.
 */
export class FlareExplorerApi implements ICredentialType {
	name = 'flareExplorerApi';
	displayName = 'Flare Explorer API';
	documentationUrl = 'https://docs.flare.network';

	properties: INodeProperties[] = [
		{
			displayName: 'Network',
			name: 'network',
			type: 'options',
			options: [
				{
					name: 'Flare Explorer',
					value: 'flare',
					description: 'Flare mainnet block explorer',
				},
				{
					name: 'Songbird Explorer',
					value: 'songbird',
					description: 'Songbird canary network block explorer',
				},
				{
					name: 'Coston2 Explorer',
					value: 'coston2',
					description: 'Flare testnet block explorer',
				},
				{
					name: 'Coston Explorer',
					value: 'coston',
					description: 'Songbird testnet block explorer',
				},
			],
			default: 'flare',
			description: 'Select the block explorer network',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description: 'API key for the Flare/Songbird Explorer (optional but recommended for higher rate limits)',
			hint: 'Get an API key from the Flare Explorer website',
		},
		{
			displayName: 'Custom API URL',
			name: 'customApiUrl',
			type: 'string',
			default: '',
			placeholder: 'https://flare-explorer.flare.network/api',
			description: 'Optional custom API URL (leave empty to use default for selected network)',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			qs: {
				apikey: '={{$credentials.apiKey}}',
			},
		},
	};

	// Test the credential by attempting to get the API status
	test: ICredentialTestRequest = {
		request: {
			method: 'GET',
			url: '={{$credentials.customApiUrl || ($credentials.network === "flare" ? "https://flare-explorer.flare.network/api" : $credentials.network === "songbird" ? "https://songbird-explorer.flare.network/api" : $credentials.network === "coston2" ? "https://coston2-explorer.flare.network/api" : "https://coston-explorer.flare.network/api")}}',
			qs: {
				module: 'block',
				action: 'eth_block_number',
			},
		},
	};
}
