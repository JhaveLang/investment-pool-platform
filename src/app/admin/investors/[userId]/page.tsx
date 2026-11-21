import Link from "next/link";
import { notFound } from "next/navigation";
import { setInvestorPasswordAction, updateInvestorAction } from "@/actions/account";
import { DetailRow } from "@/components/account/detail-row";
import { InvestorPasswordForm } from "@/components/admin/investor-password-form";
import { InvestorProfileForm } from "@/components/admin/investor-profile-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getI18n, pageMetadata } from "@/i18n/server";
import { requireAdmin } from "@/server/auth/guards";
import { getInvestorDetail } from "@/server/queries/admin";

export const generateMetadata = pageMetadata((messages) => messages.admin.investorsTitle);

export default async function AdminInvestorDetailPage({ params }: PageProps<"/admin/investors/[userId]">) {
  await requireAdmin();
  const { userId } = await params;
  const [{ messages, format }, investor] = await Promise.all([getI18n(), getInvestorDetail(userId)]);
  if (!investor) {
    notFound();
  }
  const text = messages.admin.investorDetail;

  return (
    <>
      <Link href="/admin/investors" className="label-caps mb-3 inline-block text-accent-400 hover:underline">
        ← {text.backLink}
      </Link>
      <PageHeader
        title={investor.fullName}
        description={`${messages.columns.investorId} ${investor.investorCode} · ${investor.email}`}
      />
      <div className="grid gap-4 lg:gap-6 wide:grid-cols-[440px_minmax(0,1fr)] wide:items-start">
        <Card className="min-w-0 lg:max-w-xl wide:max-w-none">
          <CardHeader title={text.factsTitle} icon="users" />
          <CardContent>
            <dl className="divide-y divide-line">
              <DetailRow label={messages.columns.balance}>
                <span className="amount font-medium">{format.currency(investor.balanceCents)}</span>
              </DetailRow>
              <DetailRow label={messages.columns.registeredAt}>{format.date(investor.createdAt)}</DetailRow>
              <DetailRow label={messages.columns.lastLoginAt}>
                {investor.lastLoginAt ? format.dateTime(investor.lastLoginAt) : messages.common.emptyValue}
              </DetailRow>
            </dl>
          </CardContent>
        </Card>
        <div className="grid min-w-0 gap-4 lg:max-w-xl lg:gap-6 wide:max-w-none">
          <Card>
            <CardHeader title={text.profileTitle} icon="file" />
            <CardContent>
              <InvestorProfileForm
                action={updateInvestorAction.bind(null, investor.id)}
                fullName={investor.fullName}
                email={investor.email}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader title={text.passwordTitle} description={text.passwordDescription} icon="lock" />
            <CardContent>
              <InvestorPasswordForm action={setInvestorPasswordAction.bind(null, investor.id)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
