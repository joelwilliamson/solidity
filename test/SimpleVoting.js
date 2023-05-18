const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SimpleVoting", function () {
  const proposals = ["prop1", "prop2", "prop3", "prop4"].map(
    ethers.utils.formatBytes32String
  );

  async function deploySimpleVoting() {
    const voters = await ethers.getSigners();

    const factory = await ethers.getContractFactory("SimpleVoting", voters[0]);
    const ballot = await factory.deploy(proposals);

    return { voters, ballot };
  }

  async function deployVotingWithSingleVoter() {
    const { voters, ballot } = await deploySimpleVoting();
    const [chairman, voter] = voters;
    await ballot.connect(chairman).addVoter(voter.address);
    return { voters, ballot };
  }

  async function deployVotingWithTwoVoters() {
    const { voters, ballot } = await deploySimpleVoting();
    const [chairman, voter1, voter2] = voters;
    await ballot.connect(chairman).addVoter(voter1.address);
    await ballot.connect(chairman).addVoter(voter2.address);
    return { voters, ballot };
  }

  async function deployVotingWithFiveVoters() {
    const { voters, ballot } = await deploySimpleVoting();
    const [chairman, ...nonchairman] = voters;

    for (let i = 0; i < 5; i++) {
      await ballot.connect(chairman).addVoter(nonchairman[i].address);
    }

    return { voters, ballot };
  }

  describe("Deployment", function () {
    it("Should default to the first proposal winning", async function () {
      const { voters, ballot } = await loadFixture(deploySimpleVoting);

      expect(await ballot.winningProposal()).to.equal(proposals[0]);
    });

    it("Should select the correct chairman", async function () {
      const { voters, ballot } = await loadFixture(deploySimpleVoting);

      const [chairman, otherAddress] = voters;
      await expect(
        ballot.connect(otherAddress).addVoter(otherAddress.address)
      ).to.be.revertedWith("Sender is not chairman");
      await expect(ballot.connect(chairman).addVoter(otherAddress.address)).to
        .be.ok;
    });

    it("Voters cannot be added twice", async function () {
      const { voters, ballot } = await loadFixture(deploySimpleVoting);

      const [chairman, otherAddress] = voters;
      const chairmanConnection = ballot.connect(chairman);
      await expect(chairmanConnection.addVoter(otherAddress.address)).to.be.ok;
      await expect(
        chairmanConnection.addVoter(otherAddress.address)
      ).to.be.revertedWith("newVoter is already a voter");
    });

    it("Multiple voters can be added", async function () {
      const { voters, ballot } = await loadFixture(deploySimpleVoting);

      const [chairman, voter1, voter2] = voters;
      const chairmanConnection = ballot.connect(chairman);
      await expect(chairmanConnection.addVoter(voter1.address)).not.to.be
        .reverted;
      await expect(chairmanConnection.addVoter(voter2.address)).not.to.be
        .reverted;
    });

    it("A single vote should decide the winning proposal", async function () {
      const { voters, ballot } = await loadFixture(deployVotingWithSingleVoter);

      const [chairman, voter] = voters;
      await expect(ballot.connect(voter).vote(1)).not.to.be.reverted;
      expect(await ballot.winningProposal()).to.equal(proposals[1]);
    });

    it("A voter cannot vote twice", async function () {
      const { voters, ballot } = await loadFixture(deployVotingWithSingleVoter);

      const [chairman, voter] = voters;
      await expect(ballot.connect(voter).vote(1)).not.to.be.reverted;
      await expect(ballot.connect(voter).vote(1)).to.be.reverted;
    });

    it("Ties are won by the earlier proposal", async function () {
      const { voters, ballot } = await loadFixture(deploySimpleVoting);

      const [chairman, voter1, voter2] = voters;
      const chairmanConnection = ballot.connect(chairman);
      await expect(chairmanConnection.addVoter(voter1.address)).not.to.be
        .reverted;
      await expect(chairmanConnection.addVoter(voter2.address)).not.to.be
        .reverted;
      await expect(ballot.connect(voter1).vote(2)).not.to.be.reverted;
      expect(await ballot.winningProposal()).to.equal(proposals[2]);
      await expect(ballot.connect(voter2).vote(1)).not.to.be.reverted;
      expect(await ballot.winningProposal()).to.equal(proposals[1]);
    });

    it("A voter cannot delegate to a non-voter", async function () {
      const { voters, ballot } = await loadFixture(deployVotingWithSingleVoter);
      const [chairman, voter, nonvoter] = voters;

      await expect(ballot.connect(voter).delegate(nonvoter.address)).to.be
        .reverted;
    });

    it("A voter cannot delegate twice", async function () {
      const { voters, ballot } = await loadFixture(deployVotingWithTwoVoters);
      const [chairman, voter1, voter2] = voters;

      await expect(ballot.connect(voter1).delegate(voter2.address)).not.to.be
        .reverted;
      await expect(ballot.connect(voter1).delegate(voter2.address)).to.be
        .reverted;
    });

    it("A voter cannot delegate to someone who delegated to them", async function () {
      const { voters, ballot } = await loadFixture(deployVotingWithTwoVoters);
      const [chairman, voter1, voter2] = voters;

      await expect(ballot.connect(voter1).delegate(voter2.address)).not.to.be
        .reverted;
      await expect(ballot.connect(voter2).delegate(voter1.address)).to.be
        .reverted;
    });

    it("The proposal with the most votes wins", async function () {
      const { voters, ballot } = await loadFixture(deployVotingWithFiveVoters);
      const [chairman, v1, v2, v3, v4, v5] = voters;

      await ballot.connect(v1).vote(1);
      await ballot.connect(v2).vote(1);
      await ballot.connect(v3).vote(2);
      await ballot.connect(v4).vote(2);
      await ballot.connect(v5).vote(2);

      await expect(await ballot.winningProposal()).to.equal(proposals[2]);
    });

    it("A voter with a delegated vote counts as two votes (delegation before voting)", async function () {
      const { voters, ballot } = await loadFixture(deployVotingWithFiveVoters);
      const [chairman, v1, v2, v3, v4, v5] = voters;

      await ballot.connect(v3).vote(3);

      await ballot.connect(v1).delegate(v2.address);
      await ballot.connect(v2).vote(2);

      await expect(await ballot.winningProposal()).to.equal(proposals[2]);

      await ballot.connect(v4).vote(3);
      await ballot.connect(v5).vote(3);

      await expect(await ballot.winningProposal()).to.equal(proposals[3]);
    });

    it("A voter with a delegated vote counts as two votes (voting before delegation)", async function () {
      const { voters, ballot } = await loadFixture(deployVotingWithFiveVoters);
      const [chairman, v1, v2, v3, v4, v5] = voters;

      await ballot.connect(v3).vote(3);

      await ballot.connect(v2).vote(2);
      await ballot.connect(v1).delegate(v2.address);

      await expect(await ballot.winningProposal()).to.equal(proposals[2]);

      await ballot.connect(v4).vote(3);
      await ballot.connect(v5).vote(3);

      await expect(await ballot.winningProposal()).to.equal(proposals[3]);
    });
  });
});
