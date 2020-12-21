// const { readArtifact } = require("@nomiclabs/buidler/plugins");
const { expect } = require('chai');
const timeMachine = require('ganache-time-traveler');
const utils = require('../scripts/utils.js');

let Alice;
let Bob;
let Charlie;
let alice, bob, charlie;
const interval = 2592000; // 30 days in seconds
const ether = ethers.utils.parseEther('1');
const treasuryFees = [9000, 9200, 9400, 9600, 9800];

let overrides = {
  // The maximum units of gas for the transaction to use
  gasLimit: 5000000,
  gasPrice: ethers.utils.parseUnits('100.0', 'gwei'),
};

function displayEth(number) {
  return ethers.utils.formatEther(number).toString();
}

const deployment = async () => {
  const accounts = await ethers.getSigners();
  Alice = accounts[0];
  Bob = accounts[1];
  Charlie = accounts[2];
  Treasury = accounts[3];

  const deployer = Alice.address;

  const TDAO = await ethers.getContractFactory('TDaoMockSplitterTest');
  this.tdao = await TDAO.deploy('Contribute Dao', 'TDAO');
  await this.tdao.deployed();

  const TVault = await ethers.getContractFactory('TrigRewardsVault');
  this.tVault = await TVault.deploy(this.tdao.address);
  await this.tVault.deployed();

  const NFTVault = await ethers.getContractFactory('NFTRewardsVault');
  this.nftVault = await NFTVault.deploy(this.tdao.address);
  await this.nftVault.deployed();

  const RewardsVault = await ethers.getContractFactory('RewardsVault');
  this.rewardsVault = await RewardsVault.deploy(this.tdao.address);
  await this.rewardsVault.deployed();

  const TreasuryVault = await ethers.getContractFactory('TreasuryVault');
  this.treasuryVault = await TreasuryVault.deploy(
    this.tdao.address,
    this.rewardsVault.address,
    Treasury.address
  );
  await this.treasuryVault.deployed();

  const FeeSplitter = await ethers.getContractFactory('FeeSplitter');
  this.feeSplitter = await FeeSplitter.deploy(
    this.tdao.address,
    this.tVault.address,
    this.nftVault.address,
    this.treasuryVault.address
  );
  await this.feeSplitter.deployed();
  await this.tdao.setFeeSplitter(this.feeSplitter.address);
};

async function transferNFT() {}

describe('Testing fee splits.', async () => {
  beforeEach(async () => {
    let snapshot = await timeMachine.takeSnapshot();
    snapshotId = snapshot['result'];
  });

  afterEach(async () => {
    await timeMachine.revertToSnapshot(snapshotId);
  });

  before(async () => {
    await deployment();
  });

  it('Should split fees 10/90 => nft/treasury', async () => {
    // [9000, 9200, 9400, 9600, 9800];
    const amount = ethers.utils.parseEther('100');
    const treasuryFee = ethers.BigNumber.from(treasuryFees[0].toString());
    const trigFee = ethers.BigNumber.from('5000');
    const fees = utils.calculateFees(amount, trigFee, treasuryFee);
    await this.tdao.transfer(this.feeSplitter.address, amount);
    await this.feeSplitter.update();

    expect(await this.tdao.balanceOf(this.tVault.address)).to.equal(
      fees.trigShare
    );
    expect(await this.tdao.balanceOf(this.nftVault.address)).to.equal(
      fees.nftShare
    );
    expect(await this.tdao.balanceOf(this.rewardsVault.address)).to.equal(
      fees.lpShare
    );
    expect(await this.tdao.balanceOf(Treasury.address)).to.equal(
      fees.treasuryShare
    );
  });

  it('Should split fees 8/92 => nft/treasury', async () => {
    await timeMachine.advanceTimeAndBlock(interval);
    // [9000, 9200, 9400, 9600, 9800];
    const amount = ethers.utils.parseEther('100');
    const treasuryFee = ethers.BigNumber.from(treasuryFees[1].toString());
    const trigFee = ethers.BigNumber.from('5000');
    const fees = utils.calculateFees(amount, trigFee, treasuryFee);
    await this.tdao.transfer(this.feeSplitter.address, amount);
    await this.feeSplitter.update();

    expect(await this.tdao.balanceOf(this.tVault.address)).to.equal(
      fees.trigShare
    );
    expect(await this.tdao.balanceOf(this.nftVault.address)).to.equal(
      fees.nftShare
    );
    expect(await this.tdao.balanceOf(this.rewardsVault.address)).to.equal(
      fees.lpShare
    );
    expect(await this.tdao.balanceOf(Treasury.address)).to.equal(
      fees.treasuryShare
    );
  });

  it('Should split fees 6/94 => nft/treasury', async () => {
    await timeMachine.advanceTimeAndBlock(interval * 2);
    // [9000, 9200, 9400, 9600, 9800];
    const amount = ethers.utils.parseEther('100');
    const treasuryFee = ethers.BigNumber.from(treasuryFees[2].toString());
    const trigFee = ethers.BigNumber.from('5000');
    const fees = utils.calculateFees(amount, trigFee, treasuryFee);
    await this.tdao.transfer(this.feeSplitter.address, amount);
    await this.feeSplitter.update();

    expect(await this.tdao.balanceOf(this.tVault.address)).to.equal(
      fees.trigShare
    );
    expect(await this.tdao.balanceOf(this.nftVault.address)).to.equal(
      fees.nftShare
    );
    expect(await this.tdao.balanceOf(this.rewardsVault.address)).to.equal(
      fees.lpShare
    );
    expect(await this.tdao.balanceOf(Treasury.address)).to.equal(
      fees.treasuryShare
    );
  });

  it('Should split fees 4/96 => nft/treasury', async () => {
    await timeMachine.advanceTimeAndBlock(interval * 3);
    // [9000, 9200, 9400, 9600, 9800];
    const amount = ethers.utils.parseEther('100');
    const treasuryFee = ethers.BigNumber.from(treasuryFees[3].toString());
    const trigFee = ethers.BigNumber.from('5000');
    const fees = utils.calculateFees(amount, trigFee, treasuryFee);
    await this.tdao.transfer(this.feeSplitter.address, amount);
    await this.feeSplitter.update();

    expect(await this.tdao.balanceOf(this.tVault.address)).to.equal(
      fees.trigShare
    );
    expect(await this.tdao.balanceOf(this.nftVault.address)).to.equal(
      fees.nftShare
    );
    expect(await this.tdao.balanceOf(this.rewardsVault.address)).to.equal(
      fees.lpShare
    );
    expect(await this.tdao.balanceOf(Treasury.address)).to.equal(
      fees.treasuryShare
    );
  });

  it('Should split fees 2/98 => nft/treasury', async () => {
    await timeMachine.advanceTimeAndBlock(interval * 4);
    // [9000, 9200, 9400, 9600, 9800];
    const amount = ethers.utils.parseEther('100');
    const treasuryFee = ethers.BigNumber.from(treasuryFees[4].toString());
    const trigFee = ethers.BigNumber.from('5000');
    const fees = utils.calculateFees(amount, trigFee, treasuryFee);
    await this.tdao.transfer(this.feeSplitter.address, amount);
    await this.feeSplitter.update();

    expect(await this.tdao.balanceOf(this.tVault.address)).to.equal(
      fees.trigShare
    );
    expect(await this.tdao.balanceOf(this.nftVault.address)).to.equal(
      fees.nftShare
    );
    expect(await this.tdao.balanceOf(this.rewardsVault.address)).to.equal(
      fees.lpShare
    );
    expect(await this.tdao.balanceOf(Treasury.address)).to.equal(
      fees.treasuryShare
    );
  });

  it('Should continuously split fees 2/98 => nft/treasury', async () => {
    await timeMachine.advanceTimeAndBlock(interval * 10);
    // [9000, 9200, 9400, 9600, 9800];
    const amount = ethers.utils.parseEther('100');
    const treasuryFee = ethers.BigNumber.from(treasuryFees[4].toString());
    const trigFee = ethers.BigNumber.from('5000');
    const fees = utils.calculateFees(amount, trigFee, treasuryFee);
    await this.tdao.transfer(this.feeSplitter.address, amount);
    await this.feeSplitter.update();

    expect(await this.tdao.balanceOf(this.tVault.address)).to.equal(
      fees.trigShare
    );
    expect(await this.tdao.balanceOf(this.nftVault.address)).to.equal(
      fees.nftShare
    );
    expect(await this.tdao.balanceOf(this.rewardsVault.address)).to.equal(
      fees.lpShare
    );
    expect(await this.tdao.balanceOf(Treasury.address)).to.equal(
      fees.treasuryShare
    );
  });

  it('Should set treasury to a different address.', async () => {
    await this.tdao.setTreasuryVault(Charlie.address);
    expect(await this.feeSplitter.treasuryVault()).to.equal(Charlie.address);
  });

  it('Should be able to set TRIG fee in bounds.', async () => {
    await this.tdao.setTrigFee(5001);
    expect(await this.feeSplitter.trigFee()).to.equal(5001);
    await expect(this.tdao.setTrigFee(4999)).to.be.revertedWith(
      'FeeSplitter: Trig fee out of bounds.'
    );
    await expect(this.tdao.setTrigFee(9001)).to.be.revertedWith(
      'FeeSplitter: Trig fee out of bounds.'
    );
    await this.tdao.setTrigFee(9000);
    expect(await this.feeSplitter.trigFee()).to.equal(9000);
  });

  it('Should be able to split the fees correctly after TRIG fee change.', async () => {
    // Testing 100:
    // TRIG | TREASURY/NFT
    // 90   | 90/10
    const amount = ethers.utils.parseEther('100');
    await this.tdao.setTrigFee(9000);
    const trigFee = ethers.BigNumber.from('9000');
    const treasuryFee = ethers.BigNumber.from(treasuryFees[0].toString());
    const fees = utils.calculateFees(amount, trigFee, treasuryFee);
    await this.tdao.transfer(this.feeSplitter.address, amount);
    await this.feeSplitter.update();
    expect(await this.tdao.balanceOf(this.tVault.address)).to.equal(
      fees.trigShare
    );
    expect(await this.tdao.balanceOf(this.nftVault.address)).to.equal(
      fees.nftShare
    );
    expect(await this.tdao.balanceOf(this.rewardsVault.address)).to.equal(
      fees.lpShare
    );
    expect(await this.tdao.balanceOf(Treasury.address)).to.equal(
      fees.treasuryShare
    );
  });
});
