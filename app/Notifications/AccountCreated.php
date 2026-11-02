<?php

namespace App\Notifications;

use App\Models\Setting;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Sent after a checkout made the account, with a link to choose a password.
 */
class AccountCreated extends Notification
{
    public function __construct(private string $token) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Ваш кабінет '.Setting::get('company_name'))
            ->greeting('Вітаємо, '.$notifiable->name.'!')
            ->line('Ми створили для вас кабінет, у ньому ваші сервери, рахунки та баланс.')
            ->line('Логін: '.$notifiable->email)
            ->action('Встановити пароль', route('password.reset', ['token' => $this->token, 'email' => $notifiable->email]))
            ->line('Посилання діє 60 хвилин. Пізніше пароль можна встановити через «Забули пароль?».');
    }
}
