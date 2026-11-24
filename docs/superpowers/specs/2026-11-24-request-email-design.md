# Email to the team on new requests – design

Date: 2026-11-24 · Status: proposed

## Intent

The user asked: "if investor deposit or withdraw, right now i send notif to the admin in the system and make it also
send to email bitcoin-magazin-pool-team1@online.ms".

The admin bell already announces every new deposit and withdrawal request live. The team should also get each one by
email, so they hear about it without having the admin page open.

- **Goal:** one email per new deposit and per new withdrawal request, to the team address.
- **Non-goals:** no emails to investors. No emails for approvals, rejections or booked months. No retry queue: the bell
  and the review queues stay the source of truth, so an email lost while the mail server is down is not resent.
- **Anti-goals:**
  - An email problem must never slow down, block or fail the investor's request.
  - Passwords, IBANs and wallet addresses never appear in emails or logs.

## Approaches

- **SMTP login of an existing mailbox (picked by the user).** Free, needs no new account, best delivery. Sent with
  `nodemailer` (open source, MIT-0).
- **Brevo free tier (300/day):** needs an account and a verified sender. Not picked. online.ms has DMARC
  `p=quarantine`, so mail "from" online.ms sent through Brevo would be sent to spam.
- **Resend:** its free plan needs a domain of our own. Not picked.

## Decisions

- **Mail server:** online.ms mail is run by WEB.DE (MX `mx-ha0*.web.de`, SPF via `_spf.web.de`). Settings:
  `smtp.web.de`, port 587 with STARTTLS. The login is the full address and its password. "POP3/IMAP Abruf" must be
  switched on in the WEB.DE settings.
- **Trigger:** in `depositAction` / `withdrawalAction`, only when the request was newly created.
  - `createDeposit` / `requestWithdrawal` report whether they created a row or replayed an earlier submit (same
    idempotency key), so a repeated submit sends nothing.
  - The email is sent with Next.js `after()`, after the response, so the investor never waits for it.
  - The demo seed calls the services directly and therefore sends nothing.
- **Failure:** errors are caught and logged as `[mail] …` (reason only, never the password). The request is not
  affected.
- **Content:** plain text, in German (the team's language).
  - Subject, e.g. "Neue Auszahlungsanfrage AZ-7KQ2M9XA: 1.000,00 € – Anna Schmidt (01GR01)".
  - Body: investor name, investor ID and email; amount, method, fee and the credited or debited amount; reference;
    time (Berlin); for withdrawals the payout deadline (7 days).
  - A link to the review page, when `APP_URL` is set.
  - No IBAN or wallet address.
- **Configuration (`.env`, all optional):** sending is off unless `SMTP_HOST` and `ADMIN_NOTIFICATION_EMAIL` are set,
  like the optional DeepL key.
  - `ADMIN_NOTIFICATION_EMAIL`: one or more addresses, comma-separated.
  - `SMTP_HOST`, `SMTP_PORT` (default 587; 465 means TLS from the start), `SMTP_USER`, `SMTP_PASSWORD`.
  - `MAIL_FROM`: defaults to `SMTP_USER`. WEB.DE only accepts its own address as sender.
  - `APP_URL`: e.g. `https://pool.example.com`, for the link.
  - `docker-compose.yml` passes these variables to the app. `deploy/setup.sh` fills in `APP_URL` from `SITE_HOST`.
- **Test command:** `npm run mail:test` sends one test email with the current settings, so a wrong password shows up
  before the first real request. On the server: `docker compose run --rm migrate npm run mail:test`.
- **Volume:** the deposit and withdrawal forms are already rate-limited per investor, which caps the email count.

## Left to the builder

- Exact wording of the email texts, kept in the message files next to the other German and English texts.
- **Testing:**
  - Unit tests for building the email and for reading the settings.
  - One real send through nodemailer to a local test SMTP server.
  - Typecheck and lint.
