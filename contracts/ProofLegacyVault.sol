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
    bool public claimed;

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
        require(!claimed, "Already claimed");

        lastProofOfLife = block.timestamp;
        warningPeriod = false;
        warningStartedAt = 0;
    }

    function updateBeneficiary(
        address _beneficiary
    ) external onlyOwner {
        require(_beneficiary != address(0), "Invalid beneficiary");
        require(!claimed, "Already claimed");

        beneficiary = _beneficiary;
    }

    function startWarningPeriod() external {
        require(!claimed, "Already claimed");
        require(!warningPeriod, "Warning already active");
        require(
            block.timestamp >= lastProofOfLife + inactivityPeriod,
            "Owner still active"
        );

        warningPeriod = true;
        warningStartedAt = block.timestamp;
    }

    function claim() external {
        require(!claimed, "Already claimed");
        require(warningPeriod, "Warning not started");
        require(
            block.timestamp >= warningStartedAt + WARNING_PERIOD,
            "Warning period active"
        );
        require(
            msg.sender == beneficiary,
            "Not beneficiary"
        );

        claimed = true;
        warningPeriod = false;

        (bool success, ) = payable(beneficiary).call{
            value: address(this).balance
        }("");

        require(success, "Transfer failed");
    }

    function getStatus()
        external
        view
        returns (
            address,
            address,
            uint256,
            uint256,
            bool,
            bool
        )
    {
        return (
            owner,
            beneficiary,
            inactivityPeriod,
            lastProofOfLife,
            warningPeriod,
            claimed
        );
    }

    receive() external payable {}
}