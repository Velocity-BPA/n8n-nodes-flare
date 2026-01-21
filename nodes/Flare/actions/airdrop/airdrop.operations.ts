/**
 * Airdrop/Distribution Resource Operations
 *
 * Handles Flare/Songbird airdrop and distribution claiming operations.
 * Flare's token distribution occurs through:
 * - Initial airdrop to XRP holders
 * - Monthly FlareDrop distributions (for Flare)
 * - Songbird token distributions
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { ethers } from 'ethers';
import { createFlareConnection, getContract } from '../../transport/provider';
import { SYSTEM_CONTRACTS } from '../../constants/systemContracts';
import { formatTokenAmount } from '../../utils/unitConverter';

// Distribution contract ABI (simplified)
const DISTRIBUTION_ABI = [
	'function claim(address _rewardOwner, address _recipient, uint256 _month, bool _wrap) external returns (uint256)',
	'function autoClaim(address[] _rewardOwners, uint256 _month) external',
	'function claimableAmount(address _rewardOwner, uint256 _month) external view returns (uint256)',
	'function getClaimableMonths(address _rewardOwner) external view returns (uint256[] memory)',
	'function getCurrentMonth() external view returns (uint256)',
	'function getMonthToExpireNext() external view returns (uint256)',
	'function totalDistributableAmount() external view returns (uint256)',
	'function totalClaimedWei() external view returns (uint256)',
	'function totalAvailableAmount(address _rewardOwner) external view returns (uint256)',
	'function stopped() external view returns (bool)',
	'function entitlementStartTs() external view returns (uint256)',
	'function optOutAddresses(address) external view returns (bool)',
];

export const airdropOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['airdrop'],
			},
		},
		options: [
			{
				name: 'Get Airdrop Info',
				value: 'getAirdropInfo',
				description: 'Get distribution contract information',
				action: 'Get airdrop info',
			},
			{
				name: 'Get Claimable Amount',
				value: 'getClaimableAmount',
				description: 'Get claimable amount for a specific month',
				action: 'Get claimable amount',
			},
			{
				name: 'Get Total Available',
				value: 'getTotalAvailable',
				description: 'Get total available distribution amount',
				action: 'Get total available',
			},
			{
				name: 'Get Claimable Months',
				value: 'getClaimableMonths',
				description: 'Get months with claimable distributions',
				action: 'Get claimable months',
			},
			{
				name: 'Claim Distribution',
				value: 'claimDistribution',
				description: 'Claim distribution for a specific month',
				action: 'Claim distribution',
			},
			{
				name: 'Claim All Available',
				value: 'claimAll',
				description: 'Claim all available distributions',
				action: 'Claim all available',
			},
			{
				name: 'Get Current Month',
				value: 'getCurrentMonth',
				description: 'Get current distribution month number',
				action: 'Get current month',
			},
			{
				name: 'Get Next Expiring Month',
				value: 'getNextExpiring',
				description: 'Get the next month to expire',
				action: 'Get next expiring month',
			},
			{
				name: 'Get Distribution Schedule',
				value: 'getSchedule',
				description: 'Get distribution schedule information',
				action: 'Get distribution schedule',
			},
			{
				name: 'Check Eligibility',
				value: 'checkEligibility',
				description: 'Check if address is eligible for distributions',
				action: 'Check eligibility',
			},
			{
				name: 'Get Claimed History',
				value: 'getClaimedHistory',
				description: 'Get total claimed amount for address',
				action: 'Get claimed history',
			},
		],
		default: 'getAirdropInfo',
	},
];

export const airdropFields: INodeProperties[] = [
	// Address field
	{
		displayName: 'Address',
		name: 'address',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Address to check distributions for',
		displayOptions: {
			show: {
				resource: ['airdrop'],
				operation: ['getClaimableAmount', 'getTotalAvailable', 'getClaimableMonths', 'claimDistribution', 'claimAll', 'checkEligibility', 'getClaimedHistory'],
			},
		},
	},
	// Month number
	{
		displayName: 'Month',
		name: 'month',
		type: 'number',
		required: true,
		default: 0,
		description: 'Distribution month number (0-35 for FlareDrop)',
		displayOptions: {
			show: {
				resource: ['airdrop'],
				operation: ['getClaimableAmount', 'claimDistribution'],
			},
		},
	},
	// Recipient address
	{
		displayName: 'Recipient Address',
		name: 'recipientAddress',
		type: 'string',
		required: false,
		default: '',
		placeholder: '0x... (leave empty for self)',
		description: 'Address to receive claimed tokens (defaults to claim address)',
		displayOptions: {
			show: {
				resource: ['airdrop'],
				operation: ['claimDistribution', 'claimAll'],
			},
		},
	},
	// Wrap option
	{
		displayName: 'Wrap Tokens',
		name: 'wrapTokens',
		type: 'boolean',
		default: true,
		description: 'Whether to wrap claimed tokens (WFLR/WSGB) for delegation',
		displayOptions: {
			show: {
				resource: ['airdrop'],
				operation: ['claimDistribution', 'claimAll'],
			},
		},
	},
];

export async function executeAirdrop(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;
	const credentials = await this.getCredentials('flareNetworkApi');
	const connection = await createFlareConnection(credentials as any);

	const networkName = (credentials.network as string) || 'flare';
	const contracts = SYSTEM_CONTRACTS[networkName] || SYSTEM_CONTRACTS.flare;

	// Distribution contract address (varies by network)
	const distributionAddress = contracts.DistributionTreasury || '0x9c7A4C83842B29bB4A082b0E689CB9474BD938d0';

	let result: any;

	switch (operation) {
		case 'getAirdropInfo': {
			const distribution = getContract(connection, distributionAddress, DISTRIBUTION_ABI);

			try {
				const [currentMonth, nextExpiring, totalDistributable, totalClaimed, stopped, startTs] = await Promise.all([
					distribution.getCurrentMonth().catch(() => 0n),
					distribution.getMonthToExpireNext().catch(() => 0n),
					distribution.totalDistributableAmount().catch(() => 0n),
					distribution.totalClaimedWei().catch(() => 0n),
					distribution.stopped().catch(() => false),
					distribution.entitlementStartTs().catch(() => 0n),
				]);

				result = {
					contractAddress: distributionAddress,
					network: networkName,
					currentMonth: Number(currentMonth),
					nextExpiringMonth: Number(nextExpiring),
					totalDistributable: formatTokenAmount(totalDistributable, 18),
					totalClaimed: formatTokenAmount(totalClaimed, 18),
					distributionActive: !stopped,
					entitlementStartDate: startTs > 0n ? new Date(Number(startTs) * 1000).toISOString() : null,
					description: networkName === 'flare' ? 'FlareDrop - 36 month distribution' : 'Songbird distribution',
				};
			} catch (error) {
				result = {
					contractAddress: distributionAddress,
					network: networkName,
					error: 'Distribution contract not available or not deployed',
					note: 'Distribution may not be active on this network',
				};
			}
			break;
		}

		case 'getClaimableAmount': {
			const address = this.getNodeParameter('address', index) as string;
			const month = this.getNodeParameter('month', index) as number;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const distribution = getContract(connection, distributionAddress, DISTRIBUTION_ABI);
			const claimable = await distribution.claimableAmount(address, month);

			result = {
				address,
				month,
				claimable: formatTokenAmount(claimable, 18),
				claimableWei: claimable.toString(),
				hasClaimable: claimable > 0n,
			};
			break;
		}

		case 'getTotalAvailable': {
			const address = this.getNodeParameter('address', index) as string;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const distribution = getContract(connection, distributionAddress, DISTRIBUTION_ABI);
			const totalAvailable = await distribution.totalAvailableAmount(address);

			result = {
				address,
				totalAvailable: formatTokenAmount(totalAvailable, 18),
				totalAvailableWei: totalAvailable.toString(),
				hasClaimable: totalAvailable > 0n,
			};
			break;
		}

		case 'getClaimableMonths': {
			const address = this.getNodeParameter('address', index) as string;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const distribution = getContract(connection, distributionAddress, DISTRIBUTION_ABI);
			const claimableMonths = await distribution.getClaimableMonths(address);

			// Get claimable amounts for each month
			const monthDetails = await Promise.all(
				claimableMonths.map(async (month: bigint) => {
					const claimable = await distribution.claimableAmount(address, month);
					return {
						month: Number(month),
						claimable: formatTokenAmount(claimable, 18),
						claimableWei: claimable.toString(),
					};
				})
			);

			result = {
				address,
				claimableMonths: claimableMonths.map((m: bigint) => Number(m)),
				monthDetails,
				totalMonths: claimableMonths.length,
			};
			break;
		}

		case 'claimDistribution': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required for claiming');
			}

			const address = this.getNodeParameter('address', index) as string;
			const month = this.getNodeParameter('month', index) as number;
			const recipientAddress = this.getNodeParameter('recipientAddress', index) as string;
			const wrapTokens = this.getNodeParameter('wrapTokens', index) as boolean;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const recipient = recipientAddress && ethers.isAddress(recipientAddress) ? recipientAddress : address;

			const distribution = getContract(connection, distributionAddress, DISTRIBUTION_ABI);

			// Check claimable first
			const claimable = await distribution.claimableAmount(address, month);
			if (claimable === 0n) {
				throw new NodeOperationError(this.getNode(), `No claimable amount for month ${month}`);
			}

			const tx = await distribution.claim(address, recipient, month, wrapTokens);
			const receipt = await tx.wait();

			result = {
				operation: 'claim',
				address,
				recipient,
				month,
				wrapped: wrapTokens,
				amountClaimed: formatTokenAmount(claimable, 18),
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'success' : 'failed',
			};
			break;
		}

		case 'claimAll': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required for claiming');
			}

			const address = this.getNodeParameter('address', index) as string;
			const recipientAddress = this.getNodeParameter('recipientAddress', index) as string;
			const wrapTokens = this.getNodeParameter('wrapTokens', index) as boolean;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const recipient = recipientAddress && ethers.isAddress(recipientAddress) ? recipientAddress : address;

			const distribution = getContract(connection, distributionAddress, DISTRIBUTION_ABI);

			// Get all claimable months
			const claimableMonths = await distribution.getClaimableMonths(address);
			if (claimableMonths.length === 0) {
				throw new NodeOperationError(this.getNode(), 'No claimable months available');
			}

			// Calculate total claimable
			let totalClaimable = 0n;
			for (const month of claimableMonths) {
				const claimable = await distribution.claimableAmount(address, month);
				totalClaimable += claimable;
			}

			// Claim each month
			const claims = [];
			for (const month of claimableMonths) {
				const tx = await distribution.claim(address, recipient, month, wrapTokens);
				const receipt = await tx.wait();
				claims.push({
					month: Number(month),
					transactionHash: tx.hash,
					status: receipt?.status === 1 ? 'success' : 'failed',
				});
			}

			result = {
				operation: 'claimAll',
				address,
				recipient,
				wrapped: wrapTokens,
				monthsClaimed: claimableMonths.map((m: bigint) => Number(m)),
				totalClaimed: formatTokenAmount(totalClaimable, 18),
				claims,
			};
			break;
		}

		case 'getCurrentMonth': {
			const distribution = getContract(connection, distributionAddress, DISTRIBUTION_ABI);
			const currentMonth = await distribution.getCurrentMonth();

			result = {
				currentMonth: Number(currentMonth),
				totalMonths: 36, // FlareDrop is 36 months
				remainingMonths: Math.max(0, 36 - Number(currentMonth)),
				percentComplete: ((Number(currentMonth) / 36) * 100).toFixed(2) + '%',
			};
			break;
		}

		case 'getNextExpiring': {
			const distribution = getContract(connection, distributionAddress, DISTRIBUTION_ABI);
			const [nextExpiring, currentMonth] = await Promise.all([
				distribution.getMonthToExpireNext(),
				distribution.getCurrentMonth(),
			]);

			result = {
				nextExpiringMonth: Number(nextExpiring),
				currentMonth: Number(currentMonth),
				monthsUntilExpiry: Number(currentMonth) - Number(nextExpiring),
				warning: Number(nextExpiring) < Number(currentMonth) ? 'Some months may have expired' : null,
			};
			break;
		}

		case 'getSchedule': {
			const distribution = getContract(connection, distributionAddress, DISTRIBUTION_ABI);
			const [currentMonth, startTs, totalDistributable, stopped] = await Promise.all([
				distribution.getCurrentMonth(),
				distribution.entitlementStartTs(),
				distribution.totalDistributableAmount(),
				distribution.stopped(),
			]);

			// Calculate monthly amount (roughly)
			const monthlyAmount = totalDistributable / 36n;

			// Calculate next distribution date (approximately)
			const startDate = new Date(Number(startTs) * 1000);
			const nextMonth = Number(currentMonth) + 1;
			const nextDate = new Date(startDate);
			nextDate.setMonth(nextDate.getMonth() + nextMonth);

			result = {
				network: networkName,
				totalMonths: 36,
				currentMonth: Number(currentMonth),
				completedMonths: Number(currentMonth),
				remainingMonths: Math.max(0, 36 - Number(currentMonth)),
				totalDistributable: formatTokenAmount(totalDistributable, 18),
				estimatedMonthlyAmount: formatTokenAmount(monthlyAmount, 18),
				startDate: startDate.toISOString(),
				nextDistributionDate: nextMonth <= 36 ? nextDate.toISOString() : null,
				distributionActive: !stopped,
				claimExpiryMonths: 2, // Typically 2 months to claim
			};
			break;
		}

		case 'checkEligibility': {
			const address = this.getNodeParameter('address', index) as string;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const distribution = getContract(connection, distributionAddress, DISTRIBUTION_ABI);

			const [totalAvailable, claimableMonths, optedOut] = await Promise.all([
				distribution.totalAvailableAmount(address),
				distribution.getClaimableMonths(address),
				distribution.optOutAddresses(address).catch(() => false),
			]);

			result = {
				address,
				isEligible: totalAvailable > 0n && !optedOut,
				totalAvailable: formatTokenAmount(totalAvailable, 18),
				claimableMonthCount: claimableMonths.length,
				hasOptedOut: optedOut,
				note: optedOut ? 'Address has opted out of distributions' : null,
			};
			break;
		}

		case 'getClaimedHistory': {
			const address = this.getNodeParameter('address', index) as string;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			// Get claimed info by checking what's NOT claimable
			const distribution = getContract(connection, distributionAddress, DISTRIBUTION_ABI);

			const [totalAvailable, claimableMonths, currentMonth] = await Promise.all([
				distribution.totalAvailableAmount(address),
				distribution.getClaimableMonths(address),
				distribution.getCurrentMonth(),
			]);

			// Estimate claimed (total entitled minus still available)
			// This is an approximation as we don't have direct claimed history
			const claimableSet = new Set(claimableMonths.map((m: bigint) => Number(m)));
			const claimedMonths = [];
			for (let m = 0; m < Number(currentMonth); m++) {
				if (!claimableSet.has(m)) {
					claimedMonths.push(m);
				}
			}

			result = {
				address,
				claimedMonths,
				claimedMonthCount: claimedMonths.length,
				pendingMonths: claimableMonths.map((m: bigint) => Number(m)),
				pendingAmount: formatTokenAmount(totalAvailable, 18),
				note: 'Claimed months estimated from unclaimed data',
			};
			break;
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
	}

	return [{ json: result }];
}
