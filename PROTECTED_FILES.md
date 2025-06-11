
# AI-Protected Critical Files

## Overview
The following files are marked as AI-protected due to their critical role in payment processing and security. These files should not be modified without careful review and testing.

## Protected Payment System Files

### Edge Functions (DO NOT MODIFY)
- `supabase/functions/tap-webhook/index.ts` - Webhook handler for Tap payments
- `supabase/functions/tap-confirm/index.ts` - Payment status confirmation
- `supabase/functions/create-tap-payment/index.ts` - Payment session creation

### Payment Handlers (CRITICAL)
- `src/pages/PaymentHandler.tsx` - Payment result processing
- `src/components/payment/TapPaymentButton.tsx` - Payment initiation
- `src/components/payment/SimplePaymentSelection.tsx` - Payment interface

### Database Migrations (NEVER MODIFY)
- All files in `supabase/migrations/` - Database schema changes
- Database functions related to payments and subscriptions

### Security Components (HIGH RISK)
- `src/utils/security.ts` - Core security utilities
- `src/utils/security/threatDetection.ts` - Security monitoring
- `src/utils/sanitization/inputSanitizer.ts` - Input sanitization
- `src/utils/rateLimiting/rateLimiterFactory.ts` - Rate limiting

### Configuration Files (HANDLE WITH CARE)
- `supabase/config.toml` - Supabase configuration
- Database RLS policies and functions

## Why These Files Are Protected

### Payment Processing Chain
The payment system follows a critical chain:
1. User clicks payment button → TapPaymentButton
2. Creates payment session → create-tap-payment function
3. User completes payment → Tap redirects to PaymentHandler
4. System verifies payment → tap-confirm function
5. Webhook processes result → tap-webhook function
6. Database updates → subscription and payment log tables

**Breaking any link in this chain can cause:**
- Payment failures without refunds
- Lost revenue
- Data inconsistencies
- Security vulnerabilities

### Security Implications
These components handle:
- Sensitive payment data
- User authentication
- API secrets and keys
- Database transactions
- External API communications

**Modification risks:**
- Data breaches
- Payment fraud
- Service disruption
- Compliance violations

### Database Integrity
Migration files ensure:
- Consistent database schema
- Proper relationships
- Data integrity constraints
- Security policies

**Modification risks:**
- Data corruption
- System failures
- Irreversible data loss
- Security policy violations

## Modification Guidelines

### Before Making Changes
1. **Full system backup** - Database and code
2. **Test environment setup** - Isolated testing
3. **Security review** - Code security analysis
4. **Payment flow testing** - End-to-end validation

### Required Approvals
- **Senior Developer** - Technical review
- **Security Team** - Security assessment
- **Product Owner** - Business impact review
- **DevOps** - Infrastructure impact

### Testing Requirements
1. **Unit tests** - Component-level testing
2. **Integration tests** - Payment flow testing
3. **Security tests** - Vulnerability scanning
4. **Load tests** - Performance validation
5. **Rollback tests** - Recovery procedures

### Deployment Process
1. **Staging deployment** - Full testing environment
2. **Payment testing** - Real sandbox transactions
3. **Monitoring setup** - Enhanced logging
4. **Gradual rollout** - Phased deployment
5. **Rollback plan** - Quick recovery procedure

## Emergency Procedures

### Payment System Failure
1. **Immediate**: Disable payment processing
2. **Within 15 minutes**: Identify root cause
3. **Within 30 minutes**: Implement hotfix or rollback
4. **Within 1 hour**: Full system restoration

### Security Incident
1. **Immediate**: Isolate affected components
2. **Within 5 minutes**: Stop payment processing
3. **Within 15 minutes**: Security assessment
4. **Within 1 hour**: Incident response plan

### Database Issues
1. **Immediate**: Stop write operations
2. **Within 10 minutes**: Backup current state
3. **Within 30 minutes**: Restore from backup
4. **Within 2 hours**: Full data integrity check

## Monitoring and Alerts

### Critical Metrics
- Payment success rate (>99%)
- Webhook processing time (<5 seconds)
- Database response time (<1 second)
- Error rate (<0.1%)

### Alert Conditions
- Any payment processing failure
- Webhook processing delays
- Database connection issues
- Security policy violations
- Unusual payment patterns

### Response Teams
- **Level 1**: Development team (15 minutes)
- **Level 2**: Senior engineering (30 minutes)
- **Level 3**: Emergency response (1 hour)

## Documentation Requirements

### Change Documentation
- **What**: Detailed change description
- **Why**: Business justification
- **How**: Technical implementation
- **Risk**: Impact assessment
- **Test**: Validation procedures

### Approval Trail
- Technical review approval
- Security assessment approval
- Business impact approval
- Deployment approval

### Post-Change Review
- Performance impact analysis
- Security posture assessment
- Business metrics review
- Lessons learned documentation

## Contact Information

### Emergency Contacts
- **Technical Lead**: [Contact information]
- **Security Team**: [Contact information]
- **DevOps**: [Contact information]
- **Product Owner**: [Contact information]

### External Support
- **Tap Support**: developers.tap.company
- **Supabase Support**: supabase.com/support
- **Database Admin**: [Contact information]

---

**REMEMBER**: These files are the backbone of the payment system. Any modification requires extreme caution, thorough testing, and proper approvals. When in doubt, consult the technical lead before making any changes.
