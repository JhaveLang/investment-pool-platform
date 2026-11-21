import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getI18n } from "@/i18n/server";
import type { Profile } from "@/server/queries/account";
import { ChangePasswordForm } from "./change-password-form";
import { DetailRow } from "./detail-row";

/** Account details and the password form, shared by the investor and the admin profile page. */
export async function ProfileView({ profile }: { profile: Profile }) {
  const { messages, format } = await getI18n();
  const text = messages.profile;
  const isInvestor = profile.role === "investor";

  return (
    <div className="grid gap-4 lg:gap-6 wide:grid-cols-2 wide:items-start">
      <Card className="min-w-0 lg:max-w-xl wide:max-w-none">
        <CardHeader title={text.accountTitle} icon="users" />
        <CardContent>
          <dl className="divide-y divide-line">
            {profile.investorCode ? (
              <DetailRow label={text.investorCode}>
                <span className="reference">{profile.investorCode}</span>
              </DetailRow>
            ) : null}
            <DetailRow label={text.name}>{profile.fullName}</DetailRow>
            <DetailRow label={text.email}>{profile.email}</DetailRow>
            <DetailRow label={text.memberSince}>{format.date(profile.createdAt)}</DetailRow>
          </dl>
          {isInvestor ? <p className="mt-2 text-[13px] text-muted">{text.contactHint}</p> : null}
        </CardContent>
      </Card>
      <Card className="min-w-0 lg:max-w-xl wide:max-w-none">
        <CardHeader title={text.passwordTitle} icon="lock" />
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
