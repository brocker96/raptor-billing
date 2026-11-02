<?php

namespace App\Notifications;

use App\Models\Invoice;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class InvoicePaid extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Invoice $invoice) {}

    public function via(): array
    {
        return ['mail'];
    }

    public function toMail(): MailMessage
    {
        return (new MailMessage)
            ->subject('Рахунок '.$this->invoice->number.' сплачено')
            ->line('Дякуємо! Рахунок '.$this->invoice->number.' на суму '.$this->invoice->money()->format($this->invoice->total).' сплачено.')
            ->action('Переглянути рахунок', route('invoices.show', $this->invoice));
    }
}
