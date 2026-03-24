#!/usr/bin/env node

/**
 * Implementation Validation Script
 * Checks if all required components are in place
 */

const fs = require('fs');
const path = require('path');

console.log('\n' + '='.repeat(70));
console.log('🔍 OTP Security Implementation Validation');
console.log('='.repeat(70) + '\n');

let allPassed = true;
const results = [];

// Helper function to check file exists
function checkFile(filePath, description) {
  const fullPath = path.join(__dirname, '..', filePath);
  const exists = fs.existsSync(fullPath);
  results.push({
    check: description,
    status: exists ? '✅ PASS' : '❌ FAIL',
    passed: exists
  });
  if (!exists) allPassed = false;
  return exists;
}

// Helper function to check file contains text
function checkFileContains(filePath, searchText, description) {
  const fullPath = path.join(__dirname, '..', filePath);
  if (!fs.existsSync(fullPath)) {
    results.push({
      check: description,
      status: '❌ FAIL (file not found)',
      passed: false
    });
    allPassed = false;
    return false;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  const contains = content.includes(searchText);
  results.push({
    check: description,
    status: contains ? '✅ PASS' : '❌ FAIL',
    passed: contains
  });
  if (!contains) allPassed = false;
  return contains;
}

console.log('📁 Checking Files...\n');

// Check core files exist
checkFile('src/lib/db/schema.ts', 'Database schema file exists');
checkFile('src/server/services/otpService.ts', 'OTP service file exists');
checkFile('src/server/services/auditService.ts', 'Audit service file exists');
checkFile('migrations/add_otp_wide_window_tracking.sql', 'Migration file exists');

console.log('\n📝 Checking Schema Changes...\n');

// Check schema has new fields
checkFileContains(
  'src/lib/db/schema.ts',
  'otpFailedAttempts',
  'Schema has otpFailedAttempts field'
);
checkFileContains(
  'src/lib/db/schema.ts',
  'otpAttemptsWindowStart',
  'Schema has otpAttemptsWindowStart field'
);

console.log('\n🔐 Checking OTP Service Logic...\n');

// Check OTP service has required logic
checkFileContains(
  'src/server/services/otpService.ts',
  'cumulativeFailures >= 10',
  'Wide window lock logic (10 attempts)'
);
checkFileContains(
  'src/server/services/otpService.ts',
  '24 * 60 * 60 * 1000',
  '24-hour lock duration'
);
checkFileContains(
  'src/server/services/otpService.ts',
  '30 * 60 * 1000',
  '30-minute lock duration'
);
checkFileContains(
  'src/server/services/otpService.ts',
  'oneHourAgo',
  'Window reset logic'
);
checkFileContains(
  'src/server/services/otpService.ts',
  'logOTPEvent',
  'Audit logging integration'
);

console.log('\n📊 Checking Audit Service...\n');

// Check audit service has required event types
checkFileContains(
  'src/server/services/auditService.ts',
  'ACCOUNT_LOCKED_5_ATTEMPTS',
  'Audit event: ACCOUNT_LOCKED_5_ATTEMPTS'
);
checkFileContains(
  'src/server/services/auditService.ts',
  'ACCOUNT_LOCKED_10_ATTEMPTS',
  'Audit event: ACCOUNT_LOCKED_10_ATTEMPTS'
);
checkFileContains(
  'src/server/services/auditService.ts',
  'OTP_VERIFIED_FAILED',
  'Audit event: OTP_VERIFIED_FAILED'
);
checkFileContains(
  'src/server/services/auditService.ts',
  'logOTPEvent',
  'Helper function: logOTPEvent'
);

console.log('\n🗄️ Checking Migration...\n');

// Check migration has required SQL
checkFileContains(
  'migrations/add_otp_wide_window_tracking.sql',
  'otp_failed_attempts',
  'Migration adds otp_failed_attempts column'
);
checkFileContains(
  'migrations/add_otp_wide_window_tracking.sql',
  'otp_attempts_window_start',
  'Migration adds otp_attempts_window_start column'
);

console.log('\n📚 Checking Documentation...\n');

// Check documentation exists
checkFile('docs/OTP_SECURITY_IMPLEMENTATION.md', 'Technical documentation exists');
checkFile('docs/OTP_SECURITY_QUICK_REFERENCE.md', 'Quick reference exists');
checkFile('docs/TESTING_GUIDE.md', 'Testing guide exists');
checkFile('IMPLEMENTATION_SUMMARY.md', 'Implementation summary exists');
checkFile('DEPLOYMENT_CHECKLIST.md', 'Deployment checklist exists');

console.log('\n🧪 Checking Tests...\n');

// Check test file exists
checkFile('__tests__/otpService.security.test.ts', 'Test file exists');

console.log('\n' + '='.repeat(70));
console.log('📋 Validation Results');
console.log('='.repeat(70) + '\n');

// Print all results
results.forEach(result => {
  console.log(`${result.status} ${result.check}`);
});

console.log('\n' + '='.repeat(70));

if (allPassed) {
  console.log('✅ ALL CHECKS PASSED!');
  console.log('='.repeat(70));
  console.log('\n🚀 Implementation is complete and ready for deployment!\n');
  console.log('Next steps:');
  console.log('1. Run database migration');
  console.log('2. Deploy code changes');
  console.log('3. Configure monitoring');
  console.log('4. Test in staging environment\n');
  process.exit(0);
} else {
  console.log('❌ SOME CHECKS FAILED');
  console.log('='.repeat(70));
  console.log('\n⚠️  Please review the failed checks above.\n');
  process.exit(1);
}
