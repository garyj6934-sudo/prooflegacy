// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ProofLegacy
 *
 * Experimental smart contract for digital continuity.
 *
 * IMPORTANT:
 * This is an early prototype for testnet development.
 * It has NOT been audited and should NOT hold real funds.
 */
contract ProofLegacyVault {
    address public owner;
    address public beneficiary;

    uint256 public inactivityPeriod;
    uint256 public lastProofOfLife;

    bool public warningPeriod;
    uint256 public warningStartedAt;

    uint256 public constant WARNING_PERIOD = 14 days;

    constructor(
        address _beneficiary,
        uint256 _inactivityPeriod
    ) payable {
        require(_beneficiary != address(0), "Invalid beneficiary");
        require(_inactivityPeriod > 0, "Invalid inactivity period");

        owner = msg.sender;
        beneficiary = _beneficiary;
        inactivityPeriod = _inactivityPeriod;
        lastProofOfLife = block.timestamp;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function ping() external onlyOwner {
        lastProofOfLife = block.timestamp;
        warningPeriod = false;
        warningStartedAt = 0;
    }

    function updateBeneficiary(
        address _beneficiary
    ) external onlyOwner {
        require(_beneficiary != address(0), "Invalid beneficiary");
        beneficiary = _beneficiary;
    }

    function startWarningPeriod() external {
        require(!warningPeriod, "Warning already active");
        require(
            block.timestamp >= lastProofOfLife + inactivityPeriod,
            "Owner still active"
        );

        warningPeriod = true;
        warningStartedAt = block.timestamp;
    }

    function claim() external {
        require(warningPeriod, "Warning not started");
        require(
            block.timestamp >= warningStartedAt + WARNING_PERIOD,
            "Warning period active"
        );
        require(
            msg.sender == beneficiary,
            "Not beneficiary"
        );

        payable(beneficiary).transfer(address(this).balance);
    }

    function getStatus()
        external
        view
        returns (
            address,
            address,
            uint256,
            uint256,
            bool
        )
    {
        return (
            owner,
            beneficiary,
            inactivityPeriod,
            lastProofOfLife,
            warningPeriod
        );
    }

    receive() external payable {}
}
