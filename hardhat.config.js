require('dotenv').config();
require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-etherscan');
require('@nomiclabs/hardhat-web3');

const fs = require('fs');
// key to launch on testenets
const mnemonic = fs.readFileSync('.private').toString().trim();
// key to launch on mainnet
const mnemonic_secret = fs.readFileSync('.secret').toString().trim();

const etherscan_key = process.env.ETHERSCAN_KEY;
const alchemy_key = process.env.ALCHEMY_KEY;
const infura_key = process.env.INFURA_KEY;

// This is a sample Buidler task. To learn how to create your own go to
// https://buidler.dev/guides/create-task.html
task('accounts', 'Prints the list of accounts', async () => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress());
  }
});

task('simulate', 'Simulates a desired sequence for the application')
  .addParam('seq', 'The sequence number')
  .setAction(async (taskArgs) => {
    const seq = taskArgs.seq | 0;
    const simulation = require('./scripts/scenarios.js');
    await simulation(seq);
  });

task('deploy', 'Deploys the contracts to a specific network')
  .addParam('chain', 'Choose between mainnet, fork and kovan')
  .setAction(async (taskArgs) => {
    let _chain = taskArgs.chain;
    const deployer = require('./scripts/deploy.js');
    await deployer(this, _chain);
  });

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  mocha: {
    timeout: 50000,
  },
  // This is a sample solc configuration that specifies which version of solc to use
  solidity: {
    compilers: [
      {
        version: '0.5.5',
      },
      {
        version: '0.6.12',
        settings: {},
      },
      {
        version: '0.7.4',
        settings: {},
      },
    ],
    overrides: {
      '@uniswap/v2-periphery/contracts/UniswapV2Router02.sol': {
        version: '0.6.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
      '@uniswap/v2-periphery/contracts/libraries/SafeMath.sol': {
        version: '0.6.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
      '@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol': {
        version: '0.6.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
      'contracts/mock/UniswapV2Router02Mock.sol': {
        version: '0.6.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
    },
  },
  etherscan: {
    apiKey: etherscan_key,
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      blockGasLimit: 12000000,
      forking: {
        url:
          'https://eth-mainnet.alchemyapi.io/v2/'+alchemy_key,
        blockNumber: 11284281,
      },
      accounts: {
        mnemonic: mnemonic,
        path: "m/44'/60'/0'/0",
      },
    },
    mainnet: {
      url: 'https://mainnet.infura.io/v3/'+infura_key,
      chainId: 1,
      gas: 'auto',
      gasPrice: 'auto',
      accounts: {
        mnemonic: mnemonic_secret,
        path: "m/44'/60'/0'/0",
      },
    },
    ropsten: {
      url: 'https://ropsten.infura.io/v3/'+infura_key,
      chainId: 3,
      gas: 'auto',
      gasPrice: 'auto',
      accounts: {
        mnemonic: mnemonic,
        path: "m/44'/60'/0'/0",
      },
    },
    kovan: {
      url: 'https://kovan.infura.io/v3/'+infura_key,
      chainId: 42,
      gas: 'auto',
      gasPrice: 'auto',
      accounts: {
        mnemonic: mnemonic,
        path: "m/44'/60'/0'/0",
      },
    },
    rinkeby: {
      url: 'https://rinkeby.infura.io/v3/'+infura_key,
      chainId: 4,
      gas: 'auto',
      gasPrice: 'auto',
      accounts: {
        mnemonic: mnemonic,
        path: "m/44'/60'/0'/0",
      },
    },
  },
};
