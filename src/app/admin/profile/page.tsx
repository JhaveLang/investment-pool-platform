import { ProfileView } from "@/components/account/profile-view";
import { PageHeader } from "@/components/ui/page-header";
import { getI18n, pageMetadata } from "@/i18n/server";
import { requireAdmin } from "@/server/auth/guards";
import { getProfile } from "@/server/queries/account";

export const generateMetadata = pageMetadata((messages) => messages.profile.title);

export default async function AdminProfilePage() {
  const user = await requireAdmin();
  const [{ messages }, profile] = await Promise.all([getI18n(), getProfile(user.id)]);
  if (!profile) {
    return null;
  }
  return (
    <>
      <PageHeader title={messages.profile.title} />
      <ProfileView profile={profile} />
    </>
  );
}
