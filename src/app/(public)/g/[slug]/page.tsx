import { db } from "@/lib/db";
import { gifts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import PublicGiftClaimView from "@/components/gift/PublicGiftClaimView";

export default async function ShortLinkGiftPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const gift = await db.query.gifts.findFirst({
    where: eq(gifts.shortCode, slug),
    columns: { id: true },
  });

  if (!gift) {
    notFound();
  }

  return <PublicGiftClaimView giftId={gift.id} />;
}
