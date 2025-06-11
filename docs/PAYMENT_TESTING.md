
# Payment Testing Documentation

## Overview
This document provides comprehensive testing guidelines for the Tap payment integration system.

## Sandbox Testing

### Test Card Numbers
Use these test card numbers in Tap's sandbox environment:

#### Success Scenarios
- **4242 4242 4242 4242** - Always succeeds (CAPTURED)
- **4000 0000 0000 0077** - Succeeds with 3DS authentication
- **4000 0000 0000 0093** - Succeeds after retry

#### Failure Scenarios
- **4000 0000 0000 0002** - Generic decline (FAILED)
- **4000 0000 0000 0069** - Expired card (FAILED)
- **4000 0000 0000 0119** - Processing error (FAILED)

### Testing Scenarios

#### 1. Standard Success Flow
1. Use card: 4242 4242 4242 4242
2. Complete payment normally
3. Expected: CAPTURED → /payment/success
4. Verify subscription creation in database

#### 2. 3DS Authentication
1. Use card: 4000 0000 0000 0077
2. Complete 3DS challenge
3. Expected: CAPTURED → /payment/success

#### 3. Payment Failure
1. Use card: 4000 0000 0000 0002
2. Payment should decline
3. Expected: FAILED → /payment/failed

#### 4. Webhook Recovery Test
1. Start payment process
2. Close browser tab before completion
3. Webhook should process payment
4. Expected: CAPTURED via webhook → database updated

#### 5. Network Interruption
1. Start payment
2. Simulate network disconnection
3. Expected: Graceful error handling

## Testing Tools

### 1. Payment Flow Tester
Located at `/admin/testing` - Complete end-to-end testing

**Features:**
- Creates Tap payment session
- Simulates webhook processing
- Verifies database updates
- Validates payment logging

### 2. Webhook Tester
Test webhook scenarios independently

**Templates Available:**
- Payment Captured
- Payment Failed
- Payment Pending
- Payment Cancelled

### 3. Tap Payment Tester
Direct Tap API testing utility

**Capabilities:**
- Charge creation testing
- Payment verification
- Status checking

## Database Validation

### Tables to Check

#### 1. subscriptions
```sql
SELECT * FROM subscriptions WHERE user_id = 'user_id' ORDER BY created_at DESC;
```

#### 2. payments_log
```sql
SELECT * FROM payments_log WHERE user_id = 'user_id' ORDER BY logged_at DESC;
```

### Expected Data Flow
1. Payment creation → tap-payment function called
2. User completes payment → redirect to PaymentHandler
3. PaymentHandler → calls tap-confirm
4. Webhook received → tap-webhook processes
5. Database updated → subscription + payment log created

## Monitoring and Debugging

### Key Logs to Monitor

#### 1. Edge Function Logs
- tap-webhook processing
- tap-confirm verification
- create-tap-payment initialization

#### 2. Frontend Logs
- Payment button clicks
- Redirect handling
- Error states

#### 3. Database Activity
- Subscription insertions
- Payment log entries
- Webhook duplicate handling

### Common Issues

#### 1. Webhook Not Received
- Check webhook URL configuration
- Verify signature validation
- Monitor network connectivity

#### 2. Payment Status Mismatch
- Compare Tap API status vs database
- Check tap-confirm function logs
- Verify webhook payload structure

#### 3. Subscription Not Created
- Check webhook processing logs
- Verify user_id in metadata
- Monitor database constraints

## Security Testing

### 1. Webhook Security
- Test with invalid signatures
- Send duplicate webhooks
- Test rate limiting

### 2. Input Validation
- Test with malformed charge IDs
- Send invalid webhook payloads
- Test SQL injection attempts

### 3. Authentication
- Test without proper authentication
- Verify admin-only access to testing tools
- Check payment user validation

## Performance Testing

### Load Testing
- Multiple concurrent payments
- Webhook processing under load
- Database performance with high volume

### Response Time Monitoring
- Payment creation speed
- Webhook processing time
- Database query performance

## Troubleshooting Guide

### Payment Stuck in Pending
1. Check tap-confirm function logs
2. Verify Tap API connectivity
3. Manual status check via Tap dashboard

### Webhook Processing Failure
1. Check signature validation
2. Verify payload structure
3. Monitor rate limiting logs

### Database Inconsistency
1. Compare Tap status vs database
2. Check for webhook duplicates
3. Verify user_id mapping

## Production Deployment Checklist

- [ ] Webhook URL configured in Tap dashboard
- [ ] Production API keys set in Supabase secrets
- [ ] Database migrations applied
- [ ] Error monitoring configured
- [ ] Payment reconciliation process established
- [ ] Customer support procedures documented

## Support Contacts

### Technical Issues
- Tap Support: [Tap Developer Portal](https://developers.tap.company)
- Supabase Support: [Supabase Support](https://supabase.com/support)

### Internal Escalation
- Payment system issues → Development team
- Database problems → Database administrator
- Security concerns → Security team
