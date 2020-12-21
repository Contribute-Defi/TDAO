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
    const amount = ethers.utils.parseEther('200');
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

  it('Should not be able to make a proposal', async () => {
    let abi = ['function setTrigFee(uint256 _trigFee) external'];
    let iface = new ethers.utils.Interface(abi);
    let data = ethers.utils.defaultAbiCoder.encode(['uint'], [6000]);
    const balancePair = await this.tdao.balanceOf(this.pair.address);
    await expect(
      this.governor.propose(
        [this.tdao.address],
        [0],
        ['setTrigFee'],
        [data],
        'Changing the TRIG Fee share to 60%.'
      )
    ).to.be.revertedWith(
      'Governor::gracePeriodCheck: Minimum amount of tokens in circulation has not been met'
    );
  });

  it('Should be able to create a proposal', async () => {
    const amount = ethers.utils.parseEther('2000');
    await this.router.swapExactTokensForTokens(
      amount,
      1,
      [this.trib.address, this.tdao.address],
      Alice.address,
      deadline
    );
    await this.tdao.delegate(Alice.address);
    let data = ethers.utils.defaultAbiCoder.encode(['uint'], [6000]);
    // let abi = ["function setTrigFee(uint256 _trigFee) external"];
    // let iface = new ethers.utils.Interface(abi);
    // iface.encodeFunctionData("setTrigFee", [ethers.BigNumber.from("6000")]);
    // console.log(data);
    await this.governor.propose(
      [this.tdao.address],
      [0],
      ['setTrigFee(uint256)'],
      [data],
      'Changing the TRIG Fee share to 60%.'
    );
    expect(await this.governor.proposalCount()).to.equal(1);
  });

  it('Should not roll back initial conditions', async () => {
    const amount = ethers.utils.parseEther('3000');
    await this.router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
      amount,
      1,
      [this.tdao.address, this.trib.address],
      Alice.address,
      deadline
    );

    let data = ethers.utils.defaultAbiCoder.encode(['uint'], [6000]);
    await expect(
      this.governor.propose(
        [this.tdao.address],
        [0],
        ['setTrigFee(uint256)'],
        [data],
        'Changing the TRIG Fee share to 60%.'
      )
    ).to.be.revertedWith(
      'Governor::propose: one live proposal per proposer, found an already active proposal'
    );
  });

  it('Should allow users to vote', async () => {
    await timeMachine.advanceBlock();
    const balance = await this.tdao.balanceOf(Alice.address);
    await this.governor.castVote(1, true);
    const proposal = await this.governor.proposals(1);
    expect(proposal.forVotes).to.equal(balance);
  });

  it('Should propose to cancel the vote', async () => {
    const amount = ethers.utils.parseEther('2000');
    await this.router.swapExactTokensForTokens(
      amount,
      1,
      [this.trib.address, this.tdao.address],
      Alice.address,
      deadline
    );

    let data = ethers.utils.defaultAbiCoder.encode(['uint'], [1]);
    await this.guardian.propose(
      [this.governor.address],
      [0],
      ['cancel(uint256)'],
      [data],
      'Cancel proposal 1.'
    );
    expect(await this.guardian.proposalCount()).to.equal(1);
  });

  it('Should successfully vote', async () => {
    await timeMachine.advanceBlock();
    const balance = await this.tdao.balanceOf(Alice.address);
    await this.guardian.castVote(1, true);
    const proposal = await this.guardian.proposals(1);
    expect(proposal.forVotes).to.equal(balance);
  });

  it('Should conclude voting', async () => {
    await advanceBlocks(votingPeriod);
    const stateGovernorProposal = await this.governor.state(1);
    expect(stateGovernorProposal).to.equal(4);
    const stateGuardianProposal = await this.guardian.state(1);
    expect(stateGuardianProposal).to.equal(4);
  });

  it('Should queue the cancel proposal', async () => {
    await this.guardian.queue(1);
    const stateGuardianProposal = await this.guardian.state(1);
    expect(stateGuardianProposal).to.equal(5);
  });

  it('Should execute the proposal', async () => {
    await timeMachine.advanceTimeAndBlock(delay);
    await this.guardian.execute(1);
    expect(await this.governor.state(1)).to.equal(2);
  });

  it('Should create a second proposal', async () => {
    await timeMachine.advanceBlock();
    let data = ethers.utils.defaultAbiCoder.encode(['uint'], [6000]);
    await this.governor.propose(
      [this.tdao.address],
      [0],
      ['setTrigFee(uint256)'],
      [data],
      'Changing the TRIG Fee share to 60%.'
    );
    expect(await this.governor.proposalCount()).to.equal(2);
  });

  it('Should create, vote and approve a second proposal', async () => {
    await timeMachine.advanceBlock();
    await this.governor.castVote(2, true);
    await advanceBlocks(votingPeriod);
    expect(await this.governor.state(2)).to.equal(4);
  });

  it('Should queue and execute the second proposal', async () => {
    await this.governor.queue(2);
    const stateGovernorProposal = await this.governor.state(2);
    expect(stateGovernorProposal).to.equal(5);
    await timeMachine.advanceTimeAndBlock(longDelay);
    await this.governor.execute(2);
    const trigFee = await this.feeSplitter.trigFee();
    expect(trigFee).to.equal(6000);
  });

  it('Should delegate all its votes', async () => {
    const balanceA = await this.tdao.balanceOf(Alice.address);
    await this.tdao.delegate(Bob.address);
    await this.tdao.connect(Bob).delegate(Bob.address);
    await this.tdao.connect(Charlie).delegate(Charlie.address);
    await timeMachine.advanceBlock();
    const currentVotesA = await this.tdao.getCurrentVotes(Alice.address);
    const currentVotesB = await this.tdao.getCurrentVotes(Bob.address);
    expect(currentVotesA).to.equal(0);
    expect(currentVotesB).to.equal(balanceA);
  });

  it('Should delegate its votes on transfer', async () => {
    const balanceA = await this.tdao.balanceOf(Alice.address);
    await this.tdao.transfer(Bob.address, balanceA);
    const currentVotesB = await this.tdao.getCurrentVotes(Bob.address);
    expect(currentVotesB.div(10)).to.equal(balanceA.mul(99).div(1000));
    const balanceB = await this.tdao.balanceOf(Bob.address);
    await this.tdao.connect(Bob).transfer(Charlie.address, balanceB);
    const currentVotesC = await this.tdao.getCurrentVotes(Charlie.address);
    expect(currentVotesC.div(10)).to.equal(balanceB.mul(99).div(1000));
  });

  it('Should be able to get prior votes', async () => {
    const block = await ethers.provider.getBlockNumber();
    const priorVotes = await this.tdao.getPriorVotes(
      Charlie.address,
      block - 10
    );
    expect(priorVotes).to.equal(0);
  });

  it('Should be able claim ERC20 tokens from contract', async () => {
    await this.tdao.connect(Charlie).delegate(Alice.address);
    const votes = await this.tdao.getCurrentVotes(Alice.address);
    const amount = ethers.utils.parseEther('25');
    await this.trib.transfer(this.tdao.address, amount);
    expect(await this.trib.balanceOf(this.tdao.address)).to.equal(amount);
    let data = ethers.utils.defaultAbiCoder.encode(
      ['address', 'address'],
      [this.trib.address, Charlie.address]
    );
    await this.governor.propose(
      [this.tdao.address],
      [0],
      ['claimERC20(address,address)'],
      [data],
      'ERC20 collection'
    );
    await timeMachine.advanceBlock();
    await this.governor.castVote(3, true);
    await advanceBlocks(votingPeriod);
    await this.governor.queue(3);
    await timeMachine.advanceTimeAndBlock(longDelay);
    await this.governor.execute(3);
    expect(await this.trib.balanceOf(Charlie.address)).to.equal(amount);
  });
});
