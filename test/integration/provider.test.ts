/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import { createFlareConnection, type FlareCredentials } from '../../nodes/Flare/transport/provider';

describe('Provider Integration Tests', () => {
	const testCredentials: FlareCredentials = {
		network: 'coston2', // Use testnet for integration tests
	};

	describe('createFlareConnection', () => {
		it('should create a connection to Coston2 testnet', async () => {
			const connection = await createFlareConnection(testCredentials);

			expect(connection).toBeDefined();
			expect(connection.provider).toBeDefined();
			expect(connection.network).toBe('coston2');
		});

		it('should connect to the correct chain ID', async () => {
			const connection = await createFlareConnection(testCredentials);
			const network = await connection.provider.getNetwork();

			expect(Number(network.chainId)).toBe(114); // Coston2 chain ID
		});

		it('should be able to get block number', async () => {
			const connection = await createFlareConnection(testCredentials);
			const blockNumber = await connection.provider.getBlockNumber();

			expect(typeof blockNumber).toBe('number');
			expect(blockNumber).toBeGreaterThan(0);
		});

		it('should handle custom RPC URL', async () => {
			const customCredentials: FlareCredentials = {
				network: 'coston2',
				rpcUrl: 'https://coston2-api.flare.network/ext/C/rpc',
			};

			const connection = await createFlareConnection(customCredentials);
			expect(connection).toBeDefined();
		});
	});

	describe('Network Configuration', () => {
		const networks: Array<{ name: string; chainId: number }> = [
			{ name: 'flare', chainId: 14 },
			{ name: 'songbird', chainId: 19 },
			{ name: 'coston2', chainId: 114 },
			{ name: 'coston', chainId: 16 },
		];

		// Only test coston2 to avoid hitting mainnet RPC limits
		it('should connect to coston2 with correct chain ID', async () => {
			const creds: FlareCredentials = { network: 'coston2' };
			const connection = await createFlareConnection(creds);
			const network = await connection.provider.getNetwork();

			expect(Number(network.chainId)).toBe(114);
		});
	});
});
