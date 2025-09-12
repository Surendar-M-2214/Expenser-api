# API Testing Guide

## 1. Get Authentication Token

First, you need to get a valid Clerk token. You can get this from your mobile app's console logs when making API calls.

## 2. Test Profile Update

```bash
curl -X PUT "http://localhost:3000/api/users/profile" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "username": "testuser123"
  }'
```

## 3. Test Username Check

```bash
curl -X POST "http://localhost:3000/api/users/check-username" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser123"
  }'
```

## 4. Test Profile Image Upload

```bash
curl -X POST "http://localhost:3000/api/users/profile-image" \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN_HERE" \
  -F "file=@/path/to/your/image.jpg"
```

## 5. Check Backend Logs

When you run these commands, check your backend terminal for:

```
=== UPDATE PROFILE DEBUG ===
Full req.auth object: { userId: 'user_xxxxx', ... }
req.headers.authorization: Token present
User ID from auth: user_xxxxx
User ID type: string
```

## 6. Expected Responses

### Success Response (Profile Update):
```json
{
  "message": "Profile updated successfully",
  "user": {
    "id": "user_xxxxx",
    "username": "testuser123",
    "firstName": "Test",
    "lastName": "User"
  }
}
```

### Error Response (No Token):
```json
{
  "error": "User not authenticated"
}
```
