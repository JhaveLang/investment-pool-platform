import { randomUUID } from "node:crypto";
import { MoveMoneyHeader } from "@/components/transactions/move-money-header";
import { DepositForm } from "@/components/transactions/deposit-form";
import { DepositHistory } from "@/components/transactions/request-history";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getI18n, pageMetadata } from "@/i18n/server";
import { depositLimits, poolNotice } from "@/lib/pool-settings";
import { requireInvestor } from "@/server/auth/guards";
import { getAccountOverview, listRecentDeposits } from "@/server/queries/investor";
import { getPoolSettings } from "@/server/queries/pool-settings";

export const generateMetadata = pageMetadata((messages) => messages.deposits.title);

export default async function DepositPage() {
  const user = await requireInvestor();
  const { messages, locale } = await getI18n();
  const text = messages.deposits;
  const [overview, recentDeposits, settings] = await Promise.all([
    getAccountOverview(user.id),
    listRecentDeposits(user.id),
    getPoolSettings(),
  ]);
  const notice = poolNotice(settings, locale);
  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <MoveMoneyHeader active="deposit" overview={overview} />
      <div className="grid gap-4 lg:gap-6 wide:grid-cols-[440px_minmax(0,1fr)] wide:items-start">
        <Card className="min-w-0 lg:max-w-xl wide:max-w-none">
          <CardHeader title={text.formTitle} description={text.subtitle} icon="arrowDownLeft" />
          <CardContent className="flex flex-col gap-4">
            {notice ? <Alert tone="info">{notice}</Alert> : null}
            {settings.depositsOpen ? (
                <DepositForm
                  idempotencyKey={randomUUID()}
                  balanceCents={overview.balanceCents}
                  limits={depositLimits(settings)}
                  promos={[]}
                />
            ) : (
              <Alert tone="warning">
                {text.closed}
              </Alert>
            )}
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader title={text.historyTitle} icon="list" />
          <DepositHistory deposits={recentDeposits} />
        </Card>
      </div>
    </div>
  );
}
