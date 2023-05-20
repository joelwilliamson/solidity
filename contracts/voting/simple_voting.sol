// SPDX-License-Identifier: AGPL-3.0

pragma solidity >=0.8.2 <0.9.0;

/**
 * @title Simple Voting
 * @dev A basic delegated voting contract, based on https://docs.soliditylang.org/en/v0.8.20/solidity-by-example.html#voting
 * @custom:dev-run-script ./scripts/deploy_with_ethers.ts
 */
contract SimpleVoting {
    struct Voter {
        bool voted;
        address voter;
        address delegate;
        uint32 weight;
        uint32 votedProposal;
    }

    struct Proposal {
        bytes32 name;
        uint32 voteCount;
    }

    modifier isChairman() {
        require(msg.sender == chairman, "Sender is not chairman");
        _;
    }

    modifier isVoter() {
        require(
            voters[msg.sender].voter == msg.sender,
            "Sender is not a voter"
        );
        _;
    }

    modifier isActiveVoter() {
        Voter storage voter = voters[msg.sender];
        require(voter.voter == msg.sender, "Sender is not a voter");
        require(!voter.voted, "Voter has already voted");
        require(voter.weight != 0, "Voter has no votes");
        require(
            voter.delegate == address(0),
            "Voter has already delegated their vote"
        );
        _;
    }

    address chairman;
    Proposal[] proposals;
    mapping(address => Voter) voters;

    constructor(bytes32[] memory proposalNames) {
        require(
            proposalNames.length > 0,
            "There must be at least one proposal"
        );
        chairman = msg.sender;

        for (uint i = 0; i < proposalNames.length; i++) {
            proposals.push(Proposal({name: proposalNames[i], voteCount: 0}));
        }
    }

    function addVoter(address newVoter) public isChairman {
        Voter storage voter = voters[newVoter];
        require(voter.voter == address(0), "newVoter is already a voter");
        voter.voter = newVoter;
        voter.delegate = address(0);
        voter.voted = false; // Is this necessary? Does it default-init to false?
        voter.weight = 1;
    }

    function delegate(address delegateTo) public isActiveVoter {
        Voter storage voter = voters[msg.sender];

        // Let's find the ultimate target of the delegation
        Voter storage delegationTarget = voters[delegateTo];
        require(
            delegationTarget.voter != address(0),
            "Cannot delegate to non-voter"
        );
        while (delegationTarget.delegate != address(0)) {
            require(delegationTarget.delegate != msg.sender, "Loop detected");
            delegationTarget = voters[delegationTarget.delegate];
        }

        if (delegationTarget.voted) {
            proposals[delegationTarget.votedProposal].voteCount += voter.weight;
        } else {
            delegationTarget.weight += voter.weight;
        }
        voter.weight = 0;
        voter.delegate = delegationTarget.voter;
    }

    function vote(uint32 proposalIdx) public isActiveVoter {
        require(proposalIdx <= proposals.length, "Proposal does not exist");
        Voter storage voter = voters[msg.sender];

        proposals[proposalIdx].voteCount += voter.weight;

        voter.voted = true;
        voter.votedProposal = proposalIdx;
        voter.weight = 0;
    }

    function winningProposal() public view returns (bytes32) {
        require(
            proposals.length != 0,
            "There must be at least one proposal for a winner"
        );
        Proposal storage bestProposal = proposals[0];
        for (uint32 i = 1; i < proposals.length; i++) {
            if (proposals[i].voteCount > bestProposal.voteCount) {
                bestProposal = proposals[i];
            }
        }

        return bestProposal.name;
    }

    function getProposals() public view returns (Proposal[] memory) {
        return proposals;
    }
}
