import Link from "next/link";
import { notFound } from "next/navigation";
import { updatePromoAction } from "@/actions/promos";
import { PromoForm } from "@/components/admin/promo-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getI18n, pageMetadata } from "@/i18n/server";
import { requireAdmin } from "@/server/auth/guards";
import { getPromoOffer } from "@/server/queries/promos";

export const generateMetadata = pageMetadata((messages) => messages.admin.promos.editTitle);

export default async function AdminEditPromoPage({ params }: PageProps<"/admin/promos/[promoId]/edit">) {
  await requireAdmin();
  const [{ messages }, { promoId }] = await Promise.all([getI18n(), params]);
  const offer = await getPromoOffer(promoId);
  if (!offer) notFound();
  const text = messages.admin.promos;
  return <>
    <Link href="/admin/promos" className="label-caps mb-3 inline-block text-accent-400 hover:underline">← {text.back}</Link>
    <PageHeader title={text.editTitle} description={offer.name} />
    <Card className="min-w-0 lg:max-w-2xl"><CardHeader title={text.formTitle} icon="percent" /><CardContent>
      <PromoForm action={updatePromoAction.bind(null, offer.id)} initial={offer} submitLabel={text.save} />
    </CardContent></Card>
  </>;
}
