require('dotenv').config();
const { expect } = require('chai');
const timeMachine = require('ganache-time-traveler');
const deploy = require('../scripts/deploy.js');

let Alice;
let Bob;
let Charlie;
let alice, bob, charlie;
let snapshotID, timeDeployed;

const startTime = process.env.START_TIME | 0;
const endTime = process.env.END_TIME | 0;
const gracePeriod = process.env.GRACE_PERIOD | 0;
const deadline = endTime + 1000000000;
const delay = 1800; // 30 minutes
const longDelay = 172800; // 2 days
const votingPeriod = 17280; // blocks
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

async function advanceBlocks(blocks) {
  for (let i = 0; i < blocks; i++) {
    await timeMachine.advanceBlock();
  }
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

  it('Should buy TRIB with ETH', async () => {
    const deposit = ethers.utils.parseEther('500');
    const tribAmount = await this.tribRouter.calcTribOut(deposit);
    let transaction = {
      to: this.tribRouter.address,
      value: deposit,
    };
    await Alice.sendTransaction(transaction);

    expect(await this.trib.balanceOf(Alice.address)).to.equal(tribAmount);
  });

  it('Should be able to acquire TDAO', async () => {
    const depositAmount = ethers.utils.parseEther('1000');
    await this.lle.addLiquidity(depositAmount);
    await timeMachine.advanceBlockAndSetTime(endTime + 1);
    await this.lle.lockLiquidity();
    await this.lle.claimTrig();
    await timeMachine.advanceTimeAndBlock(gracePeriod);
    const amount = ethers.utils.parseEther('2000');
    await this.router.swapExactTokensForTokens(
      amount,
      1,
      [this.trib.address, this.tdao.address],
      Alice.address,
      deadline
    );
    const tdaoBalance = await this.tdao.balanceOf(Alice.address);
    expect(tdaoBalance).to.gt(0);
  });

  it('Should not be able to make a proposal with less than 50 TDAO', async () => {
    const amount = '50';
    await this.tdao.delegate(Alice.address);
    const balance = await this.tdao.balanceOf(Alice.address);
    const remaining = balance.sub(ethers.utils.parseEther(amount));
    await this.tdao.transfer(Bob.address, remaining);
    expect(await this.tdao.balanceOf(Alice.address)).to.equal(
      ethers.utils.parseEther(amount)
    );
    let data = ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint'],
      [this.trib.address, 24]
    );
    await expect(
      this.governor.propose(
        [this.tdao.address],
        [0],
        ['transfer(address, uint)'],
        [data],
        'description'
      )
    ).to.be.revertedWith(
      'Governor::propose: proposer votes below proposal threshold'
    );
  });

  it('Should be able to make a proposal with more than 50 TDAO', async () => {
    await this.tdao.connect(Bob).transfer(Alice.address, 100);
    const amount = ethers.utils.parseEther('250');
    const balance = await this.tdao.balanceOf(Bob.address);
    const remaining = balance.sub(amount);
    await this.tdao.connect(Bob).transfer(Charlie.address, remaining);
    await this.tdao.connect(Bob).delegate(Bob.address);
    let data = ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint'],
      [this.trib.address, 24]
    );
    await this.governor.propose(
      [this.tdao.address],
      [0],
      ['transfer(address, uint)'],
      [data],
      'description'
    );
    await timeMachine.advanceBlock();
    await this.governor.connect(Bob).castVote(1, true);
    await advanceBlocks(votingPeriod);
    const state = await this.governor.state(1);
    expect(state).to.equal(4);
  });

  it('Should not start a guardian proposal with less than 1% of tokens.', async () => {});
});
