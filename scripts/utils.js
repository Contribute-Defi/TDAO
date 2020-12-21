const ethers = require('ethers');
const ether = ethers.utils.parseEther('1');

calculateFees = (amount, _trigFee, treasuryFee) => {
  let trigFee = _trigFee;
  let hodlerFee = ethers.BigNumber.from('10');
  let lpFee = ethers.BigNumber.from('9000');
  const BASE = ethers.BigNumber.from('10000');

  let hodlerShare = amount.mul(hodlerFee).div(BASE);
  let discounted = amount.sub(hodlerShare);
  let trigShare = discounted.mul(trigFee).div(BASE);
  let remaining = discounted.sub(trigShare);
  let treasuryVaultShare = remaining.mul(treasuryFee).div(BASE);
  let nftShare = remaining.sub(treasuryVaultShare);
  let lpShare = treasuryVaultShare.mul(lpFee).div(BASE);
  let treasuryShare = treasuryVaultShare.sub(lpShare);

  return {
    hodlerShare: hodlerShare,
    trigShare: trigShare,
    nftShare: nftShare,
    lpShare: lpShare,
    treasuryShare: treasuryShare,
  };
};

module.exports = {
  calculateFees: calculateFees,
};
