<?php
declare(strict_types=1);

/*
 * آپلود تکه‌تکه است: سقف upload_max_filesize و post_max_size هاست
 * اشتراکی معمولاً از یک ویدیو کوچک‌تر است، ولی روی هر تکهٔ یک مگابایتی
 * اثری ندارد. نوع فایل فقط از محتوای واقعی‌اش تعیین می‌شود.
 */

const CMS_CHUNK_SIZE = 1048576;
const CMS_MEDIA_PAGE_SIZE = 48;
const CMS_MEDIA_LIMITS = ['image' => 15728640, 'audio' => 62914560, 'video' => 262144000];
const CMS_MEDIA_TYPES = [
    'image/jpeg' => ['image', 'jpg'],
    'image/png' => ['image', 'png'],
    'image/webp' => ['image', 'webp'],
    'image/gif' => ['image', 'gif'],
    'video/mp4' => ['video', 'mp4'],
    'video/webm' => ['video', 'webm'],
    'audio/mpeg' => ['audio', 'mp3'],
    'audio/mp3' => ['audio', 'mp3'],
    'audio/ogg' => ['audio', 'ogg'],
    'application/ogg' => ['audio', 'ogg'],
    'audio/wav' => ['audio', 'wav'],
    'audio/x-wav' => ['audio', 'wav'],
    'audio/mp4' => ['audio', 'm4a'],
    'audio/x-m4a' => ['audio', 'm4a'],
];

function cms_media_all(): array
{
    return cms_read('media', []);
}

function cms_media_clean_tmp(): void
{
    if (random_int(1, 20) !== 1) {
        return;
    }
    foreach (glob(CMS_DATA . '/tmp/*.part') ?: [] as $file) {
        if (filemtime($file) < time() - 86400) {
            @unlink($file);
        }
    }
}

function cms_media_max_size(): int
{
    return max(CMS_MEDIA_LIMITS);
}

function cms_detect_media(string $file, string $originalName): array
{
    $mime = (string) (new finfo(FILEINFO_MIME_TYPE))->file($file);
    $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

    /* بعضی فایل‌های صوتی ظرف mp4 دارند؛ پسوند فقط میان این دو نوعِ
       ازنظر محتوا معتبر انتخاب می‌کند. */
    if ($mime === 'video/mp4' && $extension === 'm4a') {
        $mime = 'audio/mp4';
    }
    if ($mime === 'video/webm' && $extension === 'weba') {
        throw new CmsError('این نوع فایل پشتیبانی نمی‌شود.', 415);
    }
    if ($mime === 'application/octet-stream' && $extension === 'mp3') {
        $head = (string) file_get_contents($file, false, null, 0, 3);
        if (str_starts_with($head, 'ID3') || (strlen($head) >= 2 && ord($head[0]) === 0xFF && (ord($head[1]) & 0xE0) === 0xE0)) {
            $mime = 'audio/mpeg';
        }
    }
    if (!isset(CMS_MEDIA_TYPES[$mime])) {
        throw new CmsError('این نوع فایل پشتیبانی نمی‌شود. عکس (JPG، PNG، WebP، GIF)، ویدیو (MP4، WebM) و صوت (MP3، M4A، OGG، WAV) مجاز است.', 415);
    }

    [$kind, $safeExtension] = CMS_MEDIA_TYPES[$mime];
    if (filesize($file) > CMS_MEDIA_LIMITS[$kind]) {
        throw new CmsError('حجم فایل بیش از سقف مجاز است (عکس ۱۵، صوت ۶۰ و ویدیو ۲۵۰ مگابایت).', 413);
    }

    $width = $height = null;
    if ($kind === 'image') {
        $size = @getimagesize($file);
        if ($size === false) {
            throw new CmsError('فایل عکس معتبر نیست.', 415);
        }
        [$width, $height] = $size;
    }
    return compact('mime', 'kind', 'safeExtension', 'width', 'height');
}

function cms_store_media(string $tmp, string $originalName, array $actor): array
{
    $info = cms_detect_media($tmp, $originalName);
    $folder = gmdate('Y/m');
    $directory = CMS_MEDIA . '/' . $folder;
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new CmsError('پوشهٔ رسانه ساخته نشد.', 500);
    }
    /* نام فایل تصادفی است تا نام اصلی هیچ نقشی در مسیر روی سرور نداشته باشد. */
    $file = bin2hex(random_bytes(12)) . '.' . $info['safeExtension'];
    if (!rename($tmp, $directory . '/' . $file)) {
        throw new CmsError('فایل ذخیره نشد؛ فضای هاست را بررسی کنید.', 500);
    }
    @chmod($directory . '/' . $file, 0644);

    $item = [
        'id' => bin2hex(random_bytes(8)),
        'url' => '/cms-media/' . $folder . '/' . $file,
        'kind' => $info['kind'],
        'mime' => $info['mime'],
        'size' => filesize($directory . '/' . $file),
        'name' => mb_substr(basename(str_replace('\\', '/', $originalName)), 0, 120),
        'alt' => '',
        'width' => $info['width'],
        'height' => $info['height'],
        'uploaded_by' => $actor['display_name'],
        'uploaded_at' => gmdate('c'),
    ];
    cms_locked('media', static function () use ($item): void {
        $media = cms_media_all();
        array_unshift($media, $item);
        cms_write('media', $media);
    });
    return $item;
}

function cms_receive_chunk(array $post, array $files, array $actor): array
{
    cms_media_clean_tmp();
    $uploadId = (string) ($post['upload_id'] ?? '');
    $offset = (int) ($post['offset'] ?? -1);
    $total = (int) ($post['total'] ?? -1);
    $name = (string) ($post['name'] ?? '');
    $chunk = $files['chunk'] ?? null;

    if (preg_match('/^[a-f0-9]{32}$/D', $uploadId) !== 1 || $offset < 0 || $total <= 0 || $name === '') {
        throw new CmsError('درخواست آپلود معتبر نیست.');
    }
    if ($total > cms_media_max_size()) {
        throw new CmsError('حجم فایل بیش از سقف مجاز است (عکس ۱۵، صوت ۶۰ و ویدیو ۲۵۰ مگابایت).', 413);
    }
    if (!is_array($chunk) || (int) $chunk['error'] !== UPLOAD_ERR_OK || !is_uploaded_file((string) $chunk['tmp_name'])) {
        throw new CmsError('بخشی از فایل نرسید. دوباره امتحان کنید.');
    }
    if ((int) $chunk['size'] > CMS_CHUNK_SIZE) {
        throw new CmsError('اندازهٔ تکهٔ آپلود معتبر نیست.', 413);
    }

    $part = CMS_DATA . '/tmp/' . $actor['id'] . '_' . $uploadId . '.part';
    clearstatcache(true, $part);
    $current = is_file($part) ? (int) filesize($part) : 0;
    if ($offset > $current) {
        throw new CmsError('ترتیب تکه‌های آپلود به هم خورده است.', 409);
    }

    $handle = fopen($part, 'c+b');
    if ($handle === false) {
        throw new CmsError('فایل موقت ساخته نشد.', 500);
    }
    /* تلاش دوبارهٔ یک تکه به‌جای دو بار نوشته شدن، روی همان جا می‌نشیند. */
    flock($handle, LOCK_EX);
    ftruncate($handle, $offset);
    fseek($handle, $offset);
    $data = (string) file_get_contents((string) $chunk['tmp_name']);
    $written = fwrite($handle, $data);
    flock($handle, LOCK_UN);
    fclose($handle);
    if ($written !== strlen($data)) {
        @unlink($part);
        throw new CmsError('فایل ذخیره نشد؛ فضای هاست را بررسی کنید.', 507);
    }

    $received = $offset + $written;
    if ($received > $total) {
        @unlink($part);
        throw new CmsError('اندازهٔ فایل با مقدار اعلام‌شده یکی نیست.');
    }
    if ($received < $total) {
        return ['done' => false, 'received' => $received];
    }

    try {
        $item = cms_store_media($part, $name, $actor);
    } finally {
        @unlink($part);
    }
    return ['done' => true, 'item' => $item];
}

function cms_list_media(array $query): array
{
    $kind = (string) ($query['kind'] ?? '');
    $term = cms_normalize_search(trim((string) ($query['q'] ?? '')));
    $items = array_values(array_filter(cms_media_all(), static function (array $item) use ($kind, $term): bool {
        if ($kind !== '' && $item['kind'] !== $kind) {
            return false;
        }
        return $term === '' || str_contains(cms_normalize_search($item['name'] . ' ' . $item['alt']), $term);
    }));
    $page = max(1, (int) ($query['page'] ?? 1));
    return [
        'items' => array_slice($items, ($page - 1) * CMS_MEDIA_PAGE_SIZE, CMS_MEDIA_PAGE_SIZE),
        'total' => count($items),
        'page' => $page,
        'pages' => max(1, (int) ceil(count($items) / CMS_MEDIA_PAGE_SIZE)),
    ];
}

function cms_update_media(string $id, string $alt): array
{
    if (mb_strlen($alt) > 250) {
        throw new CmsError('متن جایگزین بیش از حد طولانی است.');
    }
    return cms_locked('media', static function () use ($id, $alt): array {
        $media = cms_media_all();
        foreach ($media as &$item) {
            if ($item['id'] === $id) {
                $item['alt'] = trim($alt);
                cms_write('media', $media);
                return $item;
            }
        }
        throw new CmsError('فایل پیدا نشد.', 404);
    });
}

function cms_delete_media(string $id): void
{
    cms_locked('media', static function () use ($id): void {
        $media = cms_media_all();
        foreach ($media as $index => $item) {
            if ($item['id'] !== $id) {
                continue;
            }
            $usedIn = cms_pages_using_media($item['url']);
            if ($usedIn !== []) {
                throw new CmsError('این فایل در ' . count($usedIn) . ' صفحه استفاده شده است (' . implode('، ', array_slice($usedIn, 0, 3)) . '). اول آن را از صفحه‌ها حذف کنید.', 409);
            }
            /* مسیر از رکورد خودمان می‌آید، ولی پیش از حذف دوباره بررسی می‌شود. */
            if (preg_match('~^/cms-media/\d{4}/\d{2}/[a-f0-9]{24}\.[a-z0-9]{2,4}$~D', $item['url']) === 1) {
                @unlink(CMS_ROOT . $item['url']);
            }
            unset($media[$index]);
            cms_write('media', array_values($media));
            return;
        }
        throw new CmsError('فایل پیدا نشد.', 404);
    });
}
