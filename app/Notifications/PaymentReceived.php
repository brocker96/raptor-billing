<?php

namespace App\Notifications;

use App\Billing\Currency;
use App\Models\Payment;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PaymentReceived extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Payment $payment) {}

    public function via(): array
    {
        return ['mail'];
    }

    public function toMail(): MailMessage
    {
        return (new MailMessage)
            ->subject('Баланс поповнено')
            ->line('Ми отримали платіж '.Currency::from($this->payment->currency)->format($this->payment->amount).'.')
            ->line('Поточний баланс: '.$this->payment->user->money()->format($this->payment->user->balance).'.')
            ->action('Відкрити баланс', route('balance'));
    }
}
