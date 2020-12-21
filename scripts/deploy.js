require('dotenv').config();
const fs = require('fs');
const hre = require('hardhat');
const ethers = hre.ethers;
const provider = hre.ethers.provider;

const startTime = process.env.START_TIME | 0;
const endTime = process.env.END_TIME | 0;
const shortDelay = 1800; // 30 minutes
const longDelay = 172800; // 2 days
const nftRewardPoints = [2, 10, 34, 84, 180, 280, 360, 50];

let overrides = {
  gasLimit: 5000000,
  gasPrice: ethers.utils.parseUnits('100.0', 'gwei'),
};

module.exports = async (root, network) => {
  addresses = {
    routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    factoryAddress: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    ethAddress: '0x0000000000000000000000000000000000000000',
    wethAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  };
  if (network == 'mainnet' || network == 'fork') {
    addresses.contributeAddress = '0x0DdfE92234b9DCA2de799736bBBa1D2F25CFC3b8';
    addresses.tribAddress = '0xe09216F1d343Dd39D6Aa732a08036fee48555Af0';
    addresses.tribRouterAddress = '0x2EfA929Fc3c6F0853B49D8f371220d4Ee4972175';
    addresses.balancerPairAddress =
      '0xe036CCE08cf4E23D33bC6B18e53Caf532AFa8513';
  } else if (network == 'kovan') {
    addresses.contributeAddress = '0x54550d389a284f8812526C23809F143193BbF6F3';
    addresses.tribAddress = '0x40F54030D321afA3c626D41F04a6e80B149bDaf7';
  }

  await setup(root, addresses, network);
};

async function setup(root, addresses, network) {
  root.signers = await ethers.getSigners();
  root.alice = root.signers[0];
  root.bob = root.signers[1];
  root.charlie = root.signers[2];
  root.treasury = root.signers[3];

  const deployer = root.alice.address;

  root.trib = await ethers.getContractAt(
    '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
    addresses.tribAddress
  );

  root.router = await ethers.getContractAt(
    'IUniswapV2Router02',
    addresses.routerAddress
  );

  root.uniFactory = await ethers.getContractAt(
    'IUniswapV2Factory',
    addresses.factoryAddress
  );

  const NFT = await ethers.getContractFactory('NFT');
  root.nft = await NFT.deploy(
    'ipfs://ipfs/QmUnZcWBcjpcxGTKtR6N4x9EZ4RKvjea4MJRU1k1hA8rru/{id}.json'
  );
  await root.nft.deployed();

  const TDao = await ethers.getContractFactory('TDAO');
  root.tdao = await TDao.deploy('Contribure DAO', 'TDAO');
  await root.tdao.deployed();

  const LLE = await ethers.getContractFactory('LockedLiquidityEvent');
  root.lle = await LLE.deploy(
    addresses.routerAddress,
    addresses.factoryAddress,
    root.tdao.address,
    addresses.tribAddress,
    root.nft.address,
    startTime,
    endTime
  );
  await root.lle.deployed();

  await root.tdao.setLockedLiquidityEvent(root.lle.address);

  if (network != 'kovan') {
    root.tribRouter = await ethers.getContractAt(
      'TribRouter',
      addresses.tribRouterAddress
    );

    const TRouterLLE = await ethers.getContractFactory('TribRouterLLE');

    root.routerLLE = await TRouterLLE.deploy(
      addresses.balancerPairAddress,
      addresses.contributeAddress,
      root.tdao.address
    );
    await root.routerLLE.deployed();
  }

  const GuardianTimelock = await ethers.getContractFactory('GuardianTimelock');
  root.guardianTL = await GuardianTimelock.deploy(deployer, shortDelay);
  await root.guardianTL.deployed();

  const Guardian = await ethers.getContractFactory('Guardian');
  root.guardian = await Guardian.deploy(
    root.guardianTL.address,
    root.tdao.address,
    deployer
  );
  await root.guardian.deployed();

  let tx = await root.guardianTL.setPendingAdmin(root.guardian.address);
  await tx.wait(1);
  tx = await root.guardian.__acceptAdmin();
  await tx.wait(1);
  await root.guardian.__abdicate();

  const GovernorTimelock = await ethers.getContractFactory('GovernorTimelock');
  root.governorTL = await GovernorTimelock.deploy(deployer, longDelay);
  await root.governorTL.deployed();

  const Governor = await ethers.getContractFactory('Governor');
  root.governor = await Governor.deploy(
    root.governorTL.address,
    root.tdao.address,
    deployer
  );
  await root.governor.deployed();

  tx = await root.governorTL.setPendingAdmin(root.governor.address);
  await tx.wait(1);
  tx = await root.governor.__acceptAdmin();
  await tx.wait(1);
  await root.governor.__transferGuardianship(root.guardianTL.address);

  const trigAddress = await root.lle.trig();
  root.trig = await ethers.getContractAt('TRIG', trigAddress);

  // Deposit NFTs into LLE.
  const indexes = [0, 1, 2, 3, 4, 5, 6, 7];
  const amounts = [10, 8, 6, 5, 4, 2, 1, 1];
  await root.nft.safeBatchTransferFrom(
    deployer,
    root.lle.address,
    indexes,
    amounts,
    ethers.utils.hexZeroPad('0x0', 32)
  );

  const pairAddress = await root.lle.tokenUniswapPair();
  root.pair = await ethers.getContractAt('IUniswapV2Pair', pairAddress);

  // Deploy NFT Rewards, add reward pools and renownce ownership.
  const NFTRewardsVault = await ethers.getContractFactory('NFTRewardsVault');
  root.nftRewardsVault = await NFTRewardsVault.deploy(root.tdao.address);
  await root.nftRewardsVault.deployed();

  for (let i in nftRewardPoints) {
    await root.nftRewardsVault.add(
      nftRewardPoints[i],
      root.nft.address,
      i,
      false
    );
  }

  await root.nftRewardsVault.renounceOwnership();

  // Deploy Trig Rewards, add reward pool and renownce ownership.
  const TrigRewardsVault = await ethers.getContractFactory('TrigRewardsVault');
  root.trigRewardsVault = await TrigRewardsVault.deploy(root.tdao.address);
  await root.trigRewardsVault.deployed();
  await root.trigRewardsVault.add(1, root.trig.address, false);
  await root.trigRewardsVault.renounceOwnership();

  const RewardsVault = await ethers.getContractFactory('RewardsVault');
  root.rewardsVault = await RewardsVault.deploy(root.tdao.address);
  await root.rewardsVault.deployed();

  const TreasuryVault = await ethers.getContractFactory('TreasuryVault');
  root.treasuryVault = await TreasuryVault.deploy(
    root.tdao.address,
    root.rewardsVault.address,
    root.treasury.address
  );
  await root.treasuryVault.deployed();

  const FeeSplitter = await ethers.getContractFactory('FeeSplitter');
  root.feeSplitter = await FeeSplitter.deploy(
    root.tdao.address,
    root.trigRewardsVault.address,
    root.nftRewardsVault.address,
    root.treasuryVault.address
  );
  await root.feeSplitter.deployed();

  const FeeController = await ethers.getContractFactory('FeeController');
  root.feeController = await FeeController.deploy(
    root.tdao.address,
    addresses.tribAddress,
    addresses.factoryAddress,
    root.feeSplitter.address
  );
  await root.feeController.deployed();

  await root.uniFactory.createPair(root.tdao.address, addresses.wethAddress);
  const lpPair = await root.feeController.pairWETH();
  await root.rewardsVault.add(1, lpPair, false);

  await root.tdao.setDependencies(
    root.feeController.address,
    root.feeSplitter.address,
    root.governorTL.address
  );

  const UIView = await ethers.getContractFactory('UIView');
  root.ui = await UIView.deploy(
    addresses.contributeAddress,
    root.tdao.address,
    root.feeSplitter.address
  );
  await root.ui.deployed();

  await approveAll(root, addresses);

  let contracts;

  if (network == 'mainnet' || network == 'fork') {
    contracts = {
      NFT: root.nft.address,
      TRouterLLE: root.routerLLE.address,
      TribRouter: root.tribRouter.address,
      TDAO: root.tdao.address,
      TRIG: root.trig.address,
      GuardianTimelock: root.guardianTL.address,
      Guardian: root.guardian.address,
      GovernorTimelock: root.governorTL.address,
      Governor: root.governor.address,
      LockedLiquidityEvent: root.lle.address,
      IUniswapV2Pair: root.pair.address,
      NFTRewardsVault: root.nftRewardsVault.address,
      TrigRewardsVault: root.trigRewardsVault.address,
      RewardsVault: root.rewardsVault.address,
      TreasuryVault: root.treasuryVault.address,
      FeeSplitter: root.feeSplitter.address,
      FeeController: root.feeController.address,
      Treasury: root.treasury.address,
      UIView: root.ui.address,
    };
  } else if (network == 'kovan') {
    contracts = {
      NFT: root.nft.address,
      TDAO: root.tdao.address,
      TRIG: root.trig.address,
      GuardianTimelock: root.guardianTL.address,
      Guardian: root.guardian.address,
      GovernorTimelock: root.governorTL.address,
      Governor: root.governor.address,
      LockedLiquidityEvent: root.lle.address,
      IUniswapV2Pair: root.pair.address,
      NFTRewardsVault: root.nftRewardsVault.address,
      TrigRewardsVault: root.trigRewardsVault.address,
      RewardsVault: root.rewardsVault.address,
      TreasuryVault: root.treasuryVault.address,
      FeeSplitter: root.feeSplitter.address,
      FeeController: root.feeController.address,
      Treasury: root.treasury.address,
      UIView: root.ui.address,
    };
  }

  fs.writeFileSync(
    `./output/${network}.json`,
    JSON.stringify(contracts, null, 2),
    function (err) {
      if (err) throw err;
    }
  );

  async function approveAll(root, addresses) {
    const approval = ethers.utils.parseEther('10000000000');

    await root.trib.approve(root.lle.address, approval);
    await root.trib.connect(root.bob).approve(root.lle.address, approval);
    await root.trib.connect(root.charlie).approve(root.lle.address, approval);

    await root.trib.approve(addresses.routerAddress, approval);
    await root.trib
      .connect(root.bob)
      .approve(addresses.routerAddress, approval);
    await root.trib
      .connect(root.charlie)
      .approve(addresses.routerAddress, approval);

    await root.trib.approve(root.pair.address, approval);
    await root.trib.connect(root.bob).approve(root.pair.address, approval);
    await root.trib.connect(root.charlie).approve(root.pair.address, approval);

    await root.tdao.approve(addresses.routerAddress, approval);
    await root.tdao
      .connect(root.bob)
      .approve(addresses.routerAddress, approval);
    await root.tdao
      .connect(root.charlie)
      .approve(addresses.routerAddress, approval);

    await root.tdao.approve(root.pair.address, approval);
    await root.tdao.connect(root.bob).approve(root.pair.address, approval);
    await root.tdao.connect(root.charlie).approve(root.pair.address, approval);

    await root.nft.setApprovalForAll(root.nftRewardsVault.address, true);
    await root.nft
      .connect(root.bob)
      .setApprovalForAll(root.nftRewardsVault.address, true);
    await root.nft
      .connect(root.charlie)
      .setApprovalForAll(root.nftRewardsVault.address, true);
  }
}
