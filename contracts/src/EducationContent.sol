// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {BFNAccessUUPSUpgradeable} from "./base/BFNAccessUUPSUpgradeable.sol";
import {BFNRoles} from "./base/BFNRoles.sol";
import {IRegistry} from "./interfaces/IRegistry.sol";

/**
 * @title EducationContent - On-Chain Education Backend
 * @notice Decentralized education content and progress tracking on smart contracts
 * @dev Replaces off-chain backend with fully on-chain course management and progress tracking
 */
contract EducationContent is Initializable, BFNAccessUUPSUpgradeable {
    /// @notice Course structure stored on-chain
    struct Course {
        string title;
        string description;
        string ipfsContentHash; // Course materials stored on IPFS
        uint256 totalLessons;
        bool active;
        uint256 createdAt;
        address creator;
    }
    
    /// @notice Lesson structure within courses
    struct Lesson {
        string title;
        string ipfsContentHash;
        uint256 order;
        bool active;
    }
    
    /// @notice User progress tracking
    struct UserProgress {
        mapping(uint256 => bool) completedLessons; // lessonId => completed
        uint256 completedCount;
        uint256 lastActivityAt;
        uint256 streak; // consecutive days of activity
        uint256 lastStreakDate;
    }
    
    /// @notice Learning streak tracking
    struct LearningStreak {
        uint256 currentStreak;
        uint256 longestStreak;
        uint256 lastActivityDate; // normalized to days since epoch
    }

    IRegistry public registry;
    
    // Storage mappings
    mapping(uint256 => Course) public courses;
    mapping(uint256 => mapping(uint256 => Lesson)) public lessons; // courseId => lessonId => lesson
    mapping(address => mapping(uint256 => UserProgress)) private userProgress; // user => courseId => progress
    mapping(address => LearningStreak) public learningStreaks;
    
    uint256 public courseCount;
    mapping(uint256 => uint256) public courseLessonCount; // courseId => lesson count
    
    // Events
    event CourseCreated(uint256 indexed courseId, string title, address creator);
    event LessonAdded(uint256 indexed courseId, uint256 indexed lessonId, string title);
    event LessonCompleted(address indexed user, uint256 indexed courseId, uint256 indexed lessonId);
    event CourseCompleted(address indexed user, uint256 indexed courseId);
    event StreakUpdated(address indexed user, uint256 newStreak, uint256 longestStreak);
    
    // Errors
    error CourseNotFound(uint256 courseId);
    error LessonNotFound(uint256 courseId, uint256 lessonId);
    error AlreadyCompleted(address user, uint256 lessonId);
    error NotRegistered(address user);
    error EmptyContent();
    error CourseInactive();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address _registry) external initializer {
        __BFNAccessUUPS_init(admin);
        registry = IRegistry(_registry);
    }
    
    /**
     * @notice Create a new course (admin/content creator only)
     * @param title Course title
     * @param description Course description  
     * @param ipfsContentHash IPFS hash for course materials
     */
    function createCourse(
        string calldata title,
        string calldata description,
        string calldata ipfsContentHash
    ) external onlyRole(BFNRoles.ISSUER_ROLE) returns (uint256 courseId) {
        if (bytes(title).length == 0 || bytes(ipfsContentHash).length == 0) revert EmptyContent();
        
        courseId = ++courseCount;
        Course storage course = courses[courseId];
        course.title = title;
        course.description = description;
        course.ipfsContentHash = ipfsContentHash;
        course.active = true;
        course.createdAt = block.timestamp;
        course.creator = msg.sender;
        
        emit CourseCreated(courseId, title, msg.sender);
    }
    
    /**
     * @notice Add a lesson to a course
     * @param courseId Target course ID
     * @param title Lesson title
     * @param ipfsContentHash IPFS hash for lesson content
     */
    function addLesson(
        uint256 courseId,
        string calldata title,
        string calldata ipfsContentHash
    ) external onlyRole(BFNRoles.ISSUER_ROLE) returns (uint256 lessonId) {
        if (!courses[courseId].active) revert CourseNotFound(courseId);
        if (bytes(title).length == 0 || bytes(ipfsContentHash).length == 0) revert EmptyContent();
        
        lessonId = ++courseLessonCount[courseId];
        Lesson storage lesson = lessons[courseId][lessonId];
        lesson.title = title;
        lesson.ipfsContentHash = ipfsContentHash;
        lesson.order = lessonId;
        lesson.active = true;
        
        courses[courseId].totalLessons = lessonId;
        
        emit LessonAdded(courseId, lessonId, title);
    }
    
    /**
     * @notice Mark a lesson as completed (registered users only)
     * @param courseId Course containing the lesson
     * @param lessonId Lesson to mark complete
     */
    function completeLesson(uint256 courseId, uint256 lessonId) external {
        if (!registry.isRegistered(msg.sender)) revert NotRegistered(msg.sender);
        if (!courses[courseId].active) revert CourseNotFound(courseId);
        if (!lessons[courseId][lessonId].active) revert LessonNotFound(courseId, lessonId);
        
        UserProgress storage progress = userProgress[msg.sender][courseId];
        
        // Prevent double completion
        if (progress.completedLessons[lessonId]) revert AlreadyCompleted(msg.sender, lessonId);
        
        // Mark lesson completed
        progress.completedLessons[lessonId] = true;
        progress.completedCount++;
        progress.lastActivityAt = block.timestamp;
        
        // Update learning streak
        _updateLearningStreak(msg.sender);
        
        emit LessonCompleted(msg.sender, courseId, lessonId);
        
        // Check if course is completed
        if (progress.completedCount == courses[courseId].totalLessons) {
            emit CourseCompleted(msg.sender, courseId);
        }
    }
    
    /**
     * @notice Update user's learning streak based on daily activity
     * @param user User address to update streak for
     */
    function _updateLearningStreak(address user) private {
        LearningStreak storage streak = learningStreaks[user];
        uint256 today = block.timestamp / 1 days;
        
        if (streak.lastActivityDate == 0) {
            // First activity
            streak.currentStreak = 1;
            streak.longestStreak = 1;
        } else if (streak.lastActivityDate == today - 1) {
            // Consecutive day
            streak.currentStreak++;
            if (streak.currentStreak > streak.longestStreak) {
                streak.longestStreak = streak.currentStreak;
            }
        } else if (streak.lastActivityDate < today - 1) {
            // Streak broken
            streak.currentStreak = 1;
        }
        // Same day activity doesn't change streak
        
        streak.lastActivityDate = today;
        
        emit StreakUpdated(user, streak.currentStreak, streak.longestStreak);
    }
    
    /**
     * @notice Get course information
     * @param courseId Course to query
     * @return Course struct data
     */
    function getCourse(uint256 courseId) external view returns (Course memory) {
        if (courseId == 0 || courseId > courseCount) revert CourseNotFound(courseId);
        return courses[courseId];
    }
    
    /**
     * @notice Get lesson information
     * @param courseId Course containing lesson
     * @param lessonId Lesson to query
     * @return Lesson struct data
     */
    function getLesson(uint256 courseId, uint256 lessonId) external view returns (Lesson memory) {
        if (!courses[courseId].active) revert CourseNotFound(courseId);
        if (lessonId == 0 || lessonId > courseLessonCount[courseId]) revert LessonNotFound(courseId, lessonId);
        return lessons[courseId][lessonId];
    }
    
    /**
     * @notice Get user's progress in a course
     * @param user User address
     * @param courseId Course to check progress for
     * @return completedCount Number of lessons completed
     * @return totalLessons Total lessons in course
     * @return lastActivity Timestamp of last activity
     */
    function getUserProgress(address user, uint256 courseId) 
        external 
        view 
        returns (uint256 completedCount, uint256 totalLessons, uint256 lastActivity) 
    {
        UserProgress storage progress = userProgress[user][courseId];
        return (progress.completedCount, courses[courseId].totalLessons, progress.lastActivityAt);
    }
    
    /**
     * @notice Check if user completed a specific lesson
     * @param user User address
     * @param courseId Course ID
     * @param lessonId Lesson ID
     * @return true if lesson is completed
     */
    function isLessonCompleted(address user, uint256 courseId, uint256 lessonId) 
        external 
        view 
        returns (bool) 
    {
        return userProgress[user][courseId].completedLessons[lessonId];
    }
    
    /**
     * @notice Get user's learning streak information
     * @param user User address
     * @return current Current streak in days
     * @return longest Longest streak achieved
     */
    function getUserStreak(address user) 
        external 
        view 
        returns (uint256 current, uint256 longest) 
    {
        LearningStreak storage streak = learningStreaks[user];
        return (streak.currentStreak, streak.longestStreak);
    }
    
    /**
     * @notice Get all courses (pagination support)
     * @param offset Starting index
     * @param limit Maximum courses to return
     * @return courseIds Array of course IDs
     */
    function getCourses(uint256 offset, uint256 limit) 
        external 
        view 
        returns (uint256[] memory courseIds) 
    {
        if (offset >= courseCount) return new uint256[](0);
        
        uint256 end = offset + limit;
        if (end > courseCount) end = courseCount;
        
        courseIds = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            courseIds[i - offset] = i + 1; // Course IDs start at 1
        }
    }
}