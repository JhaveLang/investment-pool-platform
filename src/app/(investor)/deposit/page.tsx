import { randomUUID } from "node:crypto";
import { MoveMoneyHeader } from "@/components/transactions/move-money-header";
import { DepositForm } from "@/components/transactions/deposit-form";
import { DepositHistory } from "@/components/transactions/request-history";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getI18n, pageMetadata } from "@/i18n/server";
import { requireInvestor } from "@/server/auth/guards";
import { getAccountOverview, listRecentDeposits } from "@/server/queries/investor";

export const generateMetadata = pageMetadata((messages) => messages.deposits.title);

export default async function DepositPage() {
  const user = await requireInvestor();
  const text = (await getI18n()).messages.deposits;
  const [overview, recentDeposits] = await Promise.all([getAccountOverview(user.id), listRecentDeposits(user.id)]);

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <MoveMoneyHeader active="deposit" overview={overview} />
      <div className="grid gap-4 lg:gap-6 wide:grid-cols-[440px_minmax(0,1fr)] wide:items-start">
        <Card className="min-w-0 lg:max-w-xl wide:max-w-none">
          <CardHeader title={text.formTitle} description={text.subtitle} icon="arrowDownLeft" />
          <CardContent>
            {/* A fresh key per render; it changes after each successful booking. */}
            <DepositForm idempotencyKey={randomUUID()} balanceCents={overview.balanceCents} />
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
