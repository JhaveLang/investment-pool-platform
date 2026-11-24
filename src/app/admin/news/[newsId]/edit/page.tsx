import Link from "next/link";
import { notFound } from "next/navigation";
import { updateNewsAction } from "@/actions/news";
import { NewsForm } from "@/components/admin/news-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getI18n, pageMetadata } from "@/i18n/server";
import { requireAdmin } from "@/server/auth/guards";
import { getNewsEntry } from "@/server/queries/news";

export const generateMetadata = pageMetadata((messages) => messages.admin.news.editTitle);

export default async function AdminEditNewsPage({ params }: PageProps<"/admin/news/[newsId]/edit">) {
  await requireAdmin();
  const { newsId } = await params;
  const [{ messages }, entry] = await Promise.all([getI18n(), getNewsEntry(newsId)]);
  if (!entry) {
    notFound();
  }
  const text = messages.admin.news;

  return (
    <>
      <Link href="/admin/news" className="label-caps mb-3 inline-block text-accent-400 hover:underline">
        ← {text.backLink}
      </Link>
      <PageHeader title={text.editTitle} description={text.formSubtitle} />
      <Card className="min-w-0 lg:max-w-2xl">
        <CardHeader title={text.formTitle} icon="globe" />
        <CardContent>
          <NewsForm
            action={updateNewsAction.bind(null, entry.id)}
            initial={{ publishedOn: entry.publishedOn, textDe: entry.textDe, visible: entry.visible }}
            english={entry.textEn}
            submitLabel={text.save}
          />
        </CardContent>
      </Card>
    </>
  );
}
