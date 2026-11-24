import Link from "next/link";
import { notFound } from "next/navigation";
import { setInvestorPasswordAction, setInvestorStatusAction, updateInvestorAction } from "@/actions/account";
import { DetailRow } from "@/components/account/detail-row";
import { InvestorPasswordForm } from "@/components/admin/investor-password-form";
import { InvestorProfileForm } from "@/components/admin/investor-profile-form";
import { InvestorStatusForm } from "@/components/admin/investor-status-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getI18n, pageMetadata } from "@/i18n/server";
import { requireAdmin } from "@/server/auth/guards";
import { getInvestorDetail } from "@/server/queries/admin";

export const generateMetadata = pageMetadata((messages) => messages.admin.investorsTitle);

/** Edit an investor: investor ID, name and email, a new password, deactivate / activate. */
export default async function AdminInvestorEditPage({ params }: PageProps<"/admin/investors/[userId]/edit">) {
  await requireAdmin();
  const { userId } = await params;
  const [{ messages, format }, investor] = await Promise.all([getI18n(), getInvestorDetail(userId)]);
  if (!investor) {
    notFound();
  }
  const text = messages.admin.investorDetail;
  const deactivatedOn = investor.deactivatedAt ? format.date(investor.deactivatedAt) : null;
  // Deactivating leaves balance and open requests in place; say so when there are any.
  const moneyNotes = [
    investor.balanceCents > 0 ? text.balanceRemains(format.currency(investor.balanceCents)) : null,
    investor.openRequestCount > 0 ? text.openRequestsRemain(investor.openRequestCount) : null,
  ].filter((note) => note !== null);

  return (
    <>
      <Link
        href={`/admin/investors/${investor.id}`}
        className="label-caps mb-3 inline-block text-accent-400 hover:underline"
      >
        ← {text.backToInvestor}
      </Link>
      <PageHeader
        title={text.editTitle(investor.fullName)}
        description={`${messages.columns.investorId} ${investor.investorCode} · ${investor.email}`}
        actions={deactivatedOn === null ? null : <Badge>{messages.investorStatus.deactivated}</Badge>}
      />
      <div className="grid gap-4 lg:gap-6 wide:grid-cols-[440px_minmax(0,1fr)] wide:items-start">
        <Card className="min-w-0 lg:max-w-xl wide:max-w-none">
          <CardHeader title={text.factsTitle} icon="users" />
          <CardContent>
            <dl className="divide-y divide-line">
              <DetailRow label={messages.columns.status}>
                {deactivatedOn === null ? messages.investorStatus.active : text.deactivatedOn(deactivatedOn)}
              </DetailRow>
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
                investorCode={investor.investorCode}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader title={text.passwordTitle} description={text.passwordDescription} icon="lock" />
            <CardContent>
              <InvestorPasswordForm action={setInvestorPasswordAction.bind(null, investor.id)} />
            </CardContent>
          </Card>
          <Card>
            {deactivatedOn === null ? (
              <CardHeader title={text.deactivateTitle} description={text.deactivateDescription} icon="lock" />
            ) : (
              <CardHeader
                title={text.activateTitle}
                description={text.activateDescription(deactivatedOn)}
                icon="unlock"
              />
            )}
            <CardContent className="space-y-4">
              {deactivatedOn === null && moneyNotes.length > 0 ? (
                <Alert tone="info">{moneyNotes.join(" ")}</Alert>
              ) : null}
              <InvestorStatusForm
                action={setInvestorStatusAction.bind(null, investor.id)}
                active={deactivatedOn === null}
                investorName={investor.fullName}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
