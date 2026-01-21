/**
 * Network Resource Operations
 *
 * Handles Flare/Songbird network information and protocol parameter queries.
 * Provides access to:
 * - Network status and configuration
 * - Gas prices and base fees
 * - FTSO epoch timing
 * - Inflation and supply information
 * - Protocol parameters
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { ethers } from 'ethers';
import { createFlareConnection, getContract } from '../../transport/provider';
import { FLARE_NETWORKS } from '../../constants/networks';
import { SYSTEM_CONTRACTS } from '../../constants/systemContracts';
import { formatTokenAmount, weiToGwei, weiToEther } from '../../utils/unitConverter';

// Supply contract ABI
const SUPPLY_ABI = [
	'function getInflatableBalance() external view returns (uint256)',
	'function getCirculatingSupplyAt(uint256 _blockNumber) external view returns (uint256)',
	'function totalSupply() external view returns (uint256)',
];

// Inflation contract ABI
const INFLATION_ABI = [
	'function getCurrentAnnum() external view returns (uint256)',
	'function getInflationAnnums() external view returns (uint256[] memory)',
	'function getAnnumEndsTs(uint256 _annum) external view returns (uint256)',
	'function getTimeSlotPercentBips() external view returns (uint256)',
	'function lastAuthorizationTs() external view returns (uint256)',
];

// FtsoManager for epoch info
const FTSO_MANAGER_ABI = [
	'function getCurrentPriceEpochId() external view returns (uint256)',
	'function getCurrentRewardEpoch() external view returns (uint256)',
	'function getPriceEpochConfiguration() external view returns (uint256, uint256, uint256)',
	'function getRewardEpochConfiguration() external view returns (uint256, uint256)',
	'function getRewardEpochVotePowerBlock(uint256 _rewardEpoch) external view returns (uint256)',
	'function rewardEpochDurationSeconds() external view returns (uint256)',
	'function priceEpochDurationSeconds() external view returns (uint256)',
];

export const networkOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['network'],
			},
		},
		options: [
			{
				name: 'Get Network Info',
				value: 'getNetworkInfo',
				description: 'Get comprehensive network information',
				action: 'Get network info',
			},
			{
				name: 'Get Chain ID',
				value: 'getChainId',
				description: 'Get network chain ID',
				action: 'Get chain ID',
			},
			{
				name: 'Get Network Status',
				value: 'getNetworkStatus',
				description: 'Get current network status',
				action: 'Get network status',
			},
			{
				name: 'Get Gas Price',
				value: 'getGasPrice',
				description: 'Get current gas price',
				action: 'Get gas price',
			},
			{
				name: 'Get Base Fee',
				value: 'getBaseFee',
				description: 'Get current base fee per gas',
				action: 'Get base fee',
			},
			{
				name: 'Get Fee History',
				value: 'getFeeHistory',
				description: 'Get historical fee data',
				action: 'Get fee history',
			},
			{
				name: 'Get FTSO Epoch Timing',
				value: 'getFtsoEpochTiming',
				description: 'Get FTSO price and reward epoch timing',
				action: 'Get FTSO epoch timing',
			},
			{
				name: 'Get Protocol Parameters',
				value: 'getProtocolParams',
				description: 'Get core protocol parameters',
				action: 'Get protocol parameters',
			},
			{
				name: 'Get Inflation Info',
				value: 'getInflationInfo',
				description: 'Get inflation schedule information',
				action: 'Get inflation info',
			},
			{
				name: 'Get Total Supply',
				value: 'getTotalSupply',
				description: 'Get total FLR/SGB supply',
				action: 'Get total supply',
			},
			{
				name: 'Get Circulating Supply',
				value: 'getCirculatingSupply',
				description: 'Get circulating supply',
				action: 'Get circulating supply',
			},
			{
				name: 'Get System Contracts',
				value: 'getSystemContracts',
				description: 'Get system contract addresses',
				action: 'Get system contracts',
			},
		],
		default: 'getNetworkInfo',
	},
];

export const networkFields: INodeProperties[] = [
	// Block count for fee history
	{
		displayName: 'Block Count',
		name: 'blockCount',
		type: 'number',
		required: false,
		default: 10,
		description: 'Number of blocks for fee history',
		displayOptions: {
			show: {
				resource: ['network'],
				operation: ['getFeeHistory'],
			},
		},
	},
	// Block number for historical queries
	{
		displayName: 'Block Number',
		name: 'blockNumber',
		type: 'number',
		required: false,
		default: 0,
		description: 'Block number (0 for latest)',
		displayOptions: {
			show: {
				resource: ['network'],
				operation: ['getCirculatingSupply'],
			},
		},
	},
];

export async function executeNetwork(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;
	const credentials = await this.getCredentials('flareNetworkApi');
	const connection = await createFlareConnection(credentials as any);

	const networkName = (credentials.network as string) || 'flare';
	const networkConfig = FLARE_NETWORKS[networkName] || FLARE_NETWORKS.flare;
	const contracts = SYSTEM_CONTRACTS[networkName] || SYSTEM_CONTRACTS.flare;

	let result: any;

	switch (operation) {
		case 'getNetworkInfo': {
			const [network, blockNumber, gasPrice, feeData] = await Promise.all([
				connection.provider.getNetwork(),
				connection.provider.getBlockNumber(),
				connection.provider.getFeeData(),
				connection.provider.getFeeData(),
			]);

			const latestBlock = await connection.provider.getBlock(blockNumber);

			result = {
				network: networkName,
				chainId: Number(network.chainId),
				name: networkConfig.name,
				nativeCurrency: networkName === 'flare' || networkName === 'coston2' ? 'FLR' : 'SGB',
				wrappedCurrency: networkName === 'flare' || networkName === 'coston2' ? 'WFLR' : 'WSGB',
				currentBlock: blockNumber,
				blockTimestamp: latestBlock?.timestamp,
				blockTime: new Date((latestBlock?.timestamp || 0) * 1000).toISOString(),
				gasPrice: weiToGwei(gasPrice.gasPrice || 0n),
				baseFee: weiToGwei(feeData.maxFeePerGas || 0n),
				maxPriorityFee: weiToGwei(feeData.maxPriorityFeePerGas || 0n),
				rpcEndpoint: networkConfig.rpcUrls[0],
				explorerUrl: networkConfig.blockExplorerUrls[0],
				isMainnet: networkName === 'flare' || networkName === 'songbird',
				isTestnet: networkName === 'coston' || networkName === 'coston2',
			};
			break;
		}

		case 'getChainId': {
			const network = await connection.provider.getNetwork();

			result = {
				chainId: Number(network.chainId),
				networkName,
				expectedChainId: networkConfig.chainId,
				matches: Number(network.chainId) === networkConfig.chainId,
			};
			break;
		}

		case 'getNetworkStatus': {
			const [blockNumber, network, gasPrice] = await Promise.all([
				connection.provider.getBlockNumber(),
				connection.provider.getNetwork(),
				connection.provider.getFeeData(),
			]);

			const latestBlock = await connection.provider.getBlock(blockNumber);
			const previousBlock = await connection.provider.getBlock(blockNumber - 1);

			const blockTime = latestBlock && previousBlock
				? latestBlock.timestamp - previousBlock.timestamp
				: null;

			result = {
				status: 'online',
				network: networkName,
				chainId: Number(network.chainId),
				currentBlock: blockNumber,
				lastBlockTime: latestBlock?.timestamp,
				averageBlockTime: blockTime,
				gasPrice: weiToGwei(gasPrice.gasPrice || 0n),
				transactionsInBlock: latestBlock?.transactions?.length || 0,
				syncStatus: 'synced',
			};
			break;
		}

		case 'getGasPrice': {
			const feeData = await connection.provider.getFeeData();

			result = {
				network: networkName,
				gasPrice: weiToGwei(feeData.gasPrice || 0n),
				gasPriceWei: (feeData.gasPrice || 0n).toString(),
				maxFeePerGas: weiToGwei(feeData.maxFeePerGas || 0n),
				maxPriorityFeePerGas: weiToGwei(feeData.maxPriorityFeePerGas || 0n),
				unit: 'gwei',
				suggestedGasLimit: {
					transfer: 21000,
					tokenTransfer: 65000,
					contractInteraction: 100000,
					delegation: 150000,
				},
			};
			break;
		}

		case 'getBaseFee': {
			const blockNumber = await connection.provider.getBlockNumber();
			const block = await connection.provider.getBlock(blockNumber);

			result = {
				network: networkName,
				blockNumber,
				baseFeePerGas: weiToGwei(block?.baseFeePerGas || 0n),
				baseFeeWei: (block?.baseFeePerGas || 0n).toString(),
				gasUsed: block?.gasUsed?.toString(),
				gasLimit: block?.gasLimit?.toString(),
				utilizationPercent: block?.gasLimit
					? ((Number(block.gasUsed) / Number(block.gasLimit)) * 100).toFixed(2)
					: null,
			};
			break;
		}

		case 'getFeeHistory': {
			const blockCount = this.getNodeParameter('blockCount', index, 10) as number;

			const feeHistory = await connection.provider.send('eth_feeHistory', [
				`0x${blockCount.toString(16)}`,
				'latest',
				[25, 50, 75],
			]);

			const baseFees = feeHistory.baseFeePerGas.map((fee: string) => weiToGwei(BigInt(fee)));
			const rewards = feeHistory.reward.map((r: string[]) => r.map((v: string) => weiToGwei(BigInt(v))));

			result = {
				network: networkName,
				blockCount,
				oldestBlock: parseInt(feeHistory.oldestBlock, 16),
				baseFees,
				averageBaseFee: (baseFees.reduce((a: number, b: number) => a + b, 0) / baseFees.length).toFixed(4),
				priorityFeePercentiles: {
					p25: rewards.map((r: number[]) => r[0]),
					p50: rewards.map((r: number[]) => r[1]),
					p75: rewards.map((r: number[]) => r[2]),
				},
				gasUsedRatio: feeHistory.gasUsedRatio,
			};
			break;
		}

		case 'getFtsoEpochTiming': {
			const ftsoManagerAddress = contracts.FtsoManager || contracts.FtsoRewardManager;

			try {
				const ftsoManager = getContract(connection, ftsoManagerAddress, FTSO_MANAGER_ABI);

				const [currentPriceEpoch, currentRewardEpoch, priceConfig, rewardDuration, priceDuration] = await Promise.all([
					ftsoManager.getCurrentPriceEpochId().catch(() => 0n),
					ftsoManager.getCurrentRewardEpoch().catch(() => 0n),
					ftsoManager.getPriceEpochConfiguration().catch(() => [0n, 0n, 0n]),
					ftsoManager.rewardEpochDurationSeconds().catch(() => 302400n), // 3.5 days default
					ftsoManager.priceEpochDurationSeconds().catch(() => 180n), // 3 minutes default
				]);

				const priceEpochDuration = Number(priceDuration);
				const rewardEpochDuration = Number(rewardDuration);

				result = {
					network: networkName,
					currentPriceEpoch: Number(currentPriceEpoch),
					currentRewardEpoch: Number(currentRewardEpoch),
					priceEpochDuration: priceEpochDuration,
					priceEpochDurationFormatted: `${priceEpochDuration / 60} minutes`,
					rewardEpochDuration: rewardEpochDuration,
					rewardEpochDurationFormatted: `${(rewardEpochDuration / 86400).toFixed(2)} days`,
					priceEpochsPerRewardEpoch: Math.floor(rewardEpochDuration / priceEpochDuration),
					note: 'Price epochs are used for FTSO price submissions, reward epochs for reward distribution',
				};
			} catch (error) {
				// Return typical Flare configuration
				result = {
					network: networkName,
					priceEpochDuration: 180,
					priceEpochDurationFormatted: '3 minutes',
					rewardEpochDuration: 302400,
					rewardEpochDurationFormatted: '3.5 days',
					priceEpochsPerRewardEpoch: 1680,
					note: 'Default Flare/Songbird timing (contract not available)',
				};
			}
			break;
		}

		case 'getProtocolParams': {
			result = {
				network: networkName,
				chainId: networkConfig.chainId,
				nativeCurrency: networkName === 'flare' || networkName === 'coston2' ? 'FLR' : 'SGB',
				blockTime: '~3 seconds',
				maxDelegations: 2,
				delegationPercentageBasis: 10000, // 100% = 10000 bips
				rewardClaimExpiry: '90 days',
				minDelegationAmount: '1',
				votePowerBlockSelectionStrategy: 'randomized within epoch',
				ftso: {
					priceEpochDuration: 180, // 3 minutes
					revealPeriod: 90, // 90 seconds
					rewardEpochDuration: 302400, // 3.5 days
					supportedSymbols: 30,
				},
				stateConnector: {
					roundDuration: 90, // 90 seconds
					finalizationRounds: 2,
					attestationTypes: ['Payment', 'BalanceDecreasingTransaction', 'ConfirmedBlockHeightExists'],
				},
				fAssets: networkName === 'flare' ? {
					supported: ['FBTC', 'FXRP', 'FDOGE', 'FLTC', 'FXLM'],
					minCollateralRatio: 1.5,
				} : null,
			};
			break;
		}

		case 'getInflationInfo': {
			const inflationAddress = contracts.Inflation;

			if (!inflationAddress) {
				result = {
					network: networkName,
					note: 'Inflation contract address not configured',
					estimatedAnnualInflation: networkName === 'flare' ? '10%' : '10%',
					inflationDistributionTreasury: {
						ftsoRewards: '70%',
						validatorRewards: '20%',
						airdrop: '10%',
					},
				};
				break;
			}

			try {
				const inflation = getContract(connection, inflationAddress, INFLATION_ABI);

				const [currentAnnum, timeSlotPercent, lastAuthTs] = await Promise.all([
					inflation.getCurrentAnnum(),
					inflation.getTimeSlotPercentBips(),
					inflation.lastAuthorizationTs(),
				]);

				result = {
					network: networkName,
					currentInflationYear: Number(currentAnnum),
					timeSlotPercentBips: Number(timeSlotPercent),
					timeSlotPercent: (Number(timeSlotPercent) / 100).toFixed(2) + '%',
					lastAuthorizationTime: new Date(Number(lastAuthTs) * 1000).toISOString(),
					inflationContract: inflationAddress,
				};
			} catch (error) {
				result = {
					network: networkName,
					error: 'Unable to query inflation contract',
					estimatedAnnualInflation: '10%',
				};
			}
			break;
		}

		case 'getTotalSupply': {
			const supplyAddress = contracts.Supply;

			if (!supplyAddress) {
				// Get native token balance of common addresses as approximation
				result = {
					network: networkName,
					note: 'Supply contract not available',
					estimatedTotalSupply: networkName === 'flare' ? '100,000,000,000 FLR' : '15,000,000,000 SGB',
				};
				break;
			}

			try {
				const supply = getContract(connection, supplyAddress, SUPPLY_ABI);
				const [totalSupply, inflatableBalance] = await Promise.all([
					supply.totalSupply(),
					supply.getInflatableBalance(),
				]);

				const symbol = networkName === 'flare' || networkName === 'coston2' ? 'FLR' : 'SGB';

				result = {
					network: networkName,
					totalSupply: formatTokenAmount(totalSupply, 18),
					totalSupplyRaw: totalSupply.toString(),
					inflatableBalance: formatTokenAmount(inflatableBalance, 18),
					symbol,
					supplyContract: supplyAddress,
				};
			} catch (error) {
				result = {
					network: networkName,
					error: 'Unable to query supply contract',
				};
			}
			break;
		}

		case 'getCirculatingSupply': {
			const blockNumber = this.getNodeParameter('blockNumber', index, 0) as number;
			const supplyAddress = contracts.Supply;

			if (!supplyAddress) {
				result = {
					network: networkName,
					note: 'Supply contract not available',
				};
				break;
			}

			try {
				const supply = getContract(connection, supplyAddress, SUPPLY_ABI);
				const targetBlock = blockNumber || await connection.provider.getBlockNumber();
				const circulatingSupply = await supply.getCirculatingSupplyAt(targetBlock);

				const symbol = networkName === 'flare' || networkName === 'coston2' ? 'FLR' : 'SGB';

				result = {
					network: networkName,
					blockNumber: targetBlock,
					circulatingSupply: formatTokenAmount(circulatingSupply, 18),
					circulatingSupplyRaw: circulatingSupply.toString(),
					symbol,
				};
			} catch (error) {
				result = {
					network: networkName,
					error: 'Unable to query circulating supply',
				};
			}
			break;
		}

		case 'getSystemContracts': {
			result = {
				network: networkName,
				chainId: networkConfig.chainId,
				contracts: {
					WNat: contracts.WNat,
					FtsoRegistry: contracts.FtsoRegistry,
					FtsoRewardManager: contracts.FtsoRewardManager,
					FtsoManager: contracts.FtsoManager,
					StateConnector: contracts.StateConnector,
					PriceSubmitter: contracts.PriceSubmitter,
					VoterWhitelister: contracts.VoterWhitelister,
					ClaimSetupManager: contracts.ClaimSetupManager,
					GovernanceVotePower: contracts.GovernanceVotePower,
					DistributionTreasury: contracts.DistributionTreasury,
					Inflation: contracts.Inflation,
					Supply: contracts.Supply,
					AddressBinder: contracts.AddressBinder,
				},
				note: 'Some contracts may not be deployed on all networks',
			};
			break;
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
	}

	return [{ json: result }];
}
