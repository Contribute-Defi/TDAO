// const { readArtifact } = require("@nomiclabs/buidler/plugins");
require('dotenv').config();
const { expect } = require('chai');
const timeMachine = require('ganache-time-traveler');

let Alice;
let Bob;
let Charlie;
let alice, bob, charlie;
let ethAddress,
  routerAddress,
  factoryAddress,
  tribAddress,
  wethAddress,
  tribRouterAddress;
let weth,
  router,
  factory,
  tdao,
  liquidityPool,
  pair,
  trib,
  timeDeployed,
  feeController,
  vault,
  vaultProxy,
  stakingRewards,
  tribRouter;
let snapshotID;

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

  const ERC20 = await ethers.getContractFactory('ERC20Mock');
  tdao = await ERC20.deploy('Contribute Dao', 'TDAO');
  await tdao.deployed();

  trig = await ERC20.deploy('Contribute Rig', 'Trig');
  await trig.deployed();

  trib = await ERC20.deploy('Contribute', 'Trib');
  await trib.deployed();

  const Vault = await ethers.getContractFactory('TrigRewardsVault');
  vault = await Vault.deploy(tdao.address);
  await vault.deployed();
};

async function approveAll() {
  const approval = ethers.utils.parseEther('10000000000');
  await trig.approve(vault.address, approval);
  await trig.connect(Bob).approve(vault.address, approval);
  await trig.connect(Charlie).approve(vault.address, approval);
  await trib.approve(vault.address, approval);
  await trib.connect(Bob).approve(vault.address, approval);
  await trib.connect(Charlie).approve(vault.address, approval);
}

async function transferTokens() {
  const amount = ethers.utils.parseEther('100');
  await trig.transfer(Bob.address, amount);
  await trig.transfer(Charlie.address, amount);
  await trib.transfer(Bob.address, amount);
  await trib.transfer(Charlie.address, amount);
}

describe('Testing reward functionality with TRIG', async () => {
  before(async () => {
    let snapshot = await timeMachine.takeSnapshot();
    snapshotId = snapshot['result'];
    await deployment();
    await approveAll();
    await transferTokens();
  });

  it('Should have minted TRIG', async () => {
    const balance = ethers.utils.parseEther('100');
    expect(await trig.balanceOf(Bob.address)).to.equal(balance);
    expect(await trig.balanceOf(Charlie.address)).to.equal(balance);
  });

  it('Should add and stake to the pool', async () => {
    await vault.add(100, trig.address, false);
    await tdao.transfer(vault.address, ethers.utils.parseEther('100'));
    await vault.update(0);
    const amount = ethers.utils.parseEther('100');
    await vault.deposit(0, amount);
    expect(await trig.balanceOf(vault.address)).to.equal(amount);
  });

  it('Should have pending rewards', async () => {
    await vault.massUpdatePools();
    expect(await vault.pendingReward(0, Alice.address)).to.equal(
      ethers.utils.parseEther('100')
    );
  });

  it('Should withdraw pending rewards on deposit', async () => {
    const amount = ethers.utils.parseEther('100');
    const pendingReward = await vault.pendingReward(0, Alice.address);
    expect(pendingReward).to.equal(amount);
    const beforeBalance = await tdao.balanceOf(Alice.address);
    await vault.deposit(0, amount);
    expect(await tdao.balanceOf(Alice.address)).to.equal(
      beforeBalance.add(pendingReward)
    );
  });

  it('Should allocate reward participants pro rata.', async () => {
    const amount = ethers.utils.parseEther('100');
    await vault.connect(Bob).deposit(0, amount);
    await vault.connect(Charlie).deposit(0, amount);
    await tdao.transfer(vault.address, ethers.utils.parseEther('120'));
    await vault.update(0);
    await vault.massUpdatePools();
    // Alice 200 - Bob 100 - Chalie 100 (50%, 25%, 25%)
    // Reward => 120 Expect (60, 30, 30)
    expect(await vault.pendingReward(0, Alice.address)).to.equal(
      ethers.utils.parseEther('60')
    );
    expect(await vault.pendingReward(0, Bob.address)).to.equal(
      ethers.utils.parseEther('30')
    );
    expect(await vault.pendingReward(0, Charlie.address)).to.equal(
      ethers.utils.parseEther('30')
    );
  });

  it('Should be able to withdraw stake.', async () => {
    const amount = ethers.utils.parseEther('100');
    const beforeBalance = await trig.balanceOf(Alice.address);
    await vault.withdraw(0, amount);
    await vault.connect(Bob).withdraw(0, 0); // Withdraws zero to collect rewards
    await vault.connect(Charlie).withdraw(0, 0); // Withdraws zero to collect rewards
    expect(await trig.balanceOf(Alice.address)).to.equal(
      beforeBalance.add(amount)
    );
  });

  it('Should add another pool and change points.', async () => {
    await vault.add(50, trib.address, true);
    await vault.set(0, 50, true);
    const amount = ethers.utils.parseEther('100');
    await vault.deposit(1, amount);
    await vault.connect(Bob).deposit(1, amount);
    await vault.connect(Charlie).deposit(1, amount);
    // Alice, Bob and Charlie all have 100 deposit on both pools. Each pool should get 50% of the total rewards
    // and each of them should get 1/3 of the reward on each pool.
    await tdao.transfer(vault.address, ethers.utils.parseEther('180'));
    await vault.update(0);
    await vault.massUpdatePools();
    // Reward => 180 Expect pool 0 and pool 1 to have (30, 30, 30)
    expect(await vault.pendingReward(0, Alice.address)).to.equal(
      ethers.utils.parseEther('30')
    );
    expect(await vault.pendingReward(0, Bob.address)).to.equal(
      ethers.utils.parseEther('30')
    );
    expect(await vault.pendingReward(0, Charlie.address)).to.equal(
      ethers.utils.parseEther('30')
    );
    expect(await vault.pendingReward(1, Alice.address)).to.equal(
      ethers.utils.parseEther('30')
    );
    expect(await vault.pendingReward(1, Bob.address)).to.equal(
      ethers.utils.parseEther('30')
    );
    expect(await vault.pendingReward(1, Charlie.address)).to.equal(
      ethers.utils.parseEther('30')
    );
  });

  it('Should not be able to add the same pool.', async () => {
    await expect(vault.add(50, trib.address, true)).to.be.revertedWith(
      'TrigRewardsVault: Token pool already added.'
    );
  });

  it('Should calculate the average fees per block total.', async () => {
    const initialBlock = await vault.initialBlock();
    const totalCumulativeRewards = await vault.totalCumulativeRewards();
    const currentBlock = await ethers.provider.getBlockNumber();
    const totalBlocks = currentBlock - initialBlock;
    const total = ethers.BigNumber.from(totalBlocks.toString());
    expect(await vault.avgFeesPerBlockTotal()).to.equal(
      totalCumulativeRewards.div(total)
    );
  });

  it('Should return the correct pool length.', async () => {
    expect(await vault.poolLength()).to.equal(2);
  });

  it('Should be able to emergency withdraw.', async () => {
    const amount = ethers.utils.parseEther('100');
    const balanceBefore = await trib.balanceOf(Bob.address);
    await vault.connect(Bob).emergencyWithdraw(1);
    expect(await trib.balanceOf(Bob.address)).to.equal(
      balanceBefore.add(amount)
    );
  });
});
