#!/usr/bin/env bash
# One-time setup of a server for the pool (e.g. a demo for a client): Docker, the app stack and Caddy with automatic
# HTTPS. Without a domain the site is served as https://<server-ip-with-dashes>.sslip.io (free, no sign-up), behind a
# site-wide password prompt. Safe to run again: existing passwords in .env are kept.
#
# On a fresh Ubuntu or Debian server, from the repository folder:
#   sudo bash deploy/setup.sh
#
# Optional settings (environment variables or prompts; generated or defaulted when left empty):
#   SITE_HOST         host name to serve, e.g. pool.example.com (default: <server-ip>.sslip.io)
#   ADMIN_EMAIL       admin account email (default: admin@example.com)
#   ADMIN_PASSWORD    admin account password (default: generated)
#   ACCESS_PASSWORD   password of the site-wide prompt, user "client" (default: generated; "none" turns it off)
#   DEMO_PASSWORD     password of the demo investors (default: generated)
#   DEMO_DATA         "yes" fills the empty pool with demo investors (default: ask, "no" when not interactive)
set -euo pipefail

APP_URL_LOCAL="http://127.0.0.1:3000"
ACCESS_USER="client"
ACCESS_FILE="/root/investment-pool-access.txt"

info() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33mWarning: %s\033[0m\n' "$*" >&2; }
fail() { printf '\033[1;31mError: %s\033[0m\n' "$*" >&2; exit 1; }

# Asks on the terminal when there is one; otherwise returns the default.
ask() {
  local question="$1" default="$2" answer=""
  if [[ -t 0 ]]; then
    read -r -p "$question [${default}]: " answer
  fi
  printf '%s' "${answer:-$default}"
}

random_secret() { openssl rand -base64 32 | tr -d '/+=' | cut -c1-20; }

# Reads KEY from .env (the value after the first "=", without surrounding single quotes), empty when missing.
env_value() {
  local value
  value="$(grep -E "^$1=" .env 2>/dev/null | head -n1 | cut -d= -f2- || true)"
  value="${value%\'}"
  printf '%s' "${value#\'}"
}

# Sets KEY='value' in .env, replacing an existing line. Single quotes keep Docker Compose from interpreting "$" or
# "#" in passwords.
set_env() {
  [[ "$2" != *"'"* ]] || fail "$1 must not contain a single quote (')."
  KEY="$1" VALUE="'$2'" awk 'BEGIN { key = ENVIRON["KEY"]; line = key "=" ENVIRON["VALUE"] }
    index($0, key "=") == 1 { if (!done) print line; done = 1; next }
    { print }
    END { if (!done) print line }' .env > .env.tmp
  mv .env.tmp .env
  chmod 600 .env
}

[[ $EUID -eq 0 ]] || fail "Run it as root: sudo bash deploy/setup.sh"
cd "$(dirname "$0")/.."
[[ -f docker-compose.yml ]] || fail "Run it from the repository (docker-compose.yml not found)."
# shellcheck disable=SC1091
. /etc/os-release
[[ "${ID:-}" == "ubuntu" || "${ID:-}" == "debian" || "${ID_LIKE:-}" == *debian* ]] ||
  fail "This script supports Ubuntu and Debian; see README › Production deployment for other systems."

info "Base packages"
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg openssl >/dev/null

# Building the app needs about 2 GB of memory; small servers get a swap file.
memory_mb=$(awk '/MemTotal/ { print int($2 / 1024) }' /proc/meminfo)
if (( memory_mb < 2000 )) && ! swapon --show | grep -q .; then
  info "Adding 2 GB swap (the server has ${memory_mb} MB of memory)"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

if ! command -v docker >/dev/null; then
  info "Installing Docker"
  curl -fsSL https://get.docker.com | sh
fi

if ! command -v caddy >/dev/null; then
  info "Installing Caddy"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' |
    gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy >/dev/null
fi

info "Settings"
public_ip="$(curl -4fsS https://api.ipify.org || curl -4fsS https://ifconfig.me || true)"
[[ -n "$public_ip" ]] || fail "Could not determine the server's public IP address; set SITE_HOST yourself."
if [[ ! -f .env ]]; then
  touch .env
  chmod 600 .env
fi
site_host="${SITE_HOST:-$(env_value SITE_HOST)}"
site_host="${site_host:-$(ask "Host name (no domain? keep the default)" "${public_ip//./-}.sslip.io")}"
admin_email="${ADMIN_EMAIL:-$(env_value ADMIN_EMAIL)}"
admin_email="${admin_email:-$(ask "Admin email" "admin@example.com")}"
# Passwords stored in the database (PostgreSQL's own, the admin's) only take effect for a new database; with an
# existing one the values in .env are kept.
database_exists="no"
docker volume inspect investment-pool_postgres-data >/dev/null 2>&1 && database_exists="yes"
admin_password="${ADMIN_PASSWORD:-$(env_value ADMIN_PASSWORD)}"
if [[ -z "$admin_password" || "$admin_password" == change-me* ]]; then
  if [[ "$database_exists" == "yes" ]]; then
    [[ -n "$admin_password" ]] || fail "ADMIN_PASSWORD is missing in .env, but the database already exists."
    warn "The database already exists; the admin keeps the password it was created with."
  else
    admin_password="$(random_secret)"
  fi
fi
access_password="${ACCESS_PASSWORD:-$(env_value ACCESS_PASSWORD)}"
access_password="${access_password:-$(random_secret)}"
demo_password="${DEMO_PASSWORD:-$(env_value DEMO_PASSWORD)}"
demo_password="${demo_password:-$(random_secret)}"
postgres_password="$(env_value POSTGRES_PASSWORD)"
if [[ -z "$postgres_password" || "$postgres_password" == change-me* ]]; then
  if [[ "$database_exists" == "yes" ]]; then
    [[ -n "$postgres_password" ]] || fail "POSTGRES_PASSWORD is missing in .env, but the database already exists."
    warn "The database already exists; keeping its current POSTGRES_PASSWORD."
  else
    postgres_password="$(random_secret)"
  fi
fi
(( ${#admin_password} >= 10 )) || fail "ADMIN_PASSWORD must have at least 10 characters."
(( ${#demo_password} >= 10 )) || fail "DEMO_PASSWORD must have at least 10 characters."

set_env SITE_HOST "$site_host"
set_env ADMIN_EMAIL "$admin_email"
set_env ADMIN_PASSWORD "$admin_password"
set_env ADMIN_NAME "$(env_value ADMIN_NAME | grep . || echo Administrator)"
set_env POSTGRES_USER "$(env_value POSTGRES_USER | grep . || echo pool)"
set_env POSTGRES_PASSWORD "$postgres_password"
set_env POSTGRES_DB "$(env_value POSTGRES_DB | grep . || echo investment_pool)"
# Only Caddy talks to the app; the port is not reachable from outside.
set_env APP_PORT "127.0.0.1:3000"
set_env ACCESS_PASSWORD "$access_password"
set_env DEMO_PASSWORD "$demo_password"

info "Building and starting the app (the first build takes a few minutes)"
docker compose up -d --build
for _ in $(seq 1 60); do
  curl -fsS "$APP_URL_LOCAL/api/health" >/dev/null 2>&1 && break
  sleep 3
done
curl -fsS "$APP_URL_LOCAL/api/health" >/dev/null 2>&1 ||
  fail "The app did not become healthy; see: docker compose logs app migrate"

demo_data="${DEMO_DATA:-}"
if [[ -z "$demo_data" ]]; then
  if [[ -t 0 ]]; then
    demo_data="$(ask "Fill the empty pool with demo investors? (yes/no)" "yes")"
  else
    demo_data="no"
  fi
fi
if [[ "$demo_data" == y* ]]; then
  info "Demo data"
  # Refuses by itself when the pool already has investors or booked months.
  docker compose run --rm migrate npm run db:seed:demo
fi

info "Caddy (HTTPS for ${site_host})"
caddyfile="/etc/caddy/Caddyfile"
[[ -f "$caddyfile" && ! -f "$caddyfile.original" ]] && cp "$caddyfile" "$caddyfile.original"
access_block=""
if [[ "$access_password" != "none" ]]; then
  access_hash="$(caddy hash-password --plaintext "$access_password")"
  access_block="	basic_auth {
		${ACCESS_USER} ${access_hash}
	}
"
fi
cat > "$caddyfile" <<EOF
# Written by deploy/setup.sh – run it again to change the host name or the access password.
${site_host} {
${access_block}	# No compression here: the app compresses itself and keeps its live-update streams unbuffered.
	reverse_proxy 127.0.0.1:3000
}
EOF
caddy validate --config "$caddyfile" --adapter caddyfile >/dev/null
systemctl enable --now caddy >/dev/null 2>&1 || true
systemctl reload caddy || systemctl restart caddy

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow OpenSSH >/dev/null
  ufw allow 80,443/tcp >/dev/null
fi

info "Waiting for the HTTPS certificate"
curl_auth=()
[[ "$access_password" != "none" ]] && curl_auth=(-u "${ACCESS_USER}:${access_password}")
https_ok="no"
for _ in $(seq 1 30); do
  if curl -fsS "${curl_auth[@]}" "https://${site_host}/api/health" >/dev/null 2>&1; then
    https_ok="yes"
    break
  fi
  sleep 3
done
[[ "$https_ok" == "yes" ]] ||
  warn "https://${site_host} doesn't answer yet. Check that ports 80 and 443 are open in the server provider's firewall, then: journalctl -u caddy --since -10min"

{
  echo "Bitcoin Magazin Pool – access ($(date '+%Y-%m-%d %H:%M'))"
  echo
  echo "Website:        https://${site_host}"
  if [[ "$access_password" != "none" ]]; then
    echo "Site password:  user ${ACCESS_USER} / ${access_password}   (asked by the browser before anything else)"
  fi
  echo "Admin:          ${admin_email} / ${admin_password}"
  if [[ "$demo_data" == y* ]]; then
    echo "Demo investors: password ${demo_password}"
    echo "                anna.becker@example.com (full history), felix.neumann@example.com (new, welcome popup),"
    echo "                ben.wagner, carla.schmidt, david.klein (3 open requests), emma.fischer (deactivated) @example.com"
  fi
  echo
  echo "Update later:   sudo bash deploy/update.sh"
} | tee "$ACCESS_FILE"
chmod 600 "$ACCESS_FILE"
echo
echo "Saved to ${ACCESS_FILE} (readable by root only)."
