// const { readArtifact } = require("@nomiclabs/buidler/plugins");
require('dotenv').config();
const { expect } = require('chai');
const timeMachine = require('ganache-time-traveler');
const utils = require('../scripts/utils.js');

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

const indexes = [0, 1, 2, 3, 4, 5, 6, 7];
const amounts = [10, 8, 6, 5, 4, 2, 1, 1];
const nftRewardPoints = [80, 115, 130, 145, 160, 175, 190, 5];

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

  const deployer = Alice.address;

  this.trib = await ethers.getContractAt(
    '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
    tribAddress
  );
  this.tribRouter = await ethers.getContractAt('TribRouter', tribRouterAddress);
  this.router = await ethers.getContractAt('IUniswapV2Router02', routerAddress);

  const NFT = await ethers.getContractFactory('NFTMock');
  this.nft = await NFT.deploy('http://nft');
  await this.nft.deployed();

  const TDao = await ethers.getContractFactory('TDAO');
  this.tdao = await TDao.deploy('Contribure DAO', 'TDAO');
  await this.tdao.deployed();

  const LLE = await ethers.getContractFactory('LockedLiquidityEvent');
  this.lle = await LLE.deploy(
    routerAddress,
    factoryAddress,
    this.tdao.address,
    tribAddress,
    this.nft.address,
    startTime,
    endTime
  );
  await this.lle.deployed();

  await this.tdao.setLockedLiquidityEvent(this.lle.address);

  const TRouterLLE = await ethers.getContractFactory('TribRouterLLE');
  this.routerLLE = await TRouterLLE.deploy(
    balancerPair,
    contributeAddress,
    this.tdao.address
  );
  await this.routerLLE.deployed();

  const lockedLiquidityEventAddress = await this.tdao.lockedLiquidityEvent();
  this.lle = await ethers.getContractAt(
    'LockedLiquidityEvent',
    lockedLiquidityEventAddress
  );

  await this.nft.safeBatchTransferFrom(
    deployer,
    this.lle.address,
    indexes,
    amounts,
    ethers.utils.hexZeroPad('0x0', 32)
  );

  const pairAddress = await this.lle.tokenUniswapPair();
  this.pair = await ethers.getContractAt('IUniswapV2Pair', pairAddress);
  // console.log("Unipair: ", pairAddress);

  const NFTRewardsVault = await ethers.getContractFactory('NFTRewardsVault');
  this.nftRewardsVault = await NFTRewardsVault.deploy(this.tdao.address);
  await this.nftRewardsVault.deployed();

  const TrigRewardsVault = await ethers.getContractFactory('TrigRewardsVault');
  this.trigRewardsVault = await TrigRewardsVault.deploy(this.tdao.address);
  await this.trigRewardsVault.deployed();

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
    this.trigRewardsVault.address,
    this.nftRewardsVault.address,
    this.treasuryVault.address
  );
  await this.feeSplitter.deployed();

  const FeeController = await ethers.getContractFactory('FeeController');
  this.feeController = await FeeController.deploy(
    this.tdao.address,
    tribAddress,
    factoryAddress,
    this.feeSplitter.address
  );
  await this.feeController.deployed();

  await this.tdao.setDependencies(
    this.feeController.address,
    this.feeSplitter.address,
    deployer
  );

  const value = ethers.utils.parseEther('10000000000');
};

const approveAll = async () => {
  const approval = ethers.utils.parseEther('10000000000');

  await this.trib.approve(this.lle.address, approval);
  await this.trib.connect(Bob).approve(this.lle.address, approval);
  await this.trib.connect(Charlie).approve(this.lle.address, approval);

  await this.trib.approve(routerAddress, approval);
  await this.trib.connect(Bob).approve(routerAddress, approval);
  await this.trib.connect(Charlie).approve(routerAddress, approval);

  await this.trib.approve(this.pair.address, approval);
  await this.trib.connect(Bob).approve(this.pair.address, approval);
  await this.trib.connect(Charlie).approve(this.pair.address, approval);

  await this.tdao.approve(routerAddress, approval);
  await this.tdao.connect(Bob).approve(routerAddress, approval);
  await this.tdao.connect(Charlie).approve(routerAddress, approval);

  await this.tdao.approve(this.pair.address, approval);
  await this.tdao.connect(Bob).approve(this.pair.address, approval);
  await this.tdao.connect(Charlie).approve(this.pair.address, approval);

  await this.nft.setApprovalForAll(this.nftRewardsVault.address, true);
  await this.nft
    .connect(Bob)
    .setApprovalForAll(this.nftRewardsVault.address, true);
  await this.nft
    .connect(Charlie)
    .setApprovalForAll(this.nftRewardsVault.address, true);
};

describe('Testing LLE', async () => {
  before(async () => {
    await deployment();
    await approveAll();
  });

  it('Should have created the Uniswap Pair', async () => {
    const zeroAddress = '0x0000000000000000000000000000000000000000';

    expect(await this.lle.tokenUniswapPair()).to.not.equal(zeroAddress);
  });

  it('Should be able to add pools to NFT rewards vault', async () => {
    // [80,115,130,145,160,175,190,5]
    for (let i in nftRewardPoints) {
      await this.nftRewardsVault.add(
        nftRewardPoints[i],
        this.nft.address,
        i,
        false
      );
    }
    expect(await this.nftRewardsVault.poolLength()).to.equal(8);
  });

  it('Should have deposited NFT in the LLE', async () => {
    const value = ethers.BigNumber.from(amounts[0].toString());
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

  it('Should have deposited TRIB', async () => {
    const depositAmount = ethers.utils.parseEther('2500');
    await this.lle.addLiquidity(depositAmount);

    expect(await this.trib.balanceOf(this.lle.address)).to.equal(depositAmount);
  });

  it('Should have received its correct NFT share', async () => {
    const share = ethers.BigNumber.from('1');

    expect(await this.nft.balanceOf(Alice.address, 0)).to.equal(1);
    expect(await this.nft.balanceOf(Alice.address, 1)).to.equal(1);
  });

  it('Should send Trib to other participants', async () => {
    const amount = ethers.utils.parseEther('45000');
    await this.trib.transfer(Bob.address, amount);
    await this.trib.transfer(Charlie.address, amount);

    expect(await this.trib.balanceOf(Bob.address)).to.equal(amount);
    expect(await this.trib.balanceOf(Charlie.address)).to.equal(amount);
  });

  it('Should distribute correct NFT amounts', async () => {
    const beforeBalance = ethers.utils.parseEther('45000');
    const bAmount = ethers.utils.parseEther('5000');
    const cAmount = ethers.utils.parseEther('500');
    await this.lle.connect(Bob).addLiquidity(bAmount);
    await this.lle.connect(Charlie).addLiquidity(cAmount);

    expect(await this.trib.balanceOf(Bob.address)).to.equal(
      beforeBalance.sub(bAmount)
    );
    expect(await this.trib.balanceOf(Charlie.address)).to.equal(
      beforeBalance.sub(cAmount)
    );
    expect(await this.nft.balanceOf(Bob.address, 2)).to.equal(1);
    expect(await this.nft.balanceOf(Charlie.address, 0)).to.equal(1);

    expect(await this.nft.balanceOf(this.lle.address, 0)).to.equal(8);
    expect(await this.nft.balanceOf(this.lle.address, 1)).to.equal(7);
    expect(await this.nft.balanceOf(this.lle.address, 2)).to.equal(5);
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

  it('Should lock liquidity after event is over', async () => {
    const tribBalance = await this.trib.balanceOf(this.lle.address);
    const tdaoBalance = await this.tdao.balanceOf(this.lle.address);
    expect(tribBalance).to.equal(ethers.utils.parseEther('8000'));
    expect(tdaoBalance).to.equal(ethers.utils.parseEther('5000'));

    await this.lle.lockLiquidity();

    expect(await this.trib.balanceOf(this.lle.address)).to.equal(0);
    expect(await this.tdao.balanceOf(this.lle.address)).to.equal(0);
    expect(await this.trib.balanceOf(this.pair.address)).to.equal(
      ethers.utils.parseEther('8000')
    );
    expect(await this.tdao.balanceOf(this.pair.address)).to.equal(
      ethers.utils.parseEther('5000')
    );

    const trigAddress = await this.lle.trig();
    this.trig = await ethers.getContractAt(
      '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
      trigAddress
    );
    const zeroAddress = '0x0000000000000000000000000000000000000000';

    expect(await this.trig.address).to.not.equal(zeroAddress);
    expect(await this.trig.balanceOf(this.lle.address)).to.equal(
      ethers.utils.parseEther('1000')
    );
  });

  it('Should claim TRIG', async () => {
    // Total Investments:
    // Alice   : 2500  TRIB
    // Bob     : 5000  TRIB
    // Charlie : 500 TRIB
    // Shares 0.3125 | 0.625 | 0.0625
    const supplyTrig = ethers.utils.parseEther('1000');
    await this.lle.claimTrig();
    await this.lle.connect(Bob).claimTrig();
    await this.lle.connect(Charlie).claimTrig();
    const aBalance = await this.trig.balanceOf(Alice.address);
    const bBalance = await this.trig.balanceOf(Bob.address);
    const cBalance = await this.trig.balanceOf(Charlie.address);

    expect(aBalance).to.equal(
      supplyTrig.mul(ethers.utils.parseEther('0.3125')).div(ether)
    );
    expect(bBalance).to.equal(
      supplyTrig.mul(ethers.utils.parseEther('0.625')).div(ether)
    );
    expect(cBalance).to.equal(
      supplyTrig.mul(ethers.utils.parseEther('0.0625')).div(ether)
    );
  });
});

describe('Testing Uniswap Trades', async () => {
  it('Should not allow to buy TDAO from Uniswap before grace period is over', async () => {
    const amount = ethers.utils.parseEther('200');

    await expect(
      this.router.swapExactTokensForTokens(
        amount,
        1,
        [this.trib.address, this.tdao.address],
        Alice.address,
        deadline
      )
    ).to.be.revertedWith('UniswapV2: TRANSFER_FAILED');
  });

  it('Should buy TDAO from Uniswap without fees after grace period is over.', async () => {
    const balanceBefore = await this.tdao.balanceOf(this.pair.address);
    await timeMachine.advanceTimeAndBlock(gracePeriod);
    const amount = ethers.utils.parseEther('2000');

    expect(await this.tdao.balanceOf(Alice.address)).to.equal(0);

    await this.router.swapExactTokensForTokens(
      amount,
      1,
      [this.trib.address, this.tdao.address],
      Alice.address,
      deadline
    );
    const difference = await balanceBefore.sub(
      await this.tdao.balanceOf(this.pair.address)
    );

    expect(difference).to.be.above(0);
    expect(await this.tdao.balanceOf(Alice.address)).to.equal(difference);
  });
});

describe('Testing Fees and Rewards', async () => {
  it('Should be able to add pool to Trig rewards vault', async () => {
    await this.trigRewardsVault.add(1, this.trig.address, false);

    expect(await this.trigRewardsVault.poolLength()).to.equal(1);
  });

  it('Should be able to deposit TRIG in rewards vault', async () => {
    const approval = ethers.utils.parseEther('1000000');
    await this.trig.approve(this.trigRewardsVault.address, approval);
    await this.trig
      .connect(Bob)
      .approve(this.trigRewardsVault.address, approval);
    await this.trig
      .connect(Charlie)
      .approve(this.trigRewardsVault.address, approval);
    const aAmount = ethers.utils.parseEther('1');
    const bAmount = ethers.utils.parseEther('3');
    const cAmount = ethers.utils.parseEther('6');
    await this.trigRewardsVault.deposit(0, aAmount);
    await this.trigRewardsVault.connect(Bob).deposit(0, bAmount);
    await this.trigRewardsVault.connect(Charlie).deposit(0, cAmount);
    const aUserInfo = await this.trigRewardsVault.userInfo(0, Alice.address);
    const bUserInfo = await this.trigRewardsVault.userInfo(0, Bob.address);
    const cUserInfo = await this.trigRewardsVault.userInfo(0, Charlie.address);

    expect(aUserInfo.amount).to.equal(aAmount);
    expect(bUserInfo.amount).to.equal(bAmount);
    expect(cUserInfo.amount).to.equal(cAmount);
  });

  it('Should be able to deposit NFT in rewards vault', async () => {
    // NFT Cards
    // Alice:   0=1 | 1=1
    // Bob:     2=1
    // Charlie: 0=1 | 1=1 | 4=2
    await this.nftRewardsVault.deposit(0, 1);
    await this.nftRewardsVault.deposit(1, 1);
    await this.nftRewardsVault.connect(Bob).deposit(2, 1);
    await this.nftRewardsVault.connect(Charlie).deposit(0, 1);

    const aUserInfo_0 = await this.nftRewardsVault.userInfo(0, Alice.address);
    const aUserInfo_1 = await this.nftRewardsVault.userInfo(1, Alice.address);
    expect(aUserInfo_0.amount).to.equal(1);
    expect(aUserInfo_1.amount).to.equal(1);

    const bUserInfo_2 = await this.nftRewardsVault.userInfo(2, Bob.address);
    expect(bUserInfo_2.amount).to.equal(1);

    const cUserInfo_0 = await this.nftRewardsVault.userInfo(0, Charlie.address);
    expect(cUserInfo_0.amount).to.equal(1);
  });

  it('Should be charged a fee if selling TDAO', async () => {
    // Current fee structure:
    // Fee = 1%
    const balanceBefore = await this.tdao.balanceOf(this.pair.address);
    const amount = ethers.utils.parseEther('100');
    const fee = amount.div(100);
    await this.router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
      amount,
      1,
      [this.tdao.address, this.trib.address],
      Alice.address,
      deadline
    );
    expect(await this.tdao.balanceOf(this.pair.address)).to.equal(
      balanceBefore.add(amount.sub(fee))
    );
  });

  it('Should have pending rewards TDAO from TRIG rewards vault', async () => {
    // Total in Rewards TDAO
    // Alice    10%
    // Bob      30%
    // Charlie  60%
    const amount = ethers.utils.parseEther('100');
    const fee = amount.div(100);
    const trigFee = ethers.BigNumber.from('5000');
    const treasuryVaultFee = ethers.BigNumber.from('9000');
    const fees = utils.calculateFees(fee, trigFee, treasuryVaultFee);
    await this.feeSplitter.update();
    const trigRewardAmount = fees.trigShare;
    const BASE = 100;

    const rewardA = trigRewardAmount.mul(ethers.BigNumber.from('10')).div(BASE);
    const rewardB = trigRewardAmount.mul(ethers.BigNumber.from('30')).div(BASE);
    const rewardC = trigRewardAmount.mul(ethers.BigNumber.from('60')).div(BASE);

    expect(
      await this.trigRewardsVault.pendingReward(0, Alice.address)
    ).to.equal(rewardA);
    expect(await this.trigRewardsVault.pendingReward(0, Bob.address)).to.equal(
      rewardB
    );
    expect(
      await this.trigRewardsVault.pendingReward(0, Charlie.address)
    ).to.equal(rewardC);
  });

  it('Should have received TDAO from TRIG rewards vault', async () => {
    // Total in Rewards TDAO
    // Alice    10%
    // Bob      30%
    // Charlie  60%
    const beforeBalanceA = await this.tdao.balanceOf(Alice.address);
    const beforeBalanceB = await this.tdao.balanceOf(Bob.address);
    const beforeBalanceC = await this.tdao.balanceOf(Charlie.address);

    const amount = ethers.utils.parseEther('100');
    const fee = amount.div(100);
    const trigFee = ethers.BigNumber.from('5000');
    const treasuryVaultFee = ethers.BigNumber.from('9000');
    const fees = utils.calculateFees(fee, trigFee, treasuryVaultFee);
    const trigRewardAmount = fees.trigShare;
    const BASE = 100;

    const rewardA = trigRewardAmount.mul(ethers.BigNumber.from('10')).div(BASE);
    const rewardB = trigRewardAmount.mul(ethers.BigNumber.from('30')).div(BASE);
    const rewardC = trigRewardAmount.mul(ethers.BigNumber.from('60')).div(BASE);

    await this.trigRewardsVault.withdraw(0, 0);
    await this.trigRewardsVault.connect(Bob).withdraw(0, 0);
    await this.trigRewardsVault.connect(Charlie).withdraw(0, 0);

    expect(await this.tdao.balanceOf(Alice.address)).to.equal(
      beforeBalanceA.add(rewardA)
    );
    expect(await this.tdao.balanceOf(Bob.address)).to.equal(
      beforeBalanceB.add(rewardB)
    );
    expect(await this.tdao.balanceOf(Charlie.address)).to.equal(
      beforeBalanceC.add(rewardC)
    );
  });

  it('Should have pending rewards TDAO from NFT rewards vault', async () => {
    // NFT Cards
    // Total in Rewards
    // Alice:   0=1 | 1=1
    // Bob:     2=1
    // Charlie: 0=1 | 1=1 | 4=2 | 7=1
    // Proportions [8,11.5,13,14.5,16,17.5,19,0.5]
    const amount = ethers.utils.parseEther('100');
    const fee = amount.div(100);
    const trigFee = ethers.BigNumber.from('5000');
    const treasuryVaultFee = ethers.BigNumber.from('9000');
    const fees = utils.calculateFees(fee, trigFee, treasuryVaultFee);
    const nftRewardsAmount = fees.nftShare;
    const BASE = 1000;

    const rewardPool_0 = nftRewardsAmount
      .mul(ethers.BigNumber.from(nftRewardPoints[0].toString()))
      .div(BASE);
    const rewardPool_1 = nftRewardsAmount
      .mul(ethers.BigNumber.from(nftRewardPoints[1].toString()))
      .div(BASE);
    const rewardPool_2 = nftRewardsAmount
      .mul(ethers.BigNumber.from(nftRewardPoints[2].toString()))
      .div(BASE);

    const rewardA_0 = ethers.utils
      .parseEther('0.5')
      .mul(rewardPool_0)
      .div(ether);
    const rewardA_1 = ethers.utils.parseEther('1').mul(rewardPool_1).div(ether);
    const rewardB_2 = ethers.utils.parseEther('1').mul(rewardPool_2).div(ether);
    const rewardC_0 = ethers.utils
      .parseEther('0.5')
      .mul(rewardPool_0)
      .div(ether);

    expect(await this.nftRewardsVault.pendingReward(0, Alice.address)).to.equal(
      rewardA_0
    );
    expect(await this.nftRewardsVault.pendingReward(1, Alice.address)).to.equal(
      rewardA_1
    );
    expect(await this.nftRewardsVault.pendingReward(2, Bob.address)).to.equal(
      rewardB_2
    );
    expect(
      await this.nftRewardsVault.pendingReward(0, Charlie.address)
    ).to.equal(rewardC_0);
  });

  it('Should have received TDAO from NFT rewards vault', async () => {
    // NFT Cards
    // Total in Rewards 0.05 TDAO
    // Alice:   0=1 | 1=1
    // Bob:     2=1
    // Charlie: 0=1
    // Proportions [8,11.5,13,14.5,16,17.5,19,0.5]
    const beforeBalanceA = await this.tdao.balanceOf(Alice.address);
    const beforeBalanceB = await this.tdao.balanceOf(Bob.address);
    const beforeBalanceC = await this.tdao.balanceOf(Charlie.address);

    const amount = ethers.utils.parseEther('100');
    const fee = amount.div(100);
    const trigFee = ethers.BigNumber.from('5000');
    const treasuryVaultFee = ethers.BigNumber.from('9000');
    const fees = utils.calculateFees(fee, trigFee, treasuryVaultFee);
    const nftRewardsAmount = fees.nftShare;
    const BASE = 1000;

    const rewardPool_0 = nftRewardsAmount
      .mul(ethers.BigNumber.from(nftRewardPoints[0].toString()))
      .div(BASE);
    const rewardPool_1 = nftRewardsAmount
      .mul(ethers.BigNumber.from(nftRewardPoints[1].toString()))
      .div(BASE);
    const rewardPool_2 = nftRewardsAmount
      .mul(ethers.BigNumber.from(nftRewardPoints[2].toString()))
      .div(BASE);

    const rewardA_0 = ethers.utils
      .parseEther('0.5')
      .mul(rewardPool_0)
      .div(ether);
    const rewardA_1 = ethers.utils.parseEther('1').mul(rewardPool_1).div(ether);
    const rewardB_2 = ethers.utils.parseEther('1').mul(rewardPool_2).div(ether);
    const rewardC_0 = ethers.utils
      .parseEther('0.5')
      .mul(rewardPool_0)
      .div(ether);

    await this.nftRewardsVault.withdraw(0, 0);
    await this.nftRewardsVault.withdraw(1, 0);
    await this.nftRewardsVault.connect(Bob).withdraw(2, 0);
    await this.nftRewardsVault.connect(Charlie).withdraw(0, 0);

    expect(await this.tdao.balanceOf(Alice.address)).to.equal(
      beforeBalanceA.add(rewardA_0).add(rewardA_1)
    );
    expect(await this.tdao.balanceOf(Bob.address)).to.equal(
      beforeBalanceB.add(rewardB_2)
    );
    expect(await this.tdao.balanceOf(Charlie.address)).to.equal(
      beforeBalanceC.add(rewardC_0)
    );
  });

  it('Should have staked one of each NFT that was not allocated', async () => {
    // NFT Cards
    // Treasury: 0=0 | 1=0 | 2=0 | 3=1 | 4=0 | 5=1 | 6=1 | 7=0
    // Proportions [8,11.5,13,14.5,16,17.5,19,0.5]
    const userInfo_0 = await this.nftRewardsVault.userInfo(0, this.lle.address);
    const userInfo_1 = await this.nftRewardsVault.userInfo(1, this.lle.address);
    const userInfo_2 = await this.nftRewardsVault.userInfo(2, this.lle.address);
    const userInfo_3 = await this.nftRewardsVault.userInfo(3, this.lle.address);
    const userInfo_4 = await this.nftRewardsVault.userInfo(4, this.lle.address);
    const userInfo_5 = await this.nftRewardsVault.userInfo(5, this.lle.address);
    const userInfo_6 = await this.nftRewardsVault.userInfo(6, this.lle.address);
    const userInfo_7 = await this.nftRewardsVault.userInfo(7, this.lle.address);

    expect(userInfo_0.amount).to.equal(0);
    expect(userInfo_1.amount).to.equal(0);
    expect(userInfo_2.amount).to.equal(0);
    expect(userInfo_3.amount).to.equal(1);
    expect(userInfo_4.amount).to.equal(1);
    expect(userInfo_5.amount).to.equal(1);
    expect(userInfo_6.amount).to.equal(1);
    expect(userInfo_7.amount).to.equal(1);
  });

  it('Should have burned all NFTs that were not claimed', async () => {
    const z = ethers.BigNumber.from('0');
    const lle = this.lle.address;
    const add = [lle, lle, lle, lle, lle, lle, lle, lle];
    const ids = [0, 1, 2, 3, 4, 5, 6, 7];
    const balance = await this.nft.balanceOfBatch(add, ids);
    expect(balance).to.eql([z, z, z, z, z, z, z, z]);
  });

  it('Should be able to claim treasury rewards', async () => {
    // NFT Cards
    // Total in Rewards 0.05 TDAO
    // Treasury: 0=0 | 1=0 | 2=0 | 3=1 | 4=1 | 5=1 | 6=1 | 7=0
    // Proportions [8,11.5,13,14.5,16,17.5,19,0.5]
    const beforeBalanceT = await this.tdao.balanceOf(Treasury.address);

    const amount = ethers.utils.parseEther('100');
    const fee = amount.div(100);
    const trigFee = ethers.BigNumber.from('5000');
    const treasuryVaultFee = ethers.BigNumber.from('9000');
    const fees = utils.calculateFees(fee, trigFee, treasuryVaultFee);
    const nftRewardsAmount = fees.nftShare;
    const BASE = 1000;

    const rewardPool_3 = nftRewardsAmount
      .mul(ethers.BigNumber.from(nftRewardPoints[3].toString()))
      .div(BASE);
    const rewardPool_4 = nftRewardsAmount
      .mul(ethers.BigNumber.from(nftRewardPoints[4].toString()))
      .div(BASE);
    const rewardPool_5 = nftRewardsAmount
      .mul(ethers.BigNumber.from(nftRewardPoints[5].toString()))
      .div(BASE);
    const rewardPool_6 = nftRewardsAmount
      .mul(ethers.BigNumber.from(nftRewardPoints[6].toString()))
      .div(BASE);
    const rewardPool_7 = nftRewardsAmount
      .mul(ethers.BigNumber.from(nftRewardPoints[7].toString()))
      .div(BASE);

    const rewardT_3 = rewardPool_3
      .mul(ethers.utils.parseEther('0.1'))
      .div(ether);
    const rewardT_4 = rewardPool_4
      .mul(ethers.utils.parseEther('0.1'))
      .div(ether);
    const rewardT_5 = rewardPool_5
      .mul(ethers.utils.parseEther('0.1'))
      .div(ether);
    const rewardT_6 = rewardPool_6
      .mul(ethers.utils.parseEther('0.1'))
      .div(ether);
    const rewardT_7 = rewardPool_7
      .mul(ethers.utils.parseEther('0.1'))
      .div(ether);

    await this.lle.claimTreasuryNFTRewards();

    expect(await this.tdao.balanceOf(Treasury.address)).to.equal(
      beforeBalanceT
        .add(rewardT_3)
        .add(rewardT_4)
        .add(rewardT_5)
        .add(rewardT_6)
        .add(rewardT_7)
    );
  });
});
