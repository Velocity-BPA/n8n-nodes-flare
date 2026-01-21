/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Flare Trigger Node
 *
 * Trigger node for monitoring Flare Network events.
 */

import type {
	IPollFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { ethers } from 'ethers';
import { createFlareConnection, getContract, getWNatContract, type FlareCredentials } from './transport/provider';
import { getCurrentPrice, getAllCurrentPrices } from './transport/ftsoClient';
import { FTSO_REWARD_MANAGER_ABI, STATE_CONNECTOR_ABI } from './constants/abis';
import { SYSTEM_CONTRACTS } from './constants/systemContracts';
import { formatTokenAmount, weiToEther } from './utils/unitConverter';

// Licensing notice flag - logged once per node load
let triggerLicensingNoticeLogged = false;

const LICENSING_NOTICE = `[Velocity BPA Licensing Notice]

This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).

Use of this node by for-profit organizations in production environments requires a commercial license from Velocity BPA.

For licensing information, visit https://velobpa.com/licensing or contact licensing@velobpa.com.`;

export class FlareTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Flare Trigger',
		name: 'flareTrigger',
		icon: 'file:flare.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Trigger on Flare Network events - prices, transactions, rewards',
		defaults: {
			name: 'Flare Trigger',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'flareNetworkApi',
				required: true,
			},
		],
		polling: true,
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				required: true,
				options: [
					{ name: 'New Transaction', value: 'newTransaction' },
					{ name: 'Balance Change', value: 'balanceChange' },
					{ name: 'Price Update', value: 'priceUpdate' },
					{ name: 'Price Threshold', value: 'priceThreshold' },
					{ name: 'New Price Epoch', value: 'newPriceEpoch' },
					{ name: 'Reward Epoch Ended', value: 'rewardEpochEnded' },
					{ name: 'Rewards Available', value: 'rewardsAvailable' },
					{ name: 'Delegation Changed', value: 'delegationChanged' },
					{ name: 'Vote Power Changed', value: 'votePowerChanged' },
					{ name: 'New Block', value: 'newBlock' },
				],
				default: 'priceUpdate',
			},
			{
				displayName: 'Address',
				name: 'address',
				type: 'string',
				required: true,
				default: '',
				placeholder: '0x...',
				displayOptions: {
					show: {
						event: ['newTransaction', 'balanceChange', 'delegationChanged', 'votePowerChanged', 'rewardsAvailable'],
					},
				},
			},
			{
				displayName: 'Symbol',
				name: 'symbol',
				type: 'options',
				required: true,
				options: [
					{ name: 'FLR/USD', value: 'FLR' },
					{ name: 'SGB/USD', value: 'SGB' },
					{ name: 'BTC/USD', value: 'BTC' },
					{ name: 'ETH/USD', value: 'ETH' },
					{ name: 'XRP/USD', value: 'XRP' },
					{ name: 'All Prices', value: 'ALL' },
				],
				default: 'FLR',
				displayOptions: {
					show: {
						event: ['priceUpdate', 'priceThreshold'],
					},
				},
			},
			{
				displayName: 'Threshold Type',
				name: 'thresholdType',
				type: 'options',
				required: true,
				options: [
					{ name: 'Above', value: 'above' },
					{ name: 'Below', value: 'below' },
					{ name: 'Change Percentage', value: 'changePercent' },
				],
				default: 'above',
				displayOptions: {
					show: {
						event: ['priceThreshold'],
					},
				},
			},
			{
				displayName: 'Threshold Value',
				name: 'thresholdValue',
				type: 'number',
				required: true,
				default: 0,
				displayOptions: {
					show: {
						event: ['priceThreshold'],
					},
				},
			},
			{
				displayName: 'Minimum Value',
				name: 'minValue',
				type: 'string',
				required: false,
				default: '',
				displayOptions: {
					show: {
						event: ['newTransaction', 'balanceChange'],
					},
				},
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		// Log licensing notice once per node load (non-blocking, informational only)
		if (!triggerLicensingNoticeLogged) {
			console.warn(LICENSING_NOTICE);
			triggerLicensingNoticeLogged = true;
		}

		const event = this.getNodeParameter('event') as string;
		const credentials = await this.getCredentials('flareNetworkApi');

		const flareCredentials: FlareCredentials = {
			network: (credentials.network as string) || 'flare',
			rpcUrl: credentials.rpcUrl as string | undefined,
			chainId: credentials.chainId as number | undefined,
			privateKey: credentials.privateKey as string | undefined,
			apiKey: credentials.apiKey as string | undefined,
		};

		const connection = await createFlareConnection(flareCredentials);
		const networkName = flareCredentials.network;
		const contracts = SYSTEM_CONTRACTS[networkName] || SYSTEM_CONTRACTS.flare;

		const webhookData = this.getWorkflowStaticData('node');
		const returnData: INodeExecutionData[] = [];

		try {
			switch (event) {
				case 'newTransaction': {
					const address = this.getNodeParameter('address') as string;
					const minValue = this.getNodeParameter('minValue', '') as string;

					if (!ethers.isAddress(address)) {
						throw new NodeOperationError(this.getNode(), 'Invalid address');
					}

					const currentBlock = await connection.provider.getBlockNumber();
					const lastCheckedBlock = (webhookData.lastBlock as number) || currentBlock - 1;

					for (let blockNum = lastCheckedBlock + 1; blockNum <= currentBlock; blockNum++) {
						const block = await connection.provider.getBlock(blockNum, true);
						if (!block || !block.prefetchedTransactions) continue;

						for (const tx of block.prefetchedTransactions) {
							const isRelevant =
								tx.from.toLowerCase() === address.toLowerCase() ||
								tx.to?.toLowerCase() === address.toLowerCase();

							if (isRelevant) {
								const value = weiToEther(tx.value);
								if (minValue && parseFloat(value) < parseFloat(minValue)) continue;

								returnData.push({
									json: {
										event: 'newTransaction',
										address,
										hash: tx.hash,
										from: tx.from,
										to: tx.to,
										value,
										direction: tx.from.toLowerCase() === address.toLowerCase() ? 'outgoing' : 'incoming',
										blockNumber: blockNum,
										timestamp: block.timestamp,
									},
								});
							}
						}
					}

					webhookData.lastBlock = currentBlock;
					break;
				}

				case 'balanceChange': {
					const address = this.getNodeParameter('address') as string;

					if (!ethers.isAddress(address)) {
						throw new NodeOperationError(this.getNode(), 'Invalid address');
					}

					const currentBalance = await connection.provider.getBalance(address);
					const lastBalance = webhookData.lastBalance as string;

					if (lastBalance && currentBalance.toString() !== lastBalance) {
						const previousBalance = BigInt(lastBalance);
						const change = currentBalance - previousBalance;

						returnData.push({
							json: {
								event: 'balanceChange',
								address,
								previousBalance: formatTokenAmount(previousBalance, 18),
								currentBalance: formatTokenAmount(currentBalance, 18),
								change: formatTokenAmount(change, 18),
								direction: change > 0n ? 'increase' : 'decrease',
								timestamp: Date.now(),
							},
						});
					}

					webhookData.lastBalance = currentBalance.toString();
					break;
				}

				case 'priceUpdate': {
					const symbol = this.getNodeParameter('symbol') as string;

					if (symbol === 'ALL') {
						const prices = await getAllCurrentPrices(connection);
						const lastPrices = (webhookData.lastPrices as Record<string, string>) || {};

						for (const priceData of prices) {
							if (!lastPrices[priceData.symbol] || lastPrices[priceData.symbol] !== priceData.priceFormatted) {
								returnData.push({
									json: {
										event: 'priceUpdate',
										symbol: priceData.symbol,
										price: priceData.priceFormatted,
										previousPrice: lastPrices[priceData.symbol] || null,
										timestamp: priceData.timestamp,
									},
								});
								lastPrices[priceData.symbol] = priceData.priceFormatted;
							}
						}

						webhookData.lastPrices = lastPrices;
					} else {
						const priceData = await getCurrentPrice(connection, symbol);
						const lastPrice = webhookData.lastPrice as string;

						if (!lastPrice || lastPrice !== priceData.priceFormatted) {
							returnData.push({
								json: {
									event: 'priceUpdate',
									symbol,
									price: priceData.priceFormatted,
									previousPrice: lastPrice || null,
									decimals: priceData.decimals,
									timestamp: priceData.timestamp,
								},
							});
						}

						webhookData.lastPrice = priceData.priceFormatted;
					}
					break;
				}

				case 'priceThreshold': {
					const symbol = this.getNodeParameter('symbol') as string;
					const thresholdType = this.getNodeParameter('thresholdType') as string;
					const thresholdValue = this.getNodeParameter('thresholdValue') as number;

					const priceData = await getCurrentPrice(connection, symbol);
					const currentPrice = parseFloat(priceData.priceFormatted);
					const lastPrice = (webhookData.lastThresholdPrice as number) || currentPrice;

					let triggered = false;
					let message = '';

					if (thresholdType === 'above' && lastPrice < thresholdValue && currentPrice >= thresholdValue) {
						triggered = true;
						message = `${symbol} crossed above ${thresholdValue}`;
					} else if (thresholdType === 'below' && lastPrice > thresholdValue && currentPrice <= thresholdValue) {
						triggered = true;
						message = `${symbol} crossed below ${thresholdValue}`;
					} else if (thresholdType === 'changePercent') {
						const changePercent = ((currentPrice - lastPrice) / lastPrice) * 100;
						if (Math.abs(changePercent) >= thresholdValue) {
							triggered = true;
							message = `${symbol} changed ${changePercent.toFixed(2)}%`;
						}
					}

					if (triggered) {
						returnData.push({
							json: {
								event: 'priceThreshold',
								symbol,
								currentPrice: priceData.priceFormatted,
								previousPrice: String(lastPrice),
								thresholdType,
								thresholdValue,
								message,
								timestamp: Date.now(),
							},
						});
					}

					webhookData.lastThresholdPrice = currentPrice;
					break;
				}

				case 'newPriceEpoch': {
					const ftsoRewardManager = getContract(connection, contracts.FtsoRewardManager, FTSO_REWARD_MANAGER_ABI);
					const currentEpoch = await ftsoRewardManager.getCurrentPriceEpochId();
					const lastEpoch = webhookData.lastPriceEpoch as number;

					if (lastEpoch === undefined || Number(currentEpoch) > lastEpoch) {
						returnData.push({
							json: {
								event: 'newPriceEpoch',
								epochId: Number(currentEpoch),
								previousEpochId: lastEpoch || null,
								timestamp: Date.now(),
							},
						});
					}

					webhookData.lastPriceEpoch = Number(currentEpoch);
					break;
				}

				case 'rewardEpochEnded': {
					const ftsoRewardManager = getContract(connection, contracts.FtsoRewardManager, FTSO_REWARD_MANAGER_ABI);
					const currentRewardEpoch = await ftsoRewardManager.getCurrentRewardEpoch();
					const lastRewardEpoch = webhookData.lastRewardEpoch as number;

					if (lastRewardEpoch !== undefined && Number(currentRewardEpoch) > lastRewardEpoch) {
						returnData.push({
							json: {
								event: 'rewardEpochEnded',
								endedEpoch: lastRewardEpoch,
								newEpoch: Number(currentRewardEpoch),
								timestamp: Date.now(),
							},
						});
					}

					webhookData.lastRewardEpoch = Number(currentRewardEpoch);
					break;
				}

				case 'rewardsAvailable': {
					const address = this.getNodeParameter('address') as string;

					if (!ethers.isAddress(address)) {
						throw new NodeOperationError(this.getNode(), 'Invalid address');
					}

					const ftsoRewardManager = getContract(connection, contracts.FtsoRewardManager, FTSO_REWARD_MANAGER_ABI);
					const [claimableEpochs, currentEpoch] = await Promise.all([
						ftsoRewardManager.getEpochsWithClaimableRewards(address),
						ftsoRewardManager.getCurrentRewardEpoch(),
					]);

					const lastClaimableCount = (webhookData.lastClaimableCount as number) || 0;

					if (claimableEpochs.length > lastClaimableCount) {
						let totalClaimable = 0n;
						for (const epoch of claimableEpochs) {
							const [amount] = await ftsoRewardManager.getStateOfRewards(address, epoch);
							totalClaimable += amount;
						}

						returnData.push({
							json: {
								event: 'rewardsAvailable',
								address,
								claimableEpochs: claimableEpochs.map((e: bigint) => Number(e)),
								totalClaimable: formatTokenAmount(totalClaimable, 18),
								currentRewardEpoch: Number(currentEpoch),
								timestamp: Date.now(),
							},
						});
					}

					webhookData.lastClaimableCount = claimableEpochs.length;
					break;
				}

				case 'delegationChanged': {
					const address = this.getNodeParameter('address') as string;

					if (!ethers.isAddress(address)) {
						throw new NodeOperationError(this.getNode(), 'Invalid address');
					}

					const wNat = getWNatContract(connection);
					const delegates = await wNat.delegatesOf(address);

					const currentDelegation = JSON.stringify(delegates);
					const lastDelegation = webhookData.lastDelegation as string;

					if (lastDelegation && currentDelegation !== lastDelegation) {
						returnData.push({
							json: {
								event: 'delegationChanged',
								address,
								previousDelegates: JSON.parse(lastDelegation),
								currentDelegates: delegates,
								timestamp: Date.now(),
							},
						});
					}

					webhookData.lastDelegation = currentDelegation;
					break;
				}

				case 'votePowerChanged': {
					const address = this.getNodeParameter('address') as string;

					if (!ethers.isAddress(address)) {
						throw new NodeOperationError(this.getNode(), 'Invalid address');
					}

					const wNat = getWNatContract(connection);
					const currentVotePower = await wNat.votePowerOf(address);
					const lastVotePower = webhookData.lastVotePower as string;

					if (lastVotePower && currentVotePower.toString() !== lastVotePower) {
						const previousVotePower = BigInt(lastVotePower);
						const change = currentVotePower - previousVotePower;

						returnData.push({
							json: {
								event: 'votePowerChanged',
								address,
								previousVotePower: formatTokenAmount(previousVotePower, 18),
								currentVotePower: formatTokenAmount(currentVotePower, 18),
								change: formatTokenAmount(change, 18),
								direction: change > 0n ? 'increase' : 'decrease',
								timestamp: Date.now(),
							},
						});
					}

					webhookData.lastVotePower = currentVotePower.toString();
					break;
				}

				case 'newBlock': {
					const currentBlock = await connection.provider.getBlockNumber();
					const lastBlock = (webhookData.lastBlockNum as number) || currentBlock - 1;

					if (currentBlock > lastBlock) {
						const block = await connection.provider.getBlock(currentBlock);

						returnData.push({
							json: {
								event: 'newBlock',
								blockNumber: currentBlock,
								hash: block?.hash,
								timestamp: block?.timestamp,
								transactionCount: block?.transactions?.length || 0,
								gasUsed: block?.gasUsed?.toString(),
								baseFeePerGas: block?.baseFeePerGas?.toString(),
							},
						});
					}

					webhookData.lastBlockNum = currentBlock;
					break;
				}

				default:
					throw new NodeOperationError(this.getNode(), `Unknown event: ${event}`);
			}
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw new NodeOperationError(this.getNode(), `Trigger error: ${errorMessage}`);
		}

		if (returnData.length === 0) {
			return null;
		}

		return [returnData];
	}
}
