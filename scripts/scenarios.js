require('dotenv').config();
const hre = require('hardhat');
const ethers = hre.ethers;
const timeMachine = require('ganache-time-traveler');
const deploy = require('./deploy.js');

const startTime = process.env.START_TIME | 0;
const endTime = process.env.END_TIME | 0;
const gracePeriod = process.env.GRACE_PERIOD | 0;
const deadline = endTime + 1000000000;

function displayEth(number) {
  return ethers.utils.formatEther(number).toString();
}

module.exports = async function (_sequence) {
  console.log({ _sequence });
  switch (_sequence | 0) {
    case 0:
      await seq00();
      break;
    case 1:
      await seq01();
      break;
    case 2:
      await seq02();
      break;
    case 3:
      await seq03();
      break;
    case 4:
      await seq04();
      break;
    case 5:
      await seq05();
      break;
    default:
      console.log('Enter valid sequence. 0, 1, 2, 3 or 4');
  }
};

// before lle
async function seq00() {
  await deploy(this, 'fork');
}

// lle ongoing
async function seq01() {
  await seq00();
  await approveAll();
  await buyAndDistributeTrib();
  await startLle();
  await addLiquidity();
}

// lle ended
async function seq02() {
  await seq01();
  await endLle();
}

// Claimed TRIG
async function seq03() {
  await seq02();
  await withdraw();
}

// Staked Assets
async function seq04() {
  await seq03();
  await stakeTRIG();
  await stakeNFT();
  await generateTransferFees();
  await checkAPY();
}

// Create ETH/TDAO Uniswap pool and stake it
async function seq05() {
  await seq04();
  await addLiquidityEthTdaoPool();
  await stakeLP();
}

async function stakeLP() {
  const approval = ethers.utils.parseEther('1000000000');
  await this.ethPair.approve(this.rewardsVault.address, approval);
  const stake = await this.ethPair.balanceOf(this.alice.address);
  await this.rewardsVault.deposit(0, stake);
}

async function addLiquidityEthTdaoPool() {
  const ethPairAddress = await this.uniFactory.getPair(
    this.tdao.address,
    addresses.wethAddress
  );
  this.ethPair = await ethers.getContractAt('IUniswapV2Pair', ethPairAddress);
  const amount = (await this.tdao.balanceOf(this.alice.address)).div(3);
  const amountEth = ethers.utils.parseEther('1');
  const data = this.router.interface.encodeFunctionData('addLiquidityETH', [
    this.tdao.address,
    amount,
    0,
    0,
    this.alice.address,
    2553465600,
  ]);
  let transaction = {
    to: this.router.address,
    value: amountEth,
    data: data,
  };
  await this.alice.sendTransaction(transaction);
}

async function checkAPY() {
  const apyNFT = await this.ui.apyNft(this.alice.address, 0, false);
  console.log('APY NFT: ', displayEth(apyNFT));

  const apyTRIG = await this.ui.apyTrig(this.alice.address, 0, false, false);
  console.log('APY TRIG: ', displayEth(apyTRIG));
}

async function stakeTRIG() {
  await this.trigRewardsVault.deposit(
    0,
    await this.trig.balanceOf(this.alice.address)
  );
  await this.trigRewardsVault
    .connect(this.bob)
    .deposit(0, await this.trig.balanceOf(this.bob.address));
  await this.trigRewardsVault
    .connect(this.charlie)
    .deposit(0, await this.trig.balanceOf(this.charlie.address));
}

async function stakeNFT() {
  for (i = 0; i < 8; i++) {
    let balA = await this.nft.balanceOf(this.alice.address, i);
    let balB = await this.nft.balanceOf(this.bob.address, i);
    let balC = await this.nft.balanceOf(this.charlie.address, i);

    if (balA > 0) {
      await this.nftRewardsVault.deposit(i, balA);
    }
    if (balB > 0) {
      await this.nftRewardsVault.connect(this.bob).deposit(i, balB);
    }
    if (balC > 0) {
      await this.nftRewardsVault.connect(this.charlie).deposit(i, balC);
    }
  }
}

async function generateTransferFees() {
  await timeMachine.advanceTimeAndBlock(gracePeriod);
  await this.router.swapExactTokensForTokens(
    await this.trib.balanceOf(this.alice.address),
    0,
    [this.trib.address, this.tdao.address],
    this.alice.address,
    deadline
  );
  await this.tdao.transfer(
    this.bob.address,
    await this.tdao.balanceOf(this.alice.address)
  );
  await this.tdao
    .connect(this.bob)
    .transfer(this.alice.address, await this.tdao.balanceOf(this.bob.address));
  await this.feeSplitter.update();
}

async function startLle() {
  await timeMachine.advanceBlockAndSetTime(startTime + 1);
}

async function endLle() {
  await timeMachine.advanceBlockAndSetTime(endTime + 1);
  await this.lle.lockLiquidity();
}

async function withdraw() {
  await this.lle.claimTrig();
  await this.lle.connect(this.bob).claimTrig();
  await this.lle.connect(this.charlie).claimTrig();
}

async function endAndWithdraw() {
  await endLle();
  await withdraw();
}

async function addLiquidity() {
  const amounta = await this.trib.balanceOf(this.alice.address);
  const amountb = await this.trib.balanceOf(this.bob.address);
  const amountc = await this.trib.balanceOf(this.charlie.address);
  await this.lle.addLiquidity(amounta.div(2));
  await this.lle.connect(this.bob).addLiquidity(amountb);
  await this.lle.connect(this.charlie).addLiquidity(amountc);
  const sum = amounta.add(amountb).add(amountc);
  console.log(
    'Should have a total of ',
    displayEth(sum),
    'in LockedLiquidityEvent'
  );
}

async function buyAndDistributeTrib() {
  const deposit = ethers.utils.parseEther('800');
  const tribAmount = await this.tribRouter.calcTribOut(deposit);
  console.log(displayEth(tribAmount));
  let transaction = {
    to: this.tribRouter.address,
    value: deposit,
  };
  await this.alice.sendTransaction(transaction);
  const half = tribAmount.div(2);
  await this.trib.transfer(this.bob.address, half);
  await this.trib.transfer(this.charlie.address, half.div(2));
}

async function approveAll() {
  const routerAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
  const approval = ethers.utils.parseEther('10000000000');

  await this.trib.approve(this.lle.address, approval);
  await this.trib.connect(this.bob).approve(this.lle.address, approval);
  await this.trib.connect(this.charlie).approve(this.lle.address, approval);

  await this.trib.approve(routerAddress, approval);
  await this.trib.connect(this.bob).approve(routerAddress, approval);
  await this.trib.connect(this.charlie).approve(routerAddress, approval);

  await this.trib.approve(this.pair.address, approval);
  await this.trib.connect(this.bob).approve(this.pair.address, approval);
  await this.trib.connect(this.charlie).approve(this.pair.address, approval);

  await this.tdao.approve(routerAddress, approval);
  await this.tdao.connect(this.bob).approve(routerAddress, approval);
  await this.tdao.connect(this.charlie).approve(routerAddress, approval);

  await this.tdao.approve(this.pair.address, approval);
  await this.tdao.connect(this.bob).approve(this.pair.address, approval);
  await this.tdao.connect(this.charlie).approve(this.pair.address, approval);

  await this.trig.approve(this.trigRewardsVault.address, approval);
  await this.trig
    .connect(this.bob)
    .approve(this.trigRewardsVault.address, approval);
  await this.trig
    .connect(this.charlie)
    .approve(this.trigRewardsVault.address, approval);

  await this.nft.setApprovalForAll(this.nftRewardsVault.address, true);
  await this.nft
    .connect(this.bob)
    .setApprovalForAll(this.nftRewardsVault.address, true);
  await this.nft
    .connect(this.charlie)
    .setApprovalForAll(this.nftRewardsVault.address, true);
}
