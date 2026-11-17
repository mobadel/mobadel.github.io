<?php
declare(strict_types=1);

require __DIR__ . '/lib/core.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/sanitize.php';
require __DIR__ . '/lib/pages.php';
require __DIR__ . '/lib/media.php';

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');

function cms_respond(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function cms_require_admin(array $user): void
{
    if ($user['role'] !== 'admin') {
        throw new CmsError('این بخش فقط برای مدیر است.', 403);
    }
}

/* درخواست تغییر فقط از همین دامنه پذیرفته می‌شود؛ این کنار توکن CSRF و
   کوکی SameSite لایهٔ سوم است. */
function cms_require_same_origin(): void
{
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== parse_url('http://' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST)) {
        throw new CmsError('درخواست از مبدأ معتبر نیست.', 403);
    }
}

try {
    cms_init_storage();
    cms_session_start();

    $action = (string) ($_GET['action'] ?? '');
    $method = (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $isPost = $method === 'POST';
    $input = [];
    if ($isPost) {
        cms_require_same_origin();
        if (str_starts_with((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) {
            $decoded = json_decode((string) file_get_contents('php://input'), true);
            $input = is_array($decoded) ? $decoded : [];
        } elseif ($action !== 'media.upload') {
            throw new CmsError('نوع درخواست معتبر نیست.', 415);
        }
    }

    if ($action === 'status') {
        $user = cms_current_user();
        cms_respond([
            'ok' => true,
            'needs_setup' => cms_users() === [],
            'setup_ready' => strlen(cms_setup_token()) >= 16,
            'user' => $user ? cms_public_user($user) : null,
            'csrf' => $user ? $_SESSION['csrf'] : null,
        ]);
    }
    if ($action === 'setup' && $isPost) {
        cms_create_first_admin((string) ($input['token'] ?? ''), (string) ($input['username'] ?? ''), (string) ($input['display_name'] ?? ''), (string) ($input['password'] ?? ''));
        cms_respond(['ok' => true]);
    }
    if ($action === 'login' && $isPost) {
        $user = cms_login((string) ($input['username'] ?? ''), (string) ($input['password'] ?? ''));
        cms_respond(['ok' => true, 'user' => cms_public_user($user), 'csrf' => $_SESSION['csrf']]);
    }

    $user = cms_current_user();
    if ($user === null) {
        throw new CmsError('لطفاً دوباره وارد شوید.', 401);
    }
    if ($isPost && !hash_equals((string) ($_SESSION['csrf'] ?? ''), (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
        throw new CmsError('نشست منقضی شده است؛ صفحه را تازه کنید.', 403);
    }

    switch ($action) {
        case 'logout':
            if (!$isPost) {
                break;
            }
            cms_logout();
            cms_respond(['ok' => true]);

        case 'pages':
            cms_respond(['ok' => true] + cms_list_pages($_GET));

        case 'page':
            cms_respond(['ok' => true] + cms_page_view(cms_require_key((string) ($_GET['path'] ?? ''))));

        case 'page.save':
        case 'page.publish':
            if (!$isPost) {
                break;
            }
            $view = cms_save_page(cms_require_key((string) ($input['path'] ?? '')), (string) ($input['html'] ?? ''), (int) ($input['version'] ?? -1), $action === 'page.publish', $user);
            cms_respond(['ok' => true] + $view);

        case 'page.unpublish':
            if (!$isPost) {
                break;
            }
            cms_respond(['ok' => true] + cms_unpublish_page(cms_require_key((string) ($input['path'] ?? '')), $user));

        case 'page.revision':
            cms_respond(['ok' => true, 'html' => cms_revision_html(cms_require_key((string) ($_GET['path'] ?? '')), (string) ($_GET['id'] ?? ''))]);

        case 'page.preview':
            if (!$isPost) {
                break;
            }
            $key = cms_require_key((string) ($input['path'] ?? ''));
            cms_respond(['ok' => true, 'url' => cms_path_from_key($key) . '?cms_preview=' . cms_preview_token($key)]);

        case 'media':
            cms_respond(['ok' => true] + cms_list_media($_GET));

        case 'media.upload':
            if (!$isPost) {
                break;
            }
            cms_respond(['ok' => true] + cms_receive_chunk($_POST, $_FILES, $user));

        case 'media.update':
            if (!$isPost) {
                break;
            }
            cms_respond(['ok' => true, 'item' => cms_update_media((string) ($input['id'] ?? ''), (string) ($input['alt'] ?? ''))]);

        case 'media.delete':
            if (!$isPost) {
                break;
            }
            cms_delete_media((string) ($input['id'] ?? ''));
            cms_respond(['ok' => true]);

        case 'account.password':
            if (!$isPost) {
                break;
            }
            cms_change_own_password($user, (string) ($input['current'] ?? ''), (string) ($input['password'] ?? ''));
            cms_respond(['ok' => true]);

        case 'users':
            cms_require_admin($user);
            cms_respond(['ok' => true, 'items' => array_map('cms_public_user', cms_users())]);

        case 'user.create':
            cms_require_admin($user);
            if (!$isPost) {
                break;
            }
            cms_respond(['ok' => true, 'item' => cms_create_user($input, $user)]);

        case 'user.update':
            cms_require_admin($user);
            if (!$isPost) {
                break;
            }
            cms_respond(['ok' => true, 'item' => cms_update_user($input)]);

        case 'user.delete':
            cms_require_admin($user);
            if (!$isPost) {
                break;
            }
            cms_delete_user((string) ($input['id'] ?? ''), $user);
            cms_respond(['ok' => true]);
    }
    throw new CmsError('درخواست پیدا نشد.', 404);
} catch (CmsError $error) {
    cms_respond(['ok' => false, 'error' => $error->getMessage()], $error->status);
} catch (InvalidArgumentException $error) {
    cms_respond(['ok' => false, 'error' => $error->getMessage()], 400);
} catch (Throwable $error) {
    error_log('tabdex panel: ' . $error->getMessage());
    cms_respond(['ok' => false, 'error' => 'خطای سرور. دوباره امتحان کنید.'], 500);
}
