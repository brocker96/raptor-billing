<?php

namespace App\Updates;

use Carbon\CarbonImmutable;
use Illuminate\Filesystem\Filesystem;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;

/**
 * Installs releases of Raptor Billing in place and rolls them back again.
 *
 * Every update starts with a backup of the code, the .env file and the database. When any step of
 * the update fails the backup is restored automatically, so a failed update never leaves billing
 * half upgraded. Updates requested from the admin area are queued in a state file and picked up by
 * the scheduler, which runs as the same user as the web server and with the CLI PHP binary.
 */
class Updater
{
    public const IDLE = 'idle';

    public const QUEUED = 'queued';

    public const RUNNING = 'running';

    public const COMPLETED = 'completed';

    public const FAILED = 'failed';

    /**
     * Directories holding code that are replaced by a release or a backup. Everything else, most
     * importantly storage/ and .env, is left untouched.
     */
    private const CODE = ['app', 'bootstrap', 'config', 'database', 'resources', 'routes', 'public/build'];

    /** @var callable|null */
    private $output;

    public function __construct(private Filesystem $files, private ReleaseFeed $feed) {}

    public function path(string $append = ''): string
    {
        return storage_path('app/updates'.($append ? '/'.ltrim($append, '/') : ''));
    }

    /**
     * Sends every log line to the callback as well, used by the console command.
     */
    public function onOutput(?callable $output): self
    {
        $this->output = $output;

        return $this;
    }

    public function state(): array
    {
        $state = rescue(fn () => json_decode($this->files->get($this->path('state.json')), true), null, false);

        return array_merge([
            'status' => self::IDLE,
            'action' => null,
            'target' => null,
            'step' => null,
            'error' => null,
            'requested_by' => null,
            'requested_at' => null,
            'started_at' => null,
            'finished_at' => null,
            'from' => null,
            'backup' => null,
        ], is_array($state) ? $state : []);
    }

    public function busy(): bool
    {
        $state = $this->state();

        if ($state['status'] === self::RUNNING && $state['started_at']) {
            // A worker that died without writing its result must not block updates forever.
            return CarbonImmutable::parse($state['started_at'])->gt(now()->subHour());
        }

        return $state['status'] === self::QUEUED;
    }

    public function log(int $lines = 400): string
    {
        $path = $this->path('update.log');
        if (! $this->files->exists($path)) {
            return '';
        }

        return implode("\n", array_slice(explode("\n", rtrim($this->files->get($path))), -$lines));
    }

    /**
     * Queues an update or rollback for the scheduler.
     */
    public function request(string $action, string $target, ?string $user = null): array
    {
        if ($this->busy()) {
            throw new UpdateException('Інше оновлення вже в черзі або виконується.');
        }

        $this->files->ensureDirectoryExists($this->path());
        $this->files->put($this->path('update.log'), '');

        return $this->write([
            'status' => self::QUEUED,
            'action' => $action,
            'target' => $target,
            'step' => 'Чекаємо, поки планувальник візьме оновлення (до хвилини)',
            'error' => null,
            'requested_by' => $user,
            'requested_at' => now()->toAtomString(),
            'started_at' => null,
            'finished_at' => null,
            'from' => $this->feed->current(),
            'backup' => null,
        ]);
    }

    public function cancel(): void
    {
        if ($this->state()['status'] !== self::QUEUED) {
            throw new UpdateException('Скасувати можна лише оновлення в черзі.');
        }

        $this->write(['status' => self::IDLE, 'step' => null]);
    }

    /**
     * Runs a queued request, returns false when there was nothing to do.
     */
    public function runPending(): bool
    {
        $state = $this->state();
        if ($state['status'] !== self::QUEUED) {
            return false;
        }

        $state['action'] === 'rollback' ? $this->rollback($state['target']) : $this->install($state['target']);

        return true;
    }

    /**
     * Installs the given release, any failure restores the backup made before.
     */
    public function install(string $version): void
    {
        $this->begin('install', $version);
        $backup = null;
        $touched = false;

        try {
            $release = $this->feed->find($version);
            if (! $release || ! $release['archive']) {
                throw new UpdateException("Реліз $version не знайдено або в ньому немає billing.tar.gz.");
            }

            $this->checkRequirements();

            $this->step('Завантаження релізу '.$release['tag']);
            $archive = $this->download($release);

            $this->step('Резервна копія файлів і бази даних');
            $backup = $this->backup();
            $this->write(['backup' => $backup]);

            $this->step('Режим обслуговування');
            $this->artisan(['down', '--retry=15']);

            $this->step('Заміна файлів');
            $cached = $this->files->exists(base_path('bootstrap/cache/config.php'));
            $touched = true;
            $this->replaceCode($archive, keepVendor: true);

            $this->finish($cached);
            $this->files->delete($archive);
            $this->prune();
            $this->succeed("Raptor Billing оновлено до $version.");
        } catch (\Throwable $exception) {
            $this->line('ERROR: '.$exception->getMessage());

            if ($touched && $backup) {
                $this->line('Restoring the backup made before the update…');
                try {
                    $this->restore($backup, database: true);
                    $this->fail($exception, 'Оновлення не вдалося, попередню версію відновлено.');
                } catch (\Throwable $restore) {
                    $this->line('ERROR: '.$restore->getMessage());
                    $this->fail($restore, "Оновлення не вдалося, і відновлення копії $backup теж. Відновіть вручну: php artisan billing:update --rollback=$backup");
                }
            } else {
                $this->artisan(['up'], false);
                $this->fail($exception, 'Оновлення не вдалося ще до зміни файлів, нічого не змінено.');
            }
        }
    }

    /**
     * Restores a backup made before an earlier update, including its database.
     */
    public function rollback(string $backup): void
    {
        $this->begin('rollback', $backup);

        try {
            if (! $this->files->isDirectory($this->path("backups/$backup"))) {
                throw new UpdateException("Копії $backup не існує.");
            }

            $this->restore($backup, database: true);
            $this->succeed('Копію '.$backup.' відновлено.');
        } catch (\Throwable $exception) {
            $this->line('ERROR: '.$exception->getMessage());
            $this->artisan(['up'], false);
            $this->fail($exception, 'Відкат не вдався.');
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function backups(): array
    {
        if (! $this->files->isDirectory($this->path('backups'))) {
            return [];
        }

        return collect($this->files->directories($this->path('backups')))
            ->map(function (string $directory) {
                $meta = rescue(fn () => json_decode($this->files->get("$directory/meta.json"), true), [], false);

                return [
                    'id' => basename($directory),
                    'version' => $meta['version'] ?? 'unknown',
                    'created_at' => $meta['created_at'] ?? null,
                    'size' => collect($this->files->files($directory))->sum(fn ($file) => $file->getSize()),
                    'database' => $this->files->exists("$directory/database.sql.gz"),
                ];
            })
            ->sortByDesc('id')
            ->values()
            ->all();
    }

    /**
     * Backs up the code, the .env file and the database, returns the identifier of the backup.
     */
    public function backup(): string
    {
        $id = now()->format('Ymd-His').'-'.Str::slug($this->feed->current());
        $directory = $this->path("backups/$id");
        $this->files->ensureDirectoryExists($directory);

        try {
            $this->run([
                'tar', '-czf', "$directory/files.tar.gz",
                '--exclude=./storage', '--exclude=./node_modules', '--exclude=./.git',
                '-C', base_path(), '.',
            ]);

            $this->dumpDatabase("$directory/database.sql.gz");
        } catch (\Throwable $exception) {
            $this->files->deleteDirectory($directory);

            throw $exception;
        }

        $this->files->put("$directory/meta.json", json_encode([
            'version' => $this->feed->current(),
            'created_at' => now()->toAtomString(),
        ]));

        $this->line("Backup stored in $directory");

        return $id;
    }

    private function restore(string $backup, bool $database): void
    {
        $directory = $this->path("backups/$backup");

        $this->step('Режим обслуговування');
        $this->artisan(['down', '--retry=15'], false);

        // The database goes first, while the code loaded by this process is still on disk.
        if ($database && $this->files->exists("$directory/database.sql.gz")) {
            $this->step('Відновлення бази даних');
            $this->restoreDatabase("$directory/database.sql.gz");
        }

        $this->step('Відновлення файлів з копії '.$backup);
        $this->replaceCode("$directory/files.tar.gz", keepVendor: false);

        $this->step('Очищення кешів');
        $this->artisan(['optimize:clear'], false);
        $this->artisan(['queue:restart'], false);
        $this->artisan(['up'], false);
    }

    /**
     * Removes the code directories and unpacks the archive over the installation.
     */
    private function replaceCode(string $archive, bool $keepVendor): void
    {
        $listing = $this->run(['tar', '-tzf', $archive], quiet: true);
        foreach (['artisan', 'config/billing.php', 'bootstrap/app.php', 'public/build/manifest.json'] as $required) {
            if (! preg_match('#^(\./)?'.preg_quote($required, '#').'$#m', $listing)) {
                throw new UpdateException("Архів не схожий на реліз Raptor Billing, немає $required.");
            }
        }

        $directories = $keepVendor ? self::CODE : [...self::CODE, 'vendor'];
        foreach ($directories as $directory) {
            $this->files->deleteDirectory(base_path($directory));
        }

        $this->run(['tar', '-xzf', $archive, '-C', base_path(), '--exclude=.env', '--exclude=./.env', '--no-same-owner']);
        $this->files->ensureDirectoryExists(base_path('bootstrap/cache'));
    }

    /**
     * Refuses release archives that could write outside the installation: absolute paths, ".."
     * in a path, and links that point outside the directory they are unpacked in. Backups made
     * by the updater itself are not checked, they hold the links of the installation.
     */
    private function assertSafeArchive(string $archive): void
    {
        foreach (preg_split('/\R/', trim($this->run(['tar', '-tzf', $archive], quiet: true))) as $entry) {
            if (str_starts_with($entry, '/') || in_array('..', explode('/', $entry), true)) {
                throw new UpdateException("Архів містить небезпечний шлях: $entry");
            }
        }

        $verbose = $this->run(['tar', '-tvzf', $archive], quiet: true);
        foreach (preg_split('/\R/', trim($verbose)) as $line) {
            if (! in_array($line[0] ?? '', ['l', 'h'], true)) {
                continue;
            }

            $target = trim((string) preg_replace('/^.*? (?:->|link to) /', '', $line));
            if (str_starts_with($target, '/') || in_array('..', explode('/', $target), true)) {
                throw new UpdateException("Архів містить посилання за межі каталогу: $line");
            }
        }
    }

    /**
     * Runs the usual post-update commands. These run in new processes as the code of this one
     * was replaced.
     */
    private function finish(bool $cache): void
    {
        $this->step('Встановлення PHP-залежностей');
        $composer = (new ExecutableFinder)->find('composer', null, ['/usr/local/bin', '/usr/bin']);
        if (! $composer) {
            throw new UpdateException('Composer не знайдено, встановіть його для оновлень.');
        }
        $this->run([PHP_BINARY, $composer, 'install', '--no-dev', '--optimize-autoloader', '--no-interaction', '--no-ansi'], env: [
            'COMPOSER_HOME' => $this->path('composer'),
            'COMPOSER_ALLOW_SUPERUSER' => '1',
        ], timeout: 900);

        $this->step('Міграції бази даних');
        $this->artisan(['optimize:clear']);
        $this->artisan(['migrate', '--force']);
        if ($cache) {
            // The installer caches the configuration, routes and views, keep it that way.
            $this->artisan(['config:cache']);
            $this->artisan(['route:cache']);
            $this->artisan(['view:cache']);
        }

        $this->step('Перезапуск обробника черги');
        $this->artisan(['queue:restart']);
        $this->fixOwnership();
        $this->artisan(['up']);
    }

    private function download(array $release): string
    {
        $this->files->ensureDirectoryExists($this->path('downloads'));
        $target = $this->path('downloads/'.Str::slug($release['tag']).'.tar.gz');

        foreach (['archive', 'checksum'] as $key) {
            if (! is_string($release[$key] ?? null) || ! str_starts_with($release[$key], 'https://')) {
                throw new UpdateException("У релізі немає HTTPS-посилання $key, оновлення ставляться лише з перевіреною контрольною сумою.");
            }
        }

        $this->line('GET '.$release['archive']);
        Http::timeout(600)->withHeaders(['User-Agent' => 'Raptor-Billing'])->sink($target)->get($release['archive'])->throw();

        $expected = strtolower(strtok(trim(Http::timeout(30)->get($release['checksum'])->throw()->body()), " \t\n") ?: '');
        $actual = hash_file('sha256', $target);
        if (! hash_equals($expected, $actual)) {
            $this->files->delete($target);

            throw new UpdateException("Контрольна сума не збігається: очікували $expected, отримали $actual.");
        }
        $this->line("Checksum verified ($actual)");

        $this->assertSafeArchive($target);

        return $target;
    }

    private function checkRequirements(): void
    {
        foreach ($this->usesMysql() ? ['tar', 'gzip', 'mysqldump', 'mysql'] : ['tar', 'gzip'] as $binary) {
            if (! (new ExecutableFinder)->find($binary)) {
                throw new UpdateException("Для оновлення потрібна команда \"$binary\".");
            }
        }

        $free = (int) @disk_free_space(storage_path());
        if ($free && $free < 512 * 1024 * 1024) {
            throw new UpdateException('Для оновлення потрібно щонайменше 512 МБ вільного місця.');
        }

        if (! is_writable(base_path('app')) || ! is_writable(base_path())) {
            throw new UpdateException('Файли недоступні для запису користувачу '.(function_exists('posix_geteuid') ? (posix_getpwuid(posix_geteuid())['name'] ?? '?') : '?').', виконайте "chown -R www-data:www-data '.base_path().'".');
        }
    }

    private function usesMysql(): bool
    {
        return in_array(config('database.connections.'.config('database.default').'.driver'), ['mysql', 'mariadb'], true);
    }

    private function dumpDatabase(string $target): void
    {
        if (! $this->usesMysql()) {
            $file = config('database.connections.'.config('database.default').'.database');
            if (is_string($file) && is_file($file)) {
                $this->run(['sh', '-c', 'gzip -c '.escapeshellarg($file).' > '.escapeshellarg($target)], quiet: true);
            }

            return;
        }

        $db = config('database.connections.'.config('database.default'));

        $this->run(['sh', '-c', 'mysqldump --single-transaction --quick --routines --no-tablespaces "$@" | gzip > '.escapeshellarg($target), 'sh', ...$this->databaseArguments($db)], env: ['MYSQL_PWD' => (string) $db['password']], quiet: true);
    }

    private function restoreDatabase(string $source): void
    {
        if (! $this->usesMysql()) {
            $file = config('database.connections.'.config('database.default').'.database');
            $this->run(['sh', '-c', 'gunzip -c '.escapeshellarg($source).' > '.escapeshellarg((string) $file)]);

            return;
        }

        $db = config('database.connections.'.config('database.default'));

        // Tables created by a failed migration are not part of the dump and would break the next
        // attempt, so the database is emptied first.
        $schema = DB::connection()->getSchemaBuilder();
        $schema->dropAllViews();
        $schema->dropAllTables();

        $this->run(['sh', '-c', 'gunzip -c '.escapeshellarg($source).' | mysql "$@"', 'sh', ...$this->databaseArguments($db)], env: ['MYSQL_PWD' => (string) $db['password']]);
    }

    private function databaseArguments(array $db): array
    {
        $arguments = ['--user='.$db['username']];
        if (! empty($db['unix_socket'])) {
            $arguments[] = '--socket='.$db['unix_socket'];
        } else {
            $arguments[] = '--host='.$db['host'];
            $arguments[] = '--port='.$db['port'];
        }
        $arguments[] = $db['database'];

        return $arguments;
    }

    /**
     * Files written while running as root would no longer be writable by the web server.
     */
    private function fixOwnership(): void
    {
        if (! function_exists('posix_geteuid') || posix_geteuid() !== 0) {
            return;
        }

        $owner = posix_getpwuid(fileowner(base_path('storage')))['name'] ?? 'www-data';
        $group = posix_getgrgid(filegroup(base_path('storage')))['name'] ?? 'www-data';
        $this->run(['chown', '-R', "$owner:$group", base_path()], quiet: true);
    }

    /**
     * Keeps the configured number of backups, the newest ones survive.
     */
    private function prune(): void
    {
        $keep = max(1, (int) config('billing.updates.keep_backups', 3));

        foreach (array_slice($this->backups(), $keep) as $backup) {
            $this->files->deleteDirectory($this->path('backups/'.$backup['id']));
            $this->line('Removed old backup '.$backup['id']);
        }
    }

    private function artisan(array $arguments, bool $throw = true): void
    {
        try {
            $this->run([PHP_BINARY, base_path('artisan'), ...$arguments, '--no-interaction'], timeout: 900);
        } catch (\Throwable $exception) {
            if ($throw) {
                throw $exception;
            }
        }
    }

    private function run(array $command, array $env = [], int $timeout = 600, bool $quiet = false): string
    {
        $this->line('$ '.implode(' ', array_map(fn ($part) => str_contains($part, ' ') ? escapeshellarg($part) : $part, $command)));

        $process = new Process($command, base_path(), $env ?: null, null, $timeout);
        $output = '';
        $process->run(function ($type, $buffer) use (&$output, $quiet) {
            $output .= $buffer;
            if (! $quiet) {
                foreach (explode("\n", rtrim($buffer)) as $line) {
                    $this->line('  '.$line);
                }
            }
        });

        if (! $process->isSuccessful()) {
            if ($quiet) {
                $this->line('  '.trim(Str::limit($process->getErrorOutput() ?: $output, 2000)));
            }

            $name = $command[0] === PHP_BINARY ? basename($command[1]).(isset($command[2]) && str_starts_with($command[2], '-') === false ? ' '.$command[2] : '') : basename($command[0]);
            $reason = collect(explode("\n", $process->getErrorOutput()."\n".$output))
                ->map(fn ($line) => trim($line))
                ->filter(fn ($line) => $line !== '' && ! str_starts_with($line, '#') && ! str_starts_with($line, 'at ') && ! preg_match('/^\d+[▕|]/u', $line))
                ->last();

            throw new UpdateException(sprintf('"%s" failed (exit code %d)%s', $name, $process->getExitCode(), $reason ? ': '.Str::limit($reason, 300) : '.'));
        }

        return $output;
    }

    private function begin(string $action, string $target): void
    {
        // Loaded up front, the files on disk are replaced while the update runs.
        class_exists(UpdateException::class);
        $state = $this->state();
        $this->files->ensureDirectoryExists($this->path());
        if ($state['status'] !== self::QUEUED) {
            $this->files->put($this->path('update.log'), '');
        }

        $this->write([
            'status' => self::RUNNING,
            'action' => $action,
            'target' => $target,
            'error' => null,
            'started_at' => now()->toAtomString(),
            'finished_at' => null,
            'from' => $this->feed->current(),
            'backup' => null,
        ]);
        $this->line(sprintf('%s %s on %s', $action === 'install' ? 'Updating to' : 'Rolling back to backup', $target, now()->toDateTimeString()));
    }

    private function step(string $step): void
    {
        $this->write(['step' => $step]);
        $this->line("==> $step");
    }

    private function succeed(string $message): void
    {
        $this->line($message);
        $this->remember($this->write(['status' => self::COMPLETED, 'step' => $message, 'finished_at' => now()->toAtomString()]));
    }

    /**
     * Keeps the last runs for the history list in the admin area.
     *
     * @return array<int, array<string, mixed>>
     */
    public function history(): array
    {
        $history = rescue(fn () => json_decode($this->files->get($this->path('history.json')), true), [], false);

        return is_array($history) ? $history : [];
    }

    private function remember(array $state): void
    {
        $entry = array_intersect_key($state, array_flip(['status', 'action', 'target', 'from', 'error', 'requested_by', 'started_at', 'finished_at']));
        $this->files->put($this->path('history.json'), json_encode(array_slice([$entry, ...$this->history()], 0, 20), JSON_PRETTY_PRINT));
    }

    private function fail(\Throwable $exception, string $message): void
    {
        $this->line($message);
        $this->remember($this->write([
            'status' => self::FAILED,
            'step' => $message,
            'error' => $exception->getMessage(),
            'finished_at' => now()->toAtomString(),
        ]));
    }

    private function write(array $values): array
    {
        $state = array_merge($this->state(), $values);
        $this->files->ensureDirectoryExists($this->path());
        $this->files->put($this->path('state.json'), json_encode($state, JSON_PRETTY_PRINT));

        return $state;
    }

    private function line(string $line): void
    {
        $this->files->ensureDirectoryExists($this->path());
        $this->files->append($this->path('update.log'), '['.now()->format('H:i:s')."] $line\n");

        if ($this->output) {
            ($this->output)($line);
        }
    }
}
