import { LegalPageContent } from "@/components/public/legal-page";
import { getI18n, pageMetadata } from "@/i18n/server";

export const generateMetadata = pageMetadata((messages) => messages.site.privacy);

export default async function PrivacyPage() {
  const { messages } = await getI18n();
  return <LegalPageContent page="privacy" title={messages.site.privacy} />;
}
