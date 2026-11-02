<?php

namespace App\Notifications;

use App\Models\Invoice;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class InvoiceCreated extends Notification implements ShouldQueue
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
            ->subject('Новий рахунок '.$this->invoice->number)
            ->line('Для вас виставлено рахунок '.$this->invoice->number.' на суму '.$this->invoice->money()->format($this->invoice->total).'.')
            ->line('Сплатити до: '.($this->invoice->due_at?->format('d.m.Y') ?? 'сьогодні').'. Якщо на балансі достатньо коштів, рахунок буде сплачено автоматично.')
            ->action('Сплатити рахунок', route('invoices.show', $this->invoice));
    }
}
