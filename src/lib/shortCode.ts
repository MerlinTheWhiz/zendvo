import { customAlphabet } from "nanoid";
import { db } from "@/lib/db";
import { gifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SHORT_CODE_LENGTH = 8;
const MAX_RETRIES = 5;

const generateRawShortCode = customAlphabet(ALPHABET, SHORT_CODE_LENGTH);

export async function generateUniqueShortCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const shortCode = generateRawShortCode();
    const existing = await db.query.gifts.findFirst({
      where: eq(gifts.shortCode, shortCode),
      columns: { id: true },
    });
    if (!existing) return shortCode;
  }
  throw new Error("Failed to generate unique short code after maximum retries");
}
