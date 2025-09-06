// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * Decentralized Event Management Contract
 */
contract EventManager is Ownable, ReentrancyGuard {
    IERC20 public immutable token;

    struct Bounds {
        uint256 minDeposit;
        uint256 maxDeposit;
        uint256 minBond;
        uint256 maxBond;
    }
    Bounds public bounds;
    PolicyConfig public policy;

    mapping(address => bool) public hasAccount;
    mapping(address => uint256) public balances;

    struct PolicyConfig {
        uint256 fullRefundHours;        // Hours before event for 100% refund
        uint256 partialRefundHours;     // Hours before event for partial refund  
        uint256 partialRefundPercent;   // Percent for partial refund (0-100)
        uint256 attendeeSharePercent;   // Percent of forfeits going to attendees (0-100)
    }

    enum EventStatus {
        Created,
        Published,
        Canceled,
        Completed
    }

    enum RegStatus {
        None,
        Confirmed,
        CanceledByParticipant,
        Attended
    }

    struct Registration {
        RegStatus status;
        bool exists;
    }

    struct Event {
        address organizer;
        uint256 deposit;
        uint256 bond;
        uint64 startTime;
        uint16 minAttendanceBps;
        uint32 capacity;
        EventStatus status;
        bool published;
        uint32 confirmedCount;
        uint32 attendedCount;
        bool bondReleased;
        uint256 forfeitPool;
        mapping(address => Registration) registrations;
        mapping(address => bool) rewardsClaimed;
    }

    mapping(uint256 => Event) public events;
    uint256 public nextEventId = 1;

    event AccountCreated(address indexed user);
    event EventCreated(uint256 indexed eventId, address indexed organizer);
    event EventPublished(uint256 indexed eventId);
    event EventCanceled(uint256 indexed eventId);
    event EventCompleted(uint256 indexed eventId);
    event RegistrationConfirmed(uint256 indexed eventId, address indexed participant);
    event RegistrationCanceled(uint256 indexed eventId, address indexed participant);
    event ParticipantCheckedIn(uint256 indexed eventId, address indexed participant);
    event RewardsClaimed(uint256 indexed eventId, address indexed participant, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    event BoundsUpdated(uint256 minDeposit, uint256 maxDeposit, uint256 minBond, uint256 maxBond);
    event PolicyUpdated(uint256 fullRefundHours, uint256 partialRefundHours, uint256 partialRefundPercent, uint256 attendeeSharePercent);

    constructor(address _token, address _owner) Ownable(_owner) {
        token = IERC20(_token);
        bounds = Bounds({
            minDeposit: 1e18,
            maxDeposit: 1000e18,
            minBond: 10e18,
            maxBond: 10000e18
        });
        policy = PolicyConfig({
            fullRefundHours: 24,
            partialRefundHours: 2, 
            partialRefundPercent: 50,
            attendeeSharePercent: 50
        });
    }

    function createAccount() external {
        require(!hasAccount[msg.sender], "Account already exists");
        hasAccount[msg.sender] = true;
        emit AccountCreated(msg.sender);
    }

    function setBounds(uint256 _minDeposit, uint256 _maxDeposit, uint256 _minBond, uint256 _maxBond) external onlyOwner {
        require(_minDeposit <= _maxDeposit, "Invalid deposit bounds");
        require(_minBond <= _maxBond, "Invalid bond bounds");
        bounds = Bounds(_minDeposit, _maxDeposit, _minBond, _maxBond);
        emit BoundsUpdated(_minDeposit, _maxDeposit, _minBond, _maxBond);
    }

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

    function createEvent(
        uint256 _deposit,
        uint256 _bond,
        uint64 _startTime,
        uint16 _minAttendanceBps,
        uint32 _capacity
    ) external nonReentrant returns (uint256) {
        require(hasAccount[msg.sender], "Must create account first");
        require(_deposit >= bounds.minDeposit && _deposit <= bounds.maxDeposit, "Invalid deposit amount");
        require(_bond >= bounds.minBond && _bond <= bounds.maxBond, "Invalid bond amount");
        require(_startTime > block.timestamp, "Start time must be in future");
        require(_minAttendanceBps <= 10000, "Invalid attendance BPS");
        require(_capacity > 0, "Capacity must be positive");

        token.transferFrom(msg.sender, address(this), _bond);

        uint256 eventId = nextEventId++;
        Event storage newEvent = events[eventId];
        newEvent.organizer = msg.sender;
        newEvent.deposit = _deposit;
        newEvent.bond = _bond;
        newEvent.startTime = _startTime;
        newEvent.minAttendanceBps = _minAttendanceBps;
        newEvent.capacity = _capacity;
        newEvent.status = EventStatus.Created;
        newEvent.published = false;

        emit EventCreated(eventId, msg.sender);
        return eventId;
    }

    function publishEvent(uint256 _eventId) external {
        Event storage evt = events[_eventId];
        require(evt.organizer == msg.sender, "Only organizer can publish");
        require(evt.status == EventStatus.Created, "Event already published or finalized");
        
        evt.published = true;
        evt.status = EventStatus.Published;
        
        emit EventPublished(_eventId);
    }

    function registerForEvent(uint256 _eventId) external nonReentrant {
        require(hasAccount[msg.sender], "Must create account first");
        
        Event storage evt = events[_eventId];
        require(evt.published, "Event not published");
        require(evt.status == EventStatus.Published, "Registration not open");
        require(evt.confirmedCount < evt.capacity, "Event at capacity");
        require(!evt.registrations[msg.sender].exists, "Already registered");
        require(block.timestamp < evt.startTime, "Registration closed");

        token.transferFrom(msg.sender, address(this), evt.deposit);

        evt.registrations[msg.sender] = Registration({
            status: RegStatus.Confirmed,
            exists: true
        });
        evt.confirmedCount++;

        emit RegistrationConfirmed(_eventId, msg.sender);
    }

    function cancelRegistration(uint256 _eventId) external nonReentrant {
        Event storage evt = events[_eventId];
        Registration storage reg = evt.registrations[msg.sender];
        
        require(reg.exists, "Not registered");
        require(reg.status == RegStatus.Confirmed, "Registration not active");

        reg.status = RegStatus.CanceledByParticipant;
        evt.confirmedCount--;

        uint256 refundAmount = _calculateRefund(evt, evt.deposit);
        if (refundAmount > 0) {
            balances[msg.sender] += refundAmount;
        }

        uint256 forfeitAmount = evt.deposit - refundAmount;
        if (forfeitAmount > 0) {
            evt.forfeitPool += forfeitAmount;
        }

        emit RegistrationCanceled(_eventId, msg.sender);
    }

    function checkIn(uint256 _eventId, address _participant) external {
        Event storage evt = events[_eventId];
        require(evt.organizer == msg.sender, "Only organizer can check-in");
        require(evt.status == EventStatus.Published, "Event not active");
        require(block.timestamp >= evt.startTime, "Event not started");
        
        Registration storage reg = evt.registrations[_participant];
        require(reg.exists, "Participant not registered");
        require(reg.status == RegStatus.Confirmed, "Registration not confirmed");

        reg.status = RegStatus.Attended;
        evt.attendedCount++;

        emit ParticipantCheckedIn(_eventId, _participant);
    }

    function completeEvent(uint256 _eventId) external nonReentrant {
        Event storage evt = events[_eventId];
        require(evt.organizer == msg.sender, "Only organizer can complete");
        require(evt.status == EventStatus.Published, "Event not active");
        require(!evt.bondReleased, "Bond already released");

        evt.status = EventStatus.Completed;
        evt.bondReleased = true;

        uint256 attendanceRate = evt.confirmedCount > 0 ? 
            (evt.attendedCount * 10000) / evt.confirmedCount : 0;

        if (attendanceRate >= evt.minAttendanceBps) {
            balances[evt.organizer] += evt.bond;
        } else {
            uint256 penalty = (evt.bond * (evt.minAttendanceBps - attendanceRate)) / evt.minAttendanceBps;
            balances[evt.organizer] += (evt.bond - penalty);
            evt.forfeitPool += penalty;
        }

        _distributeForfeitsByPolicy(evt);

        emit EventCompleted(_eventId);
    }

    function cancelEvent(uint256 _eventId) external nonReentrant {
        Event storage evt = events[_eventId];
        require(evt.organizer == msg.sender || msg.sender == owner(), "Only organizer or admin");
        require(evt.status == EventStatus.Published, "Event not active");

        evt.status = EventStatus.Canceled;
        
        emit EventCanceled(_eventId);
    }

    function claimPayout(uint256 _eventId) external nonReentrant {
        Event storage evt = events[_eventId];
        Registration storage reg = evt.registrations[msg.sender];
        
        require(evt.status == EventStatus.Completed || evt.status == EventStatus.Canceled, "Event not finalized");
        require(reg.exists, "Not registered for event");
        require(!evt.rewardsClaimed[msg.sender], "Payout already claimed");
        
        evt.rewardsClaimed[msg.sender] = true;
        
        uint256 totalPayout = 0;
        
        // If attended, get deposit back + share of forfeit pool
        if (reg.status == RegStatus.Attended) {
            totalPayout += evt.deposit; // Original deposit back
            totalPayout += _calculateReward(evt); // Share of forfeits
        }
        // If canceled event, everyone gets deposits back
        else if (evt.status == EventStatus.Canceled) {
            totalPayout += evt.deposit;
        }
        
        if (totalPayout > 0) {
            balances[msg.sender] += totalPayout;
        }
        
        emit RewardsClaimed(_eventId, msg.sender, totalPayout);
    }

    function withdraw() external nonReentrant {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance to withdraw");

        balances[msg.sender] = 0;
        token.transfer(msg.sender, amount);

        emit Withdrawal(msg.sender, amount);
    }

    function _calculateRefund(Event storage evt, uint256 depositAmount) private view returns (uint256) {
        uint256 timeUntilStart = evt.startTime > block.timestamp ? 
            evt.startTime - block.timestamp : 0;

        if (timeUntilStart >= policy.fullRefundHours * 1 hours) {
            return depositAmount;
        } else if (timeUntilStart >= policy.partialRefundHours * 1 hours) {
            return (depositAmount * policy.partialRefundPercent) / 100;
        } else {
            return 0;
        }
    }

    function _distributeForfeitsByPolicy(Event storage evt) private {
        if (evt.forfeitPool == 0) return;

        uint256 organizerShare = (evt.forfeitPool * (100 - policy.attendeeSharePercent)) / 100;
        if (organizerShare > 0) {
            balances[evt.organizer] += organizerShare;
            evt.forfeitPool -= organizerShare;
        }
        // Remaining forfeitPool distributed via claimPayout()
    }

    function _calculateReward(Event storage evt) private view returns (uint256) {
        if (evt.forfeitPool == 0 || evt.attendedCount == 0) {
            return 0;
        }

        // Attendees split the remaining forfeit pool equally
        return evt.forfeitPool / evt.attendedCount;
    }

    // View functions
    function getEvent(uint256 _eventId) external view returns (
        address organizer,
        uint256 deposit,
        uint256 bond,
        uint64 startTime,
        uint16 minAttendanceBps,
        uint32 capacity,
        EventStatus status,
        bool published,
        uint32 confirmedCount,
        uint32 attendedCount
    ) {
        Event storage evt = events[_eventId];
        return (
            evt.organizer,
            evt.deposit,
            evt.bond,
            evt.startTime,
            evt.minAttendanceBps,
            evt.capacity,
            evt.status,
            evt.published,
            evt.confirmedCount,
            evt.attendedCount
        );
    }

    function getRegistration(uint256 _eventId, address _participant) external view returns (RegStatus status, bool exists) {
        Registration storage reg = events[_eventId].registrations[_participant];
        return (reg.status, reg.exists);
    }

    function getUserBalance(address _user) external view returns (uint256) {
        return balances[_user];
    }

    function getClaimablePayout(uint256 _eventId, address _participant) external view returns (uint256) {
        Event storage evt = events[_eventId];
        Registration storage reg = evt.registrations[_participant];
        
        if ((evt.status != EventStatus.Completed && evt.status != EventStatus.Canceled) || 
            !reg.exists ||
            evt.rewardsClaimed[_participant]) {
            return 0;
        }
        
        uint256 totalPayout = 0;
        
        if (reg.status == RegStatus.Attended) {
            totalPayout += evt.deposit; // Original deposit back
            totalPayout += _calculateReward(evt); // Share of forfeits
        } else if (evt.status == EventStatus.Canceled) {
            totalPayout += evt.deposit;
        }
        
        return totalPayout;
    }

    function getEventForfeitPool(uint256 _eventId) external view returns (uint256) {
        return events[_eventId].forfeitPool;
    }
}