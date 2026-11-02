<?php

use App\Http\Controllers\Admin;
use App\Http\Controllers\Client;
use App\Http\Controllers\Webhooks;
use App\Http\Middleware\EnsureAdmin;
use Illuminate\Support\Facades\Route;

Route::get('/', [Client\ShopController::class, 'index'])->name('shop');

Route::get('checkout/{plan:slug}', [Client\CheckoutController::class, 'show'])->name('checkout');
Route::post('checkout/{plan:slug}/quote', [Client\CheckoutController::class, 'quote'])->middleware('throttle:30,1')->name('checkout.quote');
Route::post('checkout/{plan:slug}', [Client\CheckoutController::class, 'store'])->middleware('throttle:6,1')->name('checkout.store');

Route::post('/webhooks/monopay', Webhooks\MonoPayController::class)->name('webhooks.monopay');
Route::post('/webhooks/raptor', Webhooks\RaptorController::class)->name('webhooks.raptor');

// Accounts made at checkout confirm their email through the password link, so the client
// area does not wait for a separate verification.
Route::middleware(['auth'])->group(function () {
    Route::get('dashboard', Client\DashboardController::class)->name('dashboard');

    Route::get('order/{plan:slug}', fn (\App\Models\Plan $plan) => redirect()->route('checkout', [$plan] + request()->query()))->name('order');
    Route::post('order/{plan:slug}/quote', [Client\ShopController::class, 'quote'])->name('order.quote');
    Route::post('order/{plan:slug}', [Client\ShopController::class, 'place'])->middleware('throttle:10,1')->name('order.place');

    Route::get('services', [Client\ServiceController::class, 'index'])->name('services.index');
    Route::get('services/{service}', [Client\ServiceController::class, 'show'])->name('services.show');
    Route::patch('services/{service}', [Client\ServiceController::class, 'update'])->name('services.update');
    Route::post('services/{service}/panel', [Client\ServiceController::class, 'panel'])->middleware('throttle:20,1')->name('services.panel');
    Route::post('services/{service}/plan', [Client\ServiceController::class, 'changePlan'])->name('services.plan');

    Route::get('invoices', [Client\InvoiceController::class, 'index'])->name('invoices.index');
    Route::get('invoices/{invoice}', [Client\InvoiceController::class, 'show'])->name('invoices.show');
    Route::post('invoices/{invoice}/pay', [Client\InvoiceController::class, 'pay'])->middleware('throttle:10,1')->name('invoices.pay');

    Route::get('balance', [Client\BalanceController::class, 'index'])->name('balance');
    Route::post('balance/topup', [Client\BalanceController::class, 'topup'])->middleware('throttle:10,1')->name('balance.topup');
    Route::patch('balance/currency', [Client\BalanceController::class, 'currency'])->name('balance.currency');
    Route::patch('cards/{card}', [Client\BalanceController::class, 'updateCard'])->name('cards.update');
    Route::delete('cards/{card}', [Client\BalanceController::class, 'deleteCard'])->name('cards.destroy');
    Route::get('payments/{payment}/return', [Client\BalanceController::class, 'return'])->name('payments.return');
});

Route::middleware(['auth', 'verified', EnsureAdmin::class])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/', Admin\DashboardController::class)->name('dashboard');

    Route::get('clients', [Admin\ClientController::class, 'index'])->name('clients.index');
    Route::get('clients/{user}', [Admin\ClientController::class, 'show'])->name('clients.show');
    Route::patch('clients/{user}', [Admin\ClientController::class, 'update'])->name('clients.update');
    Route::post('clients/{user}/balance', [Admin\ClientController::class, 'adjust'])->name('clients.balance');

    Route::get('services', [Admin\ServiceController::class, 'index'])->name('services.index');
    Route::get('services/{service}', [Admin\ServiceController::class, 'show'])->name('services.show');
    Route::patch('services/{service}', [Admin\ServiceController::class, 'update'])->name('services.update');
    Route::post('services/{service}/action', [Admin\ServiceController::class, 'action'])->name('services.action');

    Route::get('invoices', [Admin\InvoiceController::class, 'index'])->name('invoices.index');
    Route::post('invoices/{invoice}/paid', [Admin\InvoiceController::class, 'markPaid'])->name('invoices.paid');
    Route::post('invoices/{invoice}/cancel', [Admin\InvoiceController::class, 'cancel'])->name('invoices.cancel');
    Route::get('payments', [Admin\InvoiceController::class, 'payments'])->name('payments');

    Route::get('plans', [Admin\PlanController::class, 'index'])->name('plans.index');
    Route::post('plans', [Admin\PlanController::class, 'store'])->name('plans.store');
    Route::post('plans/import', [Admin\PlanController::class, 'import'])->name('plans.import');
    Route::put('plans/{plan}', [Admin\PlanController::class, 'update'])->name('plans.update');
    Route::delete('plans/{plan}', [Admin\PlanController::class, 'destroy'])->name('plans.destroy');

    Route::get('promo-codes', [Admin\PromoCodeController::class, 'index'])->name('promo.index');
    Route::post('promo-codes', [Admin\PromoCodeController::class, 'store'])->name('promo.store');
    Route::put('promo-codes/{code}', [Admin\PromoCodeController::class, 'update'])->name('promo.update');
    Route::delete('promo-codes/{code}', [Admin\PromoCodeController::class, 'destroy'])->name('promo.destroy');

    Route::get('settings', [Admin\SettingsController::class, 'edit'])->name('settings');
    Route::put('settings', [Admin\SettingsController::class, 'update'])->name('settings.update');
    Route::post('settings/test-panel', [Admin\SettingsController::class, 'testPanel'])->name('settings.panel');
    Route::post('settings/test-monopay', [Admin\SettingsController::class, 'testMonoPay'])->name('settings.monopay');
});

require __DIR__.'/settings.php';
