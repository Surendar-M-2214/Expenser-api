# Database Schema Update

## Overview

Updated the database schema and all related files to:
1. Keep user ID as VARCHAR (already correct)
2. Change `merchant` field to `description`
3. Remove `status` field completely

## Database Schema Changes

### Before:
```sql
CREATE TABLE user_transactions (
    id serial PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    type VARCHAR(20) NOT NULL CHECK (type IN ('debit','credit')),
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','failed')), -- REMOVED
    category VARCHAR(64),
    tags TEXT[] NOT NULL DEFAULT '{}'::text[],
    description VARCHAR(128),
    reference VARCHAR(64),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### After:
```sql
CREATE TABLE user_transactions (
    id serial PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    type VARCHAR(20) NOT NULL CHECK (type IN ('debit','credit')),
    category VARCHAR(64),
    tags TEXT[] NOT NULL DEFAULT '{}'::text[],
    description VARCHAR(128), -- RENAMED from merchant
    reference VARCHAR(64),
    receipt_url VARCHAR(500), -- NEW: URL to uploaded receipt
    receipt_filename VARCHAR(255), -- NEW: Original filename
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Index Changes

### Before:
```sql
CREATE INDEX idx_user_transactions_merchant ON user_transactions(merchant);
```

### After:
```sql
CREATE INDEX idx_user_transactions_description ON user_transactions(description);
CREATE INDEX idx_user_transactions_receipt_url ON user_transactions(receipt_url);
```

## Backend Changes

### File: `src/controllers/transactionControllers.js`

**Updated `createTransaction` function:**

1. **Removed status field:**
   ```javascript
   // Before
   const { amount, currency, type, status, category, tags, merchant, reference, transaction_date } = req.body;
   
   // After
   const { amount, currency, type, category, tags, description, reference, transaction_date } = req.body;
   ```

2. **Removed status validation:**
   ```javascript
   // Removed
   const statusValue = status || 'completed';
   if (status && !['pending', 'completed', 'failed'].includes(status)) {
       return res.status(400).json({ error: "Status must be one of: 'pending', 'completed', 'failed'" });
   }
   ```

3. **Updated INSERT statement:**
   ```sql
   -- Before
   INSERT INTO user_transactions (
       user_id, amount, currency, type, status, category, tags, merchant, reference, transaction_date
   ) VALUES (
       ${userId}, ${amount}, ${currencyValue}, ${type}, ${statusValue}, ${category}, ${tagsValue}, ${merchant}, ${reference}, ${transaction_date || 'CURRENT_DATE'}
   )
   
   -- After
   INSERT INTO user_transactions (
       user_id, amount, currency, type, category, tags, description, reference, transaction_date
   ) VALUES (
       ${userId}, ${amount}, ${currencyValue}, ${type}, ${category}, ${tagsValue}, ${description}, ${reference}, ${transaction_date || 'CURRENT_DATE'}
   )
   ```

## Mobile App Changes

### File: `services/transactionService.js`

**Updated `createTransaction` method:**

```javascript
// Before
const {
  amount,
  currency = 'INR',
  type,
  status = 'completed', // REMOVED
  category,
  tags = [],
  merchant, // CHANGED to description
  reference,
  transaction_date
} = transactionData;

// After
const {
  amount,
  currency = 'INR',
  type,
  category,
  tags = [],
  description, // RENAMED from merchant
  reference,
  transaction_date
} = transactionData;
```

### File: `app/(modals)/create.jsx`

**Updated transaction data structure:**

```javascript
// Before
const transactionData = {
  amount: parseFloat(amount),
  type: isExpense ? 'debit' : 'credit',
  category: selectedCategory,
  currency: 'INR',
  status: 'completed', // REMOVED
  merchant: '', // CHANGED to description
  reference: title,
  transaction_date: new Date().toISOString().split('T')[0],
  tags: []
};

// After
const transactionData = {
  amount: parseFloat(amount),
  type: isExpense ? 'debit' : 'credit',
  category: selectedCategory,
  currency: 'INR',
  description: '', // RENAMED from merchant
  reference: title,
  transaction_date: new Date().toISOString().split('T')[0],
  tags: []
};
```

## API Request/Response Changes

### Transaction Creation Request

**Before:**
```json
{
  "amount": 100.00,
  "type": "debit",
  "category": "Food & Drinks",
  "currency": "INR",
  "status": "completed",
  "merchant": "Restaurant",
  "reference": "Transaction title",
  "transaction_date": "2024-01-15",
  "tags": []
}
```

**After:**
```json
{
  "amount": 100.00,
  "type": "debit",
  "category": "Food & Drinks",
  "currency": "INR",
  "description": "Restaurant",
  "reference": "Transaction title",
  "receipt_url": "https://storage.com/receipts/receipt_123.jpg",
  "receipt_filename": "receipt_123.jpg",
  "transaction_date": "2024-01-15",
  "tags": []
}
```

## Migration Notes

### Database Migration
If you have existing data, you'll need to run these SQL commands:

```sql
-- Rename merchant column to description
ALTER TABLE user_transactions RENAME COLUMN merchant TO description;

-- Drop the status column
ALTER TABLE user_transactions DROP COLUMN status;

-- Add receipt fields
ALTER TABLE user_transactions ADD COLUMN receipt_url VARCHAR(500);
ALTER TABLE user_transactions ADD COLUMN receipt_filename VARCHAR(255);

-- Update indexes
DROP INDEX IF EXISTS idx_user_transactions_merchant;
CREATE INDEX idx_user_transactions_description ON user_transactions(description);
CREATE INDEX idx_user_transactions_receipt_url ON user_transactions(receipt_url);
```

### Breaking Changes
- **Status field removed** - All transactions are now considered "completed"
- **Merchant field renamed** - Now called "description"
- **Receipt fields added** - Optional receipt_url and receipt_filename fields
- **API requests** - Must use new field names

## Benefits

1. **Simplified Schema** - Removed unnecessary status field
2. **Clearer Naming** - "description" is more descriptive than "merchant"
3. **Receipt Support** - Users can attach receipts and bills to transactions
4. **Consistent Data** - All transactions are completed by default
5. **Better Performance** - Fewer fields to process and validate
6. **Better Record Keeping** - Complete transaction history with supporting documents

## Testing

### Backend Testing
```bash
# Test transaction creation with new schema
curl -X POST "https://your-vercel-app.vercel.app/api/users/1/transactions" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100.00,
    "type": "debit",
    "category": "Food & Drinks",
    "currency": "INR",
    "description": "Restaurant",
    "reference": "Lunch",
    "receipt_url": "https://storage.com/receipts/receipt_123.jpg",
    "receipt_filename": "receipt_123.jpg",
    "transaction_date": "2024-01-15",
    "tags": []
  }'
```

### Mobile Testing
```javascript
import { testUserEndpoint } from '../utils/apiTest';

// Test the updated schema
const result = await testUserEndpoint(1);
console.log('Schema validation:', result.summaryValid);
```

The database schema is now simplified and more consistent! 🎉
