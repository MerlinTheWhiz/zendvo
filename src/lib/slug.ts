import { customAlphabet } from "nanoid";
import { db } from "@/lib/db";
import { gifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SLUG_LENGTH = 6;
const MAX_RETRIES = 5;

const generateRawSlug = customAlphabet(ALPHABET, SLUG_LENGTH);

export async function generateUniqueSlug(): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const slug = generateRawSlug();
    const existing = await db.query.gifts.findFirst({
      where: eq(gifts.slug, slug),
      columns: { id: true },
    });
    if (!existing) return slug;
  }
  throw new Error("Failed to generate unique slug after maximum retries");
}
