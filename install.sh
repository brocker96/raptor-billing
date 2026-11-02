#!/usr/bin/env bash
#
# Raptor Billing installer for Ubuntu 24.04 LTS.
#
#   bash <(curl -fsSL https://raw.githubusercontent.com/brocker96/raptor-billing/main/install.sh)
#
# Sets up everything the billing needs: PHP 8.3, MariaDB, Redis, nginx, Composer, Node.js (only to
# build from source), the queue worker, the scheduler and an optional Let's Encrypt certificate.
#
# Works on a clean server and next to Raptor Panel. When the Panel is found on the same machine the
# billing connects to it by itself: API key, webhook and the "Billing" links in the Panel.
#
# Every question can be answered up front, which makes the script usable without a terminal:
#
#   BILLING_FQDN=billing.example.com BILLING_EMAIL=me@example.com BILLING_YES=1 bash install.sh
#
# Supported variables:
#   BILLING_FQDN            Domain (or IP address) of the billing.
#   BILLING_EMAIL           Email of the first administrator and for Let's Encrypt.
#   BILLING_ADMIN_NAME      Name of the first administrator (default: Administrator).
#   BILLING_ADMIN_PASSWORD  Password of the first administrator (default: generated).
#   BILLING_COMPANY         Hosting name shown to customers (default: the domain).
#   BILLING_TIMEZONE        PHP timezone, e.g. Europe/Kyiv (default: system timezone).
#   BILLING_SSL             yes/no - request a Let's Encrypt certificate (default: yes for domains).
#   BILLING_MONOPAY_TOKEN   plata by mono token, can also be added later in the admin area.
#   BILLING_CONNECT_PANEL   yes/no - connect to Raptor Panel found on this server (default: yes).
#   BILLING_PANEL_DIR       Where to look for the Panel (default: /var/www/raptor).
#   BILLING_BRANCH          Git branch to install from (default: main).
#   BILLING_RELEASE         Install a pre-built release, "latest" or a tag such as "v0.1.0".
#   BILLING_DIR             Install directory (default: /var/www/billing).
#   BILLING_YES=1           Do not ask anything, take the defaults.
#
# For a private repository clone it first and start the copy, the installer then uses those files:
#   git clone https://<token>@github.com/brocker96/raptor-billing.git /root/raptor-billing
#   bash /root/raptor-billing/install.sh

set -Eeuo pipefail

REPO="brocker96/raptor-billing"
BRANCH="${BILLING_BRANCH:-main}"
RELEASE="${BILLING_RELEASE:-}"
DIR="${BILLING_DIR:-/var/www/billing}"
PANEL_DIR="${BILLING_PANEL_DIR:-/var/www/raptor}"
PHP_VERSION="8.3"
LOG_FILE="/var/log/raptor-billing-install.log"
CREDENTIALS_FILE="/root/raptor-billing-credentials.txt"

# ---------------------------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------------------------

if [[ -t 1 ]]; then
    GREEN=$'\e[38;5;76m'; DIM=$'\e[2m'; BOLD=$'\e[1m'; RED=$'\e[31m'; YELLOW=$'\e[33m'; RESET=$'\e[0m'
else
    GREEN=""; DIM=""; BOLD=""; RED=""; YELLOW=""; RESET=""
fi

STEP=0
TOTAL_STEPS=9
step() { STEP=$((STEP + 1)); printf '\n%s[%d/%d]%s %s%s%s\n' "$GREEN" "$STEP" "$TOTAL_STEPS" "$RESET" "$BOLD" "$*" "$RESET"; }
info() { printf '      %s%s%s\n' "$DIM" "$*" "$RESET"; }
ok() { printf '      %s✔%s %s\n' "$GREEN" "$RESET" "$*"; }
warn() { printf '      %s! %s%s\n' "$YELLOW" "$*" "$RESET"; }
fail() { printf '\n%s✖ %s%s\n' "$RED" "$*" "$RESET" >&2; exit 1; }

# Passwords, keys and tokens passed as arguments never reach the log or the screen.
redact() { sed -E 's/(--(password|token|key|secret)[= ])[^ ]+/\1***/g; s/(monopay_token|panel_key)=[^ ]+/\1=***/g' <<<"$*"; }

run() {
    echo "+ $(redact "$*")" >>"$LOG_FILE"
    if ! "$@" >>"$LOG_FILE" 2>&1; then
        fail "Command failed: $(redact "$*")  (details in $LOG_FILE)"
    fi
}

trap 'fail "Installation stopped on line $LINENO. The full log is in $LOG_FILE."' ERR

ask() {
    # ask <variable> <question> <default>
    local __var="$1" __question="$2" __default="${3:-}" __answer
    if [[ -n "${!__var:-}" ]]; then return; fi
    if [[ "${BILLING_YES:-}" == "1" || ! -t 0 ]]; then
        printf -v "$__var" '%s' "$__default"
        return
    fi
    if [[ -n "$__default" ]]; then
        read -r -p "      $__question [$__default]: " __answer
    else
        read -r -p "      $__question: " __answer
    fi
    printf -v "$__var" '%s' "${__answer:-$__default}"
}

ask_secret() {
    local __var="$1" __question="$2" __answer
    if [[ -n "${!__var:-}" || "${BILLING_YES:-}" == "1" || ! -t 0 ]]; then return; fi
    read -r -s -p "      $__question: " __answer
    printf '\n'
    printf -v "$__var" '%s' "$__answer"
}

yes_no() { [[ "${1,,}" =~ ^(y|yes|1|true|так|да)$ ]]; }
random() { tr -dc 'A-Za-z0-9' </dev/urandom | head -c "${1:-32}" || true; }
is_ip() { [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; }

set_env() {
    local key="$1" value="$2"
    if grep -qE "^${key}=" .env; then
        sed -i "s|^${key}=.*|${key}=${value}|" .env
    else
        echo "${key}=${value}" >>.env
    fi
}

artisan() { run sudo -u www-data php "$DIR/artisan" "$@" --no-interaction; }

# ---------------------------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------------------------

cat <<BANNER

${GREEN}   ____             _               ${RESET}${BOLD}____  _ _ _ _             ${RESET}
${GREEN}  |  _ \\ __ _ _ __ | |_ ___  _ __  ${RESET}${BOLD}| __ )(_) | (_)_ __   __ _ ${RESET}
${GREEN}  | |_) / _\` | '_ \\| __/ _ \\| '__| ${RESET}${BOLD}|  _ \\| | | | | '_ \\ / _\` |${RESET}
${GREEN}  |  _ < (_| | |_) | || (_) | |    ${RESET}${BOLD}| |_) | | | | | | | | (_| |${RESET}
${GREEN}  |_| \\_\\__,_| .__/ \\__\\___/|_|    ${RESET}${BOLD}|____/|_|_|_|_|_| |_|\\__, |${RESET}
${GREEN}             |_|                   ${RESET}${DIM} installer · Ubuntu 24.04 ${RESET}${BOLD}|___/ ${RESET}

BANNER

[[ $EUID -eq 0 ]] || fail "Run the installer as root (sudo -i)."
: >"$LOG_FILE"
chmod 600 "$LOG_FILE"

# shellcheck disable=SC1091
. /etc/os-release
if [[ "${ID:-}" != "ubuntu" || "${VERSION_ID:-}" != "24.04" ]]; then
    warn "Written for Ubuntu 24.04 LTS, this is ${PRETTY_NAME:-unknown}."
    ask CONTINUE_ANYWAY "Continue anyway? (yes/no)" "no"
    yes_no "$CONTINUE_ANYWAY" || exit 1
fi

if [[ -e "$DIR/.env" ]]; then
    fail "$DIR already has Raptor Billing. Update it in the admin area (Оновлення) or with 'php artisan billing:update'."
fi

PANEL_FOUND=0
if [[ -f "$PANEL_DIR/artisan" && -f "$PANEL_DIR/.env" ]] && grep -q "raptor:billing:connect" < <(php "$PANEL_DIR/artisan" list raptor 2>/dev/null || true); then
    PANEL_FOUND=1
fi

PUBLIC_IP="$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
SYSTEM_TZ="$(timedatectl show -p Timezone --value 2>/dev/null || echo UTC)"
FREE_MB=$(df -Pm / | awk 'NR==2 {print $4}')
((FREE_MB > 2048)) || warn "Only ${FREE_MB} MB of free disk space, 2 GB or more is recommended."

printf '%sThis server%s\n' "$BOLD" "$RESET"
info "Public IP:     $PUBLIC_IP"
info "Raptor Panel:  $( ((PANEL_FOUND)) && echo "found in $PANEL_DIR, will be connected automatically" || echo "not on this server, connect it later in Admin → Settings")"

step "A few questions"
ask BILLING_FQDN "Billing domain, e.g. billing.example.com (or the server IP)" "$PUBLIC_IP"
[[ -n "$BILLING_FQDN" ]] || fail "A domain or IP address is required."
ask BILLING_COMPANY "Hosting name customers see" "$(is_ip "$BILLING_FQDN" && echo "My Hosting" || echo "${BILLING_FQDN#billing.}")"
ask BILLING_EMAIL "Your email (admin login + certificate notices)" "admin@${BILLING_FQDN#billing.}"
ask BILLING_ADMIN_NAME "Your name" "Administrator"
ask_secret BILLING_ADMIN_PASSWORD "Admin password (empty = generate one)"
ask BILLING_TIMEZONE "Timezone" "${SYSTEM_TZ:-UTC}"
if is_ip "$BILLING_FQDN"; then
    BILLING_SSL="no"
    info "An IP address was given: HTTPS needs a domain, so it is skipped."
else
    ask BILLING_SSL "Get a free HTTPS certificate (Let's Encrypt)? (yes/no)" "yes"
fi
ask_secret BILLING_MONOPAY_TOKEN "plata by mono token (empty = add later)"
if ((PANEL_FOUND)); then
    ask BILLING_CONNECT_PANEL "Connect to Raptor Panel on this server? (yes/no)" "yes"
else
    BILLING_CONNECT_PANEL="no"
fi

GENERATED_PASSWORD=0
if [[ -z "${BILLING_ADMIN_PASSWORD:-}" ]]; then
    BILLING_ADMIN_PASSWORD="$(random 20)"
    GENERATED_PASSWORD=1
fi
DB_PASSWORD="$(random 32)"
SCHEME="http"
yes_no "$BILLING_SSL" && SCHEME="https"

printf '\n'
info "Address:       $SCHEME://$BILLING_FQDN"
info "Hosting name:  $BILLING_COMPANY"
info "Admin:         $BILLING_ADMIN_NAME <$BILLING_EMAIL>"
info "Install from:  ${RELEASE:+release $RELEASE}${RELEASE:-git branch $BRANCH}"
info "Directory:     $DIR"
info "MonoPay:       $([[ -n "${BILLING_MONOPAY_TOKEN:-}" ]] && echo "token given" || echo "later, in Admin → Settings")"
info "Raptor Panel:  $(yes_no "$BILLING_CONNECT_PANEL" && echo "connect automatically" || echo "connect later")"
ask CONFIRM "Start? (yes/no)" "yes"
yes_no "$CONFIRM" || exit 1

export DEBIAN_FRONTEND=noninteractive
STARTED_AT=$SECONDS

# ---------------------------------------------------------------------------------------------
# System packages
# ---------------------------------------------------------------------------------------------

step "System packages (PHP $PHP_VERSION, MariaDB, Redis, nginx)"
run apt-get update
run apt-get install -y software-properties-common curl ca-certificates gnupg tar unzip git cron sudo \
    "php$PHP_VERSION" "php$PHP_VERSION"-{cli,fpm,common,gd,mysql,mbstring,bcmath,xml,curl,zip,intl,redis,sqlite3} \
    mariadb-server nginx redis-server
run systemctl enable --now mariadb redis-server nginx "php$PHP_VERSION-fpm" cron
ok "PHP $(php -r 'echo PHP_VERSION;'), MariaDB, Redis and nginx are running"

if ! command -v composer >/dev/null; then
    EXPECTED="$(curl -fsSL https://composer.github.io/installer.sig)"
    run curl -fsSL https://getcomposer.org/installer -o /tmp/composer-setup.php
    ACTUAL="$(sha384sum /tmp/composer-setup.php | awk '{print $1}')"
    [[ "$EXPECTED" == "$ACTUAL" ]] || fail "The Composer installer checksum does not match."
    run php /tmp/composer-setup.php --quiet --install-dir=/usr/local/bin --filename=composer
    rm -f /tmp/composer-setup.php
fi
ok "Composer $(composer --version 2>/dev/null | awk '{print $3}')"

# ---------------------------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------------------------

step "Database"
mysql -u root <<SQL >>"$LOG_FILE" 2>&1
CREATE DATABASE IF NOT EXISTS billing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'billing'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER 'billing'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON billing.* TO 'billing'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
ok "Database 'billing' with its own user (separate from the Panel)"

# ---------------------------------------------------------------------------------------------
# Billing files
# ---------------------------------------------------------------------------------------------

step "Downloading Raptor Billing"
mkdir -p "$DIR"
# Started from a downloaded copy (git clone, private repository): install that copy.
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || true)"
if [[ -z "$RELEASE" && -f "$SOURCE_DIR/artisan" && -f "$SOURCE_DIR/config/billing.php" && "$SOURCE_DIR" != "$DIR" ]]; then
    run cp -a "$SOURCE_DIR/." "$DIR/"
    rm -rf "$DIR/.git" "$DIR/node_modules" "$DIR/vendor"
    ok "Local copy from $SOURCE_DIR"
elif [[ -n "$RELEASE" ]]; then
    if [[ "$RELEASE" == "latest" ]]; then
        BASE="https://github.com/$REPO/releases/latest/download"
    else
        BASE="https://github.com/$REPO/releases/download/$RELEASE"
    fi
    run curl -fsSL "$BASE/billing.tar.gz" -o /tmp/raptor-billing.tar.gz
    run curl -fsSL "$BASE/billing.tar.gz.sha256" -o /tmp/raptor-billing.tar.gz.sha256
    [[ "$(awk '{print $1}' /tmp/raptor-billing.tar.gz.sha256)" == "$(sha256sum /tmp/raptor-billing.tar.gz | awk '{print $1}')" ]] || fail "The release checksum does not match."
    run tar -xzf /tmp/raptor-billing.tar.gz -C "$DIR" --no-same-owner
    rm -f /tmp/raptor-billing.tar.gz /tmp/raptor-billing.tar.gz.sha256
    ok "Release $RELEASE (checksum verified)"
else
    TMP_CLONE="$(mktemp -d)"
    run git clone --depth 1 --branch "$BRANCH" "https://github.com/$REPO.git" "$TMP_CLONE"
    rm -rf "$TMP_CLONE/.git"
    cp -a "$TMP_CLONE/." "$DIR/"
    rm -rf "$TMP_CLONE"
    ok "Branch $BRANCH"
fi
cd "$DIR"

step "Dependencies and front-end"
run env COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --optimize-autoloader --no-interaction

cp .env.example .env
set_env APP_NAME "\"Raptor Billing\""
set_env APP_ENV production
set_env APP_DEBUG false
set_env APP_URL "$SCHEME://$BILLING_FQDN"
set_env APP_TIMEZONE "$BILLING_TIMEZONE"
set_env DB_CONNECTION mariadb
set_env DB_HOST 127.0.0.1
set_env DB_DATABASE billing
set_env DB_USERNAME billing
set_env DB_PASSWORD "$DB_PASSWORD"
set_env CACHE_STORE redis
set_env QUEUE_CONNECTION redis
set_env SESSION_DRIVER redis
# Redis databases 0 and 1 belong to the Panel when it runs on this server.
set_env REDIS_DB 4
set_env REDIS_CACHE_DB 5
set_env REDIS_PREFIX raptor_billing_
set_env MAIL_FROM_ADDRESS "no-reply@${BILLING_FQDN#billing.}"
# No mail server is known yet: mails go to the log until SMTP is set in .env.
set_env MAIL_MAILER log
run php artisan key:generate --force

if [[ ! -f public/build/manifest.json ]]; then
    MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
    if ((MEM_MB < 2000)) && ! swapon --show | grep -q .; then
        info "Only ${MEM_MB} MB of RAM, adding a 2 GB swap file for the build."
        run fallocate -l 2G /swapfile
        run chmod 600 /swapfile
        run mkswap /swapfile
        run swapon /swapfile
        grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
    fi
    if ! command -v node >/dev/null || (($(node -p 'process.versions.node.split(".")[0]') < 22)); then
        run bash -c 'curl -fsSL https://deb.nodesource.com/setup_22.x | bash -'
        run apt-get install -y nodejs
    fi
    run npm ci --no-audit --no-fund
    run env NODE_OPTIONS=--max-old-space-size=1536 npm run build
    rm -rf node_modules
fi
ok "PHP packages installed, interface built"

# ---------------------------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------------------------

step "Configuring the billing"
chown -R www-data:www-data "$DIR"
chmod 640 "$DIR/.env"
artisan migrate --force
artisan billing:admin "$BILLING_EMAIL" --name="$BILLING_ADMIN_NAME" --password="$BILLING_ADMIN_PASSWORD"
artisan billing:set "company_name=$BILLING_COMPANY" "support_email=$BILLING_EMAIL" "company_url=$([[ "$BILLING_FQDN" == billing.* ]] && echo "https://${BILLING_FQDN#billing.}" || echo "")"
if [[ -n "${BILLING_MONOPAY_TOKEN:-}" ]]; then
    artisan billing:set "monopay_token=$BILLING_MONOPAY_TOKEN"
fi
ok "Administrator $BILLING_EMAIL created"

PANEL_STATUS="not connected"
if yes_no "$BILLING_CONNECT_PANEL"; then
    if CREDS="$(sudo -u www-data php "$PANEL_DIR/artisan" raptor:billing:connect --url="$SCHEME://$BILLING_FQDN" --json --no-interaction 2>>"$LOG_FILE" | tail -n 1)" && [[ "$CREDS" == \{* ]]; then
        PANEL_URL="$(php -r 'echo json_decode($argv[1], true)["panel_url"];' "$CREDS")"
        PANEL_KEY="$(php -r 'echo json_decode($argv[1], true)["key"];' "$CREDS")"
        PANEL_SECRET="$(php -r 'echo json_decode($argv[1], true)["webhook_secret"];' "$CREDS")"
        echo "+ php artisan billing:connect-panel --url=$PANEL_URL --key=*** --secret=***" >>"$LOG_FILE"
        sudo -u www-data php "$DIR/artisan" billing:connect-panel --url="$PANEL_URL" --key="$PANEL_KEY" --secret="$PANEL_SECRET" --no-interaction >>"$LOG_FILE" 2>&1 || true
        sudo -u www-data php "$DIR/artisan" billing:import-plans --no-interaction >>"$LOG_FILE" 2>&1 || warn "Plans were not imported, use Admin → Plans → Import later."
        PANEL_STATUS="connected to $PANEL_URL"
        ok "Raptor Panel connected: API key, webhook and the Billing link in the Panel menu"
    else
        warn "Could not connect to the Panel automatically, do it later in Admin → Settings."
    fi
fi

artisan config:cache
artisan route:cache
artisan view:cache

step "Queue worker and scheduler"
cat >/etc/systemd/system/raptor-billing-queue.service <<UNIT
[Unit]
Description=Raptor Billing queue worker
After=redis-server.service mariadb.service

[Service]
User=www-data
Group=www-data
Restart=always
ExecStart=/usr/bin/php $DIR/artisan queue:work --sleep=3 --tries=3 --max-time=3600
StartLimitInterval=180
StartLimitBurst=30
RestartSec=5s

[Install]
WantedBy=multi-user.target
UNIT
run systemctl daemon-reload
run systemctl enable --now raptor-billing-queue.service

# Only this installation's line is replaced, the Panel's scheduler line stays.
CRON_LINE="* * * * * php $DIR/artisan schedule:run >> /dev/null 2>&1"
(crontab -u www-data -l 2>/dev/null | grep -vF "$DIR/artisan schedule:run" || true; echo "$CRON_LINE") | crontab -u www-data -
ok "Renewals, reminders and updates run on their own"

# ---------------------------------------------------------------------------------------------
# Web server
# ---------------------------------------------------------------------------------------------

step "Web server"
# The default site only goes away on a clean server, never next to other sites.
[[ -L /etc/nginx/sites-enabled/default && ! -e /etc/nginx/sites-enabled/raptor.conf ]] && rm -f /etc/nginx/sites-enabled/default

cat >/etc/nginx/sites-available/raptor-billing.conf <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $BILLING_FQDN;

    root $DIR/public;
    index index.php;

    access_log /var/log/nginx/raptor-billing-access.log;
    error_log  /var/log/nginx/raptor-billing-error.log error;

    client_max_body_size 20m;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;

    location /build/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \.php\$ {
        fastcgi_pass unix:/run/php/php$PHP_VERSION-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        fastcgi_param HTTP_PROXY "";
        fastcgi_read_timeout 120;
    }

    location ~ /\.(?!well-known) {
        deny all;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/raptor-billing.conf /etc/nginx/sites-enabled/raptor-billing.conf
run nginx -t
run systemctl reload nginx

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
    run ufw allow 80/tcp
    run ufw allow 443/tcp
fi
ok "nginx serves $BILLING_FQDN"

step "HTTPS"
if yes_no "$BILLING_SSL"; then
    run apt-get install -y certbot python3-certbot-nginx
    if certbot --nginx -d "$BILLING_FQDN" --redirect --non-interactive --agree-tos -m "$BILLING_EMAIL" >>"$LOG_FILE" 2>&1; then
        ok "Certificate issued, renews automatically"
    else
        warn "No certificate: make sure $BILLING_FQDN points to $PUBLIC_IP and port 80 is open,"
        warn "then run: certbot --nginx -d $BILLING_FQDN"
        SCHEME="http"
        set_env APP_URL "http://$BILLING_FQDN"
        artisan config:cache
    fi
else
    info "Skipped."
fi

# ---------------------------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------------------------

cat >"$CREDENTIALS_FILE" <<CREDS
Raptor Billing
==============
Address:         $SCHEME://$BILLING_FQDN
Admin area:      $SCHEME://$BILLING_FQDN/admin
Admin login:     $BILLING_EMAIL
Admin password:  $BILLING_ADMIN_PASSWORD
Database:        billing / billing / $DB_PASSWORD
Raptor Panel:    $PANEL_STATUS
MonoPay webhook: $SCHEME://$BILLING_FQDN/webhooks/monopay (sent with every payment, nothing to set)
Panel webhook:   $SCHEME://$BILLING_FQDN/webhooks/raptor
Directory:       $DIR
Install log:     $LOG_FILE
CREDS
chmod 600 "$CREDENTIALS_FILE"

ELAPSED=$((SECONDS - STARTED_AT))
printf '\n%s%s✔ Raptor Billing is ready%s %s(%dm %ds)%s\n\n' "$GREEN" "$BOLD" "$RESET" "$DIM" $((ELAPSED / 60)) $((ELAPSED % 60)) "$RESET"
printf '   Open      %s%s://%s/admin%s\n' "$BOLD" "$SCHEME" "$BILLING_FQDN" "$RESET"
printf '   Login     %s\n' "$BILLING_EMAIL"
if ((GENERATED_PASSWORD)); then
    printf '   Password  %s%s%s  (generated, save it)\n' "$BOLD" "$BILLING_ADMIN_PASSWORD" "$RESET"
fi
printf '\n   Next steps:\n'
[[ -z "${BILLING_MONOPAY_TOKEN:-}" ]] && printf '   • Admin → Settings: paste the plata by mono token\n'
[[ "$PANEL_STATUS" == "not connected" ]] && printf '   • Admin → Settings: connect Raptor Panel (URL, API key, webhook secret)\n'
printf '   • Admin → Plans: import packages from the Panel, set prices, switch them on\n'
printf '   • Put "Buy" buttons on your site: %s://%s/checkout/<plan>?period=1\n' "$SCHEME" "$BILLING_FQDN"
printf '\n   Everything above is saved in %s\n\n' "$CREDENTIALS_FILE"
