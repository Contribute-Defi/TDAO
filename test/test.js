require('dotenv').config();
const { expect } = require('chai');
const timeMachine = require('ganache-time-traveler');
const deploy = require('../scripts/deploy.js');
const utils = require('../scripts/utils.js');

let Alice;
let Bob;
let Charlie;
let alice, bob, charlie;

const startTime = process.env.START_TIME | 0;
const endTime = process.env.END_TIME | 0;
const gracePeriod = process.env.GRACE_PERIOD | 0;
const deadline = endTime + 1000000000;

const contributeAddress = '0x0DdfE92234b9DCA2de799736bBBa1D2F25CFC3b8';
const ethAddress = '0x0000000000000000000000000000000000000000';
const routerAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const factoryAddress = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
const tribAddress = '0xe09216F1d343Dd39D6Aa732a08036fee48555Af0';
const wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const tribRouterAddress = '0x2EfA929Fc3c6F0853B49D8f371220d4Ee4972175';
const balancerPair = '0xe036CCE08cf4E23D33bC6B18e53Caf532AFa8513';

const indexes = [0, 1, 2, 3, 4, 5, 6, 7];
const amounts = [10, 8, 6, 5, 4, 2, 1, 1];
const nftRewardPoints = [2, 10, 34, 84, 180, 280, 360, 50];

const ether = ethers.utils.parseEther('1');
const mintAmount = ethers.utils.parseEther('10000');

// Alice 5%, Bob 10%, Charlie 85%
const sum = ethers.utils.parseEther('60000');
const aDeposit = sum.mul(ethers.utils.parseEther('0.05')).div(ether);
const bDeposit = sum.mul(ethers.utils.parseEther('0.1')).div(ether);
const cDeposit = sum.mul(ethers.utils.parseEther('0.85')).div(ether);

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
    expect(await this.nftRewardsVault.poolLength()).to.equal(
      nftRewardPoints.length
    );
  });

  it('Should have deposited NFT in the LLE', async () => {
    const value = ethers.BigNumber.from('10');
    const balance = await this.nft.balanceOf(this.lle.address, 0);

    expect(balance).to.equal(value);
  });

  it('Should buy TRIB with ETH', async () => {
    const deposit = ethers.utils.parseEther('800');
    const tribAmount = await this.tribRouter.calcTribOut(deposit);
    let transaction = {
      to: this.tribRouter.address,
      value: deposit,
    };
    await Alice.sendTransaction(transaction);

    expect(await this.trib.balanceOf(Alice.address)).to.equal(tribAmount);
  });

  it('Should have deposited TRIB', async () => {
    await this.lle.addLiquidity(aDeposit);

    expect(await this.trib.balanceOf(this.lle.address)).to.equal(aDeposit);
  });

  it('Should have received its correct NFT share', async () => {
    expect(await this.nft.balanceOf(Alice.address, 0)).to.equal(2);
    expect(await this.nft.balanceOf(Alice.address, 1)).to.equal(1);
  });

  it('Should send Trib to other participants', async () => {
    const amount = ethers.utils.parseEther('60000');
    await this.trib.transfer(Bob.address, amount);
    await this.trib.transfer(Charlie.address, amount);

    expect(await this.trib.balanceOf(Bob.address)).to.equal(amount);
    expect(await this.trib.balanceOf(Charlie.address)).to.equal(amount);
  });

  it('Should distribute correct NFT amounts', async () => {
    const beforeBalance = ethers.utils.parseEther('60000');
    await this.lle.connect(Bob).addLiquidity(bDeposit);
    const cAmount = cDeposit.sub(ethers.utils.parseEther('50000'));
    await this.lle.connect(Charlie).addLiquidity(cAmount);

    expect(await this.trib.balanceOf(Bob.address)).to.equal(
      beforeBalance.sub(bDeposit)
    );
    expect(await this.trib.balanceOf(Charlie.address)).to.equal(
      beforeBalance.sub(cAmount)
    );
    expect(await this.nft.balanceOf(Bob.address, 0)).to.equal(2);
    expect(await this.nft.balanceOf(Bob.address, 2)).to.equal(1);
    expect(await this.nft.balanceOf(Charlie.address, 0)).to.equal(2);

    expect(await this.nft.balanceOf(this.lle.address, 0)).to.equal(4);
    expect(await this.nft.balanceOf(this.lle.address, 1)).to.equal(7);
    expect(await this.nft.balanceOf(this.lle.address, 2)).to.equal(5);
  });

  it('Should keep track of the highest depositor', async () => {
    const amount = ethers.utils.parseEther('50000');
    await this.lle.connect(Charlie).addLiquidity(amount);
    const highestDeposit = await this.lle.highestDeposit();

    expect(highestDeposit.account).to.equal(Charlie.address);
    expect(highestDeposit.amount).to.equal(amount);
    expect(await this.nft.balanceOf(Charlie.address, 5)).to.equal(1);
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
    const tdaoSupply = ethers.utils.parseEther('5000');
    const trigSupply = ethers.utils.parseEther('1000');

    expect(tribBalance).to.equal(sum);
    expect(tdaoBalance).to.equal(tdaoSupply);

    await this.lle.lockLiquidity();

    expect(await this.trib.balanceOf(this.lle.address)).to.equal(0);
    expect(await this.tdao.balanceOf(this.lle.address)).to.equal(0);
    expect(await this.trib.balanceOf(this.pair.address)).to.equal(sum);
    expect(await this.tdao.balanceOf(this.pair.address)).to.equal(tdaoSupply);

    const trigAddress = await this.lle.trig();
    this.trig = await ethers.getContractAt(
      '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
      trigAddress
    );
    const zeroAddress = '0x0000000000000000000000000000000000000000';

    expect(await this.trig.address).to.not.equal(zeroAddress);
    expect(await this.trig.balanceOf(this.lle.address)).to.equal(trigSupply);
  });

  it('Should claim TRIG and higest NFT after LLE event', async () => {
    // Total Investments:
    // Alice   : 3000  TRIB
    // Bob     : 6000  TRIB
    // Charlie : 51000 TRIB
    // Shares 0.05 | 0.10 | 0.85
    const supplyTrig = ethers.utils.parseEther('1000');
    await this.lle.claimTrig();
    await this.lle.connect(Bob).claimTrig();
    await this.lle.connect(Charlie).claimTrig();
    const aBalance = await this.trig.balanceOf(Alice.address);
    const bBalance = await this.trig.balanceOf(Bob.address);
    const cBalance = await this.trig.balanceOf(Charlie.address);
    const rate = supplyTrig.mul(ether).div(sum);

    expect(aBalance).to.equal(aDeposit.mul(rate).div(ether));
    expect(bBalance).to.equal(bDeposit.mul(rate).div(ether));
    expect(cBalance).to.equal(cDeposit.mul(rate).div(ether));
    expect(await this.nft.balanceOf(Charlie.address, 7)).to.equal(1);
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
    // Alice:   0=2 | 1=1
    // Bob:     0=2 |     | 2=1
    // Charlie: 0=1 |     |     | 5=1 | 7=1

    await this.nftRewardsVault.deposit(0, 2);
    await this.nftRewardsVault.deposit(1, 1);
    await this.nftRewardsVault.connect(Bob).deposit(0, 2);
    await this.nftRewardsVault.connect(Bob).deposit(2, 1);
    await this.nftRewardsVault.connect(Charlie).deposit(0, 1);
    await this.nftRewardsVault.connect(Charlie).deposit(5, 1);
    await this.nftRewardsVault.connect(Charlie).deposit(7, 1);

    const aUserInfo_0 = await this.nftRewardsVault.userInfo(0, Alice.address);
    const aUserInfo_1 = await this.nftRewardsVault.userInfo(1, Alice.address);
    expect(aUserInfo_0.amount).to.equal(2);
    expect(aUserInfo_1.amount).to.equal(1);

    const bUserInfo_0 = await this.nftRewardsVault.userInfo(0, Bob.address);
    const bUserInfo_2 = await this.nftRewardsVault.userInfo(2, Bob.address);
    expect(bUserInfo_0.amount).to.equal(2);
    expect(bUserInfo_2.amount).to.equal(1);

    const cUserInfo_0 = await this.nftRewardsVault.userInfo(0, Charlie.address);
    const cUserInfo_5 = await this.nftRewardsVault.userInfo(5, Charlie.address);
    const cUserInfo_7 = await this.nftRewardsVault.userInfo(7, Charlie.address);
    expect(cUserInfo_0.amount).to.equal(1);
    expect(cUserInfo_5.amount).to.equal(1);
    expect(cUserInfo_7.amount).to.equal(1);
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

  it('Should not allow user with less than 1 TDAO to call update on feeSplitter', async () => {
    await expect(this.feeSplitter.connect(Charlie).update()).to.be.revertedWith(
      'FeeSplitter: You must have at least 1 TDAO to call this function.'
    );
  });

  it('Should compensate the keeper', async () => {
    const beforeBalance = await this.tdao.balanceOf(Alice.address);
    const keeperReward = await this.feeSplitter.keeperReward();
    await this.feeSplitter.update();
    const balance = await this.tdao.balanceOf(Alice.address);
    expect(balance).to.equal(beforeBalance.add(keeperReward));
  });

  it('Should have pending rewards TDAO from TRIG rewards vault', async () => {
    // Total in Rewards
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
    // Total in Rewards
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
    // Total in Rewards 0.05 TDAO
    // Alice:   0=2 | 1=1
    // Bob:     0=2 |     | 2=1
    // Charlie: 0=1 |     |     | 5=1 | 7=1
    const amount = ethers.utils.parseEther('100');
    const fee = amount.div(100);
    const trigFee = ethers.BigNumber.from('5000');
    const treasuryVaultFee = ethers.BigNumber.from('9000');
    const fees = utils.calculateFees(fee, trigFee, treasuryVaultFee);
    const nftRewardsAmount = fees.nftShare;
    const BASE = 1000;
    let rewardPool = new Array();

    for (i in nftRewardPoints) {
      rewardPool[i] = nftRewardsAmount
        .mul(ethers.BigNumber.from(nftRewardPoints[i].toString()))
        .div(BASE);
    }

    const rewardA_0 = ethers.utils
      .parseEther('0.4')
      .mul(rewardPool[0])
      .div(ether);
    const rewardA_1 = ethers.utils
      .parseEther('1')
      .mul(rewardPool[1])
      .div(ether);
    const rewardB_0 = ethers.utils
      .parseEther('0.4')
      .mul(rewardPool[0])
      .div(ether);
    const rewardB_2 = ethers.utils
      .parseEther('1')
      .mul(rewardPool[2])
      .div(ether);
    const rewardC_0 = ethers.utils
      .parseEther('0.2')
      .mul(rewardPool[0])
      .div(ether);
    const rewardC_5 = ethers.utils
      .parseEther('1')
      .mul(rewardPool[5])
      .div(ether);
    const rewardC_7 = ethers.utils
      .parseEther('1')
      .mul(rewardPool[7])
      .div(ether);

    expect(await this.nftRewardsVault.pendingReward(0, Alice.address)).to.equal(
      rewardA_0
    );
    expect(await this.nftRewardsVault.pendingReward(1, Alice.address)).to.equal(
      rewardA_1
    );
    expect(await this.nftRewardsVault.pendingReward(0, Bob.address)).to.equal(
      rewardB_0
    );
    expect(await this.nftRewardsVault.pendingReward(2, Bob.address)).to.equal(
      rewardB_2
    );
    expect(
      await this.nftRewardsVault.pendingReward(0, Charlie.address)
    ).to.equal(rewardC_0);
    expect(
      await this.nftRewardsVault.pendingReward(5, Charlie.address)
    ).to.equal(rewardC_5);
    expect(
      await this.nftRewardsVault.pendingReward(7, Charlie.address)
    ).to.equal(rewardC_7);
  });

  it('Should have received TDAO from NFT rewards vault', async () => {
    // NFT Cards
    // Total in Rewards 0.05 TDAO
    // Alice:   0=2 | 1=1
    // Bob:     0=2 |     | 2=1
    // Charlie: 0=1 |     |     | 5=1 | 7=1
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
    let rewardPool = new Array();

    for (i in nftRewardPoints) {
      rewardPool[i] = nftRewardsAmount
        .mul(ethers.BigNumber.from(nftRewardPoints[i].toString()))
        .div(BASE);
    }

    const rewardA_0 = ethers.utils
      .parseEther('0.4')
      .mul(rewardPool[0])
      .div(ether);
    const rewardA_1 = ethers.utils
      .parseEther('1')
      .mul(rewardPool[1])
      .div(ether);
    const rewardB_0 = ethers.utils
      .parseEther('0.4')
      .mul(rewardPool[0])
      .div(ether);
    const rewardB_2 = ethers.utils
      .parseEther('1')
      .mul(rewardPool[2])
      .div(ether);
    const rewardC_0 = ethers.utils
      .parseEther('0.2')
      .mul(rewardPool[0])
      .div(ether);
    const rewardC_5 = ethers.utils
      .parseEther('1')
      .mul(rewardPool[5])
      .div(ether);
    const rewardC_7 = ethers.utils
      .parseEther('1')
      .mul(rewardPool[7])
      .div(ether);

    await this.nftRewardsVault.withdraw(0, 0);
    await this.nftRewardsVault.withdraw(1, 0);
    await this.nftRewardsVault.connect(Bob).withdraw(0, 0);
    await this.nftRewardsVault.connect(Bob).withdraw(2, 0);
    await this.nftRewardsVault.connect(Charlie).withdraw(0, 0);
    await this.nftRewardsVault.connect(Charlie).withdraw(5, 0);
    await this.nftRewardsVault.connect(Charlie).withdraw(7, 0);

    expect(await this.tdao.balanceOf(Alice.address)).to.equal(
      beforeBalanceA.add(rewardA_0).add(rewardA_1)
    );
    expect(await this.tdao.balanceOf(Bob.address)).to.equal(
      beforeBalanceB.add(rewardB_0).add(rewardB_2)
    );
    expect(await this.tdao.balanceOf(Charlie.address)).to.equal(
      beforeBalanceC.add(rewardC_0).add(rewardC_5).add(rewardC_7)
    );
  });

  it('Should have staked one of each NFT that was not allocated', async () => {
    // NFT Cards
    // Treasury: 0=0 | 1=0 | 2=0 | 3=1 | 4=1 | 5=0 | 6=1 | 7=0
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
    expect(userInfo_5.amount).to.equal(0);
    expect(userInfo_6.amount).to.equal(1);
    expect(userInfo_7.amount).to.equal(0);
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
    // Treasury: 0=0 | 1=0 | 2=0 | 3=1 | 4=1 | 5=0 | 6=1 | 7=0
    const beforeBalanceT = await this.tdao.balanceOf(Treasury.address);

    const amount = ethers.utils.parseEther('100');
    const fee = amount.div(100);
    const trigFee = ethers.BigNumber.from('5000');
    const treasuryVaultFee = ethers.BigNumber.from('9000');
    const fees = utils.calculateFees(fee, trigFee, treasuryVaultFee);
    const nftRewardsAmount = fees.nftShare;
    const BASE = 1000;
    let rewardPool = new Array();

    for (let i in nftRewardPoints) {
      rewardPool[i] = nftRewardsAmount
        .mul(ethers.BigNumber.from(nftRewardPoints[i].toString()))
        .div(BASE);
    }

    const sum = rewardPool[3].add(rewardPool[4]).add(rewardPool[6]);

    await this.lle.claimTreasuryNFTRewards();

    expect(await this.tdao.balanceOf(Treasury.address)).to.equal(
      beforeBalanceT.add(sum.mul(ethers.utils.parseEther('0.1')).div(ether))
    );
  });
});
