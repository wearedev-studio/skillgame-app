
# SkillGame Pro API Documentation

**Base URL:** `https://sklgmsapi.koltech.dev`

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Error Handling](#error-handling)
4. [Rate Limiting](#rate-limiting)
5. [API Endpoints](#api-endpoints)
   - [Authentication](#authentication-endpoints)
   - [User Management](#user-management-endpoints)
   - [Admin Panel](#admin-panel-endpoints)
   - [Tournaments](#tournament-endpoints)
   - [Tournament Templates](#tournament-template-endpoints)
   - [Payments](#payment-endpoints)
   - [Notifications](#notification-endpoints)
   - [Chat System](#chat-system-endpoints)
   - [Game Lobby Scheduler](#game-lobby-scheduler-endpoints)
   - [Security](#security-endpoints)
   - [KYC (Sumsub)](#kyc-sumsub-endpoints)
6. [Data Models](#data-models)
7. [Socket Events](#socket-events)

## Overview

SkillGame Pro API is a comprehensive gaming platform that supports user authentication, tournaments, payments, real-time chat, and administrative functions. The API is built with Node.js, Express.js, MongoDB, and Socket.IO for real-time features.

### Features
- User registration and authentication
- Tournament management system
- Payment processing (deposits/withdrawals)
- Real-time chat system
- KYC verification via Sumsub
- Administrative panel
- Security monitoring
- Game lobby scheduling

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Authentication Levels
- **Public**: No authentication required
- **Protected**: Requires valid user token
- **Admin**: Requires admin role

## Error Handling

All API responses follow a consistent error format:

### Success Response
```json
{
  "success": true,
  "data": {...},
  "message": "Success message"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

Rate limiting is applied to prevent abuse:
- **General**: 1000 requests per 15 minutes
- **Authentication**: 5 requests per 15 minutes
- **Admin**: 100 requests per 5 minutes

## API Endpoints

### Authentication Endpoints

#### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "username": "string (required)",
  "email": "string (required)",
  "password": "string (required, min 6 chars)",
  "ageConfirmed": "boolean (required)",
  "termsAccepted": "boolean (required)",
  "privacyPolicyAccepted": "boolean (required)"
}
```

**Response:**
```json
{
  "_id": "user_id",
  "username": "username",
  "email": "email",
  "balance": 0,
  "avatar": "default_avatar.png",
  "role": "USER",
  "token": "jwt_token"
}
```

**Errors:**
- `400` - Missing required fields or validation failure
- `400` - User with email/username already exists

#### POST /api/auth/login
Authenticate user credentials.

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response:**
```json
{
  "_id": "user_id",
  "username": "username",
  "email": "email",
  "balance": 0,
  "avatar": "avatar_url",
  "role": "USER|ADMIN",
  "token": "jwt_token"
}
```

**Errors:**
- `400` - Missing email or password
- `401` - Invalid email or password

#### POST /api/auth/forgot-password
Request password reset code.

**Request Body:**
```json
{
  "email": "string (required)"
}
```

**Response:**
```json
{
  "message": "Password reset code sent to console. In production, this would be sent to your email. The code is: 123456",
  "developer_note": "This response includes the reset code for testing purposes only."
}
```

#### POST /api/auth/reset-password
Reset password using verification code.

**Request Body:**
```json
{
  "email": "string (required)",
  "secretCode": "string (required)",
  "newPassword": "string (required)"
}
```

**Response:**
```json
{
  "message": "Password has been reset successfully. Please log in."
}
```

**Errors:**
- `400` - Missing required fields
- `400` - Invalid or expired reset code

### User Management Endpoints

#### GET /api/users/profile
Get current user profile information.

**Authentication:** Required (Protected)

**Response:**
```json
{
  "_id": "user_id",
  "username": "username",
  "email": "email",
  "balance": 100.50,
  "avatar": "avatar_url",
  "role": "USER",
  "kycStatus": "NOT_SUBMITTED|PENDING|APPROVED|REJECTED",
  "kycRejectionReason": "reason (if rejected)"
}
```

#### PUT /api/users/profile/avatar
Update user avatar.

**Authentication:** Required (Protected)
**Content-Type:** multipart/form-data

**Request Body:**
- `avatar`: File (image file)

**Response:**
```json
{
  "_id": "user_id",
  "username": "username",
  "email": "email",
  "balance": 100.50,
  "avatar": "/uploads/avatars/new_avatar.jpg",
  "role": "USER"
}
```

**Errors:**
- `400` - File not uploaded
- `404` - User not found

#### GET /api/users/history/games
Get user's game history with pagination.

**Authentication:** Required (Protected)

**Query Parameters:**
- `page`: Number (default: 1)
- `limit`: Number (default: 10)

**Response:**
```json
{
  "games": [
    {
      "_id": "game_id",
      "gameName": "Checkers|Chess|Backgammon|Tic-Tac-Toe|Durak|Domino|Bingo|Dice",
      "status": "WON|LOST|DRAW",
      "amountChanged": 25.00,
      "opponent": "Bot",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 50,
  "page": 1,
  "totalPages": 5
}
```

#### GET /api/users/history/transactions
Get user's transaction history with pagination.

**Authentication:** Required (Protected)

**Query Parameters:**
- `page`: Number (default: 1)
- `limit`: Number (default: 10)

**Response:**
```json
{
  "transactions": [
    {
      "_id": "transaction_id",
      "type": "DEPOSIT|WITHDRAWAL|WAGER_LOSS|WAGER_WIN|TOURNAMENT_FEE|TOURNAMENT_WINNINGS",
      "status": "COMPLETED|PENDING|CANCELLED",
      "amount": 100.00,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 25,
  "page": 1,
  "totalPages": 3
}
```

#### PUT /api/users/profile/password
Update user password.

**Authentication:** Required (Protected)

**Request Body:**
```json
{
  "currentPassword": "string (required)",
  "newPassword": "string (required)"
}
```

**Response:**
```json
{
  "message": "Password updated successfully"
}
```

**Errors:**
- `400` - Missing passwords
- `401` - Incorrect current password
- `404` - User not found

#### POST /api/users/balance
Update user balance (demo purposes).

**Authentication:** Required (Protected)

**Request Body:**
```json
{
  "amount": "number (required, can be negative)"
}
```

**Response:**
```json
{
  "_id": "user_id",
  "username": "username",
  "email": "email",
  "balance": 150.50,
  "avatar": "avatar_url",
  "kycStatus": "status",
  "role": "USER"
}
```

**Errors:**
- `400` - Invalid amount or insufficient funds

#### POST /api/users/kyc
Submit KYC documents.

**Authentication:** Required (Protected)
**Content-Type:** multipart/form-data

**Request Body:**
- `document`: File (document file)
- `documentType`: String (PASSPORT|UTILITY_BILL|INTERNATIONAL_PASSPORT|RESIDENCE_PERMIT)

**Response:**
```json
{
  "status": "PENDING",
  "message": "The documents have been successfully submitted for verification."
}
```

**Errors:**
- `400` - User already submitted or approved
- `400` - Document file not uploaded
- `404` - User not found

### Admin Panel Endpoints

#### POST /api/admin/create-room
Create a new game room.

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "gameType": "tic-tac-toe|checkers|chess|backgammon",
  "bet": "number (required)"
}
```

**Response:**
```json
{
  "message": "The room was created successfully",
  "room": {
    "id": "admin-checkers-1640995200000",
    "gameType": "checkers",
    "bet": 50,
    "players": [],
    "gameState": null
  }
}
```

#### GET /api/admin/rooms
Get active game rooms with pagination.

**Authentication:** Required (Admin)

**Query Parameters:**
- `page`: Number (default: 1)
- `limit`: Number (default: 10)
- `gameType`: String (filter by game type)
- `search`: String (search in room ID or player names)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "room_id",
      "gameType": "checkers",
      "bet": 50,
      "players": ["player1", "player2"]
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 50,
    "itemsPerPage": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### DELETE /api/admin/rooms/:roomId
Delete a game room.

**Authentication:** Required (Admin)

**Response:**
```json
{
  "message": "Room room_id successfully deleted."
}
```

**Errors:**
- `404` - Room not found

#### POST /api/admin/tournaments
Create a new tournament.

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "name": "string (required)",
  "gameType": "tic-tac-toe|checkers|chess|backgammon",
  "entryFee": "number (required)",
  "maxPlayers": "number (required, 4|8|16|32)"
}
```

**Response:**
```json
{
  "_id": "tournament_id",
  "name": "Championship",
  "gameType": "checkers",
  "status": "WAITING",
  "entryFee": 10,
  "prizePool": 360,
  "maxPlayers": 8,
  "players": [],
  "platformCommission": 10,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### GET /api/admin/tournaments
Get all tournaments with pagination and filtering.

**Authentication:** Required (Admin)

**Query Parameters:**
- `page`: Number (default: 1)
- `limit`: Number (default: 10)
- `status`: String (WAITING|ACTIVE|FINISHED|CANCELLED)
- `gameType`: String
- `search`: String (search in tournament name)

**Response:**
```json
{
  "data": [
    {
      "_id": "tournament_id",
      "name": "Championship",
      "gameType": "checkers",
      "status": "WAITING",
      "entryFee": 10,
      "prizePool": 360,
      "maxPlayers": 8,
      "players": [
        {
          "_id": "user_id",
          "username": "player1",
          "isBot": false,
          "registeredAt": "2024-01-01T00:00:00.000Z"
        }
      ],
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 50,
    "itemsPerPage": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### PUT /api/admin/tournaments/:id
Update tournament details.

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "name": "string",
  "status": "WAITING|ACTIVE|FINISHED|CANCELLED",
  "entryFee": "number",
  "maxPlayers": "number"
}
```

#### DELETE /api/admin/tournaments/:id
Delete a tournament.

**Authentication:** Required (Admin)

**Response:**
```json
{
  "message": "The tournament has been deleted"
}
```

#### GET /api/admin/users
Get all users with pagination and filtering.

**Authentication:** Required (Admin)

**Query Parameters:**
- `page`: Number (default: 1)
- `limit`: Number (default: 10)
- `role`: String (USER|ADMIN)
- `search`: String (search in username, email, or ID)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "user_id",
      "username": "username",
      "email": "email",
      "role": "USER",
      "status": "ACTIVE",
      "balance": 100.50,
      "kycStatus": "APPROVED",
      "kycProvider": "SUMSUB",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalItems": 100,
    "itemsPerPage": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### GET /api/admin/users/export/excel
Export users data to Excel file.

**Authentication:** Required (Admin)

**Query Parameters:**
- `role`: String (USER|ADMIN)
- `search`: String

**Response:** Excel file download with filename `users-report-{timestamp}.xlsx`

#### GET /api/admin/users/:id
Get user details by ID.

**Authentication:** Required (Admin)

**Response:**
```json
{
  "_id": "user_id",
  "username": "username",
  "email": "email",
  "role": "USER",
  "status": "ACTIVE",
  "balance": 100.50,
  "kycStatus": "APPROVED",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### PUT /api/admin/users/:id
Update user details.

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "role": "USER|ADMIN",
  "balance": "number"
}
```

#### DELETE /api/admin/users/:id
Delete a user.

**Authentication:** Required (Admin)

**Response:**
```json
{
  "message": "User successfully deleted"
}
```

#### GET /api/admin/transactions
Get all transactions with pagination and filtering.

**Authentication:** Required (Admin)

**Query Parameters:**
- `page`: Number (default: 1)
- `limit`: Number (default: 10)
- `type`: String (DEPOSIT|WITHDRAWAL|WAGER_LOSS|WAGER_WIN|TOURNAMENT_FEE|TOURNAMENT_WINNINGS)
- `status`: String (COMPLETED|PENDING|CANCELLED)
- `search`: String

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "transaction_id",
      "user": {
        "username": "username"
      },
      "type": "DEPOSIT",
      "status": "COMPLETED",
      "amount": 100.00,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalItems": 100,
    "itemsPerPage": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### GET /api/admin/transactions/export/excel
Export transactions to Excel file.

**Authentication:** Required (Admin)

**Query Parameters:**
- `type`: String
- `status`: String
- `search`: String

**Response:** Excel file download with filename `transactions-report-{timestamp}.xlsx`

#### GET /api/admin/games
Get all game records with pagination and filtering.

**Authentication:** Required (Admin)

**Query Parameters:**
- `page`: Number (default: 1)
- `limit`: Number (default: 10)
- `status`: String (WON|LOST|DRAW)
- `gameName`: String
- `search`: String

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "game_id",
      "user": {
        "username": "username"
      },
      "gameName": "Checkers",
      "status": "WON",
      "amountChanged": 25.00,
      "opponent": "Bot",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalItems": 100,
    "itemsPerPage": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### GET /api/admin/kyc-submissions
Get KYC submissions for review.

**Authentication:** Required (Admin)

**Query Parameters:**
- `status`: String (PENDING|APPROVED|REJECTED, default: PENDING)

**Response:**
```json
[
  {
    "_id": "user_id",
    "username": "username",
    "email": "email",
    "kycStatus": "PENDING",
    "kycDocuments": [
      {
        "documentType": "PASSPORT",
        "filePath": "path/to/document",
        "submittedAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
]
```

#### POST /api/admin/kyc-submissions/:userId/review
Review KYC submission.

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "action": "APPROVE|REJECT",
  "reason": "string (required if REJECT)"
}
```

**Response:**
```json
{
  "message": "User's request username has been processed."
}
```

#### GET /api/admin/kyc-document/:userId/:fileName
Download KYC document.

**Authentication:** Required (Admin)

**Response:** File download

**Errors:**
- `404` - Document not found or access denied

### Tournament Endpoints

#### GET /api/tournaments
Get active tournaments.

**Response:**
```json
[
  {
    "_id": "tournament_id",
    "name": "Championship",
    "gameType": "checkers",
    "status": "WAITING",
    "entryFee": 10,
    "prizePool": 360,
    "maxPlayers": 8,
    "players": [],
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### GET /api/tournaments/all
Get all tournaments with pagination and filtering.

**Query Parameters:**
- `page`: Number (default: 1)
- `limit`: Number (default: 12)
- `status`: String (WAITING|ACTIVE|FINISHED)
- `gameType`: String

**Response:**
```json
{
  "tournaments": [
    {
      "_id": "tournament_id",
      "name": "Championship",
      "gameType": "checkers",
      "status": "WAITING",
      "entryFee": 10,
      "prizePool": 360,
      "maxPlayers": 8,
      "players": [
        {
          "_id": {
            "username": "player1",
            "avatar": "avatar_url"
          },
          "isBot": false,
          "registeredAt": "2024-01-01T00:00:00.000Z"
        }
      ],
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 50,
    "itemsPerPage": 12,
    "hasNext": true,
    "hasPrev": false
  }
}
```

#### GET /api/tournaments/history
Get finished tournaments history.

**Query Parameters:**
- `page`: Number (default: 1)
- `limit`: Number (default: 10)
- `gameType`: String

**Response:**
```json
{
  "tournaments": [
    {
      "_id": "tournament_id",
      "name": "Championship",
      "gameType": "checkers",
      "status": "FINISHED",
      "winner": {
        "_id": "user_id",
        "username": "winner_name",
        "isBot": false
      },
      "finishedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

#### GET /api/tournaments/stats
Get tournament statistics.

**Response:**
```json
{
  "byGameType": [
    {
      "_id": "checkers",
      "total": 50,
      "active": 5,
      "finished": 45,
      "totalPrizePool": 5000
    }
  ],
  "overall": {
    "totalTournaments": 100,
    "totalPrizePool": 15000,
    "activeTournaments": 10
  }
}
```

#### GET /api/tournaments/:tournamentId
Get tournament details by ID.

**Response:**
```json
{
  "_id": "tournament_id",
  "name": "Championship",
  "gameType": "checkers",
  "status": "WAITING",
  "entryFee": 10,
  "prizePool": 360,
  "maxPlayers": 8,
  "players": [],
  "bracket": [],
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### POST /api/tournaments
Create a new tournament.

**Authentication:** Required (Protected)

**Request Body:**
```json
{
  "name": "string (required)",
  "gameType": "tic-tac-toe|checkers|chess|backgammon",
  "maxPlayers": "number (required, 4|8|16|32)",
  "entryFee": "number (required)",
  "platformCommission": "number (optional, default: 10)"
}
```

**Response:**
```json
{
  "message": "Tournament successfully created",
  "tournament": {
    "_id": "tournament_id",
    "name": "Championship",
    "gameType": "checkers",
    "status": "WAITING",
    "entryFee": 10,
    "prizePool": 360,
    "maxPlayers": 8,
    "players": [],
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET /api/tournaments/player
Get tournaments for authenticated player.

**Authentication:** Required (Protected)

**Response:**
```json
[
  {
    "_id": "tournament_id",
    "name": "Championship",
    "gameType": "checkers",
    "status": "ACTIVE",
    "entryFee": 10,
    "players": [
      {
        "_id": "user_id",
        "username": "player1",
        "isBot": false
      }
    ]
  }
]
```

#### POST /api/tournaments/:tournamentId/register
Register for a tournament.

**Authentication:** Required (Protected)

**Headers:**
- `x-socket-id`: String (optional, socket ID for real-time updates)

**Response:**
```json
{
  "message": "Successfully registered for tournament"
}
```

**Errors:**
- `400` - Tournament full, insufficient funds, already registered
- `404` - Tournament not found

#### DELETE /api/tournaments/:tournamentId/register
Unregister from a tournament.

**Authentication:** Required (Protected)

**Response:**
```json
{
  "message": "Registration cancelled, entry fee refunded"
}
```

**Errors:**
- `400` - Cannot cancel after tournament starts
- `404` - Tournament not found

### Tournament Template Endpoints

#### GET /api/tournament-templates/active
Get active tournament templates.

**Response:**
```json
[
  {
    "_id": "template_id",
    "name": "Daily Checkers",
    "gameType": "checkers",
    "maxPlayers": 8,
    "entryFee": 10,
    "schedule": {
      "frequency": "daily",
      "time": "18:00"
    },
    "isActive": true
  }
]
```

#### GET /api/tournament-templates/scheduler/stats
Get tournament scheduler statistics.

**Response:**
```json
{
  "isRunning": true,
  "nextCheck": "2024-01-01T18:00:00.000Z",
  "activeTemplates": 5,
  "tournamentsCreated": 25,
  "lastCreated": "2024-01-01T17:00:00.000Z"
}
```

#### GET /api/tournament-templates
Get all tournament templates.

**Authentication:** Required (Protected)

**Response:**
```json
[
  {
    "_id": "template_id",
    "name": "Daily Checkers",
    "gameType": "checkers",
    "maxPlayers": 8,
    "entryFee": 10,
    "schedule": {
      "frequency": "daily",
      "time": "18:00"
    },
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### POST /api/tournament-templates
Create a tournament template.

**Authentication:** Required (Protected)

**Request Body:**
```json
{
  "name": "string (required)",
  "gameType": "tic-tac-toe|checkers|chess|backgammon",
  "maxPlayers": "number (required, 4|8|16|32)",
  "entryFee": "number (required)",
  "schedule": {
    "frequency": "daily|weekly|hourly",
    "time": "HH:MM",
    "dayOfWeek": "number (0-6, required for weekly)"
  }
}
```

#### POST /api/tournament-templates/defaults
Create default tournament templates.

**Authentication:** Required (Protected)

**Response:**
```json
{
  "message": "Default templates created successfully",
  "templates": [...]
}
```

#### GET /api/tournament-templates/:templateId
Get tournament template by ID.

**Authentication:** Required (Protected)

#### PUT /api/tournament-templates/:templateId
Update tournament template.

**Authentication:** Required (Protected)

#### DELETE /api/tournament-templates/:templateId
Delete tournament template.

**Authentication:** Required (Protected)

#### PATCH /api/tournament-templates/:templateId/toggle
Toggle template active status.

**Authentication:** Required (Protected)

#### POST /api/tournament-templates/scheduler/force-check
Force scheduler check.

**Authentication:** Required (Protected)

#### POST /api/tournament-templates/scheduler/start
Start tournament scheduler.

**Authentication:** Required (Protected)

#### POST /api/tournament-templates/scheduler/stop
Stop tournament scheduler.

**Authentication:** Required (Protected)

### Payment Endpoints

#### POST /api/payments/deposit
Create a deposit payment.

**Authentication:** Required (Protected)

**Request Body:**
```json
{
  "amount": "number (required, > 0)"
}
```

**Response:**
```json
{
  "success": true,
  "paymentId": "payment_id",
  "paymentUrl": "https://payment.provider.com/pay/...",
  "orderId": "deposit_user_id_timestamp",
  "amount": 100.00,
  "currency": "USD"
}
```

**Errors:**
- `400` - Invalid amount provided

#### POST /api/payments/withdrawal
Create a withdrawal request.

**Authentication:** Required (Protected)

**Request Body:**
```json
{
  "amount": "number (required, > 0)",
  "recipientDetails": {
    "method": "string (required)",
    "accountNumber": "string",
    "routingNumber": "string"
  }
}
```

**Response:**
```json
{
  "success": true,
  "withdrawalId": "withdrawal_id",
  "orderId": "withdrawal_user_id_timestamp",
  "amount": 100.00,
  "currency": "USD",
  "status": "PENDING"
}
```

**Errors:**
- `400` - Invalid amount, insufficient funds, or missing recipient details
- `400` - KYC verification required

#### GET /api/payments/status/:paymentId
Get payment status.

**Authentication:** Required (Protected)

**Response:**
```json
{
  "orderId": "order_id",
  "paymentId": "payment_id",
  "type": "DEPOSIT|WITHDRAWAL",
  "amount": 100.00,
  "currency": "USD",
  "status": "PENDING|COMPLETED|FAILED|CANCELLED",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "completedAt": "2024-01-01T00:05:00
.000Z"
}
```

**Errors:**
- `404` - Payment not found

#### GET /api/payments/history
Get user's payment history.

**Authentication:** Required (Protected)

**Query Parameters:**
- `page`: Number (default: 1)
- `limit`: Number (default: 20)
- `type`: String (DEPOSIT|WITHDRAWAL)

**Response:**
```json
{
  "payments": [
    {
      "orderId": "order_id",
      "paymentId": "payment_id",
      "type": "DEPOSIT",
      "amount": 100.00,
      "currency": "USD",
      "status": "COMPLETED",
      "description": "Deposit $100 to gaming account",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "completedAt": "2024-01-01T00:05:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3
  }
}
```

#### POST /api/payments/webhook
Payment webhook handler (G2Pay integration).

**Authentication:** Not required (webhook signature verification)

**Request Body:**
```json
{
  "order_id": "string",
  "payment_id": "string",
  "withdrawal_id": "string",
  "status": "completed|failed|cancelled",
  "transaction_id": "string"
}
```

**Response:**
```json
{
  "success": true
}
```

### Notification Endpoints

#### GET /api/notifications
Get user's notifications.

**Authentication:** Required (Protected)

**Response:**
```json
[
  {
    "_id": "notification_id",
    "title": "Tournament Started",
    "message": "Your tournament 'Championship' has started!",
    "link": "/tournaments/tournament_id",
    "isRead": false,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### GET /api/notifications/unread-count
Get count of unread notifications.

**Authentication:** Required (Protected)

**Response:**
```json
{
  "unreadCount": 5
}
```

#### POST /api/notifications/read
Mark all notifications as read.

**Authentication:** Required (Protected)

**Response:**
```json
{
  "message": "All notifications marked as read"
}
```

#### POST /api/notifications/:id/read
Mark specific notification as read.

**Authentication:** Required (Protected)

**Response:**
```json
{
  "message": "Notification marked as read"
}
```

### Chat System Endpoints

#### POST /api/chat/create
Create a new chat (supports both authenticated users and guests).

**Request Body:**
```json
{
  "guestName": "string (required for guests)",
  "guestEmail": "string (required for guests)",
  "subject": "string (required)",
  "message": "string (required)"
}
```

**Response:**
```json
{
  "_id": "chat_id",
  "subject": "Technical Support",
  "status": "OPEN",
  "priority": "MEDIUM",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "messages": [
    {
      "_id": "message_id",
      "content": "Hello, I need help",
      "sender": {
        "type": "USER|GUEST",
        "userId": "user_id",
        "guestName": "Guest User"
      },
      "timestamp": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### POST /api/chat/guest/message
Send message as guest user.

**Request Body:**
```json
{
  "chatId": "string (required)",
  "content": "string (required)",
  "guestName": "string (required)",
  "guestEmail": "string (required)"
}
```

#### GET /api/chat/:chatId
Get chat details (supports both authenticated and guest users).

**Response:**
```json
{
  "_id": "chat_id",
  "subject": "Technical Support",
  "status": "OPEN|ASSIGNED|CLOSED",
  "priority": "LOW|MEDIUM|HIGH|URGENT",
  "user": {
    "username": "username"
  },
  "guestInfo": {
    "name": "Guest User",
    "email": "guest@example.com"
  },
  "assignedAgent": {
    "username": "admin_username"
  },
  "messages": [
    {
      "_id": "message_id",
      "content": "Hello",
      "sender": {
        "type": "USER",
        "userId": "user_id"
      },
      "timestamp": "2024-01-01T00:00:00.000Z",
      "isRead": true
    }
  ],
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### GET /api/chat/stats
Get chat statistics.

**Authentication:** Required (Admin)

**Response:**
```json
{
  "totalChats": 150,
  "openChats": 25,
  "assignedChats": 40,
  "closedChats": 85,
  "avgResponseTime": 1800,
  "chatsByPriority": {
    "LOW": 50,
    "MEDIUM": 75,
    "HIGH": 20,
    "URGENT": 5
  }
}
```

#### GET /api/chat/admin/all
Get all chats for admin.

**Authentication:** Required (Admin)

**Response:**
```json
[
  {
    "_id": "chat_id",
    "subject": "Technical Support",
    "status": "OPEN",
    "priority": "MEDIUM",
    "user": {
      "username": "username"
    },
    "lastMessage": {
      "content": "Latest message",
      "timestamp": "2024-01-01T00:00:00.000Z"
    },
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### GET /api/chat/user
Get user's chats.

**Authentication:** Required (Protected)

**Response:**
```json
[
  {
    "_id": "chat_id",
    "subject": "Technical Support",
    "status": "OPEN",
    "priority": "MEDIUM",
    "lastMessage": {
      "content": "Latest message",
      "timestamp": "2024-01-01T00:00:00.000Z"
    },
    "unreadCount": 2,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### POST /api/chat/:chatId/assign
Assign chat to admin agent.

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "agentId": "string (required)"
}
```

#### POST /api/chat/:chatId/close
Close a chat.

**Authentication:** Required (Protected or Admin)

#### POST /api/chat/:chatId/read
Mark chat messages as read.

**Authentication:** Required (Protected)

#### POST /api/chat/:chatId/message
Send message in chat.

**Authentication:** Required (Protected)

**Request Body:**
```json
{
  "content": "string (required)"
}
```

### Game Lobby Scheduler Endpoints

#### GET /api/game-lobby-scheduler/stats
Get lobby scheduler statistics.

**Response:**
```json
{
  "isRunning": true,
  "nextCheck": "2024-01-01T00:05:00.000Z",
  "activeRooms": 15,
  "roomsCreated": 100,
  "lastCreated": "2024-01-01T00:00:00.000Z"
}
```

#### GET /api/game-lobby-scheduler/lobby-stats
Get general lobby statistics.

**Response:**
```json
{
  "totalRooms": 50,
  "activeRooms": 15,
  "waitingRooms": 10,
  "roomsByGameType": {
    "checkers": 20,
    "chess": 15,
    "tic-tac-toe": 10,
    "backgammon": 5
  }
}
```

#### POST /api/game-lobby-scheduler/force-check
Force lobby scheduler check.

**Authentication:** Required (Protected)

#### POST /api/game-lobby-scheduler/start
Start lobby scheduler.

**Authentication:** Required (Protected)

#### POST /api/game-lobby-scheduler/stop
Stop lobby scheduler.

**Authentication:** Required (Protected)

#### POST /api/game-lobby-scheduler/cleanup
Cleanup old rooms.

**Authentication:** Required (Protected)

### Security Endpoints

#### GET /api/security/dashboard
Get security dashboard data.

**Authentication:** Required (Admin)

**Response:**
```json
{
  "success": true,
  "data": {
    "activeSessions": 150,
    "securityEvents": 25,
    "blockedIPs": 5,
    "suspiciousActivity": 3,
    "systemHealth": "healthy"
  }
}
```

#### GET /api/security/sessions
Get active user sessions.

**Authentication:** Required (Admin)

**Response:**
```json
{
  "success": true,
  "data": {
    "activeSessions": 150,
    "sessions": [
      {
        "sessionId": "session_id",
        "userId": "user_id",
        "ip": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "lastActivity": "2024-01-01T00:05:00.000Z"
      }
    ]
  }
}
```

#### POST /api/security/sessions/:userId/logout
Force logout user from all sessions.

**Authentication:** Required (Admin)

**Response:**
```json
{
  "success": true,
  "message": "User user_id has been logged out from all sessions"
}
```

#### GET /api/security/blocked-ips
Get blocked IP addresses.

**Authentication:** Required (Admin)

**Response:**
```json
{
  "success": true,
  "data": {
    "blockedIPs": [],
    "message": "Blocked IPs feature requires Redis implementation"
  }
}
```

#### POST /api/security/block-ip
Block an IP address.

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "ip": "string (required, valid IP)",
  "reason": "string (required, 1-200 chars)",
  "duration": "number (optional, 60-86400 seconds, default: 3600)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "IP 192.168.1.100 has been blocked for 3600 seconds",
  "data": {
    "ip": "192.168.1.100",
    "reason": "Suspicious activity",
    "duration": 3600
  }
}
```

#### POST /api/security/unblock-ip
Unblock an IP address.

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "ip": "string (required, valid IP)"
}
```

#### GET /api/security/events
Get security events with pagination.

**Authentication:** Required (Admin)

**Query Parameters:**
- `page`: Number (default: 1)
- `limit`: Number (1-100, default: 20)
- `severity`: String (low|medium|high|critical)
- `type`: String (event type)
- `ip`: String (IP address filter)

**Response:**
```json
{
  "success": true,
  "data": {
    "events": [],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalItems": 0,
      "limit": 20
    },
    "filters": {
      "severity": null,
      "type": null,
      "ip": null
    }
  }
}
```

#### GET /api/security/health
Security system health check.

**Authentication:** Required (Admin)

**Response:**
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "components": {
      "securityMonitor": "operational",
      "rateLimit": "operational",
      "bruteForceProtection": "operational",
      "fileUploadSecurity": "operational",
      "xssProtection": "operational",
      "sqlInjectionProtection": "operational"
    },
    "overall": "healthy"
  }
}
```

#### GET /api/security/config
Get security configuration.

**Authentication:** Required (Admin)

**Response:**
```json
{
  "success": true,
  "data": {
    "rateLimit": {
      "global": {
        "windowMs": 900000,
        "max": 1000
      },
      "auth": {
        "windowMs": 900000,
        "max": 5
      },
      "admin": {
        "windowMs": 300000,
        "max": 100
      }
    },
    "security": {
      "maxLoginAttempts": 5,
      "lockoutTime": 1800000,
      "maxFileSize": 5242880,
      "allowedFileTypes": [".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf"]
    },
    "monitoring": {
      "alertCooldown": 300000,
      "patternDetection": true,
      "realTimeAlerts": true
    }
  }
}
```

#### PUT /api/security/config
Update security configuration.

**Authentication:** Required (Admin)

**Request Body:**
```json
{
  "maxLoginAttempts": "number (optional, 3-20)",
  "lockoutTime": "number (optional, 300000-3600000)",
  "maxFileSize": "number (optional, 1048576-52428800)"
}
```

### KYC (Sumsub) Endpoints

#### GET /api/sumsub/access-token
Get Sumsub access token for KYC verification.

**Authentication:** Required (Protected)

**Response:**
```json
{
  "token": "sumsub_access_token",
  "externalUserId": "user_id",
  "levelName": "basic-kyc-level"
}
```

#### GET /api/sumsub/verification-status
Get user's KYC verification status.

**Authentication:** Required (Protected)

**Response:**
```json
{
  "kycStatus": "NOT_SUBMITTED|PENDING|APPROVED|REJECTED",
  "sumsubStatus": "pending|completed",
  "reviewResult": "GREEN|RED|YELLOW",
  "applicantId": "sumsub_applicant_id",
  "reviewStatus": "init|pending|prechecked|queued|completed|onHold"
}
```

#### POST /api/sumsub/mock-submission
Submit mock KYC documents (development only).

**Authentication:** Required (Protected)

**Request Body:**
```json
{
  "kycProvider": "SUMSUB",
  "kycStatus": "PENDING",
  "mockMode": true,
  "applicantId": "mock_applicant_id",
  "documents": [
    {
      "documentType": "PASSPORT",
      "fileName": "passport.jpg"
    }
  ],
  "documentType": "PASSPORT",
  "filesCount": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Mock KYC submission saved successfully",
  "applicantId": "mock_applicant_id",
  "status": "PENDING",
  "documents": [
    {
      "documentType": "PASSPORT",
      "filePath": "mock/mock_applicant_id/passport.jpg",
      "submittedAt": "2024-01-01T00:00:00.000Z",
      "mockData": true
    }
  ]
}
```

#### POST /api/sumsub/webhook
Sumsub webhook handler.

**Authentication:** Not required (webhook signature verification)

**Content-Type:** application/json (raw)

#### GET /api/sumsub/admin/applicant/:userId
Get Sumsub applicant information (admin only).

**Authentication:** Required (Admin)

#### POST /api/sumsub/admin/sync/:userId
Sync Sumsub status for user (admin only).

**Authentication:** Required (Admin)

## Data Models

### User Model
```typescript
{
  _id: ObjectId,
  username: string,
  email: string,
  password: string (hashed),
  avatar: string,
  balance: number,
  role: "USER" | "ADMIN",
  status: "ACTIVE" | "BANNED" | "SUSPENDED" | "PENDING",
  kycStatus: "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED",
  kycDocuments: [
    {
      documentType: "PASSPORT" | "UTILITY_BILL" | "INTERNATIONAL_PASSPORT" | "RESIDENCE_PERMIT",
      filePath: string,
      submittedAt: Date
    }
  ],
  kycRejectionReason?: string,
  kycProvider: "LEGACY" | "SUMSUB",
  sumsubData?: {
    applicantId?: string,
    inspectionId?: string,
    externalUserId: string,
    levelName?: string,
    reviewStatus?: "init" | "pending" | "prechecked" | "queued" | "completed" | "onHold",
    reviewResult?: "GREEN" | "RED" | "YELLOW",
    createdAt?: Date,
    updatedAt?: Date,
    webhookData?: any
  },
  ageConfirmed: boolean,
  termsAccepted: boolean,
  privacyPolicyAccepted: boolean,
  passwordResetCode?: string,
  passwordResetExpires?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Tournament Model
```typescript
{
  _id: ObjectId,
  name: string,
  gameType: "tic-tac-toe" | "checkers" | "chess" | "backgammon" | "durak" | "domino" | "dice" | "bingo",
  status: "WAITING" | "ACTIVE" | "FINISHED" | "CANCELLED",
  entryFee: number,
  prizePool: number,
  maxPlayers: 4 | 8 | 16 | 32,
  players: [
    {
      _id: string,
      username: string,
      socketId?: string,
      isBot: boolean,
      registeredAt: Date
    }
  ],
  bracket: [
    {
      round: number,
      matches: [
        {
          matchId: ObjectId,
          player1: TournamentPlayer,
          player2: TournamentPlayer,
          winner?: TournamentPlayer,
          status: "WAITING" | "PENDING" | "ACTIVE" | "FINISHED"
        }
      ]
    }
  ],
  platformCommission: number,
  firstRegistrationTime?: Date,
  startedAt?: Date,
  finishedAt?: Date,
  winner?: TournamentPlayer,
  createdAt: Date,
  updatedAt: Date
}
```

### Transaction Model
```typescript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  type: "DEPOSIT" | "WITHDRAWAL" | "WAGER_LOSS" | "WAGER_WIN" | "TOURNAMENT_FEE" | "TOURNAMENT_WINNINGS",
  status: "COMPLETED" | "PENDING" | "CANCELLED",
  amount: number,
  createdAt: Date,
  updatedAt: Date
}
```

### GameRecord Model
```typescript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  gameName: "Checkers" | "Chess" | "Backgammon" | "Tic-Tac-Toe" | "Durak" | "Domino" | "Bingo" | "Dice",
  status: "WON" | "LOST" | "DRAW",
  amountChanged: number,
  opponent: string,
  createdAt: Date,
  updatedAt: Date
}
```

### Notification Model
```typescript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  title: string,
  message: string,
  link?: string,
  isRead: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## Socket Events

The API uses Socket.IO for real-time communication. Connect to the WebSocket server at the same base URL with proper authentication.

### Socket Connection and Authentication

#### Connection Setup
```javascript
import io from 'socket.io-client';

const socket = io('https://sklgmsapi.koltech.dev', {
  auth: {
    token: 'Bearer your_jwt_token' // Required for authenticated users
  }
});

// For guest users (chat support)
const guestSocket = io('https://sklgmsapi.koltech.dev');
```

#### Authentication
- **Authenticated Users**: Must provide valid JWT token in `auth.token`
- **Guest Users**: Can connect without token (limited to chat functionality)
- Invalid tokens will result in connection rejection

### Game Lobby Events

#### Client Events (Send to Server)

##### `joinLobby`
Join a game lobby to see available rooms.

**Parameters:**
```javascript
socket.emit('joinLobby', gameType);
```
- `gameType`: String - Game type ('tic-tac-toe', 'checkers', 'chess', 'backgammon', 'durak', 'domino', 'dice', 'bingo')

**Example:**
```javascript
socket.emit('joinLobby', 'checkers');
```

##### `leaveLobby`
Leave a game lobby.

**Parameters:**
```javascript
socket.emit('leaveLobby', gameType);
```

#### Server Events (Receive from Server)

##### `roomsList`
Updated list of available public rooms in the lobby.

**Data Structure:**
```javascript
socket.on('roomsList', (rooms) => {
  // rooms: Array of room objects
  console.log(rooms);
});
```

**Room Object:**
```javascript
{
  id: "room-socket_id",
  bet: 50,
  host: {
    user: {
      username: "player1"
    }
  }
}
```

### Game Room Events

#### Client Events (Send to Server)

##### `createRoom`
Create a new public game room.

**Parameters:**
```javascript
socket.emit('createRoom', { gameType, bet });
```
- `gameType`: String - Type of game
- `bet`: Number - Bet amount for the game

**Requirements:**
- User must be authenticated
- User balance must be >= bet amount

##### `createPrivateRoom`
Create a private game room with invitation.

**Parameters:**
```javascript
socket.emit('createPrivateRoom', { gameType, bet });
```

##### `joinRoom`
Join an existing public room.

**Parameters:**
```javascript
socket.emit('joinRoom', roomId);
```
- `roomId`: String - ID of the room to join

##### `joinPrivateRoom`
Join a private room using invitation token.

**Parameters:**
```javascript
socket.emit('joinPrivateRoom', token);
```
- `token`: String - Private room invitation token

##### `getPrivateRoomInfo`
Get information about a private room invitation.

**Parameters:**
```javascript
socket.emit('getPrivateRoomInfo', token);
```

##### `playerMove`
Make a move in the game.

**Parameters:**
```javascript
socket.emit('playerMove', { roomId, move });
```
- `roomId`: String - Room ID
- `move`: Object - Move data (structure depends on game type)

**Example Moves by Game Type:**
```javascript
// Tic-Tac-Toe
{ type: 'PLACE_MARK', position: 4 }

// Checkers
{ type: 'MOVE_PIECE', from: [2, 1], to: [3, 2] }

// Chess
{ type: 'MOVE_PIECE', from: 'e2', to: 'e4' }

// Backgammon
{ type: 'MOVE_CHECKER', from: 24, to: 20, checkers: 1 }

// Dice
{ type: 'SELECT_DICE', diceIndex: 0 }
{ type: 'BANK_SCORE' }

// Bingo
{ type: 'MARK_NUMBER', number: 15 }
```

##### `rollDice`
Roll dice (specific to backgammon).

**Parameters:**
```javascript
socket.emit('rollDice', roomId);
```

##### `leaveGame`
Leave the current game room.

**Parameters:**
```javascript
socket.emit('leaveGame', roomId);
```

##### `getGameState`
Request current game state.

**Parameters:**
```javascript
socket.emit('getGameState', roomId);
```

#### Server Events (Receive from Server)

##### `gameStart`
Game has started with all players.

**Data Structure:**
```javascript
socket.on('gameStart', (roomState) => {
  console.log('Game started:', roomState);
});
```

##### `gameUpdate`
Game state has been updated.

**Data Structure:**
```javascript
socket.on('gameUpdate', (roomState) => {
  console.log('Game updated:', roomState);
});
```

**Room State Object:**
```javascript
{
  id: "room_id",
  gameType: "checkers",
  bet: 50,
  players: [
    {
      socketId: "socket_id",
      user: {
        _id: "user_id",
        username: "player1",
        avatar: "avatar_url",
        balance: 1000
      }
    }
  ],
  gameState: {
    // Game-specific state
    board: [...],
    turn: "user_id",
    isGameFinished: false,
    currentPlayer: 0
  },
  turnStartTime: 1640995200000,
  moveTimeLimit: 30000
}
```

##### `gameEnd`
Game has ended.

**Data Structure:**
```javascript
socket.on('gameEnd', ({ winner, isDraw }) => {
  if (isDraw) {
    console.log('Game ended in draw');
  } else {
    console.log('Winner:', winner.user.username);
  }
});
```

##### `gameTimeout`
A player's move timer has expired.

**Data Structure:**
```javascript
socket.on('gameTimeout', (data) => {
  console.log('Player timed out:', data);
});
```

**Timeout Data:**
```javascript
{
  timedOutPlayerId: "user_id",
  timedOutPlayerName: "player1",
  winnerId: "user_id2",
  winnerName: "player2",
  message: "player1 превысил время хода (30 сек). player2 побеждает!",
  reason: "timeout"
}
```

##### `moveTimerStart`
Move timer started for current player.

**Data Structure:**
```javascript
socket.on('moveTimerStart', (data) => {
  console.log('Timer started:', data);
});
```

**Timer Data:**
```javascript
{
  timeLimit: 30000,
  currentPlayerId: "user_id",
  startTime: 1640995200000
}
```

##### `moveTimerWarning`
Move timer warning (10 seconds remaining).

**Data Structure:**
```javascript
socket.on('moveTimerWarning', (data) => {
  console.log('Timer warning:', data);
});
```

##### `privateRoomCreated`
Private room has been created successfully.

**Data Structure:**
```javascript
socket.on('privateRoomCreated', (data) => {
  console.log('Private room created:', data);
});
```

**Private Room Data:**
```javascript
{
  room: roomState,
  invitationToken: "abc123...",
  invitationUrl: "https://platform.skillgame.pro/private-room/abc123...",
  expiresAt: "2024-01-01T01:00:00.000Z"
}
```

##### `privateRoomInfo`
Information about private room invitation.

**Data Structure:**
```javascript
socket.on('privateRoomInfo', (data) => {
  console.log('Private room info:', data);
});
```

##### `playerReconnected`
A player has reconnected to the game.

**Data Structure:**
```javascript
socket.on('playerReconnected', ({ message }) => {
  console.log(message); // "Player username returned to the game!"
});
```

##### `opponentDisconnected`
Opponent has disconnected (60-second wait timer).

**Data Structure:**
```javascript
socket.on('opponentDisconnected', ({ message }) => {
  console.log(message); // "Opponent disconnected. Waiting for reconnection (60 sec)..."
});
```

### Tournament Events

#### Client Events (Send to Server)

##### `joinTournamentGame`
Join a tournament match.

**Parameters:**
```javascript
socket.emit('joinTournamentGame', matchId);
```
- `matchId`: String - Tournament match ID

##### `leaveTournamentGame`
Leave a tournament match.

**Parameters:**
```javascript
socket.emit('leaveTournamentGame', matchId);
```

##### `tournamentMove`
Make a move in tournament game.

**Parameters:**
```javascript
socket.emit('tournamentMove', { matchId, move });
```
- `matchId`: String - Tournament match ID
- `move`: Object - Move data

##### `tournamentPlayerLeft`
Notify that player left tournament match temporarily.

**Parameters:**
```javascript
socket.emit('tournamentPlayerLeft', { matchId, timestamp });
```
- `timestamp`: Number - Time when player left

##### `tournamentPlayerReturned`
Notify that player returned to tournament match.

**Parameters:**
```javascript
socket.emit('tournamentPlayerReturned', { matchId });
```

##### `tournamentPlayerForfeited`
Forfeit tournament match.

**Parameters:**
```javascript
socket.emit('tournamentPlayerForfeited', { matchId, reason });
```
- `reason`: String (optional) - Reason for forfeit

#### Server Events (Receive from Server)

##### `tournamentUpdated`
Tournament status or bracket has been updated.

**Data Structure:**
```javascript
socket.on('tournamentUpdated', (tournament) => {
  console.log('Tournament updated:', tournament);
});
```

### Chat Events

#### Client Events (Send to Server)

##### `joinChat`
Join a chat room.

**Parameters:**
```javascript
// Join existing chat by ID
socket.emit('joinChat', chatId);

// Auto-find/create user's support chat
socket.emit('joinChat', { userId: 'user_id', autoCreate: true });

// Join specific chat
socket.emit('joinChat', { chatId: 'chat_id' });
```

##### `leaveChat`
Leave a chat room.

**Parameters:**
```javascript
socket.emit('leaveChat', chatId);
```

##### `sendMessage`
Send a message in chat.

**Parameters:**
```javascript
// Authenticated user
socket.emit('sendMessage', {
  chatId: 'chat_id', // optional, will auto-create if not provided
  content: 'Hello, I need help',
  autoCreate: true // optional, auto-create chat if needed
});

// Guest user
socket.emit('sendMessage', {
  chatId: 'chat_id', // optional
  content: 'Hello',
  guestInfo: {
    id: 'guest_unique_id',
    name: 'Guest Name'
  },
  autoCreate: true
});
```

##### `markChatRead`
Mark chat messages as read.

**Parameters:**
```javascript
socket.emit('markChatRead', chatId);
```

##### `chatTyping`
Send typing indicator.

**Parameters:**
```javascript
socket.emit('chatTyping', { chatId, isTyping: true });
```

##### `closeChat`
Close a chat (admin or owner only).

**Parameters:**
```javascript
socket.emit('closeChat', chatId);
```

#### Server Events (Receive from Server)

##### `chatJoined`
Successfully joined a chat room.

**Data Structure:**
```javascript
socket.on('chatJoined', (data) => {
  console.log('Joined chat:', data);
});
```

**Join Data:**
```javascript
{
  chatId: "chat_id",
  message: "Successfully joined chat",
  chat: {
    id: "chat_id",
    subject: "Support Request",
    status: "pending",
    messages: [...],
    createdAt: "2024-01-01T00:00:00.000Z"
  }
}
```

##### `chatLeft`
Successfully left a chat room.

**Data Structure:**
```javascript
socket.on('chatLeft', ({ chatId }) => {
  console.log('Left chat:', chatId);
});
```

##### `newMessage`
New message received in chat.

**Data Structure:**
```javascript
socket.on('newMessage', ({ chatId, message }) => {
  console.log('New message:', message);
});
```

**Message Object:**
```javascript
{
  id: "message_id",
  chatId: "chat_id",
  content: "Message text",
  sender: {
    id: "user_id",
    name: "Username",
    type: "user" | "admin" | "guest"
  },
  timestamp: "2024-01-01T00:00:00.000Z",
  isRead: false
}
```

##### `messagesRead`
Messages marked as read by someone.

**Data Structure:**
```javascript
socket.on('messagesRead', ({ chatId, readBy }) => {
  console.log('Messages read by:', readBy);
});
```

##### `chatReadConfirmed`
Confirmation that messages were marked as read.

**Data Structure:**
```javascript
socket.on('chatReadConfirmed', ({ chatId }) => {
  console.log('Chat read confirmed for:', chatId);
});
```

##### `userTyping`
Someone is typing in the chat.

**Data Structure:**
```javascript
socket.on('userTyping', ({ chatId, userId, userName, isTyping }) => {
  if (isTyping) {
    console.log(`${userName} is typing...`);
  } else {
    console.log(`${userName} stopped typing`);
  }
});
```

##### `chatClosed`
Chat has been closed.

**Data Structure:**
```javascript
socket.on('chatClosed', ({ chatId, closedBy }) => {
  console.log(`Chat ${chatId} closed by ${closedBy}`);
});
```

##### `chatError`
Chat-related error occurred.

**Data Structure:**
```javascript
socket.on('chatError', ({ message }) => {
  console.error('Chat error:', message);
});
```

### System Events

#### Server Events (Receive from Server)

##### `balanceUpdated`
User balance has been updated (globally broadcast).

**Data Structure:**
```javascript
socket.on('balanceUpdated', (data) => {
  if (data.userId === currentUserId) {
    console.log('My balance updated:', data.newBalance);
  }
});
```

**Balance Update Data:**
```javascript
{
  userId: "user_id",
  newBalance: 150.50,
  transaction: {
    type: "DEPOSIT" | "WITHDRAWAL" | "WAGER_WIN" | "WAGER_LOSS",
    amount: 50.00,
    status: "COMPLETED",
    createdAt: "2024-01-01T00:00:00.000Z"
  }
}
```

##### `kycStatusUpdated`
KYC status has been updated (globally broadcast).

**Data Structure:**
```javascript
socket.on('kycStatusUpdated', (data) => {
  if (data.userId === currentUserId) {
    console.log('My KYC status updated:', data.kycStatus);
  }
});
```

**KYC Update Data:**
```javascript
{
  userId: "user_id",
  kycStatus: "PENDING" | "APPROVED" | "REJECTED",
  kycRejectionReason: "reason (if rejected)"
}
```

##### `error`
General error notification.

**Data Structure:**
```javascript
socket.on('error', ({ message }) => {
  console.error('Socket error:', message);
});
```

### Complete Integration Example

```javascript
import io from 'socket.io-client';

class SkillGameSocketClient {
  constructor(token = null) {
    this.socket = io('https://sklgmsapi.koltech.dev', {
      auth: token ? { token: `Bearer ${token}` } : {}
    });
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    // Game lobby events
    this.socket.on('roomsList', (rooms) => {
      this.updateLobbyRooms(rooms);
    });

    // Game events
    this.socket.on('gameStart', (roomState) => {
      this.handleGameStart(roomState);
    });

    this.socket.on('gameUpdate', (roomState) => {
      this.handleGameUpdate(roomState);
    });

    this.socket.on('gameEnd', ({ winner, isDraw }) => {
      this.handleGameEnd(winner, isDraw);
    });

    this.socket.on('moveTimerStart', (data) => {
      this.startMoveTimer(data.timeLimit, data.currentPlayerId);
    });

    this.socket.on('moveTimerWarning', (data) => {
      this.showTimerWarning(data.timeRemaining);
    });

    this.socket.on('gameTimeout', (data) => {
      this.handleGameTimeout(data);
    });

    // Chat events
    this.socket.on('chatJoined', (data) => {
      this.handleChatJoined(data);
    });

    this.socket.on('newMessage', ({ chatId, message }) => {
      this.handleNewMessage(chatId, message);
    });

    this.socket.on('userTyping', ({ chatId, userName, isTyping }) => {
      this.handleTypingIndicator(chatId, userName, isTyping);
    });

    // System events
    this.socket.on('balanceUpdated', (data) => {
      this.handleBalanceUpdate(data);
    });

    this.socket.on('error', ({ message }) => {
      this.handleError(message);
    });
  }

  // Game methods
  joinLobby(gameType) {
    this.socket.emit('joinLobby', gameType);
  }

  createRoom(gameType, bet) {
    this.socket.emit('createRoom', { gameType, bet });
  }

  joinRoom(roomId) {
    this.socket.emit('joinRoom', roomId);
  }

  makeMove(roomId, move) {
    this.socket.emit('playerMove', { roomId, move });
  }

  // Chat methods
  joinChat(chatId) {
    this.socket.emit('joinChat', chatId);
  }

  sendMessage(chatId, content) {
    this.socket.emit('sendMessage', { chatId, content });
  }

  startTyping(chatId) {
    this.socket.emit('chatTyping', { chatId, isTyping: true });
  }

  stopTyping(chatId) {
    this.socket.emit('chatTyping', { chatId, isTyping: false });
  }

  // Event handlers (implement according to your UI)
  updateLobbyRooms(rooms) {
    // Update lobby UI with available rooms
  }

  handleGameStart(roomState) {
    // Initialize game UI with room state
  }

  handleGameUpdate(roomState) {
    // Update game board and state
  }

  handleGameEnd(winner, isDraw) {
    // Show game result
  }

  startMoveTimer(timeLimit, currentPlayerId) {
    // Start countdown timer in UI
  }

  showTimerWarning(timeRemaining) {
    // Show warning that time is running out
  }

  handleGameTimeout(data) {
    // Handle timeout scenario
  }

  handleChatJoined(data) {
    // Setup chat UI
  }

  handleNewMessage(chatId, message) {
    // Display new message in chat
  }

  handleTypingIndicator(chatId, userName, isTyping) {
    // Show/hide typing indicator
  }

  handleBalanceUpdate(data) {
    // Update user balance in UI
  }

  handleError(message) {
    // Show error message
  }
}

// Usage
const gameClient = new SkillGameSocketClient('your_jwt_token');

// Join checkers lobby
gameClient.joinLobby('checkers');

// Create a room
gameClient.createRoom('checkers', 50);

// Make a move
gameClient.makeMove('room_id', { type: 'MOVE_PIECE', from: [2, 1], to: [3, 2] });
```

### Error Handling

All socket events should include proper error handling:

```javascript
socket.on('error', ({ message }) => {
  switch (message) {
    case 'Authentication required':
      // Redirect to login
      break;
    case 'Insufficient funds':
      // Show deposit modal
      break;
    case 'Room is already full':
      // Refresh lobby
      break;
    default:
      // Show generic error
      console.error('Socket error:', message);
  }
});
```

### Reconnection Handling

Socket.IO handles automatic reconnection, but you should handle game state sync:

```javascript
socket.on('connect', () => {
  // If user was in a game, request current state
  if (currentRoomId) {
    socket.emit('getGameState', currentRoomId);
  }
  
  // Rejoin lobby if needed
  if (currentLobby) {
    socket.emit('joinLobby', currentLobby);
  }
});
```

### Best Practices

1. **Always handle errors**: Listen for `error` events and handle them appropriately
2. **Clean up on disconnect**: Remove timers and UI elements when disconnected
3. **Validate user permissions**: Check if user can perform actions before sending events
4. **Handle reconnections**: Sync game state when reconnecting
5. **Rate limiting**: Don't spam events (especially chat typing indicators)
6. **Memory management**: Clean up event listeners when component unmounts
7. **Security**: Never trust client-side validation; server always validates moves

## Health Check Endpoints

#### GET /health
Basic health check endpoint.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600
}
```

#### GET /cors-test
CORS configuration test endpoint.

**Response:**
```json
{
  "message": "CORS test successful",
  "origin": "https://your-origin.com",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### GET /
API root endpoint.

**Response:**
```json
{
  "message": "SkillGame Pro API is running",
  "version": "1.0.0"
}
```

---

## Additional Notes

1. **Environment**: The API supports both development and production environments with different payment processing modes.

2. **File Uploads**: Avatar and KYC document uploads are supported with file size and type restrictions.

3. **Real-time Features**: Socket.IO is used for real-time game updates, chat, and notifications.

4. **Security**: The API includes comprehensive security measures including rate limiting, IP blocking, and session management.

5. **Pagination**: Most list endpoints support pagination with consistent query parameters (`page`, `limit`).

6. **Filtering**: Many endpoints support filtering and search capabilities.

7. **Error Responses**: All endpoints return consistent error response formats with appropriate HTTP status codes.

8. **Development Features**: Mock KYC submission and demo payment processing are available for development and testing.

For support or questions about the API, please contact the development team.