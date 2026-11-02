<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ActivityController extends Controller
{
    public const GROUPS = ['auth', 'account', 'order', 'payment', 'service', 'admin'];

    public function index(Request $request): Response
    {
        $group = (string) $request->query('group');
        $search = trim((string) $request->query('search'));

        return Inertia::render('admin/activity', [
            'filters' => ['group' => $group, 'search' => $search],
            'entries' => ActivityLog::query()->with(['user:id,name,email', 'actor:id,name,email,is_admin'])
                ->when(in_array($group, self::GROUPS, true), fn ($q) => $q->where('event', 'like', $group.'.%'))
                ->when($search, fn ($q) => $q->where(fn ($q) => $q->where('description', 'like', "%$search%")->orWhere('ip', $search)
                    ->orWhereHas('user', fn ($u) => $u->where('email', 'like', "%$search%"))))
                ->latest('id')->paginate(40)->withQueryString()
                ->through(fn (ActivityLog $e) => self::present($e)),
        ]);
    }

    public static function present(ActivityLog $e): array
    {
        return [
            'id' => $e->id,
            'event' => $e->event,
            'description' => $e->description,
            'ip' => $e->ip,
            'created_at' => $e->created_at?->toAtomString(),
            'user' => $e->user ? ['id' => $e->user->id, 'name' => $e->user->name, 'email' => $e->user->email] : null,
            'actor' => $e->actor ? ['id' => $e->actor->id, 'name' => $e->actor->name, 'admin' => (bool) $e->actor->is_admin] : null,
        ];
    }
}
