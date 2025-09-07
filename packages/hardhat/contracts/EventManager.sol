// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title EventManager
 * @notice Decentralized event management with accountability deposits
 * @dev Participants put down deposits that are forfeited if they don't attend.
 *      Forfeits are shared among actual attendees as rewards for showing up.
 */
contract EventManager is Ownable, ReentrancyGuard {
    // ═══════════════════════════════════════════════════════════════════
    //                           IMMUTABLES & STATE
    // ═══════════════════════════════════════════════════════════════════

    /// @notice ERC20 token used for all deposits and bonds
    IERC20 public immutable token;

    /// @notice Global deposit amount required for all events
    uint256 public attendeeDepositAmount;

    /// @notice Global bond amount required for all organizers
    uint256 public organizerBondAmount;

    /// @notice Global minimum attendance ratio for all events (in basis points, 3000 = 30%)
    uint16 public minAttendanceRatio;

    /// @notice Global refund policy configuration
    PolicyConfig public policy;

    /// @notice Tracks if a user has created an account
    mapping(address => bool) public isRegisteredUser;

    /// @notice User balances available for withdrawal
    mapping(address => uint256) public balances;

    /// @notice All events stored by ID
    mapping(uint256 => Event) public events;

    /// @notice Next event ID to assign. Currently we can use this for the sake of the hackathn.
    uint256 public nextEventId = 1;

    /// @notice Time after event ends when anyone can complete it (24 hours)
    uint256 public constant COMPLETION_DEADLINE = 24 hours;

    // ═══════════════════════════════════════════════════════════════════
    //                               STRUCTS
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Global policy for refunds and forfeit distribution
    struct PolicyConfig {
        uint256 fullRefundHours; // Hours before event for 100% refund
        uint256 partialRefundHours; // Hours before event for partial refund
        uint256 partialRefundPercent; // Percent for partial refund (0-100)
        uint256 attendeeSharePercent; // Percent of forfeits going to attendees (0-100)
    }

    /// @notice Individual participant registration
    struct Registration {
        RegStatus status; // Current registration state
        bool exists; // Whether registration record exists
    }

    /// @notice Complete event data and state
    struct Event {
        // Basic event info
        address organizer; // Who created the event
        string description; // Event description
        uint64 startTime; // When event begins
        uint64 endTime; // When event ends (for completion deadline)
        uint32 capacity; // Maximum participants
        // State management
        EventStatus status; // Current event state
        bool published; // Whether visible to participants
        bool bondReleased; // Whether organizer bond was distributed
        bool checkInClosed; // Whether check-in period is closed
        // Participation tracking
        uint32 confirmedCount; // Number of confirmed registrations
        uint32 attendedCount; // Number who actually showed up
        // Financial state
        uint256 forfeitPool; // Total forfeited deposits
        uint256 rewardPerAttendee; // Reward each attendee gets
        // Per-participant data
        mapping(address => Registration) registrations; // Registration status
        mapping(address => bool) rewardsClaimed; // Claim tracking
    }

    // ═══════════════════════════════════════════════════════════════════
    //                               ENUMS
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Event lifecycle states
    enum EventStatus {
        Published, // Event visible and accepting registrations
        Canceled, // Event canceled (full refunds)
        Completed // Event finished (settlements processed)
    }

    /// @notice Participant registration states
    enum RegStatus {
        None, // Not registered
        Confirmed, // Registered and deposit paid
        CanceledByParticipant, // Canceled before event
        Attended // Actually showed up
    }

    // ═══════════════════════════════════════════════════════════════════
    //                               EVENTS
    // ═══════════════════════════════════════════════════════════════════

    event AccountCreated(address indexed user);
    event EventCreated(uint256 indexed eventId, address indexed organizer);
    event EventCanceled(uint256 indexed eventId);
    event EventCompleted(uint256 indexed eventId);
    event CheckInClosed(uint256 indexed eventId);
    event RegistrationConfirmed(uint256 indexed eventId, address indexed participant);
    event RegistrationCanceled(uint256 indexed eventId, address indexed participant);
    event ParticipantCheckedIn(uint256 indexed eventId, address indexed participant);
    event RewardsClaimed(uint256 indexed eventId, address indexed participant, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    event PolicyUpdated(
        uint256 fullRefundHours,
        uint256 partialRefundHours,
        uint256 partialRefundPercent,
        uint256 attendeeSharePercent
    );

    // ═══════════════════════════════════════════════════════════════════
    //                             CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════

    constructor(address _token, address _owner) Ownable(_owner) {
        token = IERC20(_token);

        // Set default global deposit and bond amounts
        attendeeDepositAmount = 1e18; // 1 token default deposit
        organizerBondAmount = 10e18; // 10 token default organizer bond
        minAttendanceRatio = 3000; // 30% default minimum attendance

        // Set default refund policy
        policy = PolicyConfig({
            fullRefundHours: 24, // Full refund if cancel >24h before
            partialRefundHours: 2, // Partial refund if cancel >2h before
            partialRefundPercent: 50, // 50% refund in partial window
            attendeeSharePercent: 50 // 50% of forfeits go to attendees
        });
    }

    // ═══════════════════════════════════════════════════════════════════
    //                         ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Update global refund and forfeit policy
     * @param _fullRefundHours Hours before event for 100% refund
     * @param _partialRefundHours Hours before event for partial refund
     * @param _partialRefundPercent Percentage refund in partial window (0-100)
     * @param _attendeeSharePercent Percentage of forfeits going to attendees (0-100)
     */
    function updatePolicy(
        uint256 _fullRefundHours,
        uint256 _partialRefundHours,
        uint256 _partialRefundPercent,
        uint256 _attendeeSharePercent
    ) external onlyOwner {
        require(_partialRefundPercent <= 100, "Invalid partial refund percent");
        require(_attendeeSharePercent <= 100, "Invalid attendee share percent");
        require(_fullRefundHours >= _partialRefundHours, "Full refund hours must be >= partial");

        policy = PolicyConfig({
            fullRefundHours: _fullRefundHours,
            partialRefundHours: _partialRefundHours,
            partialRefundPercent: _partialRefundPercent,
            attendeeSharePercent: _attendeeSharePercent
        });

        emit PolicyUpdated(_fullRefundHours, _partialRefundHours, _partialRefundPercent, _attendeeSharePercent);
    }

    /**
     * @notice Update global deposit amount for all events
     * @param _deposit global deposit amount
     */
    function setAttendeeDepositAmount(uint256 _deposit) external onlyOwner {
        attendeeDepositAmount = _deposit;
    }

    /**
     * @notice Update global bond amount for all organizers
     * @param _bond global bond amount
     */
    function setOrganizerBondAmount(uint256 _bond) external onlyOwner {
        organizerBondAmount = _bond;
    }

    /**
     * @notice Update global minimum attendance ratio for all events
     * @param _ratio minimum attendance ratio in basis points (0-10000, 3000 = 30%)
     */
    function setMinAttendanceRatio(uint16 _ratio) external onlyOwner {
        require(_ratio <= 10000, "Ratio cannot exceed 100%");
        minAttendanceRatio = _ratio;
    }

    // ═══════════════════════════════════════════════════════════════════
    //                         ACCOUNT MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Create a user account (required before any other actions)
     * @dev Simple gate to prevent accidental interactions
     */
    function createAccount() external {
        require(!isRegisteredUser[msg.sender], "Account already exists");
        isRegisteredUser[msg.sender] = true;
        emit AccountCreated(msg.sender);
    }

    /**
     * @notice Withdraw available balance to external account
     * @dev Transfers entire balance
     */
    function withdraw() external nonReentrant {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance to withdraw");

        balances[msg.sender] = 0;
        token.transfer(msg.sender, amount);

        emit Withdrawal(msg.sender, amount);
    }

    // ═══════════════════════════════════════════════════════════════════
    //                         EVENT LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Create a new event (organizer pays bond upfront)
     * @param _description Event description
     * @param _startTime When event begins (unix timestamp)
     * @param _endTime When event ends (unix timestamp)
     * @param _capacity Maximum number of participants
     * @return eventId The ID of the created event
     */
    function createEvent(
        string memory _description,
        uint64 _startTime,
        uint64 _endTime,
        uint32 _capacity
    ) external nonReentrant returns (uint256) {
        require(isRegisteredUser[msg.sender], "Must create account first");
        require(_startTime > block.timestamp, "Start time must be in future");
        require(_endTime > _startTime, "End time must be after start time");
        require(_capacity > 0, "Capacity must be positive");

        // Take organizer bond upfront
        token.transferFrom(msg.sender, address(this), organizerBondAmount);

        uint256 eventId = nextEventId++;
        Event storage newEvent = events[eventId];
        newEvent.organizer = msg.sender;
        newEvent.description = _description;
        newEvent.startTime = _startTime;
        newEvent.endTime = _endTime;
        newEvent.capacity = _capacity;
        newEvent.status = EventStatus.Published;
        newEvent.published = true;

        emit EventCreated(eventId, msg.sender);
        return eventId;
    }

    /**
     * @notice Cancel event with admin vs organizer distinction and timing-based penalties
     * @param _eventId Event to cancel
     * @dev Can be called by organizer or admin. Admin cancellation gives everyone 100% refund.
     *      Organizer cancellation applies timing-based policy with penalties distributed to participants.
     */
    function cancelEvent(uint256 _eventId) external nonReentrant {
        Event storage evt = events[_eventId];
        require(evt.organizer == msg.sender || msg.sender == owner(), "Only organizer or admin");
        require(evt.status == EventStatus.Published, "Event not active");
        require(!evt.bondReleased, "Bond already released");

        evt.status = EventStatus.Canceled;
        evt.bondReleased = true;

        bool isAdmin = (msg.sender == owner());
        
        if (isAdmin) {
            // Admin cancellation: everyone gets 100% refund
            balances[evt.organizer] += organizerBondAmount;
            evt.forfeitPool = 0;  // Clear existing forfeits
            evt.rewardPerAttendee = 0;  // Clear rewards
        } else {
            // Organizer cancellation: apply timing-based policy
            uint256 organizerRefund = _calculateRefund(evt, organizerBondAmount);
            uint256 organizerPenalty = organizerBondAmount - organizerRefund;
            
            if (organizerRefund > 0) {
                balances[evt.organizer] += organizerRefund;
            }
            
            if (organizerPenalty > 0) {
                evt.forfeitPool += organizerPenalty;
            }
            
            // Distribute penalty to all confirmed participants
            if (evt.confirmedCount > 0 && evt.forfeitPool > 0) {
                evt.rewardPerAttendee = evt.forfeitPool / evt.confirmedCount;
            }
        }

        emit EventCanceled(_eventId);
    }

    /**
     * @notice Close check-in period and process no-show forfeits
     * @param _eventId Event to close check-in for
     * @dev Should be called after event ends, before completing
     */
    function closeCheckIn(uint256 _eventId) external {
        Event storage evt = events[_eventId];
        require(evt.organizer == msg.sender, "Only organizer can close check-in");
        require(evt.status == EventStatus.Published, "Event not active");
        require(block.timestamp >= evt.endTime, "Event not ended yet");
        require(!evt.checkInClosed, "Check-in already closed");

        evt.checkInClosed = true;

        // anyone confirmed but not attended forfeits deposit
        _processNoShowForfeits(evt);

        emit CheckInClosed(_eventId);
    }

    /**
     * @notice Mark event as complete and process settlements
     * @param _eventId Event to complete
     * @dev Handles organizer bond, forfeit distribution, and reward calculation
     */
    function completeEvent(uint256 _eventId) external nonReentrant {
        Event storage evt = events[_eventId];

        // Anyone can complete after deadline passes
        bool isOrganizer = (evt.organizer == msg.sender);
        bool isPastDeadline = (block.timestamp >= evt.endTime + COMPLETION_DEADLINE);
        require(isOrganizer || isPastDeadline, "Only organizer or after deadline");
        require(evt.status == EventStatus.Published, "Event not active");
        require(!evt.bondReleased, "Bond already released");

        // Ensure check-in is closed first
        if (!evt.checkInClosed) {
            evt.checkInClosed = true;
            _processNoShowForfeits(evt);
        }

        evt.status = EventStatus.Completed;
        evt.bondReleased = true;

        // required = floor(confirmed * ratio / 10000)
        uint256 confirmed = uint256(evt.confirmedCount);
        uint256 attended = uint256(evt.attendedCount);
        uint256 required = (confirmed * uint256(minAttendanceRatio)) / 10000;

        if (required == 0 || attended >= required) {
            // Met attendance target (or nothing required) -> full bond refund
            balances[evt.organizer] += organizerBondAmount;
        } else {
            // Proportional penalty: missing/required of the bond (caps at 100%)
            uint256 missing = required - attended;
            uint256 penalty = (organizerBondAmount * missing) / required; // safe since required > 0
            uint256 refund = organizerBondAmount - penalty;

            if (refund > 0) {
                balances[evt.organizer] += refund;
            }
            if (penalty > 0) {
                // keep your existing redistribution flow
                evt.forfeitPool += penalty;
            }
        }

        // Distribute forfeited deposits by policy (attendee/organizer split)
        _distributeForfeitsByPolicy(evt);

        emit EventCompleted(_eventId);
    }

    // ═══════════════════════════════════════════════════════════════════
    //                      PARTICIPANT FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Register for an event (pays deposit)
     * Currently no need for registration approval.
     * @param _eventId Event to register for
     */
    function registerForEvent(uint256 _eventId) external nonReentrant {
        require(isRegisteredUser[msg.sender], "Must create account first");

        Event storage evt = events[_eventId];
        require(evt.published, "Event not published");
        require(evt.status == EventStatus.Published, "Registration not open");
        require(evt.confirmedCount < evt.capacity, "Event at capacity");
        require(!evt.registrations[msg.sender].exists, "Already registered");
        // Allow registration up to and including start time
        require(block.timestamp <= evt.startTime, "Registration closed");

        // Take participant deposit
        token.transferFrom(msg.sender, address(this), attendeeDepositAmount);

        evt.registrations[msg.sender] = Registration({ status: RegStatus.Confirmed, exists: true });
        evt.confirmedCount++;

        emit RegistrationConfirmed(_eventId, msg.sender);
    }

    /**
     * @notice Cancel registration (may incur forfeit based on timing)
     * @param _eventId Event to cancel registration for
     */
    function cancelRegistration(uint256 _eventId) external nonReentrant {
        Event storage evt = events[_eventId];
        Registration storage reg = evt.registrations[msg.sender];

        require(reg.exists, "Not registered");
        require(reg.status == RegStatus.Confirmed, "Registration not active");

        reg.status = RegStatus.CanceledByParticipant;
        evt.confirmedCount--;

        // Calculate refund based on timing
        uint256 refundAmount = _calculateRefund(evt, attendeeDepositAmount);
        if (refundAmount > 0) {
            balances[msg.sender] += refundAmount;
        }

        // Add forfeit to pool
        uint256 forfeitAmount = attendeeDepositAmount - refundAmount;
        if (forfeitAmount > 0) {
            evt.forfeitPool += forfeitAmount;
        }

        emit RegistrationCanceled(_eventId, msg.sender);
    }

    /**
     * @notice Claim payout after event completion/cancellation
     * @param _eventId Event to claim from
     * @dev Returns deposit + reward share for attendees, or full deposit + penalty share for canceled events
     */
    function claimPayout(uint256 _eventId) external nonReentrant {
        Event storage evt = events[_eventId];
        Registration storage reg = evt.registrations[msg.sender];

        require(evt.status == EventStatus.Completed || evt.status == EventStatus.Canceled, "Event not finalized");
        require(reg.exists, "Not registered for event");
        require(!evt.rewardsClaimed[msg.sender], "Payout already claimed");

        uint256 totalPayout = _getClaimablePayout(_eventId, msg.sender);

        evt.rewardsClaimed[msg.sender] = true;

        if (totalPayout > 0) {
            balances[msg.sender] += totalPayout;
        }

        emit RewardsClaimed(_eventId, msg.sender, totalPayout);
    }

    // ═══════════════════════════════════════════════════════════════════
    //                      ORGANIZER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Check in a participant (marks them as attended)
     * @param _eventId Event ID
     * @param _participant Address to check in
     * @dev Only callable by event organizer after event start time
     */
    function checkIn(uint256 _eventId, address _participant) external {
        Event storage evt = events[_eventId];
        require(evt.organizer == msg.sender, "Only organizer can check-in");
        require(evt.status == EventStatus.Published, "Event not active");
        require(block.timestamp >= evt.startTime, "Event not started");
        require(!evt.checkInClosed, "Check-in period closed");

        Registration storage reg = evt.registrations[_participant];
        require(reg.exists, "Participant not registered");
        require(reg.status == RegStatus.Confirmed, "Registration not confirmed");

        reg.status = RegStatus.Attended;
        evt.attendedCount++;

        emit ParticipantCheckedIn(_eventId, _participant);
    }

    // ═══════════════════════════════════════════════════════════════════
    //                         INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @param evt Event storage reference
     */
    function _processNoShowForfeits(Event storage evt) private {
        // Calculate no-shows and add their deposits to forfeit pool
        uint256 noShows = evt.confirmedCount - evt.attendedCount;
        if (noShows > 0) {
            evt.forfeitPool += (noShows * attendeeDepositAmount);
        }
    }

    /**
     * @notice Calculate refund amount based on cancellation timing
     * @param evt Event storage reference
     * @param depositAmount Original deposit amount
     * @return refundAmount Amount to refund
     */
    function _calculateRefund(Event storage evt, uint256 depositAmount) private view returns (uint256) {
        uint256 timeUntilStart = evt.startTime > block.timestamp ? evt.startTime - block.timestamp : 0;

        if (timeUntilStart >= policy.fullRefundHours * 1 hours) {
            // Early cancellation - full refund
            return depositAmount;
        } else if (timeUntilStart >= policy.partialRefundHours * 1 hours) {
            // Late cancellation - partial refund
            return (depositAmount * policy.partialRefundPercent) / 100;
        } else {
            // Very late or after start - no refund
            return 0;
        }
    }

    /**
     * Distribute forfeit pool between organizer and attendees
     * @param evt Event storage reference
     * @dev Called during event completion
     */
    function _distributeForfeitsByPolicy(Event storage evt) private {
        if (evt.forfeitPool == 0) return;

        uint256 originalForfeitPool = evt.forfeitPool;
        uint256 organizerShare = (originalForfeitPool * (100 - policy.attendeeSharePercent)) / 100;
        uint256 attendeeShare = originalForfeitPool - organizerShare;

        // Give organizer their share immediately
        if (organizerShare > 0) {
            balances[evt.organizer] += organizerShare;
        }

        // Calculate reward per attendee from attendee share
        if (evt.attendedCount > 0 && attendeeShare > 0) {
            evt.rewardPerAttendee = attendeeShare / evt.attendedCount;
        } else {
            evt.rewardPerAttendee = 0;
        }
    }

    /**
     * @notice Internal function to calculate claimable payout for a participant
     * @param _eventId Event ID
     * @param _participant Participant address
     * @return Claimable amount
     */
    function _getClaimablePayout(uint256 _eventId, address _participant) internal view returns (uint256) {
        Event storage evt = events[_eventId];
        Registration storage reg = evt.registrations[_participant];

        // Check if claim is valid
        if (
            (evt.status != EventStatus.Completed && evt.status != EventStatus.Canceled) ||
            !reg.exists ||
            evt.rewardsClaimed[_participant]
        ) {
            return 0;
        }

        uint256 totalPayout = 0;

        if (reg.status == RegStatus.Attended) {
            // Attended: get deposit back + share of forfeit pool
            totalPayout += attendeeDepositAmount; // Original deposit back
            totalPayout += evt.rewardPerAttendee; // Share of forfeits
        } else if (evt.status == EventStatus.Canceled) {
            // Event canceled: deposit + share of organizer penalty (if any)
            totalPayout += attendeeDepositAmount; // Full deposit refund
            if (reg.status == RegStatus.Confirmed || reg.status == RegStatus.CanceledByParticipant) {
                totalPayout += evt.rewardPerAttendee; // Share of organizer penalty
            }
        }
        return totalPayout;
    }

    // ═══════════════════════════════════════════════════════════════════
    //                           VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Get basic event information
     * @param _eventId Event to query
     */
    function getEvent(
        uint256 _eventId
    )
        external
        view
        returns (
            address organizer,
            string memory description,
            uint64 startTime,
            uint64 endTime,
            uint32 capacity,
            EventStatus status,
            bool published,
            uint32 confirmedCount,
            uint32 attendedCount
        )
    {
        Event storage evt = events[_eventId];
        return (
            evt.organizer,
            evt.description,
            evt.startTime,
            evt.endTime,
            evt.capacity,
            evt.status,
            evt.published,
            evt.confirmedCount,
            evt.attendedCount
        );
    }

    /**
     * @notice Get participant's registration status for an event
     * @param _eventId Event ID
     * @param _participant Participant address
     * @return status Registration status
     * @return exists Whether registration exists
     */
    function getRegistration(
        uint256 _eventId,
        address _participant
    ) external view returns (RegStatus status, bool exists) {
        Registration storage reg = events[_eventId].registrations[_participant];
        return (reg.status, reg.exists);
    }

    /**
     * @notice Get user's available balance
     * @param _user User address
     * @return Available balance
     */
    function getUserBalance(address _user) external view returns (uint256) {
        return balances[_user];
    }

    /**
     * @notice Calculate claimable payout for a participant
     * @param _eventId Event ID
     * @param _participant Participant address
     * @return Claimable amount
     */
    function getClaimablePayout(uint256 _eventId, address _participant) external view returns (uint256) {
        return _getClaimablePayout(_eventId, _participant);
    }

    /**
     * @notice Get current forfeit pool for an event
     * @param _eventId Event ID
     * @return Current forfeit pool amount
     */
    function getEventForfeitPool(uint256 _eventId) external view returns (uint256) {
        return events[_eventId].forfeitPool;
    }
}
