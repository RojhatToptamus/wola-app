/* eslint-disable @typescript-eslint/no-unused-expressions */
import { expect } from "chai";
import { ethers } from "hardhat";
import { EventManager, MockUSDC } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("EventManager", function () {
  let eventManager: EventManager;
  let mockUSDC: MockUSDC;
  let owner: SignerWithAddress;
  let organizer: SignerWithAddress;
  let participant1: SignerWithAddress;
  let participant2: SignerWithAddress;
  let participant3: SignerWithAddress;

  // Test constants
  const DEPOSIT_AMOUNT = ethers.parseUnits("1", 18);
  const BOND_AMOUNT = ethers.parseUnits("10", 18);
  const CAPACITY = 3n;
  const MIN_ATTENDANCE_BPS = 6000; // 60%

  beforeEach(async function () {
    [owner, organizer, participant1, participant2, participant3] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDCFactory.deploy();
    await mockUSDC.waitForDeployment();

    // Deploy EventManager
    const EventManagerFactory = await ethers.getContractFactory("EventManager");
    eventManager = await EventManagerFactory.deploy(await mockUSDC.getAddress(), owner.address);
    await eventManager.waitForDeployment();

    // Setup tokens for all users
    const users = [owner, organizer, participant1, participant2, participant3];
    for (const user of users) {
      await mockUSDC.mint(user.address, ethers.parseUnits("10000", 18));
      await mockUSDC.connect(user).approve(await eventManager.getAddress(), ethers.parseUnits("10000", 18));
    }
  });

  describe("Admin Functions", function () {
    it("Should set attendee deposit amount correctly", async function () {
      const newDeposit = ethers.parseUnits("5", 18);

      await eventManager.setAttendeeDepositAmount(newDeposit);
      expect(await eventManager.attendeeDepositAmount()).to.equal(newDeposit);
    });

    it("Should set organizer bond amount correctly", async function () {
      const newBond = ethers.parseUnits("25", 18);

      await eventManager.setOrganizerBondAmount(newBond);
      expect(await eventManager.organizerBondAmount()).to.equal(newBond);
    });

    it("Should update policy correctly", async function () {
      await expect(eventManager.updatePolicy(48, 6, 75, 60))
        .to.emit(eventManager, "PolicyUpdated")
        .withArgs(48, 6, 75, 60);

      const policy = await eventManager.policy();
      expect(policy.fullRefundHours).to.equal(48);
      expect(policy.partialRefundHours).to.equal(6);
      expect(policy.partialRefundPercent).to.equal(75);
      expect(policy.attendeeSharePercent).to.equal(60);
    });

    it("Should reject invalid policy", async function () {
      await expect(eventManager.updatePolicy(48, 6, 101, 60)).to.be.revertedWith("Invalid partial refund percent");
    });
  });

  describe("Account Management", function () {
    it("Should create account successfully", async function () {
      await expect(eventManager.connect(organizer).createAccount())
        .to.emit(eventManager, "AccountCreated")
        .withArgs(organizer.address);

      expect(await eventManager.isRegisteredUser(organizer.address)).to.be.true;
    });

    it("Should prevent duplicate account creation", async function () {
      await eventManager.connect(organizer).createAccount();
      await expect(eventManager.connect(organizer).createAccount()).to.be.revertedWith("Account already exists");
    });

    it("Should handle withdrawals correctly", async function () {
      await expect(eventManager.connect(organizer).withdraw()).to.be.revertedWith("No balance to withdraw");
    });
  });

  describe("Event Lifecycle", function () {
    let eventId: number;
    let startTime: number;
    let endTime: number;

    beforeEach(async function () {
      await eventManager.connect(organizer).createAccount();
      startTime = (await time.latest()) + 86400 + 3600; // 25 hours from now (within full refund window)
      endTime = startTime + 3600; // 26 hours from now
    });

    it("Should create and publish event successfully", async function () {
      const initialBalance = await mockUSDC.balanceOf(organizer.address);

      await expect(
        eventManager
          .connect(organizer)
          .createEvent("Test Event Description", startTime, endTime, MIN_ATTENDANCE_BPS, CAPACITY),
      )
        .to.emit(eventManager, "EventCreated")
        .withArgs(1, organizer.address);

      eventId = 1;

      // Check bond was transferred
      expect(await mockUSDC.balanceOf(organizer.address)).to.equal(initialBalance - BOND_AMOUNT);

      // Publish the event
      await expect(eventManager.connect(organizer).publishEvent(eventId))
        .to.emit(eventManager, "EventPublished")
        .withArgs(eventId);
    });

    it("Should validate event parameters", async function () {
      const pastTime = (await time.latest()) - 3600;
      await expect(
        eventManager.connect(organizer).createEvent("Test Event", pastTime, endTime, MIN_ATTENDANCE_BPS, CAPACITY),
      ).to.be.revertedWith("Start time must be in future");
    });

    describe("Registration and Participation", function () {
      beforeEach(async function () {
        await eventManager
          .connect(organizer)
          .createEvent("Test Event Description", startTime, endTime, MIN_ATTENDANCE_BPS, CAPACITY);
        eventId = 1;
        await eventManager.connect(organizer).publishEvent(eventId);
      });

      it("Should handle registration flow correctly", async function () {
        // Create accounts for participants
        await eventManager.connect(participant1).createAccount();
        await eventManager.connect(participant2).createAccount();

        const initialBalance1 = await mockUSDC.balanceOf(participant1.address);
        const initialBalance2 = await mockUSDC.balanceOf(participant2.address);

        // Register participants
        await expect(eventManager.connect(participant1).registerForEvent(eventId))
          .to.emit(eventManager, "RegistrationConfirmed")
          .withArgs(eventId, participant1.address);

        await expect(eventManager.connect(participant2).registerForEvent(eventId))
          .to.emit(eventManager, "RegistrationConfirmed")
          .withArgs(eventId, participant2.address);

        // Check deposits were transferred
        expect(await mockUSDC.balanceOf(participant1.address)).to.equal(initialBalance1 - DEPOSIT_AMOUNT);
        expect(await mockUSDC.balanceOf(participant2.address)).to.equal(initialBalance2 - DEPOSIT_AMOUNT);

        // Check registration status
        const reg1 = await eventManager.getRegistration(eventId, participant1.address);
        expect(reg1.status).to.equal(1); // Confirmed
        expect(reg1.exists).to.be.true;
      });

      it("Should prevent invalid registrations", async function () {
        // Without account
        await expect(eventManager.connect(participant1).registerForEvent(eventId)).to.be.revertedWith(
          "Must create account first",
        );

        await eventManager.connect(participant1).createAccount();

        // Duplicate registration
        await eventManager.connect(participant1).registerForEvent(eventId);
        await expect(eventManager.connect(participant1).registerForEvent(eventId)).to.be.revertedWith(
          "Already registered",
        );
      });

      it("Should handle registration cancellations with refunds", async function () {
        await eventManager.connect(participant1).createAccount();
        await eventManager.connect(participant1).registerForEvent(eventId);

        const initialBalance = await eventManager.getUserBalance(participant1.address);

        // Cancel registration (should get full refund since we're well before start)
        await expect(eventManager.connect(participant1).cancelRegistration(eventId))
          .to.emit(eventManager, "RegistrationCanceled")
          .withArgs(eventId, participant1.address);

        // Should get full refund
        expect(await eventManager.getUserBalance(participant1.address)).to.equal(initialBalance + DEPOSIT_AMOUNT);
      });

      describe("Event Completion and Payouts", function () {
        beforeEach(async function () {
          // Setup: Create accounts and register participants
          await eventManager.connect(participant1).createAccount();
          await eventManager.connect(participant2).createAccount();
          await eventManager.connect(participant3).createAccount();

          await eventManager.connect(participant1).registerForEvent(eventId);
          await eventManager.connect(participant2).registerForEvent(eventId);
          await eventManager.connect(participant3).registerForEvent(eventId);
        });

        it("Should complete successful event with attendance", async function () {
          // Move to event start time and check in participants
          await time.increaseTo(startTime);

          await expect(eventManager.connect(organizer).checkIn(eventId, participant1.address))
            .to.emit(eventManager, "ParticipantCheckedIn")
            .withArgs(eventId, participant1.address);

          await expect(eventManager.connect(organizer).checkIn(eventId, participant2.address))
            .to.emit(eventManager, "ParticipantCheckedIn")
            .withArgs(eventId, participant2.address);

          // participant3 doesn't show up (no check-in)

          // Move to event end time
          await time.increaseTo(endTime);

          // Close check-in
          await expect(eventManager.connect(organizer).closeCheckIn(eventId))
            .to.emit(eventManager, "CheckInClosed")
            .withArgs(eventId);

          const initialOrganizerBalance = await eventManager.getUserBalance(organizer.address);

          // Complete event
          await expect(eventManager.connect(organizer).completeEvent(eventId))
            .to.emit(eventManager, "EventCompleted")
            .withArgs(eventId);

          // Check organizer gets bond back + share of forfeits
          // Attendance: 2/3 = 66.67%, which meets 60% minimum
          // Forfeit pool: 1 no-show * DEPOSIT_AMOUNT
          const policy = await eventManager.policy();
          const forfeitPool = DEPOSIT_AMOUNT;
          const organizerShare = (forfeitPool * BigInt(100n - policy.attendeeSharePercent)) / 100n;

          expect(await eventManager.getUserBalance(organizer.address)).to.equal(
            initialOrganizerBalance + BOND_AMOUNT + organizerShare,
          );
        });

        it("Should handle event with poor attendance", async function () {
          // Move to event start time and check in only 1 participant (33% attendance)
          await time.increaseTo(startTime);

          await eventManager.connect(organizer).checkIn(eventId, participant1.address);
          // participant2 and participant3 don't show up

          // Move to event end time and complete
          await time.increaseTo(endTime);

          const initialOrganizerBalance = await eventManager.getUserBalance(organizer.address);

          await eventManager.connect(organizer).completeEvent(eventId);

          // Attendance: 1/3 = 33.33%, which is below 60% minimum
          // Organizer should be penalized
          const attendanceRate = 3333; // 33.33% in basis points
          const shortfall = MIN_ATTENDANCE_BPS - attendanceRate;
          const penalty = (BOND_AMOUNT * BigInt(shortfall)) / 10000n;
          const bondAfterPenalty = BOND_AMOUNT - penalty;

          // Forfeit pool: 2 no-shows + bond penalty
          const forfeitPool = 2n * DEPOSIT_AMOUNT + penalty;
          const policy = await eventManager.policy();
          const organizerShare = (forfeitPool * BigInt(100n - policy.attendeeSharePercent)) / 100n;

          expect(await eventManager.getUserBalance(organizer.address)).to.equal(
            initialOrganizerBalance + bondAfterPenalty + organizerShare,
          );
        });

        it("Should handle payout claims correctly", async function () {
          // Setup completed event with 2 attendees, 1 no-show
          await time.increaseTo(startTime);
          await eventManager.connect(organizer).checkIn(eventId, participant1.address);
          await eventManager.connect(organizer).checkIn(eventId, participant2.address);

          await time.increaseTo(endTime);
          await eventManager.connect(organizer).completeEvent(eventId);

          // Attendees should be able to claim deposit + reward
          const initialBalance1 = await eventManager.getUserBalance(participant1.address);

          await expect(eventManager.connect(participant1).claimPayout(eventId)).to.emit(eventManager, "RewardsClaimed");

          const finalBalance1 = await eventManager.getUserBalance(participant1.address);
          expect(finalBalance1).to.be.gt(initialBalance1 + DEPOSIT_AMOUNT); // Should include reward

          // No-show participant should get nothing
          const claimableAmount = await eventManager.getClaimablePayout(eventId, participant3.address);
          expect(claimableAmount).to.equal(0);

          // Prevent double claiming
          await expect(eventManager.connect(participant1).claimPayout(eventId)).to.be.revertedWith(
            "Payout already claimed",
          );
        });

        it("Should handle event cancellation", async function () {
          // Cancel the event
          await expect(eventManager.connect(organizer).cancelEvent(eventId))
            .to.emit(eventManager, "EventCanceled")
            .withArgs(eventId);

          // All participants should get full refund
          const claimableAmount = await eventManager.getClaimablePayout(eventId, participant1.address);
          expect(claimableAmount).to.equal(DEPOSIT_AMOUNT);

          await eventManager.connect(participant1).claimPayout(eventId);
          expect(await eventManager.getUserBalance(participant1.address)).to.equal(DEPOSIT_AMOUNT);
        });
      });
    });
  });

  describe("Edge Cases and Security", function () {
    let eventId: number;

    beforeEach(async function () {
      await eventManager.connect(organizer).createAccount();
      const startTime = (await time.latest()) + 3600;
      const endTime = startTime + 3600;

      await eventManager
        .connect(organizer)
        .createEvent("Test Event Description", startTime, endTime, MIN_ATTENDANCE_BPS, CAPACITY);
      eventId = 1;
      await eventManager.connect(organizer).publishEvent(eventId);
    });

    it("Should enforce capacity limits", async function () {
      // Fill to capacity
      const participants = [participant1, participant2, participant3];

      for (const participant of participants) {
        await eventManager.connect(participant).createAccount();
        await eventManager.connect(participant).registerForEvent(eventId);
      }

      // Next registration should fail
      const [extraParticipant] = await ethers.getSigners();
      await mockUSDC.mint(extraParticipant.address, ethers.parseUnits("10000", 18));
      await mockUSDC.connect(extraParticipant).approve(await eventManager.getAddress(), ethers.parseUnits("10000", 18));
      await eventManager.connect(extraParticipant).createAccount();

      await expect(eventManager.connect(extraParticipant).registerForEvent(eventId)).to.be.revertedWith(
        "Event at capacity",
      );
    });

    it("Should handle zero attendees correctly", async function () {
      await eventManager.connect(participant1).createAccount();
      await eventManager.connect(participant1).registerForEvent(eventId);

      const startTime = (await time.latest()) + 3600;
      await time.increaseTo(startTime + 3600); // Skip to end time

      const initialOrganizerBalance = await eventManager.getUserBalance(organizer.address);

      await eventManager.connect(organizer).completeEvent(eventId);

      // Organizer should still get bond back + organizer share of forfeits
      const policy = await eventManager.policy();
      const forfeitPool = DEPOSIT_AMOUNT; // 1 no-show
      const organizerShare = (forfeitPool * BigInt(100n - policy.attendeeSharePercent)) / 100n;

      expect(await eventManager.getUserBalance(organizer.address)).to.be.gte(initialOrganizerBalance + organizerShare); // At least organizer share (bond might be penalized)
    });

    it("Should prevent unauthorized actions", async function () {
      await expect(eventManager.connect(participant1).publishEvent(eventId)).to.be.revertedWith(
        "Only organizer can publish",
      );

      await expect(eventManager.connect(participant1).cancelEvent(eventId)).to.be.revertedWith(
        "Only organizer or admin",
      );
    });

    it("Should handle withdrawal correctly", async function () {
      // Setup scenario where participant has balance
      await eventManager.connect(participant1).createAccount();
      await eventManager.connect(participant1).registerForEvent(eventId);
      await eventManager.connect(organizer).cancelEvent(eventId);
      await eventManager.connect(participant1).claimPayout(eventId);

      const balance = await eventManager.getUserBalance(participant1.address);
      expect(balance).to.be.gt(0);

      const initialTokenBalance = await mockUSDC.balanceOf(participant1.address);

      await expect(eventManager.connect(participant1).withdraw())
        .to.emit(eventManager, "Withdrawal")
        .withArgs(participant1.address, balance);

      expect(await mockUSDC.balanceOf(participant1.address)).to.equal(initialTokenBalance + balance);
      expect(await eventManager.getUserBalance(participant1.address)).to.equal(0);
    });
  });

  describe("View Functions", function () {
    it("Should return correct user balance", async function () {
      expect(await eventManager.getUserBalance(participant1.address)).to.equal(0);
    });

    it("Should return correct global values and policy", async function () {
      expect(await eventManager.attendeeDepositAmount()).to.equal(ethers.parseUnits("1", 18));
      expect(await eventManager.organizerBondAmount()).to.equal(ethers.parseUnits("10", 18));

      const policy = await eventManager.policy();
      expect(policy.fullRefundHours).to.equal(24);
      expect(policy.partialRefundHours).to.equal(2);
      expect(policy.partialRefundPercent).to.equal(50);
      expect(policy.attendeeSharePercent).to.equal(50);
    });
  });
});
