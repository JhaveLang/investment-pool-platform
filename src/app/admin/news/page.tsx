import Link from "next/link";
import { deleteNewsAction, setNewsVisibilityAction } from "@/actions/news";
import { NewsRowActions } from "@/components/admin/news-row-actions";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FlashAlert } from "@/components/ui/flash-alert";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHeaderCell } from "@/components/ui/table";
import { getI18n, pageMetadata } from "@/i18n/server";
import { requireAdmin } from "@/server/auth/guards";
import { listAllNews } from "@/server/queries/news";

export const generateMetadata = pageMetadata((messages) => messages.admin.news.title);

// Like the investor list: the actions stay in view while a narrow screen scrolls the table sideways.
const pinnedActions = "sticky right-0 shadow-[-12px_0_12px_-12px_rgba(29,22,33,0.16)]";

/** Every notice of the public News page, hidden ones included, newest first. */
export default async function AdminNewsPage({ searchParams }: PageProps<"/admin/news">) {
  await requireAdmin();
  const [{ messages, format }, entries, params] = await Promise.all([getI18n(), listAllNews(), searchParams]);
  const text = messages.admin.news;
  // "untranslated": saved, but DeepL gave no English text, so the English website shows the German one.
  const flash = params.created ? "created" : params.saved ? "saved" : null;
  const untranslated = flash !== null && params[flash] === "untranslated";

  return (
    <>
      <PageHeader
        title={text.title}
        description={text.subtitle}
        actions={
          <>
            <Link href="/news" className={buttonStyles({ variant: "secondary" })}>
              <Icon name="globe" className="size-4" />
              {text.viewOnWebsite}
            </Link>
            <Link href="/admin/news/new" className={buttonStyles()}>
              <Icon name="plusCircle" className="size-4" />
              {text.newEntry}
            </Link>
          </>
        }
      />
      {flash ? (
        <FlashAlert param={flash} tone={untranslated ? "warning" : "success"} className="mb-4 lg:mb-6">
          {untranslated ? text[`${flash}Untranslated`] : text[flash]}
        </FlashAlert>
      ) : null}
      <Card>
        {entries.length === 0 ? (
          <EmptyState title={text.empty} />
        ) : (
          <Table>
            <thead>
              <tr>
                <TableHeaderCell>{text.date}</TableHeaderCell>
                <TableHeaderCell>{text.notice}</TableHeaderCell>
                <TableHeaderCell>{text.status}</TableHeaderCell>
                <TableHeaderCell className={`${pinnedActions} text-right`}>{text.actions}</TableHeaderCell>
              </tr>
            </thead>
            <TableBody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <TableCell className="whitespace-nowrap">{format.calendarDate(entry.publishedOn)}</TableCell>
                  <TableCell className="min-w-72 whitespace-normal">
                    <p className="text-fg">{entry.textDe}</p>
                    <p className="mt-1 text-xs text-subtle">
                      <span className="label-caps mr-1.5">EN</span>
                      {entry.textEn ?? text.noEnglish}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge tone={entry.visible ? "success" : "neutral"}>
                      {entry.visible ? text.visible : text.hidden}
                    </Badge>
                  </TableCell>
                  <TableCell className={`${pinnedActions} bg-surface`}>
                    <NewsRowActions
                      newsId={entry.id}
                      visible={entry.visible}
                      summary={`${format.calendarDate(entry.publishedOn)}: ${entry.textDe}`}
                      toggleAction={setNewsVisibilityAction.bind(null, entry.id, !entry.visible)}
                      deleteAction={deleteNewsAction.bind(null, entry.id)}
                    />
                  </TableCell>
                </tr>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
