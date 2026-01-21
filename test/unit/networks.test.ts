/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import { FLARE_NETWORKS } from '../../nodes/Flare/constants/networks';

describe('Networks Constants', () => {
	describe('FLARE_NETWORKS', () => {
		it('should have flare network defined', () => {
			expect(FLARE_NETWORKS.flare).toBeDefined();
			expect(FLARE_NETWORKS.flare.name).toBe('flare');
			expect(FLARE_NETWORKS.flare.chainId).toBe(14);
			expect(FLARE_NETWORKS.flare.nativeCurrency.symbol).toBe('FLR');
		});

		it('should have songbird network defined', () => {
			expect(FLARE_NETWORKS.songbird).toBeDefined();
			expect(FLARE_NETWORKS.songbird.name).toBe('songbird');
			expect(FLARE_NETWORKS.songbird.chainId).toBe(19);
			expect(FLARE_NETWORKS.songbird.nativeCurrency.symbol).toBe('SGB');
		});

		it('should have coston2 testnet defined', () => {
			expect(FLARE_NETWORKS.coston2).toBeDefined();
			expect(FLARE_NETWORKS.coston2.name).toBe('coston2');
			expect(FLARE_NETWORKS.coston2.chainId).toBe(114);
			expect(FLARE_NETWORKS.coston2.isTestnet).toBe(true);
		});

		it('should have coston testnet defined', () => {
			expect(FLARE_NETWORKS.coston).toBeDefined();
			expect(FLARE_NETWORKS.coston.name).toBe('coston');
			expect(FLARE_NETWORKS.coston.chainId).toBe(16);
			expect(FLARE_NETWORKS.coston.isTestnet).toBe(true);
		});

		it('should have RPC URLs for all networks', () => {
			Object.values(FLARE_NETWORKS).forEach((network) => {
				expect(network.rpcUrls).toBeDefined();
				expect(network.rpcUrls.length).toBeGreaterThan(0);
				expect(network.rpcUrls[0]).toMatch(/^https?:\/\//);
			});
		});

		it('should have explorer URLs for all networks', () => {
			Object.values(FLARE_NETWORKS).forEach((network) => {
				expect(network.blockExplorerUrls).toBeDefined();
				expect(network.blockExplorerUrls.length).toBeGreaterThan(0);
				expect(network.blockExplorerUrls[0]).toMatch(/^https?:\/\//);
			});
		});
	});
});
