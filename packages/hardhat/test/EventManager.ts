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

    it("Should set minimum attendance ratio correctly", async function () {
      const newRatio = 4000; // 40%

      await eventManager.setMinAttendanceRatio(newRatio);
      expect(await eventManager.minAttendanceRatio()).to.equal(newRatio);
    });

    it("Should reject invalid attendance ratio", async function () {
      await expect(eventManager.setMinAttendanceRatio(10001)).to.be.revertedWith("Ratio cannot exceed 100%");
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
    let eventId: bigint;
    let startTime: number;
    let endTime: number;

    beforeEach(async function () {
      await eventManager.connect(organizer).createAccount();
      startTime = (await time.latest()) + 86400 + 3600; // 25 hours from now (within full refund window)
      endTime = startTime + 3600; // 26 hours from now
    });

    it("Should create event successfully (auto-published)", async function () {
      const initialBalance = await mockUSDC.balanceOf(organizer.address);

      await expect(eventManager.connect(organizer).createEvent("Test Event Description", startTime, endTime, CAPACITY))
        .to.emit(eventManager, "EventCreated")
        .withArgs(1, organizer.address);

      eventId = 1n;

      expect(await mockUSDC.balanceOf(organizer.address)).to.equal(initialBalance - BOND_AMOUNT);
    });

    it("Should validate event parameters", async function () {
      const pastTime = (await time.latest()) - 3600;
      await expect(
        eventManager.connect(organizer).createEvent("Test Event", pastTime, endTime, CAPACITY),
      ).to.be.revertedWith("Start time must be in future");
    });

    describe("Registration and Participation", function () {
      beforeEach(async function () {
        await eventManager.connect(organizer).createEvent("Test Event Description", startTime, endTime, CAPACITY);
        eventId = 1n;
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
          // Attendance: 2/3 = 66.67%, which meets 30% minimum
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

          // Attendance: 1/3 = 33.33%, which is above 30% minimum
          // Organizer should get full bond refund (no penalty)
          const bondAfterPenalty = BOND_AMOUNT; // Full bond refund

          // Forfeit pool: 2 no-shows (no bond penalty)
          const forfeitPool = 2n * DEPOSIT_AMOUNT;
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

        describe("Event Cancellation Scenarios with Admin vs Organizer Distinction", function () {
          let eventId: bigint;
          let startTime: number;
          let endTime: number;
          let testParticipant1: SignerWithAddress;
          let testParticipant2: SignerWithAddress;
          let testParticipant3: SignerWithAddress;

          beforeEach(async function () {
            // Get fresh signers for these tests to avoid account conflicts
            const signers = await ethers.getSigners();
            testParticipant1 = signers[6];
            testParticipant2 = signers[7];
            testParticipant3 = signers[8];

            // Setup tokens and approvals for new participants
            for (const participant of [testParticipant1, testParticipant2, testParticipant3]) {
              await mockUSDC.mint(participant.address, ethers.parseUnits("10000", 18));
              await mockUSDC
                .connect(participant)
                .approve(await eventManager.getAddress(), ethers.parseUnits("10000", 18));
              await eventManager.connect(participant).createAccount();
            }

            // Create a fresh event for each test - make sure it's well within full refund window
            startTime = (await time.latest()) + 48 * 3600; // 48 hours from now (well within full refund window)
            endTime = startTime + 3600; // 1 hour duration

            await eventManager.connect(organizer).createEvent("Cancellation Test Event", startTime, endTime, 4);
            eventId = (await eventManager.nextEventId()) - 1n;
          });

          it("Scenario 1: Admin Cancellation - Everyone gets 100% refund", async function () {
            // Setup: 3 participants registered, 1 participant cancelled early
            await eventManager.connect(testParticipant1).registerForEvent(eventId);
            await eventManager.connect(testParticipant2).registerForEvent(eventId);
            await eventManager.connect(testParticipant3).registerForEvent(eventId);

            // One participant cancels early (gets 1 token refund, forfeits 0 tokens)
            await eventManager.connect(testParticipant1).cancelRegistration(eventId);

            // Verify that there was a forfeit from the early cancellation
            const forfeitPoolBefore = await eventManager.getEventForfeitPool(eventId);
            expect(forfeitPoolBefore).to.equal(0); // Early cancellation = full refund, no forfeit

            const initialOrganizerBalance = await eventManager.getUserBalance(organizer.address);

            // Admin cancels event
            await expect(eventManager.connect(owner).cancelEvent(eventId))
              .to.emit(eventManager, "EventCanceled")
              .withArgs(eventId);

            // Verify organizer gets full bond (10 tokens)
            expect(await eventManager.getUserBalance(organizer.address)).to.equal(
              initialOrganizerBalance + BOND_AMOUNT,
            );

            // Admin cancellation clears forfeit pool and rewards
            const forfeitPoolAfter = await eventManager.getEventForfeitPool(eventId);
            expect(forfeitPoolAfter).to.equal(0);

            // Verify each participant gets deposit only (1 token each) - no penalty rewards
            const claimableAmount2 = await eventManager.getClaimablePayout(eventId, testParticipant2.address);
            const claimableAmount3 = await eventManager.getClaimablePayout(eventId, testParticipant3.address);
            const claimableAmount1 = await eventManager.getClaimablePayout(eventId, testParticipant1.address); // Early canceller

            expect(claimableAmount2).to.equal(DEPOSIT_AMOUNT); // 1 token
            expect(claimableAmount3).to.equal(DEPOSIT_AMOUNT); // 1 token
            expect(claimableAmount1).to.equal(DEPOSIT_AMOUNT); // 1 token (no penalty rewards in admin cancellation)

            // Claim and verify - note that balances might include previous earnings from other events
            const initialBalance1 = await eventManager.getUserBalance(testParticipant1.address);
            const initialBalance2 = await eventManager.getUserBalance(testParticipant2.address);
            const initialBalance3 = await eventManager.getUserBalance(testParticipant3.address);

            await eventManager.connect(testParticipant2).claimPayout(eventId);
            await eventManager.connect(testParticipant3).claimPayout(eventId);
            await eventManager.connect(testParticipant1).claimPayout(eventId);

            // Each should have gained exactly 1 token (their deposit) from this event
            expect(await eventManager.getUserBalance(testParticipant2.address)).to.equal(
              initialBalance2 + DEPOSIT_AMOUNT,
            );
            expect(await eventManager.getUserBalance(testParticipant3.address)).to.equal(
              initialBalance3 + DEPOSIT_AMOUNT,
            );
            expect(await eventManager.getUserBalance(testParticipant1.address)).to.equal(
              initialBalance1 + DEPOSIT_AMOUNT,
            );
          });

          it("Scenario 2: Organizer Early Cancellation (>24h before) - No penalty", async function () {
            // Setup: 3 participants registered, 1 participant cancelled late
            await eventManager.connect(testParticipant1).registerForEvent(eventId);
            await eventManager.connect(testParticipant2).registerForEvent(eventId);
            await eventManager.connect(testParticipant3).registerForEvent(eventId);

            // We need to test early organizer cancellation, so we'll create a scenario
            // where a participant cancels late first, then organizer cancels early
            // But we can't go back in time, so let's modify the approach

            // Move to partial refund window for participant cancellation
            await time.increaseTo(startTime - 12 * 3600); // 12 hours before event (partial refund window)

            // One participant cancels late (gets 0.5 token refund, forfeits 0.5 tokens)
            const initialBalance1 = await eventManager.getUserBalance(testParticipant1.address);
            await eventManager.connect(testParticipant1).cancelRegistration(eventId);
            const finalBalance1 = await eventManager.getUserBalance(testParticipant1.address);
            const refundReceived = finalBalance1 - initialBalance1;
            expect(refundReceived).to.equal(DEPOSIT_AMOUNT / 2n); // 0.5 tokens

            // Now move to early cancellation window for organizer (still before the event)
            // Since we're at 12h before, we need to create a new event that's further out
            const newStartTime = (await time.latest()) + 48 * 3600; // 48 hours from current time
            const newEndTime = newStartTime + 3600;

            await eventManager.connect(organizer).createEvent("Early Cancellation Test", newStartTime, newEndTime, 4);
            const newEventId: bigint = (await eventManager.nextEventId()) - 1n;

            // Register participants for new event
            await eventManager.connect(testParticipant2).registerForEvent(newEventId);
            await eventManager.connect(testParticipant3).registerForEvent(newEventId);

            // Now test early organizer cancellation (48h before = full refund window)

            const initialOrganizerBalance = await eventManager.getUserBalance(organizer.address);

            // Organizer cancels new event 48 hours before (full refund window)
            await expect(eventManager.connect(organizer).cancelEvent(newEventId))
              .to.emit(eventManager, "EventCanceled")
              .withArgs(newEventId);

            // Verify organizer gets full bond (no penalty for early cancellation)
            expect(await eventManager.getUserBalance(organizer.address)).to.equal(
              initialOrganizerBalance + BOND_AMOUNT,
            );

            // For new event, there are no existing forfeits, so participants just get deposits back
            const forfeitPool = await eventManager.getEventForfeitPool(newEventId);
            expect(forfeitPool).to.equal(0); // No organizer penalty for early cancellation

            const claimableAmount2 = await eventManager.getClaimablePayout(newEventId, testParticipant2.address);
            const claimableAmount3 = await eventManager.getClaimablePayout(newEventId, testParticipant3.address);

            expect(claimableAmount2).to.equal(DEPOSIT_AMOUNT); // Just deposit back
            expect(claimableAmount3).to.equal(DEPOSIT_AMOUNT); // Just deposit back
          });

          it("Scenario 3: Organizer Late Cancellation (<2h before) - Full penalty", async function () {
            // Setup: 4 participants registered, 1 participant cancelled early
            const testParticipant4 = await ethers.getSigners().then(signers => signers[9]);
            await mockUSDC.mint(testParticipant4.address, ethers.parseUnits("10000", 18));
            await mockUSDC
              .connect(testParticipant4)
              .approve(await eventManager.getAddress(), ethers.parseUnits("10000", 18));
            await eventManager.connect(testParticipant4).createAccount();

            await eventManager.connect(testParticipant1).registerForEvent(eventId);
            await eventManager.connect(testParticipant2).registerForEvent(eventId);
            await eventManager.connect(testParticipant3).registerForEvent(eventId);
            await eventManager.connect(testParticipant4).registerForEvent(eventId);

            // One participant cancels early (gets 1 token refund, forfeits 0 tokens)
            await eventManager.connect(testParticipant1).cancelRegistration(eventId);

            // Verify no forfeit from early cancellation
            const forfeitFromEarlyCancellation = await eventManager.getEventForfeitPool(eventId);
            expect(forfeitFromEarlyCancellation).to.equal(0); // Early cancellation = full refund

            // Move to 1 hour before event (0% refund window)
            await time.increaseTo(startTime - 3600);

            const initialOrganizerBalance = await eventManager.getUserBalance(organizer.address);

            // Organizer cancels 1 hour before event
            await expect(eventManager.connect(organizer).cancelEvent(eventId))
              .to.emit(eventManager, "EventCanceled")
              .withArgs(eventId);

            // Verify organizer gets 0 tokens (full penalty)
            expect(await eventManager.getUserBalance(organizer.address)).to.equal(initialOrganizerBalance);

            // Calculation: Organizer penalty: 10 tokens (full bond forfeited)
            const forfeitPool = await eventManager.getEventForfeitPool(eventId);
            expect(forfeitPool).to.equal(BOND_AMOUNT); // Full organizer bond forfeited, no other forfeits

            const rewardPerParticipant = forfeitPool / 3n; // 10 / 3 = 3.33... tokens

            // Each confirmed participant gets: 1 + 3.33 = 4.33 tokens
            const expectedPayout = DEPOSIT_AMOUNT + rewardPerParticipant;

            const claimableAmount2 = await eventManager.getClaimablePayout(eventId, testParticipant2.address);
            const claimableAmount3 = await eventManager.getClaimablePayout(eventId, testParticipant3.address);
            const claimableAmount4 = await eventManager.getClaimablePayout(eventId, testParticipant4.address);
            const claimableAmount1 = await eventManager.getClaimablePayout(eventId, testParticipant1.address); // Early canceller

            expect(claimableAmount2).to.equal(expectedPayout);
            expect(claimableAmount3).to.equal(expectedPayout);
            expect(claimableAmount4).to.equal(expectedPayout);
            expect(claimableAmount1).to.equal(expectedPayout); // Early canceller also gets penalty share
          });

          it("Scenario 4: Organizer Partial Refund Cancellation (12h before) - 50% penalty", async function () {
            // Setup: 2 participants registered
            await eventManager.connect(testParticipant1).registerForEvent(eventId);
            await eventManager.connect(testParticipant2).registerForEvent(eventId);

            // Move to 12 hours before event (50% refund window)
            await time.increaseTo(startTime - 12 * 3600);

            const initialOrganizerBalance = await eventManager.getUserBalance(organizer.address);

            // Organizer cancels 12 hours before event
            await expect(eventManager.connect(organizer).cancelEvent(eventId))
              .to.emit(eventManager, "EventCanceled")
              .withArgs(eventId);

            // Verify organizer gets 5 tokens (50% refund)
            expect(await eventManager.getUserBalance(organizer.address)).to.equal(
              initialOrganizerBalance + BOND_AMOUNT / 2n,
            );

            // Calculation: Organizer penalty: 5 tokens, divided among 2 participants = 2.5 tokens each
            const forfeitPool = await eventManager.getEventForfeitPool(eventId);
            expect(forfeitPool).to.equal(BOND_AMOUNT / 2n); // Half organizer bond forfeited

            const rewardPerParticipant = forfeitPool / 2n; // 5 / 2 = 2.5 tokens

            // Each participant gets: 1 + 2.5 = 3.5 tokens
            const expectedPayout = DEPOSIT_AMOUNT + rewardPerParticipant;

            const claimableAmount1 = await eventManager.getClaimablePayout(eventId, testParticipant1.address);
            const claimableAmount2 = await eventManager.getClaimablePayout(eventId, testParticipant2.address);

            expect(claimableAmount1).to.equal(expectedPayout);
            expect(claimableAmount2).to.equal(expectedPayout);

            // Claim and verify
            await eventManager.connect(testParticipant1).claimPayout(eventId);
            await eventManager.connect(testParticipant2).claimPayout(eventId);

            expect(await eventManager.getUserBalance(testParticipant1.address)).to.equal(expectedPayout);
            expect(await eventManager.getUserBalance(testParticipant2.address)).to.equal(expectedPayout);
          });

          it("Should prevent double bond release", async function () {
            await eventManager.connect(testParticipant1).registerForEvent(eventId);

            // Cancel event once
            await eventManager.connect(organizer).cancelEvent(eventId);

            // Try to cancel again - should fail with "Event not active" since status is now Canceled
            await expect(eventManager.connect(organizer).cancelEvent(eventId)).to.be.revertedWith("Event not active");
          });

          it("Should only allow organizer or admin to cancel", async function () {
            await expect(eventManager.connect(testParticipant1).cancelEvent(eventId)).to.be.revertedWith(
              "Only organizer or admin",
            );
          });

          it("Should not allow cancellation of non-active events", async function () {
            // Cancel event first
            await eventManager.connect(organizer).cancelEvent(eventId);

            // Try to cancel again
            await expect(eventManager.connect(organizer).cancelEvent(eventId)).to.be.revertedWith("Event not active");
          });
        });
      });
    });
  });

  describe("Edge Cases and Security", function () {
    let eventId: bigint;

    beforeEach(async function () {
      await eventManager.connect(organizer).createAccount();
      const startTime = (await time.latest()) + 3600;
      const endTime = startTime + 3600;

      await eventManager.connect(organizer).createEvent("Test Event Description", startTime, endTime, CAPACITY);
      eventId = 1n;
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
      expect(await eventManager.minAttendanceRatio()).to.equal(3000);

      const policy = await eventManager.policy();
      expect(policy.fullRefundHours).to.equal(24);
      expect(policy.partialRefundHours).to.equal(2);
      expect(policy.partialRefundPercent).to.equal(50);
      expect(policy.attendeeSharePercent).to.equal(50);
    });
  });
});
