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

  const NFT = await ethers.getContractFactory('NFTMock');
  nft = await NFT.deploy('http://nft');
  await nft.deployed();

  const ERC20 = await ethers.getContractFactory('ERC20Mock');
  tdao = await ERC20.deploy('Contribute DAO', 'TDAO');
  await tdao.deployed();

  const Vault = await ethers.getContractFactory('NFTRewardsVault');
  vault = await Vault.deploy(tdao.address);
  await vault.deployed();
};

async function approveAll() {
  const approval = ethers.utils.parseEther('10000000000');
  await nft.setApprovalForAll(vault.address, true);
  await nft.connect(Bob).setApprovalForAll(vault.address, true);
  await nft.connect(Charlie).setApprovalForAll(vault.address, true);
}

async function transferNFT() {
  await nft.safeTransferFrom(
    Alice.address,
    Bob.address,
    0,
    1,
    ethers.constants.AddressZero
  );
  await nft.safeTransferFrom(
    Alice.address,
    Bob.address,
    1,
    2,
    ethers.constants.AddressZero
  );
  await nft.safeTransferFrom(
    Alice.address,
    Bob.address,
    2,
    1,
    ethers.constants.AddressZero
  );

  await nft.safeTransferFrom(
    Alice.address,
    Charlie.address,
    0,
    1,
    ethers.constants.AddressZero
  );
  await nft.safeTransferFrom(
    Alice.address,
    Charlie.address,
    1,
    2,
    ethers.constants.AddressZero
  );
  await nft.safeTransferFrom(
    Alice.address,
    Charlie.address,
    2,
    1,
    ethers.constants.AddressZero
  );
}

describe('Testing NFT and rewards functionality', async () => {
  before(async () => {
    let snapshot = await timeMachine.takeSnapshot();
    snapshotId = snapshot['result'];
    await deployment();
    await approveAll();
  });

  it('Should have minted NFTs', async () => {
    const balance = ethers.BigNumber.from('10');
    expect(await nft.balanceOf(Alice.address, 0)).to.equal(balance);
  });

  it('Should be able to transfer NFTs', async () => {
    await nft.safeTransferFrom(
      Alice.address,
      Bob.address,
      0,
      1,
      ethers.constants.AddressZero
    );
    await nft.safeTransferFrom(
      Alice.address,
      Bob.address,
      1,
      2,
      ethers.constants.AddressZero
    );
    await nft.safeTransferFrom(
      Alice.address,
      Bob.address,
      2,
      1,
      ethers.constants.AddressZero
    );

    await nft.safeTransferFrom(
      Alice.address,
      Charlie.address,
      0,
      1,
      ethers.constants.AddressZero
    );
    await nft.safeTransferFrom(
      Alice.address,
      Charlie.address,
      1,
      2,
      ethers.constants.AddressZero
    );
    await nft.safeTransferFrom(
      Alice.address,
      Charlie.address,
      2,
      1,
      ethers.constants.AddressZero
    );

    expect(await nft.balanceOf(Bob.address, 0)).to.equal(1);
    expect(await nft.balanceOf(Bob.address, 1)).to.equal(2);
    expect(await nft.balanceOf(Bob.address, 2)).to.equal(1);

    expect(await nft.balanceOf(Charlie.address, 0)).to.equal(1);
    expect(await nft.balanceOf(Charlie.address, 1)).to.equal(2);
    expect(await nft.balanceOf(Charlie.address, 2)).to.equal(1);
  });

  it('Should add and stake to the NFT pool', async () => {
    await vault.add(1, nft.address, 0, false);

    // Everytime there is a transfer from TDAO it will update the pool.
    await tdao.transfer(vault.address, ethers.utils.parseEther('100'));
    await vault.update(0);

    await vault.deposit(0, 1);

    expect(await nft.balanceOf(vault.address, 0)).to.equal(1);
  });

  it('Should have pending rewards', async () => {
    await vault.massUpdatePools();

    expect(await vault.pendingReward(0, Alice.address)).to.equal(
      ethers.utils.parseEther('100')
    );
  });

  it('Should withdraw pending rewards on deposit', async () => {
    const pendingReward = await vault.pendingReward(0, Alice.address);
    expect(pendingReward).to.equal(ethers.utils.parseEther('100'));
    const beforeBalance = await tdao.balanceOf(Alice.address);
    await vault.deposit(0, 1);
    expect(await tdao.balanceOf(Alice.address)).to.equal(
      beforeBalance.add(pendingReward)
    );
  });

  it('Should allocate reward participants pro rata.', async () => {
    await vault.connect(Bob).deposit(0, 1);
    await vault.connect(Charlie).deposit(0, 1);
    await tdao.transfer(vault.address, ethers.utils.parseEther('120'));
    await vault.update(0);
    await vault.massUpdatePools();
    // Alice 100 - Bob 50 - Chalie 50 (50%, 25%, 25%)
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
    const beforeBalance = await nft.balanceOf(Alice.address, 0);
    await vault.withdraw(0, 1);
    await vault.connect(Bob).withdraw(0, 0); // Withdraws zero to collect rewards
    await vault.connect(Charlie).withdraw(0, 0); // Withdraws zero to collect rewards
    expect(await nft.balanceOf(Alice.address, 0)).to.equal(
      beforeBalance.add('1')
    );
  });

  it('Should add another pool and change points.', async () => {
    await vault.add(50, nft.address, 1, true);
    await vault.set(0, 50, true);
    await vault.deposit(1, 1);
    await vault.connect(Bob).deposit(1, 1);
    await vault.connect(Charlie).deposit(1, 1);
    // Alice, Bob and Charlie all have 50 deposit on both pools. Each pool should get 50% of the total rewards
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

  it('Should not be able to add the same NFT pool.', async () => {
    await expect(vault.add(50, nft.address, 1, true)).to.be.revertedWith(
      'NFTRewardsVault: Token pool already added.'
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
    const balanceBefore = await nft.balanceOf(Bob.address, 1);
    await vault.connect(Bob).emergencyWithdraw(1);
    expect(await nft.balanceOf(Bob.address, 1)).to.equal(balanceBefore.add(1));
  });
});
