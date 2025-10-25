# JojoPrompts - Comprehensive Testing Checklist

**Version:** 1.0  
**Last Updated:** 2025-10-25

---

## Quick Start Testing

### Essential 5-Minute Test
Run these critical tests before any deployment:

- [ ] New user signup works
- [ ] Login with existing user works
- [ ] Payment checkout completes
- [ ] No console errors on main pages
- [ ] Mobile view renders correctly

---

## Phase 1: Signup Testing

### Basic Signup (/signup)

#### Valid Inputs
- [ ] Valid email + password creates account
- [ ] First name and last name saved correctly
- [ ] Username auto-generated if not provided
- [ ] User redirected to /prompts after signup
- [ ] Success toast displayed
- [ ] Profile created in database
- [ ] Role created in user_roles table

#### Email Validation
- [ ] Invalid email format rejected (no @, no domain)
- [ ] Duplicate email shows "already registered"
- [ ] Disposable email domains blocked (tempmail.com, etc.)
- [ ] Case-insensitive email checking works
- [ ] Email stored in lowercase

#### Username Validation
- [ ] Username 3-20 characters enforced
- [ ] Only alphanumeric, underscore, dash allowed
- [ ] Reserved usernames blocked:
  - [ ] "admin" rejected
  - [ ] "administrator" rejected
  - [ ] "superadmin" rejected
  - [ ] "root" rejected
  - [ ] "system" rejected
  - [ ] "jojo" rejected
  - [ ] "moderator" rejected
- [ ] Reserved prefixes blocked:
  - [ ] "admin123" rejected
  - [ ] "mod_user" rejected
  - [ ] "system_test" rejected
- [ ] Duplicate username shows "already taken"
- [ ] Case-insensitive username checking

#### Password Validation
- [ ] Minimum length enforced (8+ chars)
- [ ] Password confirmation required
- [ ] Passwords must match
- [ ] Password hidden by default
- [ ] Show/hide password toggle works

#### First User Admin
- [ ] First user gets admin role
- [ ] First user gets is_super_admin = true
- [ ] Second user gets user role
- [ ] Second user gets is_super_admin = false

---

## Phase 2: Error Handling Testing

### Retry Logic

#### Network Errors (Should Retry)
- [ ] Disconnect network, attempt signup
  - [ ] Shows retry attempt count
  - [ ] Retries 2 times for validation
  - [ ] Shows network error after all retries
- [ ] Restore network mid-retry
  - [ ] Succeeds on retry
  - [ ] No duplicate accounts created

#### Validation Errors (Should NOT Retry)
- [ ] Duplicate email fails immediately
- [ ] Invalid username fails immediately
- [ ] Reserved username fails immediately
- [ ] No retry attempts shown

#### Service Errors (Should Retry Once)
- [ ] Edge function 503 error retries once
- [ ] Shows "Service temporarily unavailable" message
- [ ] Success on second attempt proceeds normally

### Error Messages

#### User-Friendly Messages
- [ ] Email taken: "An account with this email already exists. Try logging in instead."
- [ ] Username taken: "This username is already in use. Please choose another one."
- [ ] Reserved username: "This username is reserved. Please choose a different one."
- [ ] Invalid email: "Please enter a valid email address."
- [ ] Network error: "Could not connect to the server. Please check your internet connection and try again."
- [ ] Service error: "Our servers are experiencing high load. Please try again in a moment."

#### Error Codes in Logs
- [ ] EMAIL_TAKEN logged for duplicate email
- [ ] USERNAME_RESERVED logged for admin usernames
- [ ] NETWORK_ERROR logged for connection issues
- [ ] RATE_LIMITED logged for too many attempts

### Rate Limiting
- [ ] 3 signup attempts allowed per hour per IP
- [ ] 4th attempt shows rate limit error
- [ ] Error message shows wait time
- [ ] After 1 hour, attempts reset

---

## Phase 3: Checkout & Payment Testing

### Checkout Flow (/checkout?plan_id=xxx)

#### Anonymous User
- [ ] Plan details displayed correctly
- [ ] Discount code field present
- [ ] Signup form displayed
- [ ] PayPal button hidden until authenticated

#### Valid Discount Code
- [ ] Enter discount code "DIS"
- [ ] Price updates immediately
- [ ] Discount amount shown
- [ ] Discount persists through signup
- [ ] Discount applied to PayPal payment

#### Payment Processing
- [ ] PayPal button appears for authenticated user
- [ ] Click PayPal button opens popup
- [ ] Order created in database (status: pending)
- [ ] PayPal approval page loads
- [ ] Approve payment in PayPal
- [ ] Redirected to callback page
- [ ] Payment captured successfully
- [ ] Transaction updated (status: completed)
- [ ] Subscription created (status: active)
- [ ] Redirected to /payment-success
- [ ] Success page shows transaction details

#### Payment Failure Scenarios
- [ ] Cancel payment in PayPal
  - [ ] Redirected to /payment-failed
  - [ ] Transaction status: cancelled
  - [ ] No subscription created
- [ ] Insufficient funds
  - [ ] Redirected to /payment-failed
  - [ ] Error message displayed
  - [ ] Transaction status: failed
- [ ] Network error during capture
  - [ ] Retry logic kicks in
  - [ ] Success on retry OR error shown

---

## Phase 4: Authentication Testing

### Login (/login)

#### Successful Login
- [ ] Valid email + password logs in
- [ ] User redirected to /prompts
- [ ] Session persists on page refresh
- [ ] User data loaded correctly

#### Failed Login
- [ ] Wrong password shows error
- [ ] Non-existent email shows error
- [ ] Too many failed attempts triggers rate limit
- [ ] Error messages are user-friendly

### Session Management
- [ ] Session persists across page refresh
- [ ] Logout clears session
- [ ] Protected routes redirect to login
- [ ] Logged-in users can't access /login or /signup

### Google OAuth
- [ ] Google signup button works
- [ ] Google account creates profile
- [ ] Google login for existing account works
- [ ] Profile data synced from Google

---

## Phase 5: Database Integrity Testing

### SQL Verification Queries

#### User Creation
```sql
-- Run after each signup test
SELECT 
  p.id,
  p.email,
  p.username,
  p.first_name,
  p.last_name,
  ur.role,
  ur.is_super_admin,
  p.created_at
FROM profiles p
LEFT JOIN user_roles ur ON p.id = ur.user_id
ORDER BY p.created_at DESC
LIMIT 5;
```

**Expected:**
- [ ] Profile record exists
- [ ] Email matches input
- [ ] Username present (generated or provided)
- [ ] Role assigned correctly
- [ ] First user has is_super_admin = true
- [ ] created_at timestamp present

#### Transaction & Subscription
```sql
-- Run after each payment test
SELECT 
  t.id,
  t.user_id,
  t.plan_id,
  t.status,
  t.amount,
  t.paypal_order_id,
  s.status as subscription_status,
  s.start_date,
  s.end_date
FROM transactions t
LEFT JOIN subscriptions s ON t.user_id = s.user_id
WHERE t.created_at > NOW() - INTERVAL '10 minutes'
ORDER BY t.created_at DESC;
```

**Expected:**
- [ ] Transaction exists with correct status
- [ ] PayPal order ID present
- [ ] Amount matches plan price (with discount if applied)
- [ ] Subscription created for completed payments
- [ ] Subscription end_date calculated correctly

#### Audit Logs
```sql
-- Check signup audit log
SELECT *
FROM signup_audit_log
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

**Expected:**
- [ ] All signup attempts logged
- [ ] Success = true for successful signups
- [ ] Error messages populated for failures
- [ ] IP addresses logged

---

## Phase 6: Mobile Testing

### iOS Safari

#### iPhone 12/13/14 (Portrait)
- [ ] Signup form renders correctly
- [ ] All inputs accessible
- [ ] Keyboard doesn't overlap inputs
- [ ] Touch targets minimum 44px
- [ ] Submit button accessible
- [ ] Error messages visible
- [ ] Success toast appears correctly
- [ ] PayPal popup works

#### iPhone (Landscape)
- [ ] Layout adapts correctly
- [ ] Form remains usable
- [ ] No horizontal scrolling

#### iPad Air/Pro
- [ ] Tablet layout renders
- [ ] Touch interactions work
- [ ] Form properly sized

### Android Chrome

#### Samsung Galaxy S21/S22 (Portrait)
- [ ] Signup form renders correctly
- [ ] Virtual keyboard behaves properly
- [ ] Touch targets adequate
- [ ] PayPal flow works
- [ ] Back button navigation works

#### Android Tablet
- [ ] Responsive layout works
- [ ] Touch gestures work
- [ ] Forms properly sized

### Mobile-Specific Tests

#### Keyboard Behavior
- [ ] Keyboard opens on input focus
- [ ] Keyboard type correct (email, text, password)
- [ ] "Next" button moves between fields
- [ ] "Done" button submits form
- [ ] Keyboard closes on submit

#### Touch Interactions
- [ ] Buttons respond to touch
- [ ] No accidental double-taps
- [ ] Swipe gestures don't interfere
- [ ] Pinch-to-zoom disabled on forms

#### Performance
- [ ] Page loads in <3 seconds on 4G
- [ ] No layout shift during load
- [ ] Smooth scrolling
- [ ] No jank or stuttering

---

## Phase 7: Edge Cases & Security

### Edge Cases

#### Concurrent Signups
- [ ] Two users signup with same email simultaneously
  - [ ] Only one succeeds
  - [ ] Second shows "already registered"

#### Partial Completion
- [ ] User closes browser mid-signup
  - [ ] No orphaned records in database
- [ ] Network fails during payment capture
  - [ ] Transaction marked appropriately
  - [ ] No duplicate charges

#### Session Expiry
- [ ] Session expires during checkout
  - [ ] User prompted to login
  - [ ] Checkout state preserved

### Security Testing

#### SQL Injection
- [ ] Username: `admin'; DROP TABLE users; --`
  - [ ] Treated as normal username, sanitized
  - [ ] No database error
- [ ] Email: `test@test.com' OR '1'='1`
  - [ ] Treated as invalid email

#### XSS Attempts
- [ ] First name: `<script>alert('xss')</script>`
  - [ ] Escaped in UI
  - [ ] No script execution
- [ ] Username: `<img src=x onerror=alert(1)>`
  - [ ] Rejected by validation

#### CSRF Protection
- [ ] Supabase auth tokens required
- [ ] No authentication bypass possible

#### RLS Verification
- [ ] User A cannot view User B's profile
- [ ] User A cannot view User B's transactions
- [ ] Admin can view all profiles
- [ ] Admin can view all transactions

---

## Phase 8: Performance & Monitoring

### Performance Metrics

#### Page Load Times
- [ ] Homepage: <2s
- [ ] Signup page: <2s
- [ ] Checkout page: <3s
- [ ] Payment success: <1s

#### API Response Times
- [ ] validate-signup: <500ms
- [ ] auth.signUp(): <2s
- [ ] send-welcome-email: <2s (non-blocking)
- [ ] process-paypal-payment (create): <1s
- [ ] process-paypal-payment (capture): <3s

#### Success Rates
- [ ] Signup completion: >95%
- [ ] Payment completion: >98%
- [ ] Email delivery: >99%
- [ ] First-attempt success: >90%

### Monitoring

#### Console Logs
- [ ] No errors in console on happy path
- [ ] Warnings logged for non-critical failures
- [ ] Debug logs available in development

#### Edge Function Logs
- [ ] validate-signup logs visible
- [ ] send-welcome-email logs visible
- [ ] process-paypal-payment logs visible
- [ ] Error context logged properly

---

## Phase 9: Documentation Verification

### User Documentation
- [ ] Signup instructions clear
- [ ] Payment flow documented
- [ ] FAQ covers common issues
- [ ] Error messages documented

### Developer Documentation
- [ ] Architecture diagrams accurate
- [ ] API endpoints documented
- [ ] Database schema documented
- [ ] Deployment guide complete

---

## Test Environment Setup

### Prerequisites
- [ ] Supabase project configured
- [ ] PayPal sandbox account
- [ ] Resend API key for emails
- [ ] Test user accounts created
- [ ] Test payment methods added

### Test Data
- [ ] Test plan created (id: xxx)
- [ ] Test discount code created (code: DIS)
- [ ] Admin user account (first user)
- [ ] Regular user accounts (2-3)

---

## Bug Reporting Template

When a test fails, document using this template:

```markdown
### Bug Report

**Test Case:** [Name of failed test]
**Date:** [Date]
**Tester:** [Your name]
**Environment:** [Production/Staging/Local]

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happened]

**Screenshots:**
[Attach if applicable]

**Console Errors:**
[Copy any error messages]

**Database State:**
[Run relevant SQL query and paste results]

**Priority:** [Critical/High/Medium/Low]
```

---

## Sign-Off Checklist

Before marking testing complete:

- [ ] All critical tests passing
- [ ] All high-priority tests passing
- [ ] Mobile tests completed
- [ ] Security tests passed
- [ ] Performance within targets
- [ ] Documentation reviewed
- [ ] Bug reports filed for failures
- [ ] Test results documented

---

**Tested By:** _______________  
**Date:** _______________  
**Sign-Off:** _______________
