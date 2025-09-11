# API Structure Update - Simplified User Fields

## Overview

Updated the API structure to simplify user fields. The `name` field now represents the username, and we have a separate `phone_number` field. Removed the separate `username` field to avoid redundancy.

## Database Schema Changes

### Before:
```sql
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    username VARCHAR(255),        -- REMOVED
    phone_number VARCHAR(20)
)
```

### After:
```sql
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,   -- This is now the username
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20)
)
```

## API Request/Response Changes

### User Creation Request

**Before:**
```json
{
  "id": "user_123",
  "name": "John Doe",
  "email": "john@example.com",
  "username": "johndoe",
  "phone_number": "+1234567890"
}
```

**After:**
```json
{
  "id": "user_123",
  "name": "johndoe",              // name is now the username
  "email": "john@example.com",
  "phone_number": "+1234567890"
}
```

### User Update Request

**Before:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "username": "johndoe",
  "phone_number": "+1234567890"
}
```

**After:**
```json
{
  "name": "johndoe",              // name is now the username
  "email": "john@example.com",
  "phone_number": "+1234567890"
}
```

## Backend Controller Changes

### File: `src/controllers/userControllers.js`

**Updated createUser function:**
```javascript
// Before
const {id, name, email, username, phone_number } = req.body;
const user = await sql`INSERT INTO users (id, name, email, username, phone_number) VALUES (${id}, ${name}, ${email}, ${username}, ${phone_number}) RETURNING *`;

// After
const {id, name, email, phone_number } = req.body;
const user = await sql`INSERT INTO users (id, name, email, phone_number) VALUES (${id}, ${name}, ${email}, ${phone_number}) RETURNING *`;
```

**Updated updateUser function:**
```javascript
// Before
const { name, email, username, phone_number } = req.body;
// ... username handling removed

// After
const { name, email, phone_number } = req.body;
// name field represents username
```

## Field Mapping

### Frontend to Backend Mapping:
- **Frontend `username`** → **Backend `name`** (username)
- **Frontend `phoneNumber`** → **Backend `phone_number`**
- **Frontend `emailAddress`** → **Backend `email`**
- **Frontend `password`** → **Clerk handles this**

### Clerk Integration:
- **Frontend `username`** → **Clerk `firstName`**
- **Frontend `phoneNumber`** → **Clerk `phoneNumber`**

## Validation Rules

### Name (Username)
- Required field
- Represents the user's chosen username
- No special validation (handled by Clerk)

### Email
- Required field
- Must be valid email format
- Uses regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`

### Phone Number
- Optional field
- Validates international format
- Uses regex: `/^[\+]?[1-9][\d]{0,15}$/`
- Strips spaces, dashes, and parentheses for validation

## Migration Notes

### Database Migration
If you have existing data with the old schema:

```sql
-- For existing databases, you can either:
-- Option 1: Keep both fields and migrate data
UPDATE users SET name = username WHERE username IS NOT NULL;

-- Option 2: Drop the username column (if you want to simplify)
ALTER TABLE users DROP COLUMN username;
```

### API Migration
- Update all API calls to use `name` instead of `username`
- Remove `username` field from request bodies
- Update frontend to send username as `name` field

## Benefits

1. **Simplified Schema** - Fewer fields to manage
2. **Clearer Naming** - `name` field clearly represents username
3. **Reduced Redundancy** - No duplicate username/name fields
4. **Easier Maintenance** - Less complex database structure
5. **Consistent API** - Cleaner request/response structure

## Testing

### API Testing
```bash
# Test user creation with new structure
curl -X POST "https://your-api.com/api/users" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "user_123",
    "name": "johndoe",
    "email": "john@example.com",
    "phone_number": "+1234567890"
  }'

# Test user update
curl -X PUT "https://your-api.com/api/users/user_123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "newusername",
    "email": "newemail@example.com",
    "phone_number": "+9876543210"
  }'
```

## Breaking Changes

- **Removed `username` field** from API requests/responses
- **`name` field now represents username** instead of full name
- **Database schema simplified** - removed username column

## Frontend Compatibility

The frontend sign-up form remains the same:
- User enters username in the username field
- Frontend sends username as `firstName` to Clerk
- Backend receives username as `name` field
- Phone number is sent as `phone_number`

The API structure is now simplified and more intuitive! 🎉
