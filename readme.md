# Contribute DAO

A Decentralized Autonomous Organization built on top of Contribute.
TDAO token holders vote and decide on critical protocol parameters and fully control the DAO's treasury.

For a detailed explanation of how the system works refer to this [blog post](https://medium.com/contribute-defi/contribute-dao-a-call-for-action-c66e8f5d57b).

## Getting Started

These instructions will get a copy of the project up and running on your local machine for development and testing purposes.

### Installation

Make sure to install all project dependencies

```bash
yarn install
```

## Running the tests

After installing all the dependencies just run the tests with

```bash
yarn test
```

## Simulating different scenarios

TRIG tokens are being distributed through a Liquidity Locked Event (LLE). You can run different simulations to test all its functionality.

Before you run the different simulations make sure you have the following set up correctly in the `.env` file:

`START_TIME` - Unix Time Stamp of the start of the Liquidity Locked Event. Make sure this time stamp is before current time in order for
the simulations to work.

`END_TIME` - Unix Time Stamp of the end date of the Liquidity Locked Event. It must be set after `START_TIME`.

Make sure you are running a fork of the Ethereum mainnet. You can choose a block to start from in the `buidler.config.js` file.

You will need an Alchemy API Access Key in order to have access to the Ethereum state.
Get a free API key [here](https://alchemyapi.io/build).

##### Contracts Deployment
1 - Deploys all contracts from the protocol.
```bash
yarn simulate-0
```

##### Starts the LLE and deposits TRIB to it.
1 - Approves all transactions required.
2 - Buys and distributes TRIB to participants.
3 - Starts LLE.
4 - Adds TRIB to the LLE contract.
```bash
yarn simulate-1
```

##### Finishes the LLE.
1 - Ends the LLE.
```bash
yarn simulate-2
```

##### Claims TRIG from the LLE.
1 - Withdraws TRIG from all the participants.
```bash
yarn simulate-3
```

##### Stake assets.
1 - Stakes TRIG from all the participants.
2 - Stakes NFT from all the participants.
3 - Generates transfer fees.
4 - Checks APY for rewards pool.
```bash
yarn simulate-4
```

##### Adds liquidity ETH/TDAO pool and stakes LP tokens.
1 - Adds liquidity to ETH/TDAO pool.
2 - Stake LP tokens.
```bash
yarn simulate-5
```

## Deployment

### Kovan

Deploy to the Kovan testnet with

```bash
yarn deploy:kovan
```

### Mainnet

Deploy to the Ethereum mainnet with

```bash
yarn deploy:main
```

## Deployed contracts

### Mainnet

 Contract | Address
------------ | -------------
NFT| [0x2da71c9db22f9d620fdc07bd42105e852afe05a2](https://etherscan.io/address/0x2da71c9db22f9d620fdc07bd42105e852afe05a2)
TRouterLLE| [0x9826d469322a9f0fedf52cb74064eb98fcadedfa](https://etherscan.io/address/0x9826d469322a9f0fedf52cb74064eb98fcadedfa)
TribRouter| [0x2EfA929Fc3c6F0853B49D8f371220d4Ee4972175](https://etherscan.io/address/0x2EfA929Fc3c6F0853B49D8f371220d4Ee4972175)
TDAO| [0x8e84ee8b28ddbe2b1d5e204e674460835d298815](https://etherscan.io/address/0x8e84ee8b28ddbe2b1d5e204e674460835d298815)
TRIG| [0xE3DCe982416Cb44D0376923bDA3DD92822eA5827](https://etherscan.io/address/0xE3DCe982416Cb44D0376923bDA3DD92822eA5827)
GuardianTimelock| [0xbb03410cc1c0b6c80ae7132351df1d89c6c2252b](https://etherscan.io/address/0xbb03410cc1c0b6c80ae7132351df1d89c6c2252b)
Guardian| [0xa12fcc28c4e931d35a545a41ab4298e5338dc46d](https://etherscan.io/address/0xa12fcc28c4e931d35a545a41ab4298e5338dc46d)
GovernorTimelock| [0x08ea86c8deb4a8e8b19f4f5679093c1ad05cdb04](https://etherscan.io/address/0x08ea86c8deb4a8e8b19f4f5679093c1ad05cdb04)
Governor| [0x8e6f20f7e6a0b56e4fa01076347583203bf28cb3](https://etherscan.io/address/0x8e6f20f7e6a0b56e4fa01076347583203bf28cb3)
LockedLiquidityEvent| [0x76d8c0853aac606dddf29d3cf1e4251279e66858](https://etherscan.io/address/0x76d8c0853aac606dddf29d3cf1e4251279e66858)
NFTRewardsVault| [0x76ea2186182e3ec27c2d9c7394b83e5c8f2cf6c4](https://etherscan.io/address/0x76ea2186182e3ec27c2d9c7394b83e5c8f2cf6c4)
TrigRewardsVault| [0x0069ca41fd66a0ac174db98c8fedc128c985b5f5](https://etherscan.io/address/0x0069ca41fd66a0ac174db98c8fedc128c985b5f5)
RewardsVault| [0x1c03d8d79706cd548b643810799e2b7288365c7e](https://etherscan.io/address/0x1c03d8d79706cd548b643810799e2b7288365c7e)
TreasuryVault| [0x7b756146ef9a98d63a4bd4e1b01975dc6fcfc7de](https://etherscan.io/address/0x7b756146ef9a98d63a4bd4e1b01975dc6fcfc7de)
FeeSplitter| [0xeac5b9f0993f1eb0c2c32b81335f3f00bf08b168](https://etherscan.io/address/0xeac5b9f0993f1eb0c2c32b81335f3f00bf08b168)
FeeController| [0xa18ec86acb5c2d34da64b393e87a365f29eb0f05](https://etherscan.io/address/0xa18ec86acb5c2d34da64b393e87a365f29eb0f05)
Treasury| [0x6be6e8fba7E5C2c56d32a7C994811806dC564859](https://etherscan.io/address/0x6be6e8fba7E5C2c56d32a7C994811806dC564859)

## Audit Report

These smart contracts have **not been audited** by a third party. Use it at your own risk.

## License

MIT
