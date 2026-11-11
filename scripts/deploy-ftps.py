"""Upload the prepared site with Python's standard library; no apt dependencies.

Only files under _site are uploaded. Remote-only files (WordPress and runtime
data) are never removed. Every file is sent, including same-size CSS/JS changes.
"""

import concurrent.futures
import ftplib
import os
from pathlib import Path
import ssl
import time
from urllib.parse import urlsplit


class SessionFTP_TLS(ftplib.FTP_TLS):
    """Reuse the authenticated TLS session for hosts requiring data-channel reuse."""

    def ntransfercmd(self, cmd, rest=None):
        connection, size = ftplib.FTP.ntransfercmd(self, cmd, rest)
        if self._prot_p:
            try:
                connection = self.context.wrap_socket(
                    connection, server_hostname=self.host, session=self.sock.session
                )
            except Exception:
                connection.close()
                raise
        return connection, size


def connect():
    server = os.environ["FTP_SERVER"]
    # Accept the same ftp:// / ftps:// server values as the former lftp command.
    host = urlsplit(server if "://" in server else "ftp://" + server).hostname
    context = ssl.create_default_context()
    # Owner-approved exception for this deployment's configured FTPS host.
    # This context is local to this connection; HTTPS validation is unchanged.
    if os.environ.get("FTP_ALLOW_SELF_SIGNED") == "true":
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
    ftp = SessionFTP_TLS(context=context, timeout=60)
    try:
        ftp.connect(host, int(os.environ.get("FTP_PORT") or 21))
        ftp.login(os.environ["FTP_USERNAME"], os.environ["FTP_PASSWORD"])
        ftp.prot_p()
        ftp.cwd(os.environ["FTP_DIRECTORY"])
        return ftp, ftp.pwd()
    except Exception:
        ftp.close()
        raise


def enter_directory(ftp, root, parts):
    ftp.cwd(root)
    for part in parts:
        try:
            ftp.cwd(part)
        except ftplib.error_perm as error:
            if not str(error).startswith("550"):
                raise
            try:
                ftp.mkd(part)
            except ftplib.error_perm as create_error:
                # Another worker may have created it. cwd must still succeed.
                if not str(create_error).startswith("550"):
                    raise
            ftp.cwd(part)


def upload_batch(site, paths):
    ftp = None
    try:
        for path in paths:
            for attempt in range(3):
                try:
                    if ftp is None:
                        ftp, root = connect()
                    enter_directory(ftp, root, path.parent.parts)
                    with (site / path).open("rb") as source:
                        ftp.storbinary("STOR " + path.name, source, blocksize=65536)
                    break
                except (OSError, EOFError, ftplib.Error) as error:
                    if ftp is not None:
                        ftp.close()
                        ftp = None
                    if attempt == 2:
                        detail = str(error)
                        for key in ("FTP_SERVER", "FTP_USERNAME", "FTP_PASSWORD", "FTP_DIRECTORY"):
                            value = os.environ.get(key)
                            if value:
                                detail = detail.replace(value, "***")
                        raise RuntimeError(f"FTPS upload failed after 3 attempts: {path}: {detail}") from None
                    time.sleep(attempt + 1)
    finally:
        if ftp is not None:
            ftp.close()


def deploy(site=Path("_site"), workers=8):
    for key in ("FTP_SERVER", "FTP_USERNAME", "FTP_PASSWORD", "FTP_DIRECTORY"):
        if not os.environ.get(key):
            raise ValueError(f"Missing environment variable: {key}")
    if not (site / "index.html").is_file():
        raise ValueError("Prepared _site/index.html is missing")
    paths = []
    for file in sorted(site.rglob("*")):
        if file.is_symlink():
            raise ValueError(f"Symlink not allowed in deployment: {file}")
        if file.is_file():
            paths.append(file.relative_to(site))
    # Publish assets first, then HTML, then routing rules. Never delete remotely.
    groups = [
        [p for p in paths if p.suffix != ".html" and p.name != ".htaccess"],
        [p for p in paths if p.suffix == ".html"],
        [p for p in paths if p.name == ".htaccess"],
    ]
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        for group in groups:
            futures = [pool.submit(upload_batch, site, group[i::workers])
                       for i in range(min(workers, len(group)))]
            for future in futures:
                future.result()
            print(f"Uploaded {len(group)} files", flush=True)
    print(f"FTPS publication complete: {len(paths)} files", flush=True)


if __name__ == "__main__":
    deploy()
