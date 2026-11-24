# News management (2026-11-24)

## Request

"Add news management in admin, and then display it in the News tab publicly." Asked whether notices should become longer announcements, the user said to dive in and keep the shape of the existing News tab.

## Before

The public News page and the start page's "Aktuelle Mitteilungen" (latest 3) read 49 notices from `src/content/news.ts`: a date plus a German and an English sentence, sorted newest first. Changing a notice meant editing code and redeploying.

## Decisions

- **Same shape as the News tab:** a date, the German text (required) and the English text (optional; the English website falls back to German). There are no titles, bodies or formatting. Each text is at most 500 characters; the longest existing one has 169.
- **Database table `news_entries`**, created by migration `0007`. The 49 notices are copied in by the migration itself (not by a seed), so existing installations keep them through `db:migrate`. `created_at` is staggered so the three dates with two notices keep their old order. Afterwards `src/content/news.ts` and its test were removed.
- **Order:** newest date first; on the same date, the notice added later comes first.
- **Admin → News** (`/admin/news`, globe icon, under "Mehr" on phones):
  - A list of every notice with date, German text, English text or "keine englische Fassung", a status badge, and the actions Bearbeiten / Ausblenden or Einblenden / Löschen. The actions column is pinned and stacked on phones.
  - `/admin/news/new` and `/admin/news/[newsId]/edit` share one form: date (default today in Berlin), both texts, and "Auf der Website anzeigen".
  - Hide / show is a quick toggle in the list. Delete asks for confirmation and points to "Ausblenden" for temporary removal.
- **Notices can be edited and deleted.** They are not money data, so unlike the ledger they aren't append-only. The activity log keeps the trail: `news.created`, `news.updated` (changed fields), `news.deleted` (with the deleted text). These events are not pushed as live notifications.
- **Public pages** query visible notices on every request. They already rendered dynamically (the locale cookie), so changes show at once and `next build` never touches the database.

## Approaches considered

1. **Database table with admin CRUD (chosen):** fits the existing Drizzle / server-action / audit patterns and works for every installation.
2. **Keep the TypeScript file and edit it from the admin:** impossible in the standalone Docker image, which has no writable source.
3. **External CMS:** a new service and account for 50 one-line notices; out of proportion.

## Verification

- Unit tests: validation (date, required German text, 500-character limit, optional English text) and the language fallback and year grouping.
- On a throwaway database: all 49 migrated rows matched the old file in content and order.
- A browser run against the production build covered create (with the empty-text error), edit, hide (gone from `/` and `/news` in both languages), delete with confirmation, the English fallback, the activity-log entries and the phone layout.

## Follow-up (same day): German only, translated by DeepL

The user asked for "just text in german, but it should still translatable". Offered DeepL, Claude or Google, they asked for a free option; of DeepL API Free, a self-hosted LibreTranslate and the browser's own translation, they chose **DeepL**.

- **The admin writes German only.** The English field is gone from the form. `news_entries.text_en` stays and now holds the DeepL translation, so there is no migration change.
- **Translation happens when the admin saves**, not when visitors open the page. There is no cost per page view, the public pages stay fast, and the stored text is what the admin sees.
  - `src/lib/deepl.ts` sends `POST /v2/translate` with the `DeepL-Auth-Key` header, `source_lang` DE and `target_lang` EN-GB (the app formats English as en-GB). Keys ending in `:fx` use `api-free.deepl.com`.
  - It never throws: a timeout (8 s), a non-2xx answer, or an empty or over-long result (the column allows 1 to 500 characters) comes back as a failure with a reason. The reason is logged without the key.
  - `src/server/translate.ts` reads `DEEPL_API_KEY`; an empty value counts as unset, as with Compose.
- **When the service calls DeepL:**
  - creating a notice;
  - a changed German text: if that translation fails, the old English text is dropped instead of being left outdated;
  - an unchanged German text that has no English yet, so saving again retries.
  - An unchanged German text that already has English is never re-translated, so the 49 hand-written translations survive date or visibility changes. The hide/show button never calls DeepL.
  - The call happens before the database transaction, so the row lock never waits on HTTP.
- **Failure is visible but doesn't block.**
  - The notice is saved and the English site falls back to German.
  - The list redirects with `?created=untranslated` or `?saved=untranslated` and shows a warning; the row says "noch nicht übersetzt".
  - Saving again without changes that still gets no translation shows an error instead of "nothing changed".
  - The edit page shows the current translation read-only.
- **Configuration:**
  - `DEEPL_API_KEY` goes in `.env.example` (optional, commented) and the README table.
  - Compose passes it to the app container (`DEEPL_API_KEY: ${DEEPL_API_KEY:-}`), since the app service lists its environment explicitly.
- **Privacy:** only the admin's notice texts go to DeepL, never visitor or investor data. The privacy page's statement (no analytics, advertising or audience-measurement services) stays true.
- **Verification:**
  - Unit tests with a stubbed fetch: host choice, header and body, parsing, 403/456/500, empty and too-long results, network error and timeout.
  - The service logic was tested with an injected translator.
  - One real request with a fake `:fx` key returned 403, which confirms host, path and body.
  - An actual translation still needs the operator's key.
