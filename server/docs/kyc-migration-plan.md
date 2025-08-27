# KYC Migration Plan: Legacy to Sumsub

## Overview
This document outlines the migration strategy from the legacy KYC system to Sumsub integration.

## Migration Strategy

### Phase 1: Gradual Migration (Recommended)
- **New Users**: All new KYC verifications use Sumsub
- **Existing Users**: Keep legacy KYC data intact
- **Dual Support**: Both systems run in parallel

### Phase 2: Full Migration (Optional)
- Migrate legacy approved/rejected statuses
- Archive legacy documents
- Full Sumsub adoption

## Current Data Structure

### Legacy KYC Fields
```typescript
{
  kycStatus: 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED',
  kycDocuments: [{
    documentType: string,
    filePath: string,
    submittedAt: Date
  }],
  kycRejectionReason?: string
}
```

### New Sumsub Fields
```typescript
{
  kycProvider: 'LEGACY' | 'SUMSUB',
  sumsubData?: {
    applicantId?: string,
    inspectionId?: string,
    externalUserId: string,
    levelName?: string,
    reviewStatus?: string,
    reviewResult?: string,
    createdAt?: Date,
    updatedAt?: Date,
    webhookData?: any
  }
}
```

## Migration Steps

### Step 1: Database Schema Update ✅
- [x] Added `kycProvider` field (default: 'SUMSUB')
- [x] Added `sumsubData` schema
- [x] Maintained backward compatibility

### Step 2: API Integration ✅
- [x] Created Sumsub service
- [x] Created Sumsub controllers
- [x] Added Sumsub routes
- [x] Configured webhook handling

### Step 3: Frontend Integration ✅
- [x] Created SumsubKycModal component
- [x] Updated KycModal to use Sumsub
- [x] Added Sumsub SDK integration

### Step 4: CRM Integration ✅
- [x] Updated KYC page for dual provider support
- [x] Added Sumsub status sync functionality
- [x] Added provider differentiation

### Step 5: Data Migration Script
```javascript
// Migration script to mark existing users as legacy
const migrateExistingKycData = async () => {
  await User.updateMany(
    { kycProvider: { $exists: false } },
    { $set: { kycProvider: 'LEGACY' } }
  );
};
```

### Step 6: Configuration Update
- [x] Environment variables configured
- [x] Sumsub credentials added
- [x] Webhook endpoints configured

## Migration Commands

### Mark Existing Data as Legacy
```bash
# MongoDB command to update existing records
db.users.updateMany(
  { kycProvider: { $exists: false } },
  { $set: { kycProvider: "LEGACY" } }
)
```

### Verify Migration
```bash
# Check provider distribution
db.users.aggregate([
  { $group: { _id: "$kycProvider", count: { $sum: 1 } } }
])

# Check KYC status distribution
db.users.aggregate([
  { $group: { _id: { provider: "$kycProvider", status: "$kycStatus" }, count: { $sum: 1 } } }
])
```

## Testing Checklist

### Functional Testing
- [ ] New user KYC flow with Sumsub
- [ ] Legacy KYC data display in CRM
- [ ] Webhook processing
- [ ] Status synchronization
- [ ] Error handling

### Integration Testing
- [ ] API endpoints response
- [ ] Database updates
- [ ] WebSocket notifications
- [ ] Email notifications

### Security Testing
- [ ] Webhook signature verification
- [ ] API authentication
- [ ] Data encryption
- [ ] Access controls

## Rollback Plan

### If Issues Occur
1. **Immediate**: Switch KycModal back to legacy system
2. **Database**: No rollback needed (backward compatible)
3. **API**: Disable Sumsub routes temporarily
4. **Frontend**: Revert component changes

### Rollback Commands
```bash
# Revert frontend component
git checkout HEAD~1 -- client/src/components/modals/KycModal.tsx

# Disable Sumsub routes (comment out in app.ts)
# app.use('/api/sumsub', sumsubRoutes);
```

## Post-Migration Tasks

### Monitoring
- Track KYC completion rates
- Monitor webhook delivery
- Check error rates
- Verify status accuracy

### Optimization
- Review performance metrics
- Optimize database queries
- Update documentation
- Train support team

### Cleanup (After 6 months)
- Archive legacy KYC documents
- Remove unused legacy code
- Optimize database schema
- Update API documentation

## Support Procedures

### Legacy KYC Users
- CRM shows "LEGACY" provider badge
- Manual review still available
- Documents accessible via original system
- No automatic migration required

### Sumsub KYC Users
- CRM shows "SUMSUB" provider badge
- Automatic status updates via webhook
- Manual sync available for admins
- Direct integration with Sumsub dashboard

### Troubleshooting
1. **Status Mismatch**: Use sync functionality in CRM
2. **Webhook Issues**: Check webhook logs and signature
3. **SDK Problems**: Verify token generation and expiry
4. **Provider Confusion**: Check `kycProvider` field in database

## Success Metrics

### Technical Metrics
- 99%+ webhook delivery success rate
- <2s average KYC flow completion time
- 0 critical security issues
- <1% error rate in status sync

### Business Metrics
- Improved KYC completion rate
- Reduced manual review time
- Better compliance coverage
- Enhanced user experience

## Timeline

- **Week 1**: ✅ Backend integration complete
- **Week 2**: ✅ Frontend integration complete  
- **Week 3**: ✅ CRM integration complete
- **Week 4**: 🔄 Testing and validation
- **Week 5**: Data migration and go-live
- **Week 6**: Monitoring and optimization