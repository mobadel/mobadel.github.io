import ftplib
import importlib.util
import os
import ssl
from pathlib import Path, PurePosixPath
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("deploy_ftps", Path(__file__).parents[1] / "scripts/deploy-ftps.py")
client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(client)


class FakeFTPS:
    directories = {"/hosting/site"}
    uploads = []
    connections = []
    failures = 0

    def __init__(self, **kwargs):
        allow_self_signed = os.environ.get('FTP_ALLOW_SELF_SIGNED') == 'true'
        assert kwargs['context'].check_hostname == (not allow_self_signed)
        assert kwargs['context'].verify_mode == (ssl.CERT_NONE if allow_self_signed else ssl.CERT_REQUIRED)
        self.directory = "/"
        self.protected = False
        self.closed = False
        self.connections.append(self)

    def connect(self, host, port):
        assert host == "ftp.example.com" and port == 21

    def login(self, username, password):
        assert username == "user" and password == "password"

    def prot_p(self):
        self.protected = True

    def pwd(self):
        return self.directory

    def cwd(self, path):
        path = str(PurePosixPath(self.directory) / path)
        if path not in self.directories:
            raise ftplib.error_perm("550 No such directory")
        self.directory = path

    def mkd(self, path):
        self.directories.add(str(PurePosixPath(self.directory) / path))

    def storbinary(self, command, source, blocksize):
        assert self.protected, "Data connection must use TLS"
        if self.failures:
            type(self).failures -= 1
            raise ftplib.error_temp("421 Connection lost")
        assert command.startswith("STOR ")
        self.uploads.append((str(PurePosixPath(self.directory) / command[5:]), source.read()))

    def close(self):
        self.closed = True


class DeployTest(unittest.TestCase):
    def setUp(self):
        FakeFTPS.directories = {"/hosting/site"}
        FakeFTPS.uploads = []
        FakeFTPS.connections = []
        FakeFTPS.failures = 0
        self.env = patch.dict(os.environ, {
            "FTP_SERVER": "ftps://ftp.example.com", "FTP_PORT": "21",
            "FTP_USERNAME": "user", "FTP_PASSWORD": "password",
            "FTP_DIRECTORY": "/hosting/site",
            "FTP_ALLOW_SELF_SIGNED": "false",
        })
        self.env.start()
        self.addCleanup(self.env.stop)

    def site(self, directory):
        root = Path(directory)
        for path, data in {"index.html": b"home", "convert/rahn-ejare/index.html": b"rent",
                           "assets/rent-calc.css": b"new-css", ".htaccess": b"routing",
                           "api/config.php": b"configuration"}.items():
            target = root / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        return root

    @patch.object(client.ftplib, "FTP_TLS", FakeFTPS)
    def test_uploads_all_files_with_tls_and_routing_last(self):
        with tempfile.TemporaryDirectory() as directory:
            client.deploy(self.site(directory), workers=2)
        self.assertEqual(len(FakeFTPS.uploads), 5)
        self.assertEqual(FakeFTPS.uploads[-1], ("/hosting/site/.htaccess", b"routing"))
        paths = [path for path, _ in FakeFTPS.uploads]
        self.assertLess(paths.index("/hosting/site/assets/rent-calc.css"), paths.index("/hosting/site/index.html"))
        self.assertTrue(all(connection.closed for connection in FakeFTPS.connections))

    @patch.object(client.time, "sleep")
    @patch.object(client.ftplib, "FTP_TLS", FakeFTPS)
    def test_reconnects_after_failed_transfer(self, sleep):
        FakeFTPS.failures = 1
        with tempfile.TemporaryDirectory() as directory:
            client.deploy(self.site(directory), workers=1)
        self.assertEqual(len(FakeFTPS.uploads), 5)
        sleep.assert_called_once_with(1)

    @patch.object(client.time, "sleep")
    @patch.object(client.ftplib, "FTP_TLS", FakeFTPS)
    def test_persistent_failure_is_bounded_and_fails_deployment(self, sleep):
        FakeFTPS.failures = 10
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RuntimeError, "after 3 attempts"):
                client.deploy(self.site(directory), workers=1)
        self.assertEqual(len(FakeFTPS.connections), 3)
        self.assertTrue(all(connection.closed for connection in FakeFTPS.connections))

    def test_missing_prepared_site_fails_before_connecting(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "index.html is missing"):
                client.deploy(Path(directory))

    @patch.object(client.ftplib, "FTP_TLS", FakeFTPS)
    def test_self_signed_exception_requires_explicit_opt_in(self):
        with patch.dict(os.environ, {"FTP_ALLOW_SELF_SIGNED": "true"}):
            ftp, root = client.connect()
            self.assertTrue(ftp.protected)
            self.assertEqual(root, "/hosting/site")
            ftp.close()


if __name__ == "__main__":
    unittest.main()
