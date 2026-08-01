<?php
declare(strict_types=1);

const OWNER = 'apazureck/paged-pdf-js';
const MANIFEST_PATH = '.well-known/paged-pdf-managed-files.json';
const MAX_ARCHIVE_FILES = 5000;
const MAX_UNCOMPRESSED_BYTES = 150 * 1024 * 1024;

function respond(array $payload, int $status): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=UTF-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    exit;
}

function safePath(mixed $path): string
{
    if (!is_string($path) || $path === '' || str_starts_with($path, '/')) {
        throw new RuntimeException('invalid-archive');
    }
    if (str_contains($path, "\\") || str_contains($path, "\0")) {
        throw new RuntimeException('invalid-archive');
    }
    $parts = explode('/', $path);
    if (array_filter($parts, fn (string $part): bool => in_array($part, ['', '.', '..'], true))) {
        throw new RuntimeException('invalid-archive');
    }
    if (
        $path === MANIFEST_PATH
        || str_starts_with($path, '.paged-pdf-')
        || preg_match('/\Apaged-pdf-release-[0-9a-f-]+\.(?:php|zip)\z/D', $path) === 1
    ) {
        throw new RuntimeException('invalid-archive');
    }
    return $path;
}

function removeTree(string $directory): void
{
    if (is_link($directory)) {
        @unlink($directory);
        return;
    }
    if (!is_dir($directory)) {
        return;
    }
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($iterator as $entry) {
        $entry->isDir() && !$entry->isLink()
            ? @rmdir($entry->getPathname())
            : @unlink($entry->getPathname());
    }
    @rmdir($directory);
}

function ensureSafeParentDirectories(string $root, string $relativePath): void
{
    $directory = dirname($relativePath);
    if ($directory === '.') {
        return;
    }
    $current = rtrim($root, DIRECTORY_SEPARATOR);
    foreach (explode('/', $directory) as $part) {
        $current .= DIRECTORY_SEPARATOR . $part;
        $metadata = @lstat($current);
        if ($metadata === false) {
            if (!mkdir($current, 0755) && !is_dir($current)) {
                throw new RuntimeException('write-failed');
            }
            $metadata = @lstat($current);
        }
        if (
            $metadata === false
            || is_link($current)
            || (($metadata['mode'] & 0170000) !== 0040000)
        ) {
            throw new RuntimeException('unsafe-parent');
        }
    }
}

function decodeJson(string $base64, string $category): array
{
    $decoded = base64_decode($base64, true);
    if (!is_string($decoded)) {
        throw new RuntimeException($category);
    }
    try {
        $payload = json_decode($decoded, true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        throw new RuntimeException($category);
    }
    if (!is_array($payload)) {
        throw new RuntimeException($category);
    }
    return $payload;
}

function archiveFiles(ZipArchive $archive): array
{
    if ($archive->numFiles < 1 || $archive->numFiles > MAX_ARCHIVE_FILES) {
        throw new RuntimeException('invalid-archive');
    }
    $files = [];
    $uncompressedBytes = 0;
    for ($index = 0; $index < $archive->numFiles; $index++) {
        $stat = $archive->statIndex($index);
        $name = $archive->getNameIndex($index);
        if (!is_array($stat) || !is_string($name) || str_ends_with($name, '/')) {
            throw new RuntimeException('invalid-archive');
        }
        $path = safePath($name);
        $size = $stat['size'] ?? null;
        if (!is_int($size) || $size < 0) {
            throw new RuntimeException('invalid-archive');
        }
        $uncompressedBytes += $size;
        if ($uncompressedBytes > MAX_UNCOMPRESSED_BYTES) {
            throw new RuntimeException('invalid-archive');
        }

        $operatingSystem = 0;
        $attributes = 0;
        if (
            $archive->getExternalAttributesIndex($index, $operatingSystem, $attributes)
            && $operatingSystem === ZipArchive::OPSYS_UNIX
        ) {
            $fileType = ($attributes >> 16) & 0170000;
            if ($fileType !== 0 && $fileType !== 0100000) {
                throw new RuntimeException('invalid-archive');
            }
        }
        $files[] = $path;
    }
    if (count(array_unique($files)) !== count($files)) {
        throw new RuntimeException('invalid-archive');
    }
    sort($files);
    return $files;
}

function stagedFiles(string $directory): array
{
    $files = [];
    $prefixLength = strlen(rtrim(str_replace('\\', '/', $directory), '/') . '/');
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS)
    );
    foreach ($iterator as $entry) {
        if (!$entry->isFile() || $entry->isLink()) {
            throw new RuntimeException('invalid-archive');
        }
        $path = substr(str_replace('\\', '/', $entry->getPathname()), $prefixLength);
        $files[] = safePath($path);
    }
    sort($files);
    return $files;
}

function extractToStaging(ZipArchive $archive, array $files, string $staging): void
{
    if (!mkdir($staging, 0700) && !is_dir($staging)) {
        throw new RuntimeException('write-failed');
    }
    foreach ($files as $index => $path) {
        ensureSafeParentDirectories($staging, $path);
        $source = $archive->getStream($archive->getNameIndex($index));
        $destinationPath = $staging . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $path);
        $destination = fopen($destinationPath, 'xb');
        if (!is_resource($source) || !is_resource($destination)) {
            is_resource($source) && fclose($source);
            is_resource($destination) && fclose($destination);
            throw new RuntimeException('write-failed');
        }
        $copied = stream_copy_to_stream($source, $destination);
        fclose($source);
        fclose($destination);
        if ($copied === false || !chmod($destinationPath, 0644)) {
            throw new RuntimeException('write-failed');
        }
    }
}

function previousManagedFiles(string $root): array
{
    $path = $root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, MANIFEST_PATH);
    if (!is_file($path)) {
        return [];
    }
    try {
        $payload = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        throw new RuntimeException('invalid-manifest');
    }
    if (
        !is_array($payload)
        || ($payload['schemaVersion'] ?? null) !== 1
        || ($payload['owner'] ?? null) !== OWNER
        || !is_array($payload['files'] ?? null)
    ) {
        throw new RuntimeException('invalid-manifest');
    }
    $files = array_map('safePath', $payload['files']);
    if (count(array_unique($files)) !== count($files)) {
        throw new RuntimeException('invalid-manifest');
    }
    return $files;
}

function removeEmptyParents(string $root, string $relativePath): void
{
    $directory = dirname($relativePath);
    while ($directory !== '.' && $directory !== '') {
        $candidate = $root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $directory);
        if (is_link($candidate)) {
            throw new RuntimeException('stale-cleanup-failed');
        }
        if (!is_dir($candidate)) {
            $directory = dirname($directory);
            continue;
        }
        $entries = scandir($candidate);
        if ($entries === false) {
            throw new RuntimeException('stale-cleanup-failed');
        }
        if (count($entries) > 2) {
            return;
        }
        if (!rmdir($candidate)) {
            throw new RuntimeException('stale-cleanup-failed');
        }
        $directory = dirname($directory);
    }
}

function deepestPathsFirst(array $files): array
{
    usort($files, static function (string $left, string $right): int {
        $depthOrder = substr_count($right, '/') <=> substr_count($left, '/');
        return $depthOrder !== 0 ? $depthOrder : strcmp($left, $right);
    });
    return $files;
}

function hasManagedDescendant(string $path, array $managedFiles): bool
{
    $prefix = $path . '/';
    foreach ($managedFiles as $managed) {
        if (str_starts_with($managed, $prefix)) {
            return true;
        }
    }
    return false;
}

function preflightDestinations(string $root, array $expectedFiles, array $previousFiles): void
{
    foreach ($expectedFiles as $path) {
        $parent = dirname($path);
        $relativeParent = '';
        if ($parent !== '.') {
            foreach (explode('/', $parent) as $part) {
                $relativeParent = $relativeParent === ''
                    ? $part
                    : $relativeParent . '/' . $part;
                $candidate = $root . DIRECTORY_SEPARATOR
                    . str_replace('/', DIRECTORY_SEPARATOR, $relativeParent);
                $metadata = @lstat($candidate);
                if ($metadata === false) {
                    break;
                }
                if (is_link($candidate)) {
                    throw new RuntimeException('unsafe-parent');
                }
                $type = $metadata['mode'] & 0170000;
                if ($type === 0040000) {
                    continue;
                }
                if ($type === 0100000 && in_array($relativeParent, $previousFiles, true)) {
                    break;
                }
                throw new RuntimeException('unsafe-parent');
            }
        }

        $destination = $root . DIRECTORY_SEPARATOR
            . str_replace('/', DIRECTORY_SEPARATOR, $path);
        $metadata = @lstat($destination);
        if ($metadata === false) {
            continue;
        }
        if (is_link($destination)) {
            throw new RuntimeException('unsafe-destination');
        }
        $type = $metadata['mode'] & 0170000;
        if ($type === 0100000) {
            continue;
        }
        if ($type === 0040000 && hasManagedDescendant($path, $previousFiles)) {
            continue;
        }
        throw new RuntimeException('unsafe-destination');
    }
}

function backupLiveFiles(
    string $root,
    string $backup,
    array $previousFiles,
    array $expectedFiles
): array {
    if (file_exists($backup) || is_link($backup)) {
        return ['created' => false, 'error' => 'write-failed', 'files' => []];
    }
    if (!mkdir($backup, 0700)) {
        return ['created' => false, 'error' => 'write-failed', 'files' => []];
    }

    $files = array_values(array_unique([
        ...$previousFiles,
        ...$expectedFiles,
        MANIFEST_PATH,
    ]));
    $backedUp = [];
    try {
        foreach (deepestPathsFirst($files) as $path) {
            $source = $root . DIRECTORY_SEPARATOR
                . str_replace('/', DIRECTORY_SEPARATOR, $path);
            $metadata = @lstat($source);
            if ($metadata === false || (($metadata['mode'] & 0170000) === 0040000)) {
                continue;
            }
            if (is_link($source) || (($metadata['mode'] & 0170000) !== 0100000)) {
                throw new RuntimeException('stale-cleanup-failed');
            }
            ensureSafeParentDirectories($backup, $path);
            $destination = $backup . DIRECTORY_SEPARATOR
                . str_replace('/', DIRECTORY_SEPARATOR, $path);
            if (!rename($source, $destination)) {
                throw new RuntimeException('stale-cleanup-failed');
            }
            $backedUp = [...$backedUp, $path];
            removeEmptyParents($root, $path);
        }
    } catch (Throwable $error) {
        $allowed = [
            'stale-cleanup-failed',
            'unsafe-parent',
            'write-failed',
        ];
        $category = in_array($error->getMessage(), $allowed, true)
            ? $error->getMessage()
            : 'stale-cleanup-failed';
        return ['created' => true, 'error' => $category, 'files' => $backedUp];
    }
    return ['created' => true, 'error' => null, 'files' => $backedUp];
}

function rollbackRelease(
    string $root,
    string $backup,
    array $backedUpFiles,
    array $publishedFiles
): bool {
    $success = true;
    foreach (deepestPathsFirst(array_values(array_unique($publishedFiles))) as $path) {
        $destination = $root . DIRECTORY_SEPARATOR
            . str_replace('/', DIRECTORY_SEPARATOR, $path);
        $metadata = @lstat($destination);
        if ($metadata === false) {
            continue;
        }
        if (
            is_link($destination)
            || (($metadata['mode'] & 0170000) !== 0100000)
            || !unlink($destination)
        ) {
            $success = false;
            continue;
        }
        try {
            removeEmptyParents($root, $path);
        } catch (Throwable) {
            $success = false;
        }
    }

    $restoreOrder = array_reverse(deepestPathsFirst(array_values(array_unique($backedUpFiles))));
    foreach ($restoreOrder as $path) {
        $source = $backup . DIRECTORY_SEPARATOR
            . str_replace('/', DIRECTORY_SEPARATOR, $path);
        $sourceMetadata = @lstat($source);
        if (
            $sourceMetadata === false
            || is_link($source)
            || (($sourceMetadata['mode'] & 0170000) !== 0100000)
        ) {
            $success = false;
            continue;
        }
        $destination = $root . DIRECTORY_SEPARATOR
            . str_replace('/', DIRECTORY_SEPARATOR, $path);
        $destinationMetadata = @lstat($destination);
        if ($destinationMetadata !== false) {
            if (
                is_link($destination)
                || (($destinationMetadata['mode'] & 0170000) !== 0040000)
            ) {
                $success = false;
                continue;
            }
            $entries = scandir($destination);
            if ($entries === false || count($entries) > 2 || !rmdir($destination)) {
                $success = false;
                continue;
            }
        }
        try {
            ensureSafeParentDirectories($root, $path);
        } catch (Throwable) {
            $success = false;
            continue;
        }
        if (!rename($source, $destination)) {
            $success = false;
        }
    }

    if ($success) {
        removeTree($backup);
        $success = !file_exists($backup) && !is_link($backup);
    }
    return $success;
}

function publicationOrder(array $files): array
{
    $rank = static function (string $path): int {
        if ($path === 'index.html') {
            return 2;
        }
        return str_ends_with($path, '.html') ? 1 : 0;
    };
    usort(
        $files,
        fn (string $left, string $right): int =>
            [$rank($left), $left] <=> [$rank($right), $right]
    );
    return $files;
}

function atomicWrite(string $root, string $relativePath, string $content): void
{
    ensureSafeParentDirectories($root, $relativePath);
    $destination = $root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
    $temporary = tempnam(dirname($destination), '.paged-pdf-write-');
    if (!is_string($temporary) || file_put_contents($temporary, $content, LOCK_EX) === false) {
        is_string($temporary) && @unlink($temporary);
        throw new RuntimeException('write-failed');
    }
    if (!chmod($temporary, 0644) || !rename($temporary, $destination)) {
        @unlink($temporary);
        throw new RuntimeException('write-failed');
    }
}

$archiveName = '__ARCHIVE_NAME__';
$scriptName = '__SCRIPT_NAME__';
$stagingName = '__STAGING_NAME__';
$archivePath = __DIR__ . DIRECTORY_SEPARATOR . $archiveName;
$scriptPath = __DIR__ . DIRECTORY_SEPARATOR . $scriptName;
$stagingPath = __DIR__ . DIRECTORY_SEPARATOR . $stagingName;
$backupPath = __DIR__ . DIRECTORY_SEPARATOR . $stagingName . '-backup';
$lockPath = __DIR__ . DIRECTORY_SEPARATOR . '.paged-pdf-deploy.lock';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(['error' => 'not-found'], 404);
}
$providedToken = (string) ($_SERVER['HTTP_X_PAGED_PDF_DEPLOY_TOKEN'] ?? '');
if ($providedToken === '' || !hash_equals('__TOKEN__', $providedToken)) {
    respond(['error' => 'not-found'], 404);
}

$lock = null;
$backupCreated = false;
$preserveBackup = false;
$backedUpFiles = [];
$publishedFiles = [];
$response = ['error' => 'deployment-failed'];
$status = 500;
try {
    set_time_limit(300);
    $lock = fopen($lockPath, 'c');
    if ($lock === false) {
        throw new RuntimeException('lock-unavailable');
    }
    if (!flock($lock, LOCK_EX | LOCK_NB)) {
        throw new RuntimeException('deployment-locked');
    }
    if (!chmod($lockPath, 0600)) {
        throw new RuntimeException('write-failed');
    }
    if (!class_exists(ZipArchive::class) || !is_file($archivePath)) {
        throw new RuntimeException('archive-unavailable');
    }
    $archiveHash = hash_file('sha256', $archivePath);
    if (!is_string($archiveHash) || !hash_equals('__ARCHIVE_SHA256__', $archiveHash)) {
        throw new RuntimeException('archive-checksum-failed');
    }

    $expectedFiles = array_map('safePath', decodeJson('__EXPECTED_FILES_BASE64__', 'invalid-control'));
    sort($expectedFiles);
    if (count(array_unique($expectedFiles)) !== count($expectedFiles)) {
        throw new RuntimeException('invalid-control');
    }

    $archive = new ZipArchive();
    if ($archive->open($archivePath) !== true) {
        throw new RuntimeException('invalid-archive');
    }
    $actualFiles = archiveFiles($archive);
    if ($actualFiles !== $expectedFiles) {
        $archive->close();
        throw new RuntimeException('invalid-archive');
    }
    extractToStaging($archive, $actualFiles, $stagingPath);
    $archive->close();
    if (stagedFiles($stagingPath) !== $expectedFiles) {
        throw new RuntimeException('invalid-archive');
    }

    $previousFiles = previousManagedFiles(__DIR__);
    preflightDestinations(__DIR__, $expectedFiles, $previousFiles);
    $backupResult = backupLiveFiles(
        __DIR__,
        $backupPath,
        $previousFiles,
        $expectedFiles
    );
    $backupCreated = $backupResult['created'];
    $backedUpFiles = $backupResult['files'];
    if (is_string($backupResult['error'])) {
        throw new RuntimeException($backupResult['error']);
    }

    foreach (publicationOrder($expectedFiles) as $path) {
        ensureSafeParentDirectories(__DIR__, $path);
        $staged = $stagingPath . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $path);
        $destination = __DIR__ . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $path);
        if (is_link($destination) || file_exists($destination)) {
            throw new RuntimeException('unsafe-destination');
        }
        if (!rename($staged, $destination)) {
            throw new RuntimeException('write-failed');
        }
        $publishedFiles = [...$publishedFiles, $path];
    }

    $manifest = base64_decode('__MANIFEST_BASE64__', true);
    if (!is_string($manifest)) {
        throw new RuntimeException('invalid-control');
    }
    atomicWrite(__DIR__, MANIFEST_PATH, $manifest . "\n");
    $publishedFiles = [...$publishedFiles, MANIFEST_PATH];
    $response = ['ok' => true];
    $status = 200;
} catch (Throwable $error) {
    $rollbackRequired = $backupCreated
        && ($backedUpFiles !== [] || $publishedFiles !== []);
    $rollbackSucceeded = !$rollbackRequired || rollbackRelease(
        __DIR__,
        $backupPath,
        $backedUpFiles,
        $publishedFiles
    );
    if (!$rollbackSucceeded) {
        $preserveBackup = true;
        $error = new RuntimeException('rollback-failed');
    }
    $allowed = [
        'archive-checksum-failed',
        'archive-unavailable',
        'lock-unavailable',
        'deployment-locked',
        'invalid-archive',
        'invalid-control',
        'invalid-manifest',
        'rollback-failed',
        'stale-cleanup-failed',
        'unsafe-destination',
        'unsafe-parent',
        'write-failed',
    ];
    $category = in_array($error->getMessage(), $allowed, true)
        ? $error->getMessage()
        : 'deployment-failed';
    $response = ['error' => $category];
} finally {
    removeTree($stagingPath);
    if (!$preserveBackup) {
        removeTree($backupPath);
    }
    @unlink($archivePath);
    @unlink($scriptPath);
    if (is_resource($lock)) {
        @flock($lock, LOCK_UN);
        @fclose($lock);
    }
}

respond($response, $status);
