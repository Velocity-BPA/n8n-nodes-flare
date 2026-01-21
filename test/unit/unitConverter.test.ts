/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import {
	weiToEther,
	etherToWei,
	formatTokenAmount,
	parseTokenAmount,
	bipsToPercentage,
	percentageToBips,
} from '../../nodes/Flare/utils/unitConverter';

describe('Unit Converter Utils', () => {
	describe('weiToEther', () => {
		it('should convert wei to ether correctly', () => {
			expect(weiToEther('1000000000000000000')).toBe('1.0');
			expect(weiToEther('500000000000000000')).toBe('0.5');
			expect(weiToEther('0')).toBe('0.0');
		});

		it('should handle bigint input', () => {
			expect(weiToEther(BigInt('1000000000000000000'))).toBe('1.0');
		});

		it('should handle large numbers', () => {
			const result = weiToEther('1000000000000000000000000');
			expect(parseFloat(result)).toBe(1000000);
		});
	});

	describe('etherToWei', () => {
		it('should convert ether to wei correctly', () => {
			expect(etherToWei('1')).toBe(BigInt('1000000000000000000'));
			expect(etherToWei('0.5')).toBe(BigInt('500000000000000000'));
			expect(etherToWei('0')).toBe(BigInt('0'));
		});

		it('should handle decimal values', () => {
			expect(etherToWei('0.001')).toBe(BigInt('1000000000000000'));
		});
	});

	describe('formatTokenAmount', () => {
		it('should format token amounts with default decimals', () => {
			const result = formatTokenAmount('1000000000000000000', 18);
			expect(result).toBe('1.0');
		});

		it('should format token amounts with custom decimals', () => {
			const result = formatTokenAmount('1000000', 6);
			expect(result).toBe('1.0');
		});

		it('should handle zero', () => {
			expect(formatTokenAmount('0', 18)).toBe('0.0');
		});
	});

	describe('parseTokenAmount', () => {
		it('should parse token amounts with default decimals', () => {
			const result = parseTokenAmount('1', 18);
			expect(result).toBe(BigInt('1000000000000000000'));
		});

		it('should parse token amounts with custom decimals', () => {
			const result = parseTokenAmount('1', 6);
			expect(result).toBe(BigInt('1000000'));
		});
	});

	describe('bipsToPercentage', () => {
		it('should convert basis points to percentage', () => {
			expect(bipsToPercentage(10000)).toBe(100);
			expect(bipsToPercentage(5000)).toBe(50);
			expect(bipsToPercentage(100)).toBe(1);
		});
	});

	describe('percentageToBips', () => {
		it('should convert percentage to basis points', () => {
			expect(percentageToBips(100)).toBe(10000);
			expect(percentageToBips(50)).toBe(5000);
			expect(percentageToBips(1)).toBe(100);
		});
	});
});
