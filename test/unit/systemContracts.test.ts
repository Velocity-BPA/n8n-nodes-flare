/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import { SYSTEM_CONTRACTS } from '../../nodes/Flare/constants/systemContracts';

describe('System Contracts Constants', () => {
	const networks = ['flare', 'songbird', 'coston2', 'coston'];

	describe('Contract Addresses', () => {
		networks.forEach((network) => {
			describe(`${network} network`, () => {
				it('should have WNat contract address', () => {
					expect(SYSTEM_CONTRACTS[network]).toBeDefined();
					expect(SYSTEM_CONTRACTS[network].WNat).toBeDefined();
					expect(SYSTEM_CONTRACTS[network].WNat).toMatch(/^0x[a-fA-F0-9]{40}$/);
				});

				it('should have FtsoManager contract address', () => {
					expect(SYSTEM_CONTRACTS[network].FtsoManager).toBeDefined();
					expect(SYSTEM_CONTRACTS[network].FtsoManager).toMatch(/^0x[a-fA-F0-9]{40}$/);
				});

				it('should have FtsoRewardManager contract address', () => {
					expect(SYSTEM_CONTRACTS[network].FtsoRewardManager).toBeDefined();
					expect(SYSTEM_CONTRACTS[network].FtsoRewardManager).toMatch(/^0x[a-fA-F0-9]{40}$/);
				});

				it('should have VoterWhitelister contract address', () => {
					expect(SYSTEM_CONTRACTS[network].VoterWhitelister).toBeDefined();
					expect(SYSTEM_CONTRACTS[network].VoterWhitelister).toMatch(/^0x[a-fA-F0-9]{40}$/);
				});

				it('should have PriceSubmitter contract address', () => {
					expect(SYSTEM_CONTRACTS[network].PriceSubmitter).toBeDefined();
					expect(SYSTEM_CONTRACTS[network].PriceSubmitter).toMatch(/^0x[a-fA-F0-9]{40}$/);
				});
			});
		});
	});

	describe('Address Format', () => {
		it('all required addresses should be valid Ethereum addresses', () => {
			const requiredKeys = ['WNat', 'FtsoRegistry', 'FtsoManager', 'FtsoRewardManager', 'StateConnector'];
			
			Object.entries(SYSTEM_CONTRACTS).forEach(([network, contracts]) => {
				requiredKeys.forEach((key) => {
					const address = contracts[key as keyof typeof contracts];
					if (address) {
						expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
					}
				});
			});
		});
	});
});
