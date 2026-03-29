/**
 * Session fingerprinting — binds a session to the environment where it was created.
 * A fingerprint is a SHA-256 hash of the User-Agent and IP address.
 * If the User-Agent is absent (e.g. non-browser clients), the IP alone is hashed.
 */

export async function computeFingerprint(
  userAgent: string | null,
  ip: string,
): Promise<string> {
  const input = userAgent ? `${userAgent}|${ip}` : ip;
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
