/**
 * NFT Resource Operations (ERC-721/ERC-1155)
 *
 * Handles NFT operations on Flare/Songbird networks.
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { ethers } from 'ethers';
import { createFlareConnection, getContract } from '../../transport/provider';
import { ERC721_ABI, ERC1155_ABI } from '../../constants/abis';

export const nftOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['nft'],
			},
		},
		options: [
			{
				name: 'Get NFT Metadata',
				value: 'getMetadata',
				description: 'Get NFT metadata (ERC-721)',
				action: 'Get NFT metadata',
			},
			{
				name: 'Get NFT Owner',
				value: 'getOwner',
				description: 'Get owner of an NFT (ERC-721)',
				action: 'Get NFT owner',
			},
			{
				name: 'Get NFTs by Owner',
				value: 'getNFTsByOwner',
				description: 'Get NFTs owned by an address',
				action: 'Get NFTs by owner',
			},
			{
				name: 'Transfer NFT (ERC-721)',
				value: 'transfer721',
				description: 'Transfer an ERC-721 NFT',
				action: 'Transfer ERC-721 NFT',
			},
			{
				name: 'Safe Transfer NFT (ERC-721)',
				value: 'safeTransfer721',
				description: 'Safely transfer an ERC-721 NFT',
				action: 'Safe transfer ERC-721 NFT',
			},
			{
				name: 'Approve NFT (ERC-721)',
				value: 'approve721',
				description: 'Approve address to transfer NFT',
				action: 'Approve ERC-721 NFT',
			},
			{
				name: 'Set Approval For All',
				value: 'setApprovalForAll',
				description: 'Approve operator for all NFTs',
				action: 'Set approval for all',
			},
			{
				name: 'Get Collection Info',
				value: 'getCollectionInfo',
				description: 'Get NFT collection information',
				action: 'Get collection info',
			},
			{
				name: 'Get Balance (ERC-1155)',
				value: 'getBalance1155',
				description: 'Get ERC-1155 token balance',
				action: 'Get ERC-1155 balance',
			},
			{
				name: 'Transfer (ERC-1155)',
				value: 'transfer1155',
				description: 'Transfer ERC-1155 tokens',
				action: 'Transfer ERC-1155',
			},
			{
				name: 'Batch Transfer (ERC-1155)',
				value: 'batchTransfer1155',
				description: 'Batch transfer ERC-1155 tokens',
				action: 'Batch transfer ERC-1155',
			},
		],
		default: 'getMetadata',
	},
];

export const nftFields: INodeProperties[] = [
	// Contract address
	{
		displayName: 'Contract Address',
		name: 'contractAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'NFT contract address',
		displayOptions: {
			show: {
				resource: ['nft'],
			},
		},
	},
	// Token ID
	{
		displayName: 'Token ID',
		name: 'tokenId',
		type: 'string',
		required: true,
		default: '',
		placeholder: '1',
		description: 'NFT token ID',
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['getMetadata', 'getOwner', 'transfer721', 'safeTransfer721', 'approve721', 'getBalance1155', 'transfer1155'],
			},
		},
	},
	// Address for queries
	{
		displayName: 'Address',
		name: 'address',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Address to query',
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['getNFTsByOwner', 'getBalance1155'],
			},
		},
	},
	// To address for transfers
	{
		displayName: 'To Address',
		name: 'toAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Recipient address',
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['transfer721', 'safeTransfer721', 'transfer1155', 'batchTransfer1155'],
			},
		},
	},
	// From address for transfers
	{
		displayName: 'From Address',
		name: 'fromAddress',
		type: 'string',
		default: '',
		placeholder: '0x... (leave empty to use wallet)',
		description: 'Sender address (defaults to wallet)',
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['transfer721', 'safeTransfer721', 'transfer1155', 'batchTransfer1155'],
			},
		},
	},
	// Operator for approvals
	{
		displayName: 'Operator Address',
		name: 'operatorAddress',
		type: 'string',
		required: true,
		default: '',
		placeholder: '0x...',
		description: 'Operator address to approve',
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['approve721', 'setApprovalForAll'],
			},
		},
	},
	// Approved status
	{
		displayName: 'Approved',
		name: 'approved',
		type: 'boolean',
		default: true,
		description: 'Whether to approve or revoke',
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['setApprovalForAll'],
			},
		},
	},
	// Amount for ERC-1155
	{
		displayName: 'Amount',
		name: 'amount',
		type: 'number',
		required: true,
		default: 1,
		description: 'Amount to transfer (ERC-1155)',
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['transfer1155'],
			},
		},
	},
	// Batch transfer fields
	{
		displayName: 'Token IDs',
		name: 'tokenIds',
		type: 'string',
		required: true,
		default: '',
		placeholder: '1,2,3',
		description: 'Comma-separated token IDs',
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['batchTransfer1155'],
			},
		},
	},
	{
		displayName: 'Amounts',
		name: 'amounts',
		type: 'string',
		required: true,
		default: '',
		placeholder: '1,1,1',
		description: 'Comma-separated amounts for each token ID',
		displayOptions: {
			show: {
				resource: ['nft'],
				operation: ['batchTransfer1155'],
			},
		},
	},
];

export async function executeNFT(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const operation = this.getNodeParameter('operation', index) as string;
	const credentials = await this.getCredentials('flareNetworkApi');
	const connection = await createFlareConnection(credentials as any);
	const contractAddress = this.getNodeParameter('contractAddress', index) as string;

	if (!ethers.isAddress(contractAddress)) {
		throw new NodeOperationError(this.getNode(), 'Invalid contract address');
	}

	let result: any;

	switch (operation) {
		case 'getMetadata': {
			const tokenId = this.getNodeParameter('tokenId', index) as string;
			const nft = getContract(connection, contractAddress, ERC721_ABI);

			try {
				const [name, symbol, tokenURI, owner] = await Promise.all([
					nft.name(),
					nft.symbol(),
					nft.tokenURI(tokenId),
					nft.ownerOf(tokenId),
				]);

				result = {
					contract: contractAddress,
					tokenId,
					name,
					symbol,
					owner,
					tokenURI,
				};
			} catch (error) {
				throw new NodeOperationError(this.getNode(), `Failed to get NFT metadata: ${error}`);
			}
			break;
		}

		case 'getOwner': {
			const tokenId = this.getNodeParameter('tokenId', index) as string;
			const nft = getContract(connection, contractAddress, ERC721_ABI);

			const owner = await nft.ownerOf(tokenId);

			result = {
				contract: contractAddress,
				tokenId,
				owner,
			};
			break;
		}

		case 'getNFTsByOwner': {
			const address = this.getNodeParameter('address', index) as string;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const nft = getContract(connection, contractAddress, ERC721_ABI);

			// Get balance and enumerate tokens
			const balance = await nft.balanceOf(address);
			const tokens = [];

			// Note: This only works if the contract supports enumeration
			try {
				for (let i = 0; i < Number(balance); i++) {
					try {
						const tokenId = await nft.tokenOfOwnerByIndex(address, i);
						tokens.push(tokenId.toString());
					} catch {
						// Contract may not support enumeration
						break;
					}
				}
			} catch {
				// Enumeration not supported
			}

			result = {
				contract: contractAddress,
				owner: address,
				balance: Number(balance),
				tokenIds: tokens,
				note: tokens.length === 0 && balance > 0 ? 'Contract may not support enumeration' : undefined,
			};
			break;
		}

		case 'transfer721': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required');
			}

			const tokenId = this.getNodeParameter('tokenId', index) as string;
			const toAddress = this.getNodeParameter('toAddress', index) as string;
			let fromAddress = this.getNodeParameter('fromAddress', index, '') as string;

			if (!fromAddress) {
				fromAddress = await connection.wallet.getAddress();
			}

			if (!ethers.isAddress(toAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid to address');
			}

			const nft = getContract(connection, contractAddress, ERC721_ABI);
			const tx = await nft.transferFrom(fromAddress, toAddress, tokenId);
			const receipt = await tx.wait();

			result = {
				operation: 'transfer',
				contract: contractAddress,
				tokenId,
				from: fromAddress,
				to: toAddress,
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'success' : 'failed',
			};
			break;
		}

		case 'safeTransfer721': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required');
			}

			const tokenId = this.getNodeParameter('tokenId', index) as string;
			const toAddress = this.getNodeParameter('toAddress', index) as string;
			let fromAddress = this.getNodeParameter('fromAddress', index, '') as string;

			if (!fromAddress) {
				fromAddress = await connection.wallet.getAddress();
			}

			if (!ethers.isAddress(toAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid to address');
			}

			const nft = getContract(connection, contractAddress, ERC721_ABI);
			const tx = await nft['safeTransferFrom(address,address,uint256)'](fromAddress, toAddress, tokenId);
			const receipt = await tx.wait();

			result = {
				operation: 'safeTransfer',
				contract: contractAddress,
				tokenId,
				from: fromAddress,
				to: toAddress,
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'success' : 'failed',
			};
			break;
		}

		case 'approve721': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required');
			}

			const tokenId = this.getNodeParameter('tokenId', index) as string;
			const operatorAddress = this.getNodeParameter('operatorAddress', index) as string;

			if (!ethers.isAddress(operatorAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid operator address');
			}

			const nft = getContract(connection, contractAddress, ERC721_ABI);
			const tx = await nft.approve(operatorAddress, tokenId);
			const receipt = await tx.wait();

			result = {
				operation: 'approve',
				contract: contractAddress,
				tokenId,
				operator: operatorAddress,
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'success' : 'failed',
			};
			break;
		}

		case 'setApprovalForAll': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required');
			}

			const operatorAddress = this.getNodeParameter('operatorAddress', index) as string;
			const approved = this.getNodeParameter('approved', index) as boolean;

			if (!ethers.isAddress(operatorAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid operator address');
			}

			const nft = getContract(connection, contractAddress, ERC721_ABI);
			const tx = await nft.setApprovalForAll(operatorAddress, approved);
			const receipt = await tx.wait();

			result = {
				operation: 'setApprovalForAll',
				contract: contractAddress,
				operator: operatorAddress,
				approved,
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'success' : 'failed',
			};
			break;
		}

		case 'getCollectionInfo': {
			const nft = getContract(connection, contractAddress, ERC721_ABI);

			const [name, symbol] = await Promise.all([
				nft.name(),
				nft.symbol(),
			]);

			// Try to get total supply if available
			let totalSupply;
			try {
				totalSupply = Number(await nft.totalSupply());
			} catch {
				totalSupply = 'Not available';
			}

			result = {
				address: contractAddress,
				name,
				symbol,
				totalSupply,
			};
			break;
		}

		case 'getBalance1155': {
			const tokenId = this.getNodeParameter('tokenId', index) as string;
			const address = this.getNodeParameter('address', index) as string;

			if (!ethers.isAddress(address)) {
				throw new NodeOperationError(this.getNode(), 'Invalid address');
			}

			const nft = getContract(connection, contractAddress, ERC1155_ABI);
			const balance = await nft.balanceOf(address, tokenId);

			result = {
				contract: contractAddress,
				tokenId,
				owner: address,
				balance: Number(balance),
			};
			break;
		}

		case 'transfer1155': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required');
			}

			const tokenId = this.getNodeParameter('tokenId', index) as string;
			const toAddress = this.getNodeParameter('toAddress', index) as string;
			const amount = this.getNodeParameter('amount', index) as number;
			let fromAddress = this.getNodeParameter('fromAddress', index, '') as string;

			if (!fromAddress) {
				fromAddress = await connection.wallet.getAddress();
			}

			if (!ethers.isAddress(toAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid to address');
			}

			const nft = getContract(connection, contractAddress, ERC1155_ABI);
			const tx = await nft.safeTransferFrom(fromAddress, toAddress, tokenId, amount, '0x');
			const receipt = await tx.wait();

			result = {
				operation: 'transfer1155',
				contract: contractAddress,
				tokenId,
				amount,
				from: fromAddress,
				to: toAddress,
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'success' : 'failed',
			};
			break;
		}

		case 'batchTransfer1155': {
			if (!connection.wallet) {
				throw new NodeOperationError(this.getNode(), 'Private key required');
			}

			const tokenIdsStr = this.getNodeParameter('tokenIds', index) as string;
			const amountsStr = this.getNodeParameter('amounts', index) as string;
			const toAddress = this.getNodeParameter('toAddress', index) as string;
			let fromAddress = this.getNodeParameter('fromAddress', index, '') as string;

			if (!fromAddress) {
				fromAddress = await connection.wallet.getAddress();
			}

			if (!ethers.isAddress(toAddress)) {
				throw new NodeOperationError(this.getNode(), 'Invalid to address');
			}

			const tokenIds = tokenIdsStr.split(',').map(id => id.trim());
			const amounts = amountsStr.split(',').map(a => parseInt(a.trim(), 10));

			if (tokenIds.length !== amounts.length) {
				throw new NodeOperationError(this.getNode(), 'Token IDs and amounts must match');
			}

			const nft = getContract(connection, contractAddress, ERC1155_ABI);
			const tx = await nft.safeBatchTransferFrom(fromAddress, toAddress, tokenIds, amounts, '0x');
			const receipt = await tx.wait();

			result = {
				operation: 'batchTransfer1155',
				contract: contractAddress,
				tokenIds,
				amounts,
				from: fromAddress,
				to: toAddress,
				transactionHash: tx.hash,
				blockNumber: receipt?.blockNumber,
				status: receipt?.status === 1 ? 'success' : 'failed',
			};
			break;
		}

		default:
			throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
	}

	return [{ json: result }];
}
