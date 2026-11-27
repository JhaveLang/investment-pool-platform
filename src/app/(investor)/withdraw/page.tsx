import { randomUUID } from "node:crypto";
import { MoveMoneyHeader } from "@/components/transactions/move-money-header";
import { WithdrawalHistory } from "@/components/transactions/request-history";
import { WithdrawalForm } from "@/components/transactions/withdrawal-form";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getI18n, pageMetadata } from "@/i18n/server";
import { poolNotice } from "@/lib/pool-settings";
import { requireInvestor } from "@/server/auth/guards";
import { getAccountOverview, listRecentWithdrawals } from "@/server/queries/investor";
import { getPoolSettings } from "@/server/queries/pool-settings";

export const generateMetadata = pageMetadata((messages) => messages.withdrawals.title);

export default async function WithdrawPage() {
  const user = await requireInvestor();
  const { messages, format, locale } = await getI18n();
  const text = messages.withdrawals;
  const [overview, recentWithdrawals, settings] = await Promise.all([
    getAccountOverview(user.id),
    listRecentWithdrawals(user.id),
    getPoolSettings(),
  ]);
  const notice = poolNotice(settings, locale);

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <MoveMoneyHeader active="withdraw" overview={overview} />
      <div className="grid gap-4 lg:gap-6 wide:grid-cols-[440px_minmax(0,1fr)] wide:items-start">
        <Card className="min-w-0 lg:max-w-xl wide:max-w-none">
          <CardHeader title={text.formTitle} description={text.subtitle} icon="arrowUpRight" />
          <CardContent className="flex flex-col gap-4">
            {notice ? <Alert tone="info">{notice}</Alert> : null}
            {overview.lockedCents > 0 && overview.nextUnlockOn ? (
              <Alert tone="info">
                {text.locked(format.currency(overview.lockedCents), format.calendarDate(overview.nextUnlockOn))}
              </Alert>
            ) : null}
            <WithdrawalForm
              idempotencyKey={randomUUID()}
              balanceCents={overview.balanceCents}
              availableCents={overview.availableCents}
              settings={settings}
            />
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader title={text.historyTitle} icon="list" />
          <WithdrawalHistory withdrawals={recentWithdrawals} />
        </Card>
      </div>
    </div>
  );
}
