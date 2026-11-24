import Link from "next/link";
import { createNewsAction } from "@/actions/news";
import { NewsForm } from "@/components/admin/news-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getI18n, pageMetadata } from "@/i18n/server";
import { todayIsoDate } from "@/lib/calendar";
import { requireAdmin } from "@/server/auth/guards";

export const generateMetadata = pageMetadata((messages) => messages.admin.news.newTitle);

export default async function AdminNewNewsPage() {
  await requireAdmin();
  const { messages } = await getI18n();
  const text = messages.admin.news;

  return (
    <>
      <Link href="/admin/news" className="label-caps mb-3 inline-block text-accent-400 hover:underline">
        ← {text.backLink}
      </Link>
      <PageHeader title={text.newTitle} description={text.formSubtitle} />
      <Card className="min-w-0 lg:max-w-2xl">
        <CardHeader title={text.formTitle} icon="globe" />
        <CardContent>
          <NewsForm
            action={createNewsAction}
            initial={{ publishedOn: todayIsoDate(), textDe: "", visible: true }}
            submitLabel={text.create}
          />
        </CardContent>
      </Card>
    </>
  );
}
