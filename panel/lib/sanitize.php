<?php
declare(strict_types=1);

/*
 * هر HTML ورودی پیش از ذخیره از این فهرست مجاز رد می‌شود. ادیتور فقط
 * در مرورگر محدودیت می‌گذارد و درخواست مستقیم به API از آن عبور می‌کند،
 * و خروجی این تابع بدون تغییر در صفحهٔ عمومی چاپ می‌شود.
 */

const CMS_ALLOWED_TAGS = [
    'p', 'br', 'hr', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'sub', 'sup',
    'mark', 'small', 'span', 'div', 'a', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'img', 'figure', 'figcaption',
    'video', 'audio', 'source', 'table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
];

const CMS_DROPPED_TAGS = [
    'script', 'style', 'iframe', 'object', 'embed', 'applet', 'form', 'input', 'button', 'textarea', 'select', 'option',
    'noscript', 'template', 'svg', 'math', 'link', 'meta', 'base', 'title', 'head', 'frame', 'frameset',
];

const CMS_TAG_ATTRIBUTES = [
    'a' => ['href', 'target', 'rel', 'title'],
    'img' => ['src', 'alt', 'title', 'width', 'height'],
    'video' => ['src', 'poster', 'width', 'height'],
    'audio' => ['src'],
    'source' => ['src', 'type'],
    'td' => ['colspan', 'rowspan'],
    'th' => ['colspan', 'rowspan', 'scope'],
    'col' => ['span'],
];

const CMS_STYLE_RULES = [
    'text-align' => '/^(left|right|center|justify|start|end)$/',
    'color' => '/^(#[0-9a-f]{3,8}|rgba?\([0-9., %]+\))$/',
    'background-color' => '/^(#[0-9a-f]{3,8}|rgba?\([0-9., %]+\)|transparent)$/',
    'direction' => '/^(rtl|ltr)$/',
    'float' => '/^(left|right|none)$/',
    'display' => '/^(block|inline-block|inline)$/',
    'margin-left' => '/^(auto|0|[0-9.]{1,6}(px|em|rem|%))$/',
    'margin-right' => '/^(auto|0|[0-9.]{1,6}(px|em|rem|%))$/',
    'padding-left' => '/^(0|[0-9.]{1,6}(px|em|rem))$/',
    'padding-right' => '/^(0|[0-9.]{1,6}(px|em|rem))$/',
    'width' => '/^(auto|[0-9.]{1,6}(px|%))$/',
    'height' => '/^(auto|[0-9.]{1,6}(px|%))$/',
    'max-width' => '/^(none|[0-9.]{1,6}(px|%))$/',
    'vertical-align' => '/^(top|middle|bottom|baseline)$/',
    'border-collapse' => '/^(collapse|separate)$/',
];

function cms_clean_url(string $value, bool $link): ?string
{
    $url = trim($value);
    $compact = (string) preg_replace('/[\x00-\x20\x7f]+/', '', $url);
    if ($compact === '' || str_starts_with($compact, '//')) {
        return null;
    }
    if ($compact[0] === '/') {
        return $url;
    }
    if (preg_match('/^https?:/i', $compact) === 1) {
        return $url;
    }
    if ($link && ($compact[0] === '#' || preg_match('/^(mailto|tel):/i', $compact) === 1)) {
        return $url;
    }
    return null;
}

function cms_clean_style(string $style): string
{
    $clean = [];
    foreach (explode(';', $style) as $declaration) {
        $parts = explode(':', $declaration, 2);
        if (count($parts) !== 2) {
            continue;
        }
        $property = strtolower(trim($parts[0]));
        $value = strtolower(trim($parts[1]));
        if (isset(CMS_STYLE_RULES[$property]) && preg_match(CMS_STYLE_RULES[$property], $value) === 1) {
            $clean[$property] = $property . ': ' . $value;
        }
    }
    return implode('; ', $clean);
}

function cms_clean_rel(string $rel, bool $blank): string
{
    $allowed = array_intersect(preg_split('/\s+/', strtolower(trim($rel))) ?: [], ['nofollow', 'sponsored', 'ugc', 'noopener', 'noreferrer']);
    if ($blank) {
        $allowed = array_merge($allowed, ['noopener', 'noreferrer']);
    }
    return implode(' ', array_values(array_unique($allowed)));
}

function cms_clean_element(DOMElement $node): void
{
    $tag = strtolower($node->tagName);
    $allowed = CMS_TAG_ATTRIBUTES[$tag] ?? [];
    $attributes = [];
    foreach ($node->attributes as $attribute) {
        $attributes[strtolower($attribute->nodeName)] = $attribute->nodeValue;
    }
    foreach (array_keys(iterator_to_array($node->attributes)) as $name) {
        $node->removeAttribute($name);
    }

    foreach ($attributes as $name => $value) {
        if ($name === 'style') {
            $style = cms_clean_style((string) $value);
            if ($style !== '') {
                $node->setAttribute('style', $style);
            }
        } elseif ($name === 'dir' && in_array(strtolower((string) $value), ['rtl', 'ltr', 'auto'], true)) {
            $node->setAttribute('dir', strtolower((string) $value));
        } elseif (in_array($name, $allowed, true) && !in_array($name, ['href', 'src', 'poster', 'target', 'rel'], true)) {
            if (in_array($name, ['width', 'height', 'colspan', 'rowspan', 'span'], true) && preg_match('/^\d{1,4}%?$/D', (string) $value) !== 1) {
                continue;
            }
            $node->setAttribute($name, (string) $value);
        }
    }

    if ($tag === 'a') {
        $href = cms_clean_url((string) ($attributes['href'] ?? ''), true);
        if ($href !== null) {
            $node->setAttribute('href', $href);
            $blank = strtolower((string) ($attributes['target'] ?? '')) === '_blank';
            if ($blank) {
                $node->setAttribute('target', '_blank');
            }
            $rel = cms_clean_rel((string) ($attributes['rel'] ?? ''), $blank);
            if ($rel !== '') {
                $node->setAttribute('rel', $rel);
            }
        }
    }

    if (in_array($tag, ['img', 'video', 'audio', 'source'], true)) {
        $src = cms_clean_url((string) ($attributes['src'] ?? ''), false);
        if ($src !== null) {
            $node->setAttribute('src', $src);
        }
    }
    if ($tag === 'img') {
        $node->setAttribute('alt', (string) ($attributes['alt'] ?? ''));
        $node->setAttribute('loading', 'lazy');
        $node->setAttribute('decoding', 'async');
    }
    if ($tag === 'video' || $tag === 'audio') {
        $node->setAttribute('controls', 'controls');
        $node->setAttribute('preload', 'metadata');
    }
    if ($tag === 'video') {
        $node->setAttribute('playsinline', 'playsinline');
        $poster = cms_clean_url((string) ($attributes['poster'] ?? ''), false);
        if ($poster !== null) {
            $node->setAttribute('poster', $poster);
        }
    }
}

function cms_unwrap(DOMElement $node): void
{
    $parent = $node->parentNode;
    if ($parent === null) {
        return;
    }
    while ($node->firstChild !== null) {
        $parent->insertBefore($node->firstChild, $node);
    }
    $parent->removeChild($node);
}

function cms_clean_children(DOMNode $parent): void
{
    $child = $parent->firstChild;
    while ($child !== null) {
        $next = $child->nextSibling;

        if ($child instanceof DOMElement) {
            $tag = strtolower($child->tagName);
            if (in_array($tag, CMS_DROPPED_TAGS, true)) {
                $parent->removeChild($child);
            } elseif ($tag === 'h1') {
                /* هر صفحه h1 خودش را دارد؛ h1 دوم به ساختار تیترها آسیب می‌زند. */
                $heading = $child->ownerDocument->createElement('h2');
                while ($child->firstChild !== null) {
                    $heading->appendChild($child->firstChild);
                }
                $parent->replaceChild($heading, $child);
                $next = $heading;
            } elseif (!in_array($tag, CMS_ALLOWED_TAGS, true)) {
                /* فرزندها پس از باز شدن دوباره بررسی می‌شوند. */
                $first = $child->firstChild;
                cms_unwrap($child);
                $next = $first ?? $next;
            } else {
                cms_clean_element($child);
                $needsSource = in_array($tag, ['img', 'source'], true) && !$child->hasAttribute('src');
                $needsHref = $tag === 'a' && !$child->hasAttribute('href');
                if ($needsSource) {
                    $parent->removeChild($child);
                } elseif ($needsHref) {
                    $first = $child->firstChild;
                    cms_unwrap($child);
                    $next = $first ?? $next;
                } else {
                    cms_clean_children($child);
                }
            }
        } elseif (!($child instanceof DOMText) || $child instanceof DOMCdataSection) {
            $parent->removeChild($child);
        }

        $child = $next;
    }
}

function cms_sanitize(string $html): string
{
    $html = trim($html);
    if ($html === '') {
        return '';
    }
    if (strlen($html) > 2000000) {
        throw new InvalidArgumentException('حجم متن بیش از حد مجاز است.');
    }

    $previous = libxml_use_internal_errors(true);
    $document = new DOMDocument('1.0', 'UTF-8');
    $wrapped = '<!DOCTYPE html><html><head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"></head><body><div id="cms-root">' . $html . '</div></body></html>';
    $loaded = $document->loadHTML($wrapped, LIBXML_NONET | LIBXML_COMPACT);
    libxml_clear_errors();
    libxml_use_internal_errors($previous);
    if (!$loaded) {
        throw new InvalidArgumentException('متن قابل پردازش نیست.');
    }

    $root = $document->getElementById('cms-root');
    if ($root === null) {
        throw new InvalidArgumentException('متن قابل پردازش نیست.');
    }
    cms_clean_children($root);

    $output = '';
    foreach ($root->childNodes as $child) {
        $output .= $document->saveHTML($child);
    }
    return trim($output);
}

function cms_plain_text(string $html): string
{
    return trim((string) preg_replace('/\s+/u', ' ', strip_tags($html)));
}
