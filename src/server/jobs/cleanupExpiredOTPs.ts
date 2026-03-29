import { cleanupExpiredOTPs } from "../services/otpService";

export async function cleanupExpiredOTPRecords(): Promise<number> {
  try {
    const deletedCount = await cleanupExpiredOTPs();

    console.log(
      `[CLEANUP_JOB] Deleted ${deletedCount} expired OTP records.`,
    );
    return deletedCount;
  } catch (error) {
    console.error("[CLEANUP_JOB_ERROR]", error);
    throw error;
  }
}

if (require.main === module) {
  cleanupExpiredOTPRecords()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}