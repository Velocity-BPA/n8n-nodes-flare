# n8n-nodes-flare

> [Velocity BPA Licensing Notice]
>
> This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).
>
> Use of this node by for-profit organizations in production environments requires a commercial license from Velocity BPA.
>
> For licensing information, visit https://velobpa.com/licensing or contact licensing@velobpa.com.

n8n community node for Flare Network blockchain. Supports FTSO price feeds, delegation, rewards claiming, State Connector attestations, FAssets, and DeFi operations across Flare, Songbird, and testnets. 18 resources with 150+ operations.

![n8n](https://img.shields.io/badge/n8n-community--node-orange)
![License](https://img.shields.io/badge/license-BSL--1.1-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)

## Features

- **18 Resources** with 150+ operations
- **FTSO Integration**: Decentralized price feeds, delegation, rewards
- **State Connector**: Cross-chain attestations and verification
- **FAssets**: Trustless BTC, XRP, DOGE on Flare
- **Full DeFi Support**: Tokens, NFTs, staking, governance
- **Multi-Network**: Flare, Songbird, Coston2, Coston
- **Trigger Node**: Real-time event-driven workflows

## Installation

### Community Nodes (Recommended)

1. Go to **Settings** → **Community Nodes**
2. Select **Install**
3. Enter `n8n-nodes-flare`
4. Agree to the risks and click **Install**

### Manual Installation

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-flare
```

### Development Installation

```bash
# Clone and build
git clone https://github.com/Velocity-BPA/n8n-nodes-flare.git
cd n8n-nodes-flare
npm install
npm run build

# Link to n8n
npm link
cd ~/.n8n/nodes
npm link n8n-nodes-flare

# Restart n8n
n8n start
```

## Credentials Setup

### Flare Network Credentials

| Field | Description | Required |
|-------|-------------|----------|
| Network | Flare, Songbird, Coston2, or Coston | Yes |
| Private Key | For write operations | No |
| Custom RPC URL | Override default RPC | No |

### Flare Explorer Credentials (Optional)

| Field | Description | Required |
|-------|-------------|----------|
| Network | Target network | Yes |
| API Key | Explorer API key | No |

## Resources & Operations

| Resource | Operations |
|----------|------------|
| Account | Balance, transactions, delegations, vote power |
| Wrapped Token | Wrap/unwrap, delegate, vote power |
| FTSO | Current prices, historical, epoch data |
| FTSO Delegation | Delegate to providers, manage delegations |
| FTSO Rewards | Claim rewards, epoch info, auto-claim |
| State Connector | Request/verify attestations |
| FAssets | FBTC/FXRP/FDOGE info, balances |
| Token | ERC-20 operations |
| NFT | ERC-721/1155 operations |
| Contract | Read/write, deploy, events |
| Transaction | Send, status, gas estimation |
| Block | Block info, timestamps |
| Staking | Validators, stake/unstake |
| Governance | Proposals, voting |
| Airdrop | Claim distributions |
| Bridge | Cross-chain transfers |
| Network | Chain info, gas prices |
| Utility | Address validation, encoding |

## Trigger Node

The Flare Trigger node monitors blockchain events in real-time:

- **New Transaction**: Monitor address transactions
- **Price Change**: Alert on FTSO price movements
- **Reward Available**: Notify when rewards can be claimed
- **Delegation Change**: Track delegation events
- **New Block**: Trigger on new blocks

## Usage Examples

### Get FTSO Price

```
Resource: FTSO
Operation: Get Current Price
Symbol: FLR
```

### Delegate Vote Power

```
Resource: Wrapped Token
Operation: Delegate
Provider Address: 0x...
Percentage: 100
```

### Claim Rewards

```
Resource: FTSO Rewards
Operation: Claim All Rewards
```

## Flare Network Concepts

### FTSO (Flare Time Series Oracle)
Decentralized oracle providing price feeds for various assets. Data providers submit prices and are rewarded for accuracy.

### State Connector
Cross-chain data verification system allowing Flare to attest to events on external blockchains like Bitcoin and XRP Ledger.

### FAssets
Trustless wrapped versions of non-smart contract tokens (BTC, XRP, DOGE) that can be used on Flare.

### Vote Power & Delegation
Wrapped native tokens (WFLR/WSGB) grant vote power that can be delegated to FTSO providers to earn rewards.

## Networks

| Network | Chain ID | Native Token | Wrapped Token | Type |
|---------|----------|--------------|---------------|------|
| Flare | 14 | FLR | WFLR | Mainnet |
| Songbird | 19 | SGB | WSGB | Canary |
| Coston2 | 114 | C2FLR | WC2FLR | Testnet |
| Coston | 16 | CFLR | WCFLR | Testnet |

## Error Handling

The node provides detailed error messages for common issues:

- **Invalid Address**: Check address format (0x...)
- **Insufficient Funds**: Ensure account has enough balance
- **Network Error**: Verify RPC endpoint availability
- **Contract Error**: Check contract address and ABI

## Security Best Practices

1. **Never commit private keys** to version control
2. **Use environment variables** for sensitive data
3. **Test on testnets** (Coston2/Coston) before mainnet
4. **Monitor gas costs** for transaction operations
5. **Validate addresses** before sending transactions

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint

# Fix linting issues
npm run lint:fix
```

## Author

**Velocity BPA**
- Website: [velobpa.com](https://velobpa.com)
- GitHub: [Velocity-BPA](https://github.com/Velocity-BPA)

## Licensing

This n8n community node is licensed under the **Business Source License 1.1**.

### Free Use
Permitted for personal, educational, research, and internal business use.

### Commercial Use
Use of this node within any SaaS, PaaS, hosted platform, managed service,
or paid automation offering requires a commercial license.

For licensing inquiries:
**licensing@velobpa.com**

See [LICENSE](LICENSE), [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md), and [LICENSING_FAQ.md](LICENSING_FAQ.md) for details.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

- [Documentation](https://docs.flare.network)
- [Flare Discord](https://discord.gg/flare)
- [GitHub Issues](https://github.com/Velocity-BPA/n8n-nodes-flare/issues)

## Acknowledgments

- [Flare Network](https://flare.network) - Blockchain infrastructure
- [n8n](https://n8n.io) - Workflow automation platform
- [ethers.js](https://ethers.org) - Ethereum library
