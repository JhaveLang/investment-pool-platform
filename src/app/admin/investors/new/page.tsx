import Link from "next/link";
import { CreateInvestorForm } from "@/components/admin/create-investor-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getI18n, pageMetadata } from "@/i18n/server";
import { requireAdmin } from "@/server/auth/guards";

export const generateMetadata = pageMetadata((messages) => messages.admin.investorCreate.title);

export default async function AdminNewInvestorPage() {
  await requireAdmin();
  const { messages } = await getI18n();
  const text = messages.admin.investorCreate;

  return (
    <>
      <Link href="/admin/investors" className="label-caps mb-3 inline-block text-accent-400 hover:underline">
        ← {messages.admin.investorDetail.backLink}
      </Link>
      <PageHeader title={text.title} description={text.subtitle} />
      <Card className="min-w-0 lg:max-w-xl">
        <CardHeader title={text.formTitle} description={text.passwordHint} icon="users" />
        <CardContent>
          <CreateInvestorForm />
        </CardContent>
      </Card>
    </>
  );
}
