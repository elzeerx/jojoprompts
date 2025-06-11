
# Webhook Monitoring and Failure Detection

## Overview
This document outlines monitoring strategies for webhook failures and payment issues in the Tap payment system.

## Webhook Failure Detection

### 1. Response Code Monitoring
Monitor these HTTP response codes from webhook endpoints:

#### Success Indicators
- **200 OK** - Webhook processed successfully
- **202 Accepted** - Webhook received and queued

#### Failure Indicators
- **400 Bad Request** - Invalid webhook payload
- **401 Unauthorized** - Invalid signature
- **429 Too Many Requests** - Rate limit exceeded
- **500 Internal Server Error** - Processing failure

### 2. Database Monitoring

#### Missing Subscriptions
```sql
-- Find payments without corresponding subscriptions
SELECT pl.* FROM payments_log pl
LEFT JOIN subscriptions s ON s.tap_charge = pl.tap_charge
WHERE s.tap_charge IS NULL 
AND pl.status = 'CAPTURED'
AND pl.logged_at > NOW() - INTERVAL '1 hour';
```

#### Webhook Processing Delays
```sql
-- Find delayed webhook processing
SELECT 
  tap_charge,
  status,
  logged_at,
  NOW() - logged_at as delay
FROM payments_log 
WHERE status = 'CAPTURED'
AND NOW() - logged_at > INTERVAL '5 minutes'
ORDER BY logged_at DESC;
```

### 3. Payment Status Inconsistencies

#### Status Mismatch Detection
```sql
-- Compare payment log status with subscription status
SELECT 
  pl.tap_charge,
  pl.status as log_status,
  s.status as subscription_status,
  pl.logged_at
FROM payments_log pl
JOIN subscriptions s ON s.tap_charge = pl.tap_charge
WHERE pl.status != CASE 
  WHEN s.status = 'active' THEN 'CAPTURED'
  ELSE 'FAILED'
END;
```

## Automated Monitoring Setup

### 1. Webhook Health Check Function

```typescript
// supabase/functions/webhook-health-check/index.ts
// This function would monitor webhook processing health
```

### 2. Alert Triggers

#### Database Triggers for Monitoring
```sql
-- Alert on failed webhooks
CREATE OR REPLACE FUNCTION notify_webhook_failure()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'FAILED' THEN
    -- Send notification to monitoring system
    PERFORM pg_notify('webhook_failure', 
      json_build_object(
        'charge_id', NEW.tap_charge,
        'user_id', NEW.user_id,
        'timestamp', NEW.logged_at
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER webhook_failure_alert
  AFTER INSERT ON payments_log
  FOR EACH ROW
  EXECUTE FUNCTION notify_webhook_failure();
```

### 3. Monitoring Dashboards

#### Key Metrics to Track
- Webhook success rate (last 24h)
- Average webhook processing time
- Failed payment count
- Subscription creation rate
- Database consistency score

#### Sample Monitoring Queries

**Webhook Success Rate**
```sql
SELECT 
  DATE_TRUNC('hour', logged_at) as hour,
  COUNT(*) as total_webhooks,
  COUNT(CASE WHEN status = 'CAPTURED' THEN 1 END) as successful_webhooks,
  ROUND(
    COUNT(CASE WHEN status = 'CAPTURED' THEN 1 END) * 100.0 / COUNT(*), 2
  ) as success_rate
FROM payments_log 
WHERE logged_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', logged_at)
ORDER BY hour DESC;
```

**Payment Processing Times**
```sql
SELECT 
  tap_charge,
  logged_at,
  LAG(logged_at) OVER (ORDER BY logged_at) as prev_logged_at,
  logged_at - LAG(logged_at) OVER (ORDER BY logged_at) as processing_time
FROM payments_log 
WHERE logged_at > NOW() - INTERVAL '1 hour'
ORDER BY logged_at DESC;
```

## Failure Recovery Procedures

### 1. Webhook Retry Mechanism

#### Manual Webhook Replay
```typescript
// Function to replay failed webhooks
const replayWebhook = async (chargeId: string) => {
  // Fetch charge details from Tap
  // Reconstruct webhook payload
  // Reprocess through webhook handler
};
```

### 2. Database Reconciliation

#### Missing Subscription Recovery
```sql
-- Create missing subscriptions for successful payments
INSERT INTO subscriptions (user_id, status, current_period_end, tap_charge)
SELECT 
  pl.user_id,
  'active' as status,
  NOW() + INTERVAL '30 days' as current_period_end,
  pl.tap_charge
FROM payments_log pl
LEFT JOIN subscriptions s ON s.tap_charge = pl.tap_charge
WHERE s.tap_charge IS NULL 
AND pl.status = 'CAPTURED'
AND pl.logged_at > NOW() - INTERVAL '24 hours';
```

### 3. Payment Status Correction

#### Sync with Tap API
```typescript
// Function to sync payment status with Tap
const syncPaymentStatus = async (chargeId: string) => {
  const tapStatus = await fetchTapChargeStatus(chargeId);
  await updateDatabaseStatus(chargeId, tapStatus);
};
```

## Alerting Configuration

### 1. Critical Alerts (Immediate Response)
- Webhook processing down (no webhooks in 5 minutes)
- High failure rate (>5% in 10 minutes)
- Database connection issues
- Security signature failures

### 2. Warning Alerts (Response within 1 hour)
- Slow webhook processing (>30 seconds)
- Unusual payment patterns
- Rate limiting triggered
- Payment status inconsistencies

### 3. Informational Alerts (Daily review)
- Daily payment summary
- Webhook performance metrics
- Database health report
- Security event summary

## Integration with External Monitoring

### 1. Application Performance Monitoring (APM)
- Track webhook endpoint response times
- Monitor database query performance
- Alert on error rates

### 2. Log Aggregation
- Centralize logs from all payment components
- Set up log-based alerts
- Create searchable payment audit trail

### 3. Uptime Monitoring
- Monitor webhook endpoint availability
- Check Tap API connectivity
- Validate database accessibility

## Response Procedures

### 1. Webhook Failure Response
1. **Immediate**: Check system status and connectivity
2. **Within 5 minutes**: Identify root cause
3. **Within 15 minutes**: Implement temporary fix if needed
4. **Within 1 hour**: Permanent resolution and recovery

### 2. Payment Reconciliation
1. **Daily**: Automated reconciliation check
2. **Weekly**: Manual audit of payment records
3. **Monthly**: Full system health review

### 3. Escalation Procedures
- **Level 1**: Development team (response time: 15 minutes)
- **Level 2**: Senior engineering (response time: 30 minutes)
- **Level 3**: Technical lead (response time: 1 hour)

## Metrics and KPIs

### 1. Operational Metrics
- Webhook success rate: >99.5%
- Average processing time: <5 seconds
- Error rate: <0.1%
- Database consistency: >99.9%

### 2. Business Metrics
- Payment conversion rate
- Failed payment recovery rate
- Customer satisfaction score
- Revenue impact of failures

### 3. Security Metrics
- Invalid signature attempts
- Rate limiting triggers
- Suspicious activity patterns
- Security incident response time
