<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Money is stored in minor units (kopecks, cents) as integers, never as floats.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_admin')->default(false)->after('email');
            $table->char('currency', 3)->default('UAH')->after('is_admin');
            $table->bigInteger('balance')->default(0)->after('currency');
            $table->string('wallet_id', 64)->nullable()->unique()->after('balance');
            $table->timestamp('suspended_at')->nullable();
        });

        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('category')->default('Game servers');
            $table->text('description')->nullable();
            $table->json('features')->nullable();
            $table->string('panel_package');
            $table->boolean('active')->default(true);
            $table->boolean('featured')->default(false);
            $table->unsignedInteger('sort')->default(0);
            $table->timestamps();
        });

        Schema::create('plan_prices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('plan_id')->constrained()->cascadeOnDelete();
            $table->char('currency', 3);
            $table->unsignedTinyInteger('period_months');
            $table->unsignedBigInteger('amount');
            $table->unique(['plan_id', 'currency', 'period_months']);
        });

        Schema::create('promo_codes', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('type', 8); // percent | fixed
            $table->unsignedBigInteger('value');
            $table->char('currency', 3)->nullable();
            $table->unsignedInteger('max_uses')->nullable();
            $table->unsignedInteger('uses')->default(0);
            $table->boolean('first_period_only')->default(true);
            $table->json('plan_ids')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('services', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained()->restrictOnDelete();
            $table->foreignId('next_plan_id')->nullable()->constrained('plans')->nullOnDelete();
            $table->string('name');
            $table->string('status', 16)->default('pending');
            $table->char('currency', 3);
            $table->unsignedBigInteger('amount');
            $table->unsignedTinyInteger('period_months');
            $table->boolean('auto_renew')->default(true);
            $table->timestamp('next_due_at')->nullable();
            $table->unsignedInteger('panel_server_id')->nullable();
            $table->string('panel_identifier', 16)->nullable();
            $table->string('panel_address')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('suspended_at')->nullable();
            $table->timestamp('terminated_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'next_due_at']);
        });

        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->string('number')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('service_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('promo_code_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 16); // order | renewal | upgrade | topup
            $table->string('status', 16)->default('unpaid'); // unpaid | paid | cancelled
            $table->char('currency', 3);
            $table->unsignedBigInteger('subtotal');
            $table->unsignedBigInteger('discount')->default(0);
            $table->unsignedBigInteger('total');
            $table->json('meta')->nullable();
            $table->timestamp('due_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'status']);
        });

        Schema::create('invoice_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->string('description');
            $table->bigInteger('amount');
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->string('provider', 16)->default('monopay');
            $table->string('provider_id')->nullable()->unique();
            $table->string('method', 16)->default('page'); // page | card (saved card)
            $table->string('status', 16)->default('created');
            $table->char('currency', 3);
            $table->unsignedBigInteger('amount');
            $table->string('page_url', 1024)->nullable();
            $table->boolean('save_card')->default(false);
            $table->boolean('credited')->default(false);
            $table->string('failure_reason')->nullable();
            $table->timestamp('provider_modified_at', 6)->nullable();
            $table->json('payload')->nullable();
            $table->timestamps();
        });

        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->char('currency', 3);
            $table->bigInteger('amount');
            $table->bigInteger('balance_after');
            $table->string('type', 16); // topup | charge | refund | adjustment
            $table->string('description');
            $table->foreignId('invoice_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('payment_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('admin_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['user_id', 'id']);
        });

        Schema::create('cards', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('token')->unique();
            $table->string('masked_pan', 32);
            $table->boolean('autopay')->default(true);
            $table->timestamp('last_failed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->text('value')->nullable();
        });
    }

    public function down(): void
    {
        foreach (['settings', 'cards', 'transactions', 'payments', 'invoice_items', 'invoices', 'services', 'promo_codes', 'plan_prices', 'plans'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn(['is_admin', 'currency', 'balance', 'wallet_id', 'suspended_at']));
    }
};
