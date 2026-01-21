/**
 * Unit Converter Utilities for Flare Networks
 *
 * Provides conversion between different unit denominations:
 * - Wei (smallest unit, 10^-18)
 * - Gwei (10^-9, commonly used for gas prices)
 * - Ether/FLR/SGB (10^0, human-readable)
 */

import { ethers } from 'ethers';

/**
 * Unit multipliers
 */
export const UNIT_MULTIPLIERS = {
	wei: BigInt(1),
	kwei: BigInt(1000),
	mwei: BigInt(1000000),
	gwei: BigInt(1000000000),
	szabo: BigInt(1000000000000),
	finney: BigInt(1000000000000000),
	ether: BigInt(1000000000000000000),
};

/**
 * Convert wei to ether (or FLR/SGB)
 */
export function weiToEther(wei: bigint | string): string {
	return ethers.formatEther(wei);
}

/**
 * Convert ether (or FLR/SGB) to wei
 */
export function etherToWei(ether: string | number): bigint {
	return ethers.parseEther(ether.toString());
}

/**
 * Convert wei to gwei
 */
export function weiToGwei(wei: bigint | string): string {
	const weiBigInt = typeof wei === 'string' ? BigInt(wei) : wei;
	return ethers.formatUnits(weiBigInt, 'gwei');
}

/**
 * Convert gwei to wei
 */
export function gweiToWei(gwei: string | number): bigint {
	return ethers.parseUnits(gwei.toString(), 'gwei');
}

/**
 * Convert between any units
 */
export function convertUnits(
	value: string | number | bigint,
	fromUnit: keyof typeof UNIT_MULTIPLIERS,
	toUnit: keyof typeof UNIT_MULTIPLIERS,
): string {
	// First convert to wei
	let valueInWei: bigint;

	if (fromUnit === 'wei') {
		valueInWei = typeof value === 'bigint' ? value : BigInt(value);
	} else {
		const fromDecimals = getDecimalsForUnit(fromUnit);
		valueInWei = ethers.parseUnits(value.toString(), fromDecimals);
	}

	// Then convert from wei to target unit
	const toDecimals = getDecimalsForUnit(toUnit);
	return ethers.formatUnits(valueInWei, toDecimals);
}

/**
 * Get decimals for a unit
 */
function getDecimalsForUnit(unit: keyof typeof UNIT_MULTIPLIERS): number {
	const decimalsMap: Record<keyof typeof UNIT_MULTIPLIERS, number> = {
		wei: 0,
		kwei: 3,
		mwei: 6,
		gwei: 9,
		szabo: 12,
		finney: 15,
		ether: 18,
	};
	return decimalsMap[unit];
}

/**
 * Format token amount with decimals
 */
export function formatTokenAmount(amount: bigint | string, decimals: number): string {
	return ethers.formatUnits(amount, decimals);
}

/**
 * Parse token amount to smallest unit
 */
export function parseTokenAmount(amount: string | number, decimals: number): bigint {
	return ethers.parseUnits(amount.toString(), decimals);
}

/**
 * Format a large number with commas and optional decimal places
 */
export function formatNumber(value: string | number, decimalPlaces: number = 4): string {
	const num = typeof value === 'string' ? parseFloat(value) : value;

	if (isNaN(num)) return '0';

	return num.toLocaleString('en-US', {
		minimumFractionDigits: 0,
		maximumFractionDigits: decimalPlaces,
	});
}

/**
 * Format wei as a human-readable string with unit suffix
 */
export function formatWeiWithUnit(wei: bigint | string): string {
	const weiBigInt = typeof wei === 'string' ? BigInt(wei) : wei;

	// Less than 1 gwei - show in wei
	if (weiBigInt < UNIT_MULTIPLIERS.gwei) {
		return `${weiBigInt.toString()} wei`;
	}

	// Less than 1 ether - show in gwei
	if (weiBigInt < UNIT_MULTIPLIERS.ether) {
		return `${formatNumber(weiToGwei(weiBigInt))} gwei`;
	}

	// Show in ether/FLR/SGB
	return `${formatNumber(weiToEther(weiBigInt))} FLR`;
}

/**
 * Convert basis points (bips) to percentage
 * 10000 bips = 100%
 */
export function bipsToPercentage(bips: number | bigint): number {
	return Number(bips) / 100;
}

/**
 * Convert percentage to basis points
 * 100% = 10000 bips
 */
export function percentageToBips(percentage: number): number {
	return Math.round(percentage * 100);
}

/**
 * Format basis points as percentage string
 */
export function formatBipsAsPercentage(bips: number | bigint): string {
	return `${bipsToPercentage(bips).toFixed(2)}%`;
}

/**
 * Calculate percentage of a value
 */
export function calculatePercentage(value: bigint, bips: number): bigint {
	return (value * BigInt(bips)) / BigInt(10000);
}

/**
 * Safe division for BigInt with decimal result
 */
export function safeDivide(numerator: bigint, denominator: bigint, decimals: number = 18): string {
	if (denominator === BigInt(0)) return '0';

	const multiplier = BigInt(10 ** decimals);
	const result = (numerator * multiplier) / denominator;

	return ethers.formatUnits(result, decimals);
}

/**
 * Parse a user-input value that could be in various formats
 */
export function parseUserInput(
	input: string | number,
	inputUnit: 'wei' | 'gwei' | 'ether' | 'auto' = 'auto',
): bigint {
	const strInput = input.toString().trim();

	if (inputUnit === 'auto') {
		// Try to detect the unit from the input
		const lowerInput = strInput.toLowerCase();

		if (lowerInput.includes('wei') && !lowerInput.includes('gwei')) {
			return BigInt(strInput.replace(/[^\d]/g, ''));
		}

		if (lowerInput.includes('gwei')) {
			const numPart = strInput.replace(/[^\d.]/g, '');
			return gweiToWei(numPart);
		}

		// Default: assume ether/FLR/SGB
		const numPart = strInput.replace(/[^\d.]/g, '');
		return etherToWei(numPart);
	}

	switch (inputUnit) {
		case 'wei':
			return BigInt(strInput.replace(/[^\d]/g, ''));
		case 'gwei':
			return gweiToWei(strInput);
		case 'ether':
			return etherToWei(strInput);
		default:
			throw new Error(`Unknown unit: ${inputUnit}`);
	}
}

export default {
	weiToEther,
	etherToWei,
	weiToGwei,
	gweiToWei,
	convertUnits,
	formatTokenAmount,
	parseTokenAmount,
	formatNumber,
	formatWeiWithUnit,
	bipsToPercentage,
	percentageToBips,
	formatBipsAsPercentage,
	calculatePercentage,
	safeDivide,
	parseUserInput,
	UNIT_MULTIPLIERS,
};
