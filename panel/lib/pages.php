<?php
declare(strict_types=1);

const CMS_REVISIONS_KEPT = 25;
const CMS_PAGE_SIZE = 40;

function cms_catalog(): array
{
    $raw = @file_get_contents(dirname(__DIR__) . '/catalog.json');
    $data = $raw === false ? null : json_decode($raw, true);
    return is_array($data) && isset($data['pages']) ? $data['pages'] : [];
}

function cms_require_key(string $path): string
{
    $key = cms_key_from_path($path);
    if ($key === null) {
        throw new CmsError('آدرس فقط می‌تواند صفحهٔ قیمت یا مبدل باشد.');
    }
    return $key;
}

function cms_status(?array $record): string
{
    if (!$record) {
        return 'auto';
    }
    if ($record['published_html'] === null) {
        return 'draft';
    }
    return $record['draft_html'] === $record['published_html'] ? 'published' : 'changed';
}

function cms_guess_page(string $key): array
{
    $path = cms_path_from_key($key);
    foreach (cms_catalog() as $page) {
        if ($page['path'] === $path) {
            return $page;
        }
    }
    return ['path' => $path, 'title' => $path, 'type' => str_starts_with($key, 'convert') ? 'convert' : (substr_count($key, '/') === 2 ? 'asset' : 'category')];
}

function cms_normalize_search(string $text): string
{
    return mb_strtolower(strtr($text, ['ي' => 'ی', 'ك' => 'ک', "\u{200c}" => ' ']));
}

function cms_list_pages(array $query): array
{
    $index = cms_read('index', []);
    $rows = [];
    $seen = [];
    foreach (cms_catalog() as $page) {
        $seen[$page['path']] = true;
        $rows[] = $page;
    }
    foreach (array_keys($index) as $key) {
        $path = cms_path_from_key((string) $key);
        if (!isset($seen[$path])) {
            $rows[] = cms_guess_page((string) $key);
        }
    }

    $term = cms_normalize_search(trim((string) ($query['q'] ?? '')));
    $type = (string) ($query['type'] ?? '');
    $status = (string) ($query['status'] ?? '');
    $filtered = [];
    foreach ($rows as $row) {
        $key = trim($row['path'], '/');
        $meta = $index[$key] ?? null;
        $row['status'] = $meta['status'] ?? 'auto';
        $row['updated_at'] = $meta['updated_at'] ?? null;
        $row['updated_by'] = $meta['updated_by'] ?? null;
        if ($type !== '' && $row['type'] !== $type) {
            continue;
        }
        if ($status !== '' && $row['status'] !== $status) {
            continue;
        }
        if ($term !== '' && !str_contains(cms_normalize_search($row['title'] . ' ' . $row['path']), $term)) {
            continue;
        }
        $filtered[] = $row;
    }

    /* صفحه‌هایی که تازه ویرایش شده‌اند بالای فهرست می‌آیند. */
    usort($filtered, static fn (array $a, array $b): int => strcmp((string) ($b['updated_at'] ?? ''), (string) ($a['updated_at'] ?? '')));

    $page = max(1, (int) ($query['page'] ?? 1));
    $total = count($filtered);
    return [
        'items' => array_slice($filtered, ($page - 1) * CMS_PAGE_SIZE, CMS_PAGE_SIZE),
        'total' => $total,
        'page' => $page,
        'pages' => max(1, (int) ceil($total / CMS_PAGE_SIZE)),
    ];
}

/* متن فعلی صفحه نقطهٔ شروع ویرایش است. بندهایی که با نرخ لحظه‌ای پر
   می‌شوند کنار می‌روند چون متن ثابت خیلی زود کهنه می‌شود. */
function cms_auto_content(string $key): string
{
    $html = cms_base_html($key);
    if ($html === null || !preg_match('~<section class="(?:pair-content|asset-content)"[^>]*>(.*?)</section>~s', $html, $match)) {
        return '';
    }
    $content = $match[1];
    foreach ([
        '~<p id="pair-content-rate">.*?</p>~s',
        '~<p class="pair-links">.*?</p>~s',
        '~<p id="asset-(?:content-lead|about-text|usage-text)">.*?</p>~s',
    ] as $pattern) {
        $content = (string) preg_replace($pattern, '', $content);
    }
    return cms_sanitize($content);
}

function cms_page_view(string $key): array
{
    $record = cms_read(cms_page_store_name($key));
    $revisions = [];
    foreach (array_reverse($record['revisions'] ?? []) as $revision) {
        $revisions[] = ['id' => $revision['id'], 'at' => $revision['at'], 'by' => $revision['by'], 'action' => $revision['action']];
    }
    $status = cms_status($record);
    return [
        'page' => cms_guess_page($key),
        'status' => $status,
        'version' => $record['version'] ?? 0,
        'html' => $record ? $record['draft_html'] : cms_auto_content($key),
        'from_auto' => $record === null,
        'published_at' => $record['published_at'] ?? null,
        'updated_at' => $record['updated_at'] ?? null,
        'updated_by' => $record['updated_by'] ?? null,
        'revisions' => $revisions,
    ];
}

function cms_add_revision(array &$record, string $html, string $action, array $actor): void
{
    $last = end($record['revisions']);
    if ($last && $last['html'] === $html && $last['action'] === $action) {
        return;
    }
    $record['revisions'][] = ['id' => bin2hex(random_bytes(6)), 'html' => $html, 'at' => gmdate('c'), 'by' => $actor['display_name'], 'action' => $action];
    $record['revisions'] = array_slice($record['revisions'], -CMS_REVISIONS_KEPT);
}

function cms_update_index(string $key, string $status, array $actor): void
{
    cms_locked('index', static function () use ($key, $status, $actor): void {
        $index = cms_read('index', []);
        $index[$key] = ['status' => $status, 'updated_at' => gmdate('c'), 'updated_by' => $actor['display_name']];
        cms_write('index', $index);

        /* مبدل بدون رفرش جفت را عوض می‌کند و این فهرست به آن می‌گوید
           کدام جفت‌ها باید از سرور با متن دستی‌شان بار شوند. */
        $pairs = [];
        foreach ($index as $indexKey => $meta) {
            if (str_starts_with((string) $indexKey, 'convert/') && in_array($meta['status'], ['published', 'changed'], true)) {
                $pairs[] = cms_path_from_key((string) $indexKey);
            }
        }
        cms_atomic_write(CMS_MEDIA . '/custom-pairs.json', (string) json_encode($pairs));
    });
}

/* ذخیره و انتشار یک مسیر دارند؛ نسخهٔ پایه جلوی بازنویسی کار نفر دیگری
   را می‌گیرد که هم‌زمان همین صفحه را ویرایش کرده است. */
function cms_save_page(string $key, string $html, int $baseVersion, bool $publish, array $actor): array
{
    $clean = cms_sanitize($html);
    if ($publish && cms_plain_text($clean) === '' && !preg_match('/<(img|video|audio)\b/i', $clean)) {
        throw new CmsError('محتوای خالی منتشر نمی‌شود. برای بازگشت به متن خودکار، انتشار را بردارید.');
    }

    cms_locked('page-' . md5($key), static function () use ($key, $clean, $baseVersion, $publish, $actor): void {
        $record = cms_read(cms_page_store_name($key)) ?? [
            'key' => $key, 'version' => 0, 'draft_html' => '', 'published_html' => null, 'revisions' => [],
        ];
        if ((int) $record['version'] !== $baseVersion) {
            throw new CmsError('این صفحه هم‌زمان توسط ' . ($record['updated_by'] ?? 'کاربر دیگری') . ' تغییر کرده است. صفحه را دوباره باز کنید.', 409);
        }

        $record['version'] = (int) $record['version'] + 1;
        $record['draft_html'] = $clean;
        $record['updated_at'] = gmdate('c');
        $record['updated_by'] = $actor['display_name'];
        cms_add_revision($record, $clean, $publish ? 'publish' : 'draft', $actor);

        if ($publish) {
            cms_atomic_write(cms_published_file($key), CMS_GUARD . $clean);
            $record['published_html'] = $clean;
            $record['published_at'] = gmdate('c');
            $record['published_by'] = $actor['display_name'];
        }
        cms_write(cms_page_store_name($key), $record);
        cms_update_index($key, cms_status($record), $actor);
    });
    return cms_page_view($key);
}

function cms_unpublish_page(string $key, array $actor): array
{
    cms_locked('page-' . md5($key), static function () use ($key, $actor): void {
        $record = cms_read(cms_page_store_name($key));
        if (!$record || $record['published_html'] === null) {
            throw new CmsError('این صفحه منتشر نشده است.', 409);
        }
        @unlink(cms_published_file($key));
        $record['version'] = (int) $record['version'] + 1;
        $record['published_html'] = null;
        $record['published_at'] = null;
        $record['updated_at'] = gmdate('c');
        $record['updated_by'] = $actor['display_name'];
        cms_add_revision($record, $record['draft_html'], 'unpublish', $actor);
        cms_write(cms_page_store_name($key), $record);
        cms_update_index($key, cms_status($record), $actor);
    });
    return cms_page_view($key);
}

function cms_revision_html(string $key, string $id): string
{
    $record = cms_read(cms_page_store_name($key));
    foreach ($record['revisions'] ?? [] as $revision) {
        if ($revision['id'] === $id) {
            return $revision['html'];
        }
    }
    throw new CmsError('نسخهٔ موردنظر پیدا نشد.', 404);
}

function cms_pages_using_media(string $url): array
{
    $found = [];
    foreach (array_keys(cms_read('index', [])) as $key) {
        $record = cms_read(cms_page_store_name((string) $key));
        if ($record && (str_contains((string) $record['draft_html'], $url) || str_contains((string) $record['published_html'], $url))) {
            $found[] = cms_path_from_key((string) $key);
        }
    }
    return $found;
}
