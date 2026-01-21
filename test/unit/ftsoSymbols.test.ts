/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import { FTSO_SYMBOLS, getSymbolInfo, getNetworkSymbols } from '../../nodes/Flare/constants/ftsoSymbols';

describe('FTSO Symbols Constants', () => {
	describe('FTSO_SYMBOLS', () => {
		it('should have FLR symbol', () => {
			expect(FTSO_SYMBOLS.FLR).toBeDefined();
			expect(FTSO_SYMBOLS.FLR.symbol).toBe('FLR');
		});

		it('should have SGB symbol', () => {
			expect(FTSO_SYMBOLS.SGB).toBeDefined();
			expect(FTSO_SYMBOLS.SGB.symbol).toBe('SGB');
		});

		it('should have major crypto symbols', () => {
			expect(FTSO_SYMBOLS.BTC).toBeDefined();
			expect(FTSO_SYMBOLS.ETH).toBeDefined();
			expect(FTSO_SYMBOLS.XRP).toBeDefined();
		});

		it('should have proper symbol structure', () => {
			Object.values(FTSO_SYMBOLS).forEach((info) => {
				expect(info.symbol).toBeDefined();
				expect(info.displayName).toBeDefined();
				expect(info.description).toBeDefined();
				expect(info.category).toBeDefined();
				expect(info.decimals).toBeDefined();
				expect(typeof info.flare).toBe('boolean');
				expect(typeof info.songbird).toBe('boolean');
			});
		});

		it('should have unique symbols', () => {
			const symbols = Object.keys(FTSO_SYMBOLS);
			const uniqueSymbols = [...new Set(symbols)];
			expect(uniqueSymbols.length).toBe(symbols.length);
		});
	});

	describe('getSymbolInfo', () => {
		it('should return info for valid symbols', () => {
			const flrInfo = getSymbolInfo('FLR');
			expect(flrInfo).toBeDefined();
			expect(flrInfo?.symbol).toBe('FLR');
		});

		it('should return undefined for invalid symbols', () => {
			const info = getSymbolInfo('INVALID_SYMBOL');
			expect(info).toBeUndefined();
		});
	});

	describe('getNetworkSymbols', () => {
		it('should return Flare symbols', () => {
			const flareSymbols = getNetworkSymbols('flare');
			expect(flareSymbols.length).toBeGreaterThan(0);
			expect(flareSymbols.some(s => s.symbol === 'FLR')).toBe(true);
		});

		it('should return Songbird symbols', () => {
			const songbirdSymbols = getNetworkSymbols('songbird');
			expect(songbirdSymbols.length).toBeGreaterThan(0);
			expect(songbirdSymbols.some(s => s.symbol === 'SGB')).toBe(true);
		});
	});
});
