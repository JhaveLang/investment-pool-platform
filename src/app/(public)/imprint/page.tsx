import { LegalPageContent } from "@/components/public/legal-page";
import { getI18n, pageMetadata } from "@/i18n/server";

export const generateMetadata = pageMetadata((messages) => messages.site.imprint);

export default async function ImprintPage() {
  const { messages } = await getI18n();
  return <LegalPageContent page="imprint" title={messages.site.imprint} />;
}
