import Link from "next/link";
import { getI18n } from "@/i18n/server";
import { profilePathForRole } from "@/server/auth/guards";
import type { SessionUser } from "@/server/auth/session";

/** "Anna Maria Berger" → "AB" */
function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return letters.map((word) => word.charAt(0).toUpperCase()).join("");
}

export function Avatar({ user }: { user: SessionUser }) {
  return (
    <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-accent-400 font-display text-sm font-bold text-accent-ink">
      {initialsOf(user.fullName)}
      <span
        aria-hidden
        className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-accent-400 ring-2 ring-canvas"
      />
    </span>
  );
}

/** Name with the role underneath in emerald, beside the avatar. */
export async function UserChip({ user }: { user: SessionUser }) {
  const { messages } = await getI18n();
  return (
    <Link
      href={profilePathForRole(user.role)}
      className="flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-400"
    >
      <Avatar user={user} />
      <div className="flex flex-col">
        <span className="text-[13px] leading-none font-semibold text-fg">{user.fullName}</span>
        <span className="label-caps mt-1 leading-none text-accent-400">
          {user.role === "admin" ? messages.nav.roleAdmin : messages.nav.roleInvestor}
        </span>
      </div>
    </Link>
  );
}
