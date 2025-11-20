# IDLookup.AI API Specification

## Base Information

- **Base URL**: `/api/v1`
- **Protocol**: HTTP/HTTPS
- **Content-Type**: `application/json`
- **Authentication**: JWT Bearer tokens (where required)

## Authentication

Most endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <access_token>
```

Access tokens are short-lived (15-30 minutes). Use the refresh token endpoint to obtain new access tokens.

### Token Structure
JWT tokens contain:
- `userId`: User ID
- `email`: User email
- `role`: User role (`member`, `admin`, `cs-rep`)
- `exp`: Expiration timestamp
- `iat`: Issued at timestamp

## Error Response Format

All errors follow this structure:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": [
      {
        "field": "fieldName",
        "issue": "specific issue"
      }
    ],
    "traceId": "unique-trace-id"
  }
}
```

## Pagination

Endpoints returning collections support pagination:
- `limit`: Number of items per page (default: 20, max: 100)
- `cursor`: Opaque string for next page (returned in response)
- `page`: Page number (alternative to cursor, default: 1)

Response format:
```json
{
  "data": [...],
  "pagination": {
    "limit": 20,
    "cursor": "next-page-cursor",
    "hasMore": true
  }
}
```

---

## Authentication Endpoints

### POST /signup
Create a new user account.

**Request Body:**
```json
{
  "fullName": "John Doe",
  "zip": "12345",
  "email": "john@example.com",
  "password": "SecurePassword123!",
  "socialProvider": "google" // optional
}
```

**Response (201):**
```json
{
  "user": {
    "id": "user-123",
    "email": "john@example.com",
    "fullName": "John Doe",
    "emailVerified": false,
    "role": "member"
  },
  "accessToken": "jwt-access-token",
  "refreshToken": "refresh-token",
  "message": "Please verify your email"
}
```

**Errors:**
- `400`: Validation failed
- `409`: Email already exists

---

### GET /verify-email
Verify user's email address.

**Query Parameters:**
- `token`: Verification token

**Response (200):**
```json
{
  "message": "Email verified successfully",
  "user": {
    "id": "user-123",
    "emailVerified": true
  }
}
```

**Errors:**
- `400`: Invalid or expired token
- `404`: Token not found

---

### POST /login
Authenticate user and receive tokens.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "user-123",
    "email": "john@example.com",
    "fullName": "John Doe",
    "role": "member",
    "emailVerified": true
  },
  "accessToken": "jwt-access-token",
  "refreshToken": "refresh-token"
}
```

**Errors:**
- `401`: Invalid credentials
- `403`: Email not verified

---

### POST /refresh-token
Obtain a new access token.

**Request Body:**
```json
{
  "refreshToken": "refresh-token"
}
```

**Response (200):**
```json
{
  "accessToken": "new-jwt-access-token"
}
```

**Errors:**
- `401`: Invalid or expired refresh token

---

### POST /logout
Invalidate refresh token and end session.

**Headers:**
- `Authorization: Bearer <token>`

**Response (204):** No content

---

## Public Search Endpoints

### GET /search
Public search endpoint (no authentication required).

**Query Parameters:**
- `firstName`: First name (required)
- `lastName`: Last name (required)
- `zip`: ZIP code (optional)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response (200):**
```json
{
  "data": [
    {
      "id": "person-123",
      "fullName": "John Doe",
      "ageRange": "35-40",
      "location": "New York, NY"
    }
  ],
  "pagination": {
    "limit": 20,
    "page": 1,
    "hasMore": false
  }
}
```

---

## Member Endpoints

### GET /me
Get authenticated user's profile.

**Headers:**
- `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "id": "user-123",
  "email": "john@example.com",
  "fullName": "John Doe",
  "zip": "12345",
  "phone": "555-1234",
  "emailVerified": true,
  "role": "member",
  "subscription": {
    "plan": "basic",
    "status": "active",
    "renewalDate": "2024-12-01"
  }
}
```

---

### PUT /me
Update user profile.

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "fullName": "John Smith",
  "zip": "54321",
  "email": "newemail@example.com"
}
```

**Response (200):**
```json
{
  "id": "user-123",
  "email": "newemail@example.com",
  "fullName": "John Smith",
  "zip": "54321"
}
```

---

### GET /people/{id}
Get full person report (requires authentication).

**Headers:**
- `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "id": "person-123",
  "fullName": "John Doe",
  "age": 38,
  "dateOfBirth": "1985-05-15",
  "location": "New York, NY",
  "addresses": [
    {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zip": "10001",
      "type": "current"
    }
  ],
  "phoneNumbers": ["555-1234"],
  "emailAddresses": ["john@example.com"],
  "relatives": [
    {
      "name": "Jane Doe",
      "relation": "spouse"
    }
  ],
  "associatedRecords": []
}
```

**Errors:**
- `404`: Person not found

---

### GET /dashboard
Get dashboard statistics.

**Headers:**
- `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "searchesThisMonth": 5,
  "activeAlerts": 3,
  "recentSearches": [
    {
      "id": "search-123",
      "query": "John Doe",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ],
  "subscription": {
    "plan": "basic",
    "status": "active",
    "renewalDate": "2024-12-01"
  }
}
```

---

### GET /searches/me
Get list of searches performed for the authenticated user.

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `limit`: Items per page (default: 20)
- `cursor`: Pagination cursor
- `filter`: Time filter (`24h`, `7d`, `30d`, `all`)

**Response (200):**
```json
{
  "data": [
    {
      "id": "search-event-123",
      "timestamp": "2024-01-15T10:30:00Z",
      "searcherLocation": "Los Angeles, CA",
      "searcherId": "user-456",
      "searcherMembershipLevel": "premium",
      "query": "John Doe"
    }
  ],
  "pagination": {
    "limit": 20,
    "cursor": "next-cursor",
    "hasMore": true
  }
}
```

---

### GET /alerts
List all alerts for the user.

**Headers:**
- `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "data": [
    {
      "id": "alert-123",
      "criteria": {
        "name": "John Doe",
        "location": "New York"
      },
      "frequency": "daily",
      "channels": ["email", "in-app"],
      "status": "active",
      "createdAt": "2024-01-01T00:00:00Z",
      "lastTriggered": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### POST /alerts
Create a new alert.

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "criteria": {
    "name": "John Doe",
    "location": "New York",
    "ageRange": "30-40"
  },
  "frequency": "daily",
  "channels": ["email", "in-app"]
}
```

**Response (201):**
```json
{
  "id": "alert-123",
  "criteria": {
    "name": "John Doe",
    "location": "New York",
    "ageRange": "30-40"
  },
  "frequency": "daily",
  "channels": ["email", "in-app"],
  "status": "active",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

---

### PUT /alerts/{id}
Update an alert.

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "criteria": {
    "name": "John Smith"
  },
  "frequency": "weekly",
  "status": "inactive"
}
```

**Response (200):**
```json
{
  "id": "alert-123",
  "criteria": {
    "name": "John Smith",
    "location": "New York"
  },
  "frequency": "weekly",
  "status": "inactive"
}
```

---

### DELETE /alerts/{id}
Delete an alert.

**Headers:**
- `Authorization: Bearer <token>`

**Response (204):** No content

---

### GET /subscription
Get subscription details.

**Headers:**
- `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "plan": "basic",
  "status": "active",
  "renewalDate": "2024-12-01",
  "paymentMethod": {
    "type": "card",
    "last4": "1234",
    "brand": "visa"
  },
  "billingAddress": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001"
  }
}
```

---

### PUT /subscription
Update subscription plan or payment method.

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "plan": "premium",
  "paymentToken": "stripe-payment-token"
}
```

**Response (200):**
```json
{
  "plan": "premium",
  "status": "active",
  "renewalDate": "2024-12-01"
}
```

---

### DELETE /subscription
Cancel subscription.

**Headers:**
- `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Subscription cancelled",
  "effectiveDate": "2024-12-01"
}
```

---

### GET /invoices
List invoices.

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `limit`: Items per page
- `cursor`: Pagination cursor

**Response (200):**
```json
{
  "data": [
    {
      "id": "invoice-123",
      "amount": 29.99,
      "currency": "USD",
      "status": "paid",
      "date": "2024-01-01",
      "downloadUrl": "/api/v1/invoices/invoice-123/download"
    }
  ],
  "pagination": {
    "limit": 20,
    "cursor": "next-cursor",
    "hasMore": false
  }
}
```

---

### GET /notifications
List notifications.

**Headers:**
- `Authorization: Bearer <token>`

**Query Parameters:**
- `limit`: Items per page
- `unreadOnly`: Boolean (default: false)

**Response (200):**
```json
{
  "data": [
    {
      "id": "notif-123",
      "type": "search_alert",
      "title": "New search match found",
      "message": "Someone searched for 'John Doe'",
      "read": false,
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### PUT /notifications/{id}/read
Mark notification as read.

**Headers:**
- `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "id": "notif-123",
  "read": true
}
```

---

### DELETE /notifications/{id}
Delete notification.

**Headers:**
- `Authorization: Bearer <token>`

**Response (204):** No content

---

### PUT /privacy
Update privacy settings.

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "searchable": false
}
```

**Response (200):**
```json
{
  "searchable": false
}
```

---

### POST /auth/change-password
Change password.

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword123!"
}
```

**Response (200):**
```json
{
  "message": "Password changed successfully"
}
```

---

### POST /auth/mfa/enable
Enable multi-factor authentication.

**Headers:**
- `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "method": "totp"
}
```

**Response (200):**
```json
{
  "message": "MFA enabled",
  "qrCode": "data:image/png;base64,..."
}
```

---

### POST /auth/mfa/disable
Disable multi-factor authentication.

**Headers:**
- `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "MFA disabled"
}
```

---

## Admin Endpoints

All admin endpoints require `role: "admin"` in JWT token.

### GET /admin/users
List all users.

**Headers:**
- `Authorization: Bearer <token>` (admin required)

**Query Parameters:**
- `limit`: Items per page
- `cursor`: Pagination cursor
- `search`: Search by name or email
- `role`: Filter by role
- `status`: Filter by status (`active`, `suspended`)

**Response (200):**
```json
{
  "data": [
    {
      "id": "user-123",
      "email": "john@example.com",
      "fullName": "John Doe",
      "role": "member",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00Z",
      "lastLogin": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "cursor": "next-cursor",
    "hasMore": true
  }
}
```

---

### GET /admin/users/{id}
Get user details.

**Headers:**
- `Authorization: Bearer <token>` (admin required)

**Response (200):**
```json
{
  "id": "user-123",
  "email": "john@example.com",
  "fullName": "John Doe",
  "role": "member",
  "status": "active",
  "profile": {
    "zip": "12345",
    "phone": "555-1234"
  },
  "subscription": {
    "plan": "basic",
    "status": "active"
  },
  "searchHistory": [
    {
      "id": "search-123",
      "query": "Jane Doe",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ],
  "alerts": [],
  "sessions": [
    {
      "id": "session-123",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2024-01-15T10:00:00Z",
      "lastActivity": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### POST /admin/users/{id}/suspend
Suspend or reactivate user.

**Headers:**
- `Authorization: Bearer <token>` (admin required)

**Request Body:**
```json
{
  "status": "suspended",
  "reason": "Violation of terms"
}
```

**Response (200):**
```json
{
  "id": "user-123",
  "status": "suspended"
}
```

---

### GET /admin/sessions
List all sessions.

**Headers:**
- `Authorization: Bearer <token>` (admin required)

**Query Parameters:**
- `limit`: Items per page
- `cursor`: Pagination cursor
- `userId`: Filter by user ID
- `dateFrom`: Filter from date
- `dateTo`: Filter to date

**Response (200):**
```json
{
  "data": [
    {
      "id": "session-123",
      "userId": "user-123",
      "userEmail": "john@example.com",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2024-01-15T10:00:00Z",
      "lastActivity": "2024-01-15T10:30:00Z",
      "active": true
    }
  ],
  "pagination": {
    "limit": 20,
    "cursor": "next-cursor",
    "hasMore": true
  }
}
```

---

### GET /admin/purchases
List all purchases/subscriptions.

**Headers:**
- `Authorization: Bearer <token>` (admin required)

**Query Parameters:**
- `limit`: Items per page
- `cursor`: Pagination cursor
- `status`: Filter by status
- `userId`: Filter by user ID

**Response (200):**
```json
{
  "data": [
    {
      "id": "purchase-123",
      "userId": "user-123",
      "userEmail": "john@example.com",
      "plan": "basic",
      "amount": 29.99,
      "currency": "USD",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00Z",
      "renewalDate": "2024-12-01"
    }
  ],
  "pagination": {
    "limit": 20,
    "cursor": "next-cursor",
    "hasMore": true
  }
}
```

---

### GET /admin/purchases/{id}
Get purchase details.

**Headers:**
- `Authorization: Bearer <token>` (admin required)

**Response (200):**
```json
{
  "id": "purchase-123",
  "userId": "user-123",
  "userEmail": "john@example.com",
  "plan": "basic",
  "amount": 29.99,
  "currency": "USD",
  "status": "active",
  "paymentMethod": {
    "type": "card",
    "last4": "1234"
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "renewalDate": "2024-12-01",
  "invoices": [
    {
      "id": "invoice-123",
      "amount": 29.99,
      "status": "paid",
      "date": "2024-01-01"
    }
  ]
}
```

---

### POST /admin/purchases/{id}/refund
Process refund.

**Headers:**
- `Authorization: Bearer <token>` (admin required)

**Request Body:**
```json
{
  "reason": "Customer request"
}
```

**Response (200):**
```json
{
  "id": "purchase-123",
  "status": "refunded",
  "refundAmount": 29.99
}
```

---

### GET /admin/data-removal
List data removal requests.

**Headers:**
- `Authorization: Bearer <token>` (admin required)

**Query Parameters:**
- `limit`: Items per page
- `cursor`: Pagination cursor
- `status`: Filter by status (`pending`, `approved`, `rejected`)

**Response (200):**
```json
{
  "data": [
    {
      "id": "request-123",
      "userId": "user-123",
      "userEmail": "john@example.com",
      "status": "pending",
      "requestedAt": "2024-01-15T10:30:00Z",
      "reason": "GDPR request"
    }
  ],
  "pagination": {
    "limit": 20,
    "cursor": "next-cursor",
    "hasMore": false
  }
}
```

---

### POST /admin/data-removal/{id}/approve
Approve data removal request.

**Headers:**
- `Authorization: Bearer <token>` (admin required)

**Response (200):**
```json
{
  "id": "request-123",
  "status": "approved",
  "message": "Data removal approved and scheduled"
}
```

---

### POST /admin/data-removal/{id}/reject
Reject data removal request.

**Headers:**
- `Authorization: Bearer <token>` (admin required)

**Request Body:**
```json
{
  "reason": "Request does not meet criteria"
}
```

**Response (200):**
```json
{
  "id": "request-123",
  "status": "rejected",
  "reason": "Request does not meet criteria"
}
```

---

### GET /admin/analytics
Get analytics data.

**Headers:**
- `Authorization: Bearer <token>` (admin required)

**Query Parameters:**
- `dateFrom`: Start date
- `dateTo`: End date

**Response (200):**
```json
{
  "totalUsers": 1000,
  "activeUsers": 750,
  "totalSearches": 5000,
  "conversions": 250,
  "revenue": 7500.00,
  "churn": 50,
  "newUsers": 100,
  "period": {
    "from": "2024-01-01",
    "to": "2024-01-31"
  }
}
```

---

### GET /admin/cs-reps
List customer service representatives.

**Headers:**
- `Authorization: Bearer <token>` (admin required)

**Response (200):**
```json
{
  "data": [
    {
      "id": "cs-rep-123",
      "name": "Jane Smith",
      "email": "jane@idlookup.ai",
      "role": "cs-rep",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

### POST /admin/cs-reps
Create customer service representative.

**Headers:**
- `Authorization: Bearer <token>` (admin required)

**Request Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@idlookup.ai",
  "role": "cs-rep"
}
```

**Response (201):**
```json
{
  "id": "cs-rep-123",
  "name": "Jane Smith",
  "email": "jane@idlookup.ai",
  "role": "cs-rep",
  "status": "active"
}
```

---

### PUT /admin/cs-reps/{id}
Update CS representative.

**Headers:**
- `Authorization: Bearer <token>` (admin required)

**Request Body:**
```json
{
  "role": "senior-cs-rep",
  "status": "active"
}
```

**Response (200):**
```json
{
  "id": "cs-rep-123",
  "role": "senior-cs-rep",
  "status": "active"
}
```

---

## HTTP Status Codes

- `200`: Success
- `201`: Created
- `204`: No Content (successful deletion)
- `400`: Bad Request (validation error)
- `401`: Unauthorized (missing or invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `409`: Conflict (e.g., email already exists)
- `500`: Internal Server Error

## Rate Limiting

API endpoints may be rate-limited. When rate limit is exceeded:
- Status Code: `429 Too Many Requests`
- Headers:
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp

## Versioning

API versioning is handled via URL path (`/api/v1`). Future versions will use `/api/v2`, etc.

