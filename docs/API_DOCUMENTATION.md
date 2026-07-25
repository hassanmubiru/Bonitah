# BFN API Documentation

Complete REST API documentation for the Bonitah Financial Network backend service.

**Base URL**: `http://localhost:3001` (development) | `https://api.bonitah.finance` (production)

**API Version**: v1
**Authentication**: JWT Bearer tokens via SIWE (Sign-In With Ethereum)
**Content-Type**: `application/json`

---

## 🔐 Authentication

All endpoints except `/auth/*` and `/health/*` require authentication via JWT token in the Authorization header.

### Authentication Flow

1. **Get Nonce**: `POST /auth/nonce` - Get signing nonce
2. **Verify Signature**: `POST /auth/verify` - Submit signed message  
3. **Use Token**: Include `Authorization: Bearer <jwt>` in subsequent requests
4. **Logout**: `POST /auth/logout` - Invalidate token

---

## 📚 Endpoints Reference

### Authentication (`/auth`)

#### `POST /auth/nonce`

Generate a SIWE nonce for wallet authentication.

**Authentication**: None (public endpoint)

**Request Body**:
```json
{
  "address": "0x742d35Cc6084C0532DAA8000D4057c0a1E2b0F4E"
}
```

**Response** (`200 OK`):
```json
{
  "nonce": "0x1234567890abcdef...",
  "message": "Sign in to Bonitah Financial Network\n\nURI: https://bonitah.finance\nVersion: 1\nChain ID: 84532\nNonce: 0x1234567890abcdef...\nIssued At: 2024-01-20T10:30:00.000Z",
  "expires": "2024-01-20T10:40:00.000Z"
}
```

**Errors**:
- `400 Bad Request` - Invalid address format
- `429 Too Many Requests` - Rate limit exceeded

---

#### `POST /auth/verify`

Verify signed SIWE message and issue JWT token.

**Authentication**: None (public endpoint)

**Request Body**:
```json
{
  "signature": "0x123...abc",
  "message": "Sign in to Bonitah Financial Network\n\n...",
  "address": "0x742d35Cc6084C0532DAA8000D4057c0a1E2b0F4E"
}
```

**Response** (`200 OK`):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires": "2024-01-21T10:30:00.000Z",
  "user": {
    "userId": "user_123",
    "address": "0x742d35Cc6084C0532DAA8000D4057c0a1E2b0F4E",
    "role": "USER",
    "isRegistered": true
  }
}
```

**Errors**:
- `400 Bad Request` - Invalid signature or expired nonce
- `401 Unauthorized` - Signature verification failed

---

#### `POST /auth/logout`

Invalidate current JWT token.

**Authentication**: None (public endpoint)

**Request Body**: None

**Response** (`200 OK`):
```json
{
  "message": "Logged out successfully"
}
```

---

#### `GET /auth/me`

Get current authenticated user information.

**Authentication**: Required

**Response** (`200 OK`):
```json
{
  "userId": "user_123",
  "address": "0x742d35Cc6084C0532DAA8000D4057c0a1E2b0F4E",
  "role": "USER",
  "isRegistered": true,
  "reputation": 150,
  "joinedAt": "2024-01-15T08:00:00.000Z"
}
```

**Errors**:
- `401 Unauthorized` - Invalid or expired token

---

### Health Checks (`/health`)

#### `GET /health`

Comprehensive system health check.

**Authentication**: None (public endpoint)

**Response** (`200 OK`):
```json
{
  "status": "ok",
  "info": {
    "database": {
      "status": "up"
    },
    "redis": {
      "status": "up"  
    },
    "rpc": {
      "status": "up",
      "latency": "45ms"
    }
  },
  "error": {},
  "details": {
    "database": {
      "status": "up"
    },
    "redis": {
      "status": "up"
    },
    "rpc": {
      "status": "up",
      "latency": "45ms"
    }
  }
}
```

#### `GET /health/live`

Liveness probe for Kubernetes/Docker health checks.

**Authentication**: None

**Response** (`200 OK`): `{"status": "ok"}`

#### `GET /health/ready`

Readiness probe checking all dependencies.

**Authentication**: None

**Response** (`200 OK`): `{"status": "ok"}`

---

### Education (`/education`)

#### `GET /education/courses`

Get list of all available courses.

**Authentication**: Required

**Response** (`200 OK`):
```json
[
  {
    "id": "defi-basics",
    "title": "DeFi Fundamentals",
    "description": "Learn the basics of decentralized finance",
    "difficulty": "beginner",
    "estimatedDuration": "2 hours",
    "lessonCount": 8,
    "completionRate": 0.0
  }
]
```

---

#### `GET /education/courses/:id`

Get detailed course information with lessons.

**Authentication**: Required

**Path Parameters**:
- `id` (string) - Course ID

**Response** (`200 OK`):
```json
{
  "id": "defi-basics",
  "title": "DeFi Fundamentals", 
  "description": "Learn the basics of decentralized finance",
  "difficulty": "beginner",
  "estimatedDuration": "2 hours",
  "lessons": [
    {
      "id": "lesson-1",
      "title": "What is DeFi?",
      "content": "...",
      "duration": "15 minutes",
      "completed": false
    }
  ],
  "progress": {
    "completed": 0,
    "total": 8,
    "percentage": 0.0
  }
}
```

**Errors**:
- `404 Not Found` - Course not found

---

#### `POST /education/lessons/:id/complete`

Mark a lesson as completed.

**Authentication**: Required

**Path Parameters**:
- `id` (string) - Lesson ID

**Response** (`200 OK`):
```json
{
  "lessonId": "lesson-1",
  "completed": true,
  "completedAt": "2024-01-20T10:30:00.000Z",
  "streakUpdated": true,
  "newStreak": 5
}
```

**Errors**:
- `404 Not Found` - Lesson not found
- `400 Bad Request` - Already completed

---

#### `POST /education/courses/:id/certificate`

Issue certificate for completed course.

**Authentication**: Required

**Path Parameters**:
- `id` (string) - Course ID

**Response** (`200 OK`):
```json
{
  "certificateId": "cert_123",
  "transactionHash": "0xabc123...",
  "ipfsCid": "QmX1Y2Z3...",
  "issuedAt": "2024-01-20T10:30:00.000Z"
}
```

**Errors**:
- `400 Bad Request` - Course not completed
- `503 Service Unavailable` - IPFS or blockchain unavailable

---

#### `GET /education/progress`

Get overall learning progress for user.

**Authentication**: Required

**Response** (`200 OK`):
```json
{
  "totalCourses": 5,
  "completedCourses": 2,
  "totalLessons": 40,
  "completedLessons": 16,
  "certificates": 2,
  "currentStreak": 7,
  "longestStreak": 12
}
```

---

#### `GET /education/progress/:courseId`

Get progress for specific course.

**Authentication**: Required

**Path Parameters**:
- `courseId` (string) - Course ID

**Response** (`200 OK`):
```json
{
  "courseId": "defi-basics",
  "completed": 6,
  "total": 8,
  "percentage": 75.0,
  "lastActivity": "2024-01-20T10:30:00.000Z",
  "certificateEarned": false
}
```

---

#### `GET /education/streak`

Get current learning streak.

**Authentication**: Required

**Response** (`200 OK`):
```json
{
  "current": 7,
  "longest": 12,
  "lastActivity": "2024-01-20T10:30:00.000Z"
}
```

---

### Transactions (`/transactions`)

#### `GET /transactions`

Get paginated transaction history for authenticated user.

**Authentication**: Required

**Query Parameters**:
- `page` (integer, default: 1) - Page number
- `limit` (integer, default: 50, max: 100) - Items per page
- `contract` (string, optional) - Filter by contract address

**Response** (`200 OK`):
```json
{
  "transactions": [
    {
      "id": "tx_123",
      "hash": "0xabc123...",
      "blockNumber": 12345678,
      "timestamp": "2024-01-20T10:30:00.000Z",
      "contract": "SavingsVault", 
      "method": "deposit",
      "amount": "100.00",
      "status": "confirmed",
      "gasUsed": "45000"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 156,
    "totalPages": 4,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Query Parameters**:
- `page` - Page number (default: 1)
- `limit` - Items per page (max: 100, default: 50)
- `contract` - Filter by contract name

---

### Analytics (`/analytics`)

#### `GET /analytics/portfolio`

Get portfolio value time series for authenticated user.

**Authentication**: Required

**Response** (`200 OK`):
```json
{
  "series": [
    {
      "timestamp": "2024-01-20T00:00:00.000Z",
      "totalValue": "1500.50",
      "availableBalance": "500.50", 
      "lockedFunds": "300.00",
      "savingsBalance": "700.00"
    }
  ],
  "provenance": {
    "lastUpdate": "2024-01-20T10:30:00.000Z",
    "blockNumber": 12345678,
    "staleness": "fresh"
  }
}
```

---

### Chain Read (`/chain/read`)

#### `GET /chain/read/:contract/:fn`

Read on-chain data with caching and provenance.

**Authentication**: Required

**Path Parameters**:
- `contract` (string) - Contract name (Registry, SavingsVault, etc.)
- `fn` (string) - Function name to call

**Query Parameters**:
- `args` (string, optional) - JSON array of function arguments

**Response** (`200 OK`):
```json
{
  "result": "1500500000000000000000",
  "provenance": {
    "contractAddress": "0x123...",
    "blockNumber": 12345678,
    "fetchedAt": "2024-01-20T10:30:00.000Z",
    "cached": false
  }
}
```

**Errors**:
- `400 Bad Request` - Invalid contract or function
- `503 Service Unavailable` - RPC unavailable

---

### AI Assistant (`/ai`)

#### `POST /ai/chat`

Send message to AI assistant.

**Authentication**: Required  
**Role**: USER or higher

**Request Body**:
```json
{
  "message": "How much do I have in savings?",
  "conversationId": "conv_123"
}
```

**Response** (`200 OK`):
```json
{
  "response": "You currently have $1,500.50 in your savings vault...",
  "conversationId": "conv_123",
  "messageId": "msg_456",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "dataUsed": ["SavingsVault.portfolioValue"]
}
```

**Errors**:
- `400 Bad Request` - Message too long (>2000 chars)
- `503 Service Unavailable` - AI service timeout

---

#### `GET /ai/conversations`

Get user's conversation history.

**Authentication**: Required

**Response** (`200 OK`):
```json
[
  {
    "id": "conv_123",
    "title": "Savings Questions",
    "lastMessage": "How much do I have in savings?",
    "updatedAt": "2024-01-20T10:30:00.000Z",
    "messageCount": 5
  }
]
```

---

#### `GET /ai/conversation`

Get specific conversation details.

**Authentication**: Required

**Query Parameters**:
- `id` (string) - Conversation ID

**Response** (`200 OK`):
```json
{
  "id": "conv_123",
  "title": "Savings Questions",
  "messages": [
    {
      "id": "msg_456",
      "role": "user",
      "content": "How much do I have in savings?",
      "timestamp": "2024-01-20T10:30:00.000Z"
    },
    {
      "id": "msg_457", 
      "role": "assistant",
      "content": "You currently have $1,500.50 in your savings vault...",
      "timestamp": "2024-01-20T10:30:01.000Z"
    }
  ]
}
```

---

### IPFS (`/ipfs`)

#### `POST /ipfs/profile-docs`

Upload profile documents to IPFS.

**Authentication**: Required

**Request**: `multipart/form-data`
- `files` - Array of files (max 10 files, 10MB each)

**Response** (`200 OK`):
```json
{
  "cids": [
    "QmX1Y2Z3...",
    "QmA4B5C6..."
  ]
}
```

**Errors**:
- `400 Bad Request` - Invalid files or size limit exceeded
- `503 Service Unavailable` - IPFS unavailable

---

#### `POST /ipfs/profile-metadata`

Store profile metadata on IPFS.

**Authentication**: Required

**Request Body**:
```json
{
  "name": "John Doe",
  "bio": "DeFi enthusiast", 
  "skills": ["Trading", "Analysis"]
}
```

**Response** (`200 OK`):
```json
{
  "cid": "QmX1Y2Z3..."
}
```

---

### Admin (`/admin`)

**Role Required**: ADMIN

#### `GET /admin/system/health`

Get detailed system health metrics.

**Authentication**: Required (ADMIN role)

**Response** (`200 OK`):
```json
{
  "uptime": "5d 12h 30m",
  "memory": {
    "used": "256MB",
    "total": "1GB",
    "percentage": 25.0
  },
  "database": {
    "connections": 10,
    "status": "healthy"
  },
  "rpc": {
    "latency": "45ms",
    "status": "healthy"
  }
}
```

---

#### `GET /admin/analytics`

Get admin-level analytics.

**Authentication**: Required (ADMIN role)

**Query Parameters**:
- `period` (string) - Time period: "7d", "30d", "90d"

**Response** (`200 OK`):
```json
{
  "users": {
    "total": 1250,
    "active": 890,
    "newThisPeriod": 45
  },
  "transactions": {
    "total": 5600,
    "volume": "125000.00",
    "avgPerUser": 4.48
  },
  "system": {
    "apiCalls": 12500,
    "errorRate": 0.02,
    "avgResponseTime": "145ms"
  }
}
```

---

#### `GET /admin/users`

Get user list with filters.

**Authentication**: Required (ADMIN role)

**Query Parameters**:
- `page` (integer) - Page number
- `limit` (integer) - Items per page
- `status` (string) - Filter by status: "active", "suspended"
- `role` (string) - Filter by role

**Response** (`200 OK`):
```json
{
  "users": [
    {
      "id": "user_123",
      "address": "0x742d35Cc...",
      "role": "USER",
      "status": "active", 
      "joinedAt": "2024-01-15T08:00:00.000Z",
      "lastActive": "2024-01-20T10:30:00.000Z",
      "reputation": 150
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1250,
    "totalPages": 25
  }
}
```

---

#### `PUT /admin/users/:id`

Update user details.

**Authentication**: Required (ADMIN role)

**Path Parameters**:
- `id` (string) - User ID

**Request Body**:
```json
{
  "role": "MODERATOR",
  "status": "active"
}
```

**Response** (`200 OK`):
```json
{
  "id": "user_123",
  "address": "0x742d35Cc...",
  "role": "MODERATOR",
  "status": "active",
  "updatedAt": "2024-01-20T10:30:00.000Z"
}
```

---

#### `PUT /admin/users/:id/deactivate`

Deactivate user account.

**Authentication**: Required (ADMIN role)

**Response** (`200 OK`):
```json
{
  "message": "User deactivated successfully",
  "userId": "user_123"
}
```

---

#### `PUT /admin/users/:id/activate`

Reactivate user account.

**Authentication**: Required (ADMIN role)

**Response** (`200 OK`):
```json
{
  "message": "User activated successfully", 
  "userId": "user_123"
}
```

---

#### `DELETE /admin/users/:id`

Permanently delete user.

**Authentication**: Required (ADMIN role)

**Response** (`200 OK`):
```json
{
  "message": "User deleted successfully",
  "userId": "user_123"
}
```

---

#### `GET /admin/audit`

Get audit log.

**Authentication**: Required (ADMIN role)

**Query Parameters**:
- `page` (integer) - Page number
- `limit` (integer) - Items per page
- `action` (string) - Filter by action type

**Response** (`200 OK`):
```json
{
  "entries": [
    {
      "id": "audit_123",
      "userId": "user_123",
      "action": "USER_DEACTIVATED",
      "details": {"reason": "policy violation"},
      "timestamp": "2024-01-20T10:30:00.000Z",
      "adminUserId": "admin_456"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 500
  }
}
```

---

#### `PUT /admin/system/maintenance`

Toggle maintenance mode.

**Authentication**: Required (ADMIN role)

**Request Body**:
```json
{
  "enabled": true
}
```

**Response** (`200 OK`):
```json
{
  "maintenanceMode": true,
  "message": "Maintenance mode enabled"
}
```

---

## 🔒 Authorization & Roles

### Role Hierarchy

1. **USER** - Default role for registered users
2. **MODERATOR** - Content moderation privileges  
3. **ADMIN** - Full system administration

### Role-Based Access

- `/ai/*` - USER or higher
- `/admin/*` - ADMIN only
- All other authenticated endpoints - USER or higher

---

## 📊 Rate Limiting

| Endpoint Category | Rate Limit | Window |
|------------------|------------|---------|
| Authentication | 5 requests | 1 minute |
| AI Assistant | 10 requests | 1 minute |
| Chain Read | 30 requests | 1 minute |
| General API | 100 requests | 1 minute |
| Admin | 50 requests | 1 minute |

---

## ⚠️ Error Codes

### HTTP Status Codes

- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found 
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error
- `503` - Service Unavailable (dependencies down)

### Error Response Format

```json
{
  "statusCode": 400,
  "message": "Validation failed", 
  "error": "Bad Request",
  "details": {
    "field": "amount",
    "reason": "Must be greater than 0"
  },
  "timestamp": "2024-01-20T10:30:00.000Z",
  "path": "/api/savings/deposit"
}
```

---

## 📝 Request/Response Headers

### Required Headers

```
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

### Response Headers

```
Content-Type: application/json
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1641816600
```

---

## 🧪 Testing the API

### Using cURL

```bash
# Get nonce
curl -X POST http://localhost:3001/auth/nonce \
  -H "Content-Type: application/json" \
  -d '{"address": "0x742d35Cc6084C0532DAA8000D4057c0a1E2b0F4E"}'

# Get user info (with token)
curl -X GET http://localhost:3001/auth/me \
  -H "Authorization: Bearer <your_jwt_token>"
```

### Using Postman

Import the BFN API collection with pre-configured requests and environment variables.

---

## 📞 Support

For API support:
- **Documentation Issues**: Open GitHub issue
- **Integration Help**: support@bonitah.finance
- **Status Page**: https://status.bonitah.finance

---

*Last Updated: January 2024*
*API Version: 1.0.0*