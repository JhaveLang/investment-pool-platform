import Link from "next/link";
import { createPromoAction } from "@/actions/promos";
import { PromoForm } from "@/components/admin/promo-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getI18n, pageMetadata } from "@/i18n/server";
import { todayIsoDate } from "@/lib/calendar";
import { requireAdmin } from "@/server/auth/guards";

export const generateMetadata = pageMetadata((messages) => messages.admin.promos.newTitle);

export default async function AdminNewPromoPage() {
  await requireAdmin();
  const { messages } = await getI18n();
  const text = messages.admin.promos;
  return <>
    <Link href="/admin/promos" className="label-caps mb-3 inline-block text-accent-400 hover:underline">← {text.back}</Link>
    <PageHeader title={text.newTitle} description={text.subtitle} />
    <Card className="min-w-0 lg:max-w-2xl"><CardHeader title={text.formTitle} icon="percent" /><CardContent>
      <PromoForm action={createPromoAction} initial={{ name: "", bookingUntil: todayIsoDate(), minDepositCents: 100_000, maxDepositCents: 2_500_000, termMonths: 5, totalReturnBps: 3_100, details: "", isExample: false, visible: true }} submitLabel={text.create} />
    </CardContent></Card>
  </>;
}
