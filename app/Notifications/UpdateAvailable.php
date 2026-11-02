<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class UpdateAvailable extends Notification
{
    public function __construct(private array $release, private string $current) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Raptor Billing '.$this->release['tag'].' доступний')
            ->line('Вийшла нова версія білінгу: '.$this->release['tag'].' (у вас '.$this->current.').')
            ->line('Перед оновленням робиться резервна копія файлів і бази, при помилці все повертається автоматично.')
            ->action('Відкрити оновлення', route('admin.updates'));
    }
}
