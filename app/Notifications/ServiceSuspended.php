<?php

namespace App\Notifications;

use App\Models\Service;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ServiceSuspended extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Service $service, public string $reason, public ?string $paymentUrl) {}

    public function via(): array
    {
        return ['mail'];
    }

    public function toMail(): MailMessage
    {
        return (new MailMessage)
            ->subject('Сервер '.$this->service->name.' призупинено')
            ->line('Сервер '.$this->service->name.' призупинено. '.$this->reason)
            ->line('Файли збережено. Після оплати сервер запрацює автоматично.')
            ->action('Сплатити', $this->paymentUrl ?? route('services.show', $this->service));
    }
}
