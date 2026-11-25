import { PoolSettingsForm } from "@/components/admin/pool-settings-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getI18n, pageMetadata } from "@/i18n/server";
import { todayIsoDate } from "@/lib/calendar";
import { depositState } from "@/lib/pool-settings";
import { requireAdmin } from "@/server/auth/guards";
import { getPoolSettings } from "@/server/queries/pool-settings";

export const generateMetadata = pageMetadata((messages) => messages.admin.pool.title);

export default async function AdminPoolPage() {
  await requireAdmin();
  const [{ messages, format }, { updatedAt, ...settings }] = await Promise.all([getI18n(), getPoolSettings()]);
  const text = messages.admin.pool;
  const state = depositState(settings, todayIsoDate());

  return (
    <>
      <PageHeader title={text.title} description={text.subtitle} />
      <Card className="min-w-0 lg:max-w-3xl">
        <CardHeader
          title={text.settingsTitle}
          description={text.lastChanged(format.dateTime(updatedAt))}
          icon="bank"
          action={
            <Badge tone={state === "open" ? "success" : "warning"}>{text.states[state]}</Badge>
          }
        />
        <CardContent>
          <PoolSettingsForm settings={settings} />
        </CardContent>
      </Card>
    </>
  );
}
