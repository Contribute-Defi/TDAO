const fs = require('fs');
const hre = require('hardhat');
const ethers = hre.ethers;
const provider = hre.ethers.provider;

let overrides = {
  // The maximum units of gas for the transaction to use
  gasLimit: 8000000,
  gasPrice: ethers.utils.parseUnits('20.0', 'gwei'),
};

async function setup() {
  const NFT = await ethers.getContractFactory('NFT');
  this.nft = await NFT.deploy(
    'ipfs://ipfs/QmUnZcWBcjpcxGTKtR6N4x9EZ4RKvjea4MJRU1k1hA8rru/{id}.json'
  );
  await this.nft.deployed();

  let contracts = {
    NFT: this.nft.address,
  };

  console.log(contracts);
}

async function main() {
  await setup();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
