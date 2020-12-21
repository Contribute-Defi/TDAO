// SPDX-License-Identifier: MIT

pragma solidity >=0.5.0 <0.7.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract ERC20Mock is ERC20 {
  constructor(string memory _name, string memory _symbol)
    public
    ERC20(_name, _symbol)
  {
    _mint(msg.sender, 1000000 ether);
  }
}
