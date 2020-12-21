require('dotenv').config();
const { expect } = require('chai');
const timeMachine = require('ganache-time-traveler');
const deploy = require('../scripts/deploy.js');

let Alice;
let Bob;
let Charlie;
let alice, bob, charlie;
let snapshotID, timeDeployed;

let overrides = {
  // The maximum units of gas for the transaction to use
  gasLimit: 5000000,
  gasPrice: ethers.utils.parseUnits('100.0', 'gwei'),
};

const startTime = process.env.START_TIME | 0;
const endTime = process.env.END_TIME | 0;
const gracePeriod = process.env.GRACE_PERIOD | 0;
const deadline = endTime + 1000000000;
const ether = ethers.utils.parseEther('1');
const mintAmount = ethers.utils.parseEther('10000');

const contributeAddress = '0x0DdfE92234b9DCA2de799736bBBa1D2F25CFC3b8';
const ethAddress = '0x0000000000000000000000000000000000000000';
const routerAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const factoryAddress = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
const tribAddress = '0xe09216F1d343Dd39D6Aa732a08036fee48555Af0';
const wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const tribRouterAddress = '0x2EfA929Fc3c6F0853B49D8f371220d4Ee4972175';
const balancerPair = '0xe036CCE08cf4E23D33bC6B18e53Caf532AFa8513';

function displayEth(number) {
  return ethers.utils.formatEther(number).toString();
}

const deployment = async () => {
  const accounts = await ethers.getSigners();
  Alice = accounts[0];
  Bob = accounts[1];
  Charlie = accounts[2];
  Treasury = accounts[3];

  await deploy(this, 'fork');
};

describe('Testing LLE', async () => {
  before(async () => {
    await deployment();
  });

  it('Should have created the Uniswap Pair', async () => {
    const zeroAddress = '0x0000000000000000000000000000000000000000';

    expect(await this.lle.tokenUniswapPair()).to.not.equal(zeroAddress);
  });

  it('Should be able to add pools to NFT rewards vault', async () => {
    // [80,115,130,145,160,175,190,5]

    expect(await this.nftRewardsVault.poolLength()).to.equal(8);
  });

  it('Should have deposited NFT in the LLE', async () => {
    const value = ethers.BigNumber.from('10');
    const balance = await this.nft.balanceOf(this.lle.address, 0);

    expect(balance).to.equal(value);
  });

  it('Should add liquidity with ETH', async () => {
    const deposit = ethers.utils.parseEther('10');
    const tribAmount = await this.routerLLE.calcTribOut(deposit);
    let transaction = {
      to: this.routerLLE.address,
      value: deposit,
    };
    await Alice.sendTransaction(transaction);
    const contributed = await this.lle.contributed(Alice.address);
    expect(contributed).to.equal(tribAmount);
  });

  it('Should have received its correct NFT share', async () => {
    expect(await this.nft.balanceOf(Alice.address, 1)).to.equal(1);
  });

  it('Should keep track of the highest depositor', async () => {
    const deposit = ethers.utils.parseEther('400');
    const tribAmount = await this.routerLLE.calcTribOut(deposit);
    let transaction = {
      to: this.routerLLE.address,
      value: deposit,
    };
    await Alice.sendTransaction(transaction);

    const highestDeposit = await this.lle.highestDeposit();

    expect(highestDeposit.account).to.equal(Alice.address);
    expect(highestDeposit.amount).to.equal(tribAmount);
  });

  it('Should not allow to claim trig before event is over', async () => {
    await expect(this.lle.claimTrig()).to.be.revertedWith(
      'LockedLiquidityEvent: Event not over yet.'
    );
  });

  it('Should not allow to add liquidity to Uniswap while event is ongoing', async () => {
    await expect(this.lle.lockLiquidity()).to.be.revertedWith(
      'LockedLiquidityEvent: LLE ongoing.'
    );
  });

  it('Should not allow to add liquidity after event is over', async () => {
    await timeMachine.advanceBlockAndSetTime(endTime + 1);
    const deposit = ethers.utils.parseEther('1');

    await expect(this.lle.addLiquidity(deposit)).to.be.revertedWith(
      'LockedLiquidityEvent: Liquidity Pool Event over.'
    );
  });
});
