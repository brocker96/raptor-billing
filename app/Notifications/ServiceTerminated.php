<?php

namespace App\Notifications;

use App\Models\Service;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ServiceTerminated extends Notification implements ShouldQueue
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
            ->subject('Сервер '.$this->service->name.' видалено')
            ->line('Послугу '.$this->service->name.' завершено, сервер видалено.')
            ->line('Якщо це помилка, напишіть у підтримку якомога швидше.')
            ->action('Замовити знову', route('shop'));
    }
}
