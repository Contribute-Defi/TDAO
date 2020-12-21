// SPDX-License-Identifier: MIT
pragma solidity >=0.5.16 <0.7.0;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';

import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import '../libraries/UniswapV2Library.sol';

import '../LockedLiquidityEvent.sol';
import '../TDAO.sol';
import '../interfaces/IContribute.sol';
import '../FeeSplitter.sol';
import '../TreasuryVault.sol';
import '../farms/ERC20Farm.sol';
import '../farms/ERC1155Farm.sol';

import 'hardhat/console.sol';

contract UIView {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  IContribute public contribute;
  TDAO public tdao;
  IERC20 public trib;
  LockedLiquidityEvent public lle;
  FeeSplitter public feeSplitter;
  ERC1155Farm public nftRewardsVault;
  ERC20Farm public trigRewardsVault;
  TreasuryVault public treasuryVault;
  ERC20Farm public rewardsVault;

  uint256 private precision = 1 ether;
  uint256 private _year = 365 days;

  constructor(
    address _contribute,
    address _tdao,
    address _feeSplitter
  ) public {
    contribute = IContribute(_contribute);
    trib = IERC20(contribute.token());
    tdao = TDAO(_tdao);
    feeSplitter = FeeSplitter(_feeSplitter);
    lle = LockedLiquidityEvent(tdao.lockedLiquidityEvent());
    nftRewardsVault = ERC1155Farm(feeSplitter.nftRewardsVault());
    trigRewardsVault = ERC20Farm(feeSplitter.trigRewardsVault());
    treasuryVault = TreasuryVault(feeSplitter.treasuryVault());
    rewardsVault = ERC20Farm(treasuryVault.rewardsVault());
  }

  function timeRemaining() external view returns (uint256) {
    return lle.timeRemaining();
  }

  function isEventOngoing() external view returns (bool) {
    return lle.ongoing();
  }

  function eventStartTime() external view returns (uint256) {
    return lle.startTime();
  }

  function eventEndTime() external view returns (uint256) {
    return lle.endTime();
  }

  function startTradingTime() external view returns (uint256) {
    return lle.startTradingTime();
  }

  function tribContributed() public view returns (uint256) {
    return lle.totalContributed();
  }

  function tribContributedUSD() public view returns (uint256) {
    return lle.totalContributed().mul(tribPriceUSD()).div(precision);
  }

  function tribPriceUSD() public view returns (uint256 price) {
    price = trib.totalSupply().div(1000000);
  }

  function tdaoPriceTRIB(bool useUniswap) public view returns (uint256) {
    uint256 tdaoSupply = 5000 ether;
    uint256 _price =
      useUniswap
        ? _tdaoUniswapPrice()
        : tribContributed().mul(precision).div(tdaoSupply);
    return _price;
  }

  function tdaoPriceUSD(bool useUniswap) public view returns (uint256) {
    uint256 _price =
      useUniswap
        ? tdaoPriceTRIB(true).mul(tribPriceUSD()).div(precision)
        : tdaoPriceTRIB(false).mul(tribPriceUSD()).div(precision);
    return _price;
  }

  function trigPriceTRIB() public view returns (uint256) {
    uint256 trigSupply = 1000 ether;
    return tribContributed().mul(precision).div(trigSupply);
  }

  function trigPriceUSD(bool useUniswap) public view returns (uint256 _price) {
    if (useUniswap) {
      address trig = lle.trig();
      _price = getPriceUSD(trig, 1 ether);
    } else {
      _price = trigPriceTRIB().mul(tribPriceUSD()).div(precision);
    }
  }

  function tribFloor() public view returns (uint256) {
    return
      contribute.getBurnedTokensAmount().add(tribContributed()).div(1000000);
  }

  function contributed(address account) external view returns (uint256) {
    return lle.contributed(account);
  }

  function claimableTrig(address account)
    external
    view
    returns (uint256 trigAmount)
  {
    trigAmount = lle.contributed(account).mul(lle.trigTokensPerUnit()).div(
      1e18
    );
  }

  function nftBalance(address[] memory accounts, uint256[] memory ids)
    external
    view
    returns (uint256[] memory)
  {
    return IERC1155(lle.nft()).balanceOfBatch(accounts, ids);
  }

  function apyNft(
    address account,
    uint256 pool,
    bool useTDAOUniswapPrice
  ) external view returns (uint256 apy) {
    uint24[8] memory nftPrice =
      [500, 2000, 5000, 10000, 20000, 50000, 100000, 50000];

    uint256 totalAllocationPoint = nftRewardsVault.totalAllocPoint();
    (, , uint256 poolAllocationPoint, ) = nftRewardsVault.poolInfo(pool);
    (uint256 stake, ) = nftRewardsVault.userInfo(pool, account);

    if (stake != 0 && totalAllocationPoint != 0) {
      uint256 _tdaoPriceUSD;
      _tdaoPriceUSD = tdaoPriceUSD(useTDAOUniswapPrice);

      uint256 stakeUSD = tribPriceUSD().mul(nftPrice[pool]).mul(stake);

      uint256 rewardYearUSD =
        nftRewardsVault
          .avgFeesPerSecondTotal()
          .mul(_year)
          .mul(_tdaoPriceUSD)
          .div((1e18));

      apy = rewardYearUSD.mul(poolAllocationPoint).mul(1e18).div(stakeUSD).div(
        totalAllocationPoint
      );
    }
  }

  function apyTrig(
    address account,
    uint256 pool,
    bool useTDAOUniswapPrice,
    bool useTRIGUniswapPrice
  ) external view returns (uint256 apy) {
    uint256 totalAllocationPoint = trigRewardsVault.totalAllocPoint();

    (, uint256 poolAllocationPoint, ) = trigRewardsVault.poolInfo(pool);
    (uint256 stake, ) = trigRewardsVault.userInfo(pool, account);

    if (stake != 0 && totalAllocationPoint != 0) {
      uint256 _tdaoPriceUSD;
      uint256 _trigPriceUSD;
      _tdaoPriceUSD = tdaoPriceUSD(useTDAOUniswapPrice);
      _trigPriceUSD = trigPriceUSD(useTRIGUniswapPrice);

      uint256 _stakeUSD = _trigPriceUSD.mul(stake).div(1e18);

      uint256 rewardYearUSD =
        trigRewardsVault
          .avgFeesPerSecondTotal()
          .mul(_year)
          .mul(_tdaoPriceUSD)
          .div(1e18);

      apy = rewardYearUSD.mul(poolAllocationPoint).mul(1e18).div(_stakeUSD).div(
        totalAllocationPoint
      );
    }
  }

  function apyLp(
    address pair,
    address account,
    uint256 pool,
    bool useTDAOUniswapPrice
  ) external view returns (uint256 apy) {
    uint256 totalAllocationPoint = rewardsVault.totalAllocPoint();

    (, uint256 poolAllocationPoint, ) = rewardsVault.poolInfo(pool);
    (uint256 stake, ) = rewardsVault.userInfo(pool, account);

    if (stake != 0 && totalAllocationPoint != 0) {
      uint256 _tdaoPriceUSD;
      _tdaoPriceUSD = tdaoPriceUSD(useTDAOUniswapPrice);

      uint256 lpUSD = calculateLpPriceUSD(pair);
      uint256 stakeUSD = lpUSD.mul(stake).div(1e18);
      uint256 rewardYearUSD =
        rewardsVault.avgFeesPerSecondTotal().mul(_year).mul(_tdaoPriceUSD).div(
          1e18
        );

      console.log('Stake: ', stakeUSD);
      console.log('RewardYearUSD: ', rewardYearUSD);

      apy = rewardYearUSD.mul(poolAllocationPoint).mul(1e18).div(stakeUSD).div(
        totalAllocationPoint
      );
    }
  }

  function calculateLpPriceUSD(address pair)
    public
    view
    returns (uint256 _price)
  {
    IUniswapV2Pair _pair = IUniswapV2Pair(pair);
    uint256 _totalSupplyLp = _pair.totalSupply();
    (uint256 _reserveToken0, uint256 _reserveToken1, ) = _pair.getReserves();
    uint256 _token0PerLp = _reserveToken0.mul(1e18).div(_totalSupplyLp);
    uint256 _token1PerLp = _reserveToken1.mul(1e18).div(_totalSupplyLp);
    uint256 _token0PriceUSD = getPriceUSD(_pair.token0(), 1 ether);
    uint256 _token1PriceUSD = getPriceUSD(_pair.token1(), 1 ether);
    uint256 _token0LpUSD = _token0PerLp.mul(_token0PriceUSD).div(1e18);
    uint256 _token1LpUSD = _token1PerLp.mul(_token1PriceUSD).div(1e18);

    _price = _token0LpUSD.add(_token1LpUSD);
  }

  function getPriceUSD(address _asset, uint256 _amount)
    public
    view
    returns (uint256 _price)
  {
    address _factory = 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f;
    address _stable = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address _weth = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    uint256[] memory _arr0;
    uint256[] memory _arr1;
    address[] memory _path0 = new address[](2);
    address[] memory _path1 = new address[](2);
    address[3] memory rout = [_asset, _weth, _stable];
    _path0[0] = rout[0];
    _path0[1] = rout[1];
    _path1[0] = rout[1];
    _path1[1] = rout[2];

    if (_asset == _weth) {
      _arr1 = UniswapV2Library.getAmountsOut(_factory, _amount, _path1);
      _price = _arr1[1];
      return _price;
    } else if (_asset == _stable) {
      _price = _amount;
      return _price;
    } else {
      _arr0 = UniswapV2Library.getAmountsOut(_factory, _amount, _path0);
      _arr1 = UniswapV2Library.getAmountsOut(_factory, _arr0[1], _path1);
      _price = _arr1[1];
    }
  }

  function _tdaoUniswapPrice() internal view returns (uint256) {
    address[] memory path = new address[](2);
    path[0] = address(tdao);
    path[1] = address(trib);
    uint256[] memory price =
      IUniswapV2Router02(lle.uniswapRouterV2()).getAmountsOut(1 ether, path);
    return price[1];
  }
}
