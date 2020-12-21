// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0 <0.7.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

interface IFeeSplitter {
  function setTreasuryVault(address) external;

  function setTrigFee(uint256) external;
}

contract LockedLiquidityEventMock {
  uint256 public startTradingTime = block.timestamp;
}

contract TDaoMockSplitterTest is ERC20 {
  IFeeSplitter feeSplitter;

  address public lockedLiquidityEvent;

  constructor(string memory _name, string memory _symbol)
    public
    ERC20(_name, _symbol)
  {
    _mint(msg.sender, 1000000 ether);
    lockedLiquidityEvent = address(new LockedLiquidityEventMock());
  }

  function setFeeSplitter(address _feeSplitter) external {
    feeSplitter = IFeeSplitter(_feeSplitter);
  }

  function setTreasuryVault(address _treasuryVault) external {
    feeSplitter.setTreasuryVault(_treasuryVault);
  }

  function setTrigFee(uint256 _trigFee) external {
    feeSplitter.setTrigFee(_trigFee);
  }
}
