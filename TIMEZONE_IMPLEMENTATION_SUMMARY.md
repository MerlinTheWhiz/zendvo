# Timezone-aware Unlocks Implementation Summary

## Overview

Successfully implemented timezone-aware unlocks for the Zendvo gift system. The implementation ensures that `unlock_at` values are stored as UTC in the database while allowing senders to specify unlock times in their local timezone.

## Key Changes Made

### 1. Enhanced Validation (`src/lib/validation.ts`)

- **Strict ISO 8601 Format**: Updated `validateUnlockAt()` to enforce strict ISO 8601 format with timezone and milliseconds
- **Rejection of Generic Timestamps**: API now rejects formats like `"2026-03-30 14:00:00"` or `"2026-03-30T14:00:00"`
- **Required Format**: Only accepts `"YYYY-MM-DDTHH:mm:ss.sssZ"` or `"YYYY-MM-DDTHH:mm:ss.sss±HH:mm"`

### 2. UTC Conversion Utilities

- **`convertToUTCDate()`**: Converts any valid ISO 8601 string to a UTC Date object for database storage
- **`formatAsUTCISO()`**: Formats Date objects as ISO 8601 strings in UTC (Z format) for API responses

### 3. Updated API Routes

- **`src/app/api/gifts/route.ts`**: Updated to use `convertToUTCDate()` for database storage
- **`src/app/api/gifts/public/route.ts`**: Updated to use `convertToUTCDate()` for database storage
- **Response Format**: All API responses now return Z-formatted dates (e.g., `"2026-03-30T17:00:00.000Z"`)

### 4. Comprehensive Testing

- **Validation Tests**: 13 tests covering all validation scenarios
- **Integration Tests**: 5 tests covering real-world timezone conversion scenarios
- **All Tests Passing**: 100% test success rate

## Implementation Details

### Before vs After

**Before:**

```javascript
// Accepted any format
unlock_at: "2026-03-30 14:00:00"; // ❌ No timezone info
unlock_at: "2026-03-30T14:00:00"; // ❌ No timezone info

// Stored as-is without timezone conversion
unlockDatetime: new Date(unlock_at);
```

**After:**

```javascript
// Strict validation
unlock_at: "2026-03-30T14:00:00.000Z"; // ✅ UTC format
unlock_at: "2026-03-30T14:00:00.000+01:00"; // ✅ Offset format

// Converted to UTC for storage
unlockDatetime: convertToUTCDate(unlock_at); // Always UTC
```

### Timezone Conversion Example

**Scenario**: Sender in PST (UTC-8) wants gift to unlock at 9 AM PST

```javascript
// Input from PST sender
const pstTime = "2026-03-30T09:00:00.000-08:00";

// Validation passes
validateUnlockAt(pstTime); // { valid: true }

// Converted to UTC for database storage
const utcDate = convertToUTCDate(pstTime); // Date object representing 17:00 UTC

// Stored as UTC
unlockDatetime: utcDate; // "2026-03-30T17:00:00.000Z"

// API response returns Z-formatted date
formatAsUTCISO(utcDate); // "2026-03-30T17:00:00.000Z"
```

## Benefits Achieved

1. **Global Consistency**: All unlock times stored as UTC ensures consistent database operations worldwide
2. **Timezone Accuracy**: Senders can specify times in their local timezone, automatically converted to UTC
3. **API Standardization**: All responses return standardized Z-formatted ISO 8601 dates
4. **Frontend Flexibility**: Frontend components can format UTC times to any timezone for display
5. **Validation Security**: Strict format validation prevents timezone-related bugs

## Files Modified

1. `src/lib/validation.ts` - Enhanced validation and added UTC conversion utilities
2. `src/app/api/gifts/route.ts` - Updated to use UTC conversion
3. `src/app/api/gifts/public/route.ts` - Updated to use UTC conversion
4. `__tests__/validation.test.ts` - Comprehensive validation tests
5. `__tests__/timezone-integration.test.ts` - Integration tests for timezone scenarios

## Test Results

```
Test Suites: 2 passed, 2 total
Tests:       18 passed, 18 total
Snapshots:   0 total
Time:        3.508 s
```

## Requirements Met

✅ **Force API routes to reject generic timestamps** - Strict ISO 8601 validation implemented  
✅ **Process all ISO strings explicitly down into UTC Date objects** - `convertToUTCDate()` utility  
✅ **Validate that standard outputs returned in JSON APIs are universally sent as Z-formatted dates** - `formatAsUTCISO()` utility  
✅ **Keep the timezone formatting task offloaded exclusively to the frontend components** - UTC storage with frontend display flexibility  
✅ **An unlock set by a sender in PST accurately correlates back as its equivalent UTC value inside the PostgreSQL backend** - Verified with PST→UTC conversion tests

The implementation successfully provides timezone-aware unlocks while maintaining UTC consistency in the database, ensuring reliable global operation without timezone drift.
