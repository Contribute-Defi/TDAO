// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.7.0;

/*
// @dev
// !!This is work in progress, this contract has not been tested and it is
// incomplete!!
*/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';
import '@openzeppelin/contracts/token/ERC1155/ERC1155Holder.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

import './libraries/Math.sol';
import './LockedLiquidityEvent.sol';
import './NFTRewardsVault.sol';
import './NFT.sol';

contract NFTShares is ERC20, ERC1155Holder {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  uint256 public constant NFT_PRICE = 100000 ether;
  uint256 public constant MAX_SUPPLY = NFT_PRICE;
  uint256 public constant DURATION = 7 days;

  uint256 public totalDeposited;
  uint256 public totalStaked;
  uint256 public tokensPerUnit;
  uint256 public trigTokensPerUnit;
  uint256 public rewardPerTokenStaked;
  uint256 public periodFinish = 0;
  uint256 public rewardRate = 0;
  uint256 public lastUpdateTime;
  uint256 public accumulatedReward;

  LockedLiquidityEvent lle =
    LockedLiquidityEvent(0x76D8C0853aAC606dDDF29d3cf1e4251279e66858);
  IERC20 trib = IERC20(0xe09216F1d343Dd39D6Aa732a08036fee48555Af0);
  IERC20 trig = IERC20(0xE3DCe982416Cb44D0376923bDA3DD92822eA5827);
  IERC20 tdao = IERC20(0x8e84Ee8B28dDbe2B1d5e204E674460835D298815);
  NFTRewardsVault nftRewardsVault =
    NFTRewardsVault(0x76EA2186182E3Ec27C2D9C7394b83E5C8F2cf6C4);
  NFT nft = NFT(0x2dA71C9db22F9D620FdC07BD42105E852Afe05a2);

  mapping(address => uint256) public deposited;
  mapping(address => uint256) public stakeBalance;
  mapping(address => uint256) public userRewardPerTokenPaid;
  mapping(address => uint256) public rewards;

  constructor(string memory name, string memory symbol)
    public
    ERC20(name, symbol)
  {
    _mint(address(this), MAX_SUPPLY);
  }

  event RewardAdded(uint256 reward);
  event Staked(address indexed user, uint256 amount);
  event Withdrawn(address indexed user, uint256 amount);
  event RewardPaid(address indexed user, uint256 reward);

  modifier updateReward(address account) {
    rewardPerTokenStaked = rewardPerToken();
    lastUpdateTime = lastTimeRewardApplicable();
    if (account != address(0)) {
      rewards[account] = earned(account);
      userRewardPerTokenPaid[account] = rewardPerTokenStaked;
    }
    _;
  }

  function lastTimeRewardApplicable() public view returns (uint256) {
    return Math.min(block.timestamp, periodFinish);
  }

  function rewardPerToken() public view returns (uint256) {
    if (totalStaked == 0) {
      return rewardPerTokenStaked;
    }
    return
      rewardPerTokenStaked.add(
        lastTimeRewardApplicable()
          .sub(lastUpdateTime)
          .mul(rewardRate)
          .mul(1e18)
          .div(totalStaked)
      );
  }

  function earned(address account) public view returns (uint256) {
    return
      stakeBalance[account]
        .mul(rewardPerToken().sub(userRewardPerTokenPaid[account]))
        .div(1e18)
        .add(rewards[account]);
  }

  function stake(uint256 amount) external updateReward(msg.sender) {
    require(amount > 0, 'Cannot stake 0');
    _stake(msg.sender, amount);
  }

  function _stake(address _account, uint256 _amount) internal {
    transferFrom(_account, address(this), _amount);
    stakeBalance[_account] = stakeBalance[_account].add(_amount);
    totalStaked = totalStaked.add(_amount);
    emit Staked(_account, _amount);
  }

  function withdraw(uint256 amount) public updateReward(msg.sender) {
    require(amount > 0, 'Cannot withdraw 0');
    _withdraw(msg.sender, amount);
  }

  function _withdraw(address _account, uint256 _amount) internal {
    require(stakeBalance[_account] >= _amount, 'Amount exceeds stake');

    stakeBalance[_account] = stakeBalance[_account].sub(_amount);
    totalStaked = totalStaked.sub(_amount);
    transfer(_account, _amount);
    emit Withdrawn(_account, _amount);
  }

  function exit() external {
    withdraw(stakeBalance[msg.sender]);
    getReward();
  }

  function getReward() public updateReward(msg.sender) {
    uint256 reward = earned(msg.sender);
    if (reward > 0) {
      rewards[msg.sender] = 0;
      tdao.safeTransfer(msg.sender, reward);
      emit RewardPaid(msg.sender, reward);
    }
  }

  function notifyRewardAmount() external updateReward(address(0)) {
    uint256 reward = accumulatedReward;
    if (block.timestamp >= periodFinish) {
      rewardRate = reward.div(DURATION);
    } else {
      uint256 remaining = periodFinish.sub(block.timestamp);
      uint256 leftover = remaining.mul(rewardRate);
      rewardRate = reward.add(leftover).div(DURATION);
    }
    lastUpdateTime = block.timestamp;
    periodFinish = block.timestamp.add(DURATION);
    emit RewardAdded(reward);
  }

  function depositTrib(uint256 amount) external returns (bool) {
    require(amount != 0, 'Must deposit something.');
    require(totalDeposited <= NFT_PRICE, 'Enough funds have been deposited.');

    uint256 newTotalDeposit = totalDeposited.add(amount);

    if (newTotalDeposit > NFT_PRICE) {
      uint256 difference = newTotalDeposit.sub(NFT_PRICE);
      amount = amount.sub(difference);
    }

    trib.transferFrom(msg.sender, address(this), amount);
    deposited[msg.sender] = deposited[msg.sender].add(amount);
    totalDeposited = totalDeposited.add(amount);

    if (totalDeposited == NFT_PRICE) {
      tokensPerUnit = totalSupply().mul(1e18).div(totalDeposited);

      lle.addLiquidity(totalDeposited);
    }

    return true;
  }

  function withdrawTrib(uint256 amount) external returns (bool) {
    require(amount <= deposited[msg.sender], 'Amount greater than deposit.');
    require(totalDeposited < NFT_PRICE, 'Minimum amount has been raised.');

    deposited[msg.sender] = deposited[msg.sender].sub(amount);
    totalDeposited = totalDeposited.sub(amount);
    trib.transfer(msg.sender, amount);

    return true;
  }

  function claimTrigFromLLE() external returns (bool) {
    lle.claimTrig();
    trigTokensPerUnit = trig.balanceOf(address(this)).mul(1e18).div(
      totalDeposited
    );

    return true;
  }

  function claimTokensAfterLLE() external returns (bool) {
    require(trig.balanceOf(address(this)) != 0, 'Nothing to claim');

    uint256 claimableTokens =
      deposited[msg.sender].mul(tokensPerUnit).div(1e18);
    uint256 claimableTrig =
      deposited[msg.sender].mul(trigTokensPerUnit).div(1e18);
    deposited[msg.sender] = 0;

    transfer(msg.sender, claimableTokens);
    trig.safeTransfer(msg.sender, claimableTrig);
  }

  function claimNFT() external returns (bool) {
    require(
      balanceOf(msg.sender) == MAX_SUPPLY,
      'Not enough NFT shares to claim NFTs'
    );
    _burn(msg.sender, balanceOf(msg.sender));
    _withdrawNFT();

    uint256 immortalBalance = nft.balanceOf(address(this), nft.IMMORTAL());
    uint256 divinityBalance = nft.balanceOf(address(this), nft.DIVINITY());
    uint256[] memory balances = new uint256[](2);
    balances[0] = immortalBalance;
    balances[1] = divinityBalance;

    uint256[] memory ids = new uint256[](2);
    ids[0] = nft.IMMORTAL();
    ids[1] = nft.DIVINITY();

    if (divinityBalance != 0) {
      nft.safeBatchTransferFrom(address(this), msg.sender, ids, balances, '');
    } else {
      nft.safeTransferFrom(
        address(this),
        msg.sender,
        nft.IMMORTAL(),
        immortalBalance,
        ''
      );
    }

    getReward();

    return true;
  }

  function _withdrawNFT() internal {
    (uint256 immortalBalance, ) =
      nftRewardsVault.userInfo(nft.IMMORTAL(), address(this));
    (uint256 divinityBalance, ) =
      nftRewardsVault.userInfo(nft.DIVINITY(), address(this));

    if (divinityBalance != 0) {
      nftRewardsVault.withdraw(nft.DIVINITY(), divinityBalance);
    }

    nftRewardsVault.withdraw(nft.IMMORTAL(), immortalBalance);

    accumulatedReward = tdao.balanceOf(address(this));
  }

  function stakeNFT() external returns (bool) {
    uint256 immortalBalance = nft.balanceOf(address(this), nft.IMMORTAL());
    uint256 divinityBalance = nft.balanceOf(address(this), nft.DIVINITY());

    require(immortalBalance != 0, 'Contract does not have NFT');

    nft.setApprovalForAll(address(nftRewardsVault), true);

    if (divinityBalance != 0) {
      nftRewardsVault.deposit(nft.DIVINITY(), divinityBalance);
    }

    nftRewardsVault.deposit(nft.IMMORTAL(), immortalBalance);
  }

  function claimNFTRewards() external returns (bool) {
    (uint256 immortalBalance, ) =
      nftRewardsVault.userInfo(nft.IMMORTAL(), address(this));
    (uint256 divinityBalance, ) =
      nftRewardsVault.userInfo(nft.DIVINITY(), address(this));

    require(immortalBalance != 0 || divinityBalance != 0, 'Nothing to claim.');

    if (divinityBalance != 0) {
      nftRewardsVault.withdraw(nft.DIVINITY(), 0);
    }
    nftRewardsVault.withdraw(nft.IMMORTAL(), 0);

    accumulatedReward = tdao.balanceOf(address(this));
  }
}
