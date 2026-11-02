<?php

namespace App\Notifications;

use App\Models\Service;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ServiceReady extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Service $service) {}

    public function via(): array
    {
        return ['mail'];
    }

    public function toMail(): MailMessage
    {
        return (new MailMessage)
            ->subject('Сервер '.$this->service->name.' готовий')
            ->line('Ваш сервер '.$this->service->name.' створено.')
            ->line($this->service->panel_address ? 'Адреса для підключення: '.$this->service->panel_address : 'Адреса з’явиться в панелі після встановлення.')
            ->action('Відкрити сервер', route('services.show', $this->service));
    }
}
