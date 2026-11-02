# Raptor Billing

Billing for game server hosting on [Raptor Panel](https://github.com/brocker96/raptor-panel). Customers pick a plan, pay with plata by mono, and the server appears in the panel by itself. After that, renewals, reminders, suspensions and deletions run on their own.

Laravel 13 + React (Inertia), the same stack as the panel. The interface is in Ukrainian.

| Checkout | Client area | Admin |
|---|---|---|
| ![](docs/screenshots/checkout.png) | ![](docs/screenshots/dashboard.png) | ![](docs/screenshots/admin.png) |

## What it does

- **Checkout from any website.** Link a "Buy" button straight to the payment page:
  `https://billing.example.com/checkout/minecraft-4gb?period=3`
  Optional `&promo=CODE` and `&currency=USD`. The visitor fills in full name, phone and email and presses one button. An account is created, the MonoPay page opens, and a "set your password" email arrives. In the admin area, under **Plans → Link**, the link is copied for you.
- **Balance + auto-renewal.** Every payment lands on the balance and invoices are paid from it. A saved card (MonoPay wallet) pays renewals automatically when the balance is short.
- **Automation (hourly):**
  - renewal invoice N days before the end of the period;
  - payment from balance or card;
  - suspension with a reason and a "pay" button shown in the panel;
  - deletion after N days;
  - abandoned orders cancelled after 7 days.
- **Panel integration** through the Raptor API:
  - provisioning with idempotency;
  - suspend / unsuspend / delete;
  - upgrade (prorated, applied immediately) and downgrade (from the next period);
  - one-click login into the panel;
  - live server load;
  - panel webhooks.
- **Admin:**
  - revenue and MRR;
  - clients and balance adjustments;
  - services with manual actions;
  - invoices (mark paid / cancel) and payments;
  - plans with prices per currency and period, plus import from panel packages;
  - promo codes;
  - settings with connection tests.
- Currencies: UAH, USD, EUR (one per customer).

## Install

Requirements: PHP 8.3+, Composer, Node 20+, MariaDB/MySQL (or PostgreSQL), Redis optional.

```bash
git clone https://github.com/brocker96/raptor-billing.git /var/www/billing
cd /var/www/billing
composer install --no-dev --optimize-autoloader
npm ci && npm run build
cp .env.example .env && php artisan key:generate
# set APP_URL, DB_*, MAIL_* in .env
php artisan migrate --force
php artisan billing:admin you@example.com   # after registering, makes the account an admin
```

Cron (automation runs hourly):

```
* * * * * cd /var/www/billing && php artisan schedule:run >> /dev/null 2>&1
```

Queue worker (provisioning and mail), e.g. as a systemd service:

```
php artisan queue:work --tries=3 --max-time=3600
```

Point nginx at `public/`, the same way as for any Laravel app.

## Connect

Open **Admin → Settings**:

1. **Raptor Panel.**
   - In the panel go to Admin → Raptor API, create a key with `servers: write` and `users: write`. Paste the panel URL and the key, then press "Перевірити".
   - Add a panel webhook to the URL shown in the settings and paste its secret.
2. **plata by mono.** Get the token from web.monobank.ua → Settings → API (test token: api.monobank.ua). The MonoPay webhook URL is sent with every invoice, so nothing to configure there.
3. **Plans.** Click "Імпорт з панелі" to create plans from panel packages, set prices and turn them on.

Demo data for a first look: `php artisan db:seed --class=DemoSeeder` (admin@example.com / client@example.com, password `password`).

## Development

```bash
composer install && npm install
php artisan migrate --seed --seeder=DemoSeeder
composer run dev
php artisan test
```

## License

MIT.
