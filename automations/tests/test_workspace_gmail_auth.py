import os
import sys
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import gmail_workspace_auth as gwa


class _FakeMailboxQuery:
    def __init__(self, supabase):
        self.supabase = supabase
        self.filters = []
        self._mode = "select"
        self._update_payload = None
        self._limit = None

    def select(self, _columns):
        self._mode = "select"
        return self

    def eq(self, column, value):
        self.filters.append((column, value))
        return self

    def limit(self, value):
        self._limit = value
        return self

    def update(self, values):
        self._mode = "update"
        self._update_payload = values
        return self

    def execute(self):
        if self._mode == "select":
            rows = list(self.supabase.rows)
            for col, value in self.filters:
                rows = [row for row in rows if row.get(col) == value]
            if self._limit is not None:
                rows = rows[: self._limit]
            return SimpleNamespace(data=rows)

        updated = 0
        for row in self.supabase.rows:
            matches = all(row.get(col) == value for col, value in self.filters)
            if matches:
                row.update(self._update_payload or {})
                updated += 1
        self.supabase.update_count += updated
        return SimpleNamespace(data=[])


class _FakeSupabase:
    def __init__(self, rows):
        self.rows = rows
        self.update_count = 0

    def table(self, table_name):
        assert table_name == "workspace_mailboxes"
        return _FakeMailboxQuery(self)


class _FakeCredentials:
    def __init__(
        self,
        token,
        refresh_token,
        token_uri,
        client_id,
        client_secret,
        scopes,
    ):
        self.token = token
        self.refresh_token = refresh_token
        self.token_uri = token_uri
        self.client_id = client_id
        self.client_secret = client_secret
        self.scopes = scopes
        self.expiry = None

    def refresh(self, _request):
        self.token = f"refreshed-{self.refresh_token}"
        self.expiry = datetime.now(timezone.utc) + timedelta(hours=1)


def test_encrypt_decrypt_workspace_token_round_trip(monkeypatch):
    monkeypatch.setenv(
        "MAILBOX_TOKEN_ENCRYPTION_KEY",
        "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",  # base64 for 32-byte string
    )
    encrypted = gwa.encrypt_workspace_token("refresh-token", "ws-1")
    assert encrypted.startswith("v1.")
    assert gwa.decrypt_workspace_token(encrypted, "ws-1") == "refresh-token"


def test_get_gmail_service_for_workspace_selects_workspace_specific_credentials(monkeypatch):
    monkeypatch.setenv(
        "MAILBOX_TOKEN_ENCRYPTION_KEY",
        "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
    )
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "client-id")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_SECRET", "client-secret")

    rows = [
        {
            "workspace_id": "ws-1",
            "email": "ops1@example.com",
            "status": "connected",
            "gmail_refresh_token_encrypted": gwa.encrypt_workspace_token(
                "refresh-ws1", "ws-1"
            ),
            "gmail_access_token_encrypted": gwa.encrypt_workspace_token(
                "access-ws1", "ws-1"
            ),
            "token_expires_at": (
                datetime.now(timezone.utc) + timedelta(minutes=10)
            ).isoformat(),
        },
        {
            "workspace_id": "ws-2",
            "email": "ops2@example.com",
            "status": "connected",
            "gmail_refresh_token_encrypted": gwa.encrypt_workspace_token(
                "refresh-ws2", "ws-2"
            ),
            "gmail_access_token_encrypted": gwa.encrypt_workspace_token(
                "access-ws2", "ws-2"
            ),
            "token_expires_at": (
                datetime.now(timezone.utc) - timedelta(minutes=1)
            ).isoformat(),
        },
    ]
    supabase = _FakeSupabase(rows)
    built = {}

    monkeypatch.setattr(gwa, "Credentials", _FakeCredentials)
    monkeypatch.setattr(gwa, "Request", lambda: object())
    def _fake_build(_svc, _version, credentials):
        built["credentials"] = credentials
        return object()
    monkeypatch.setattr(
        gwa,
        "build",
        _fake_build,
    )

    service, mailbox_email = gwa.get_gmail_service_for_workspace(supabase, "ws-2")

    assert service is not None
    assert mailbox_email == "ops2@example.com"
    assert built["credentials"].refresh_token == "refresh-ws2"
    assert built["credentials"].token == "refreshed-refresh-ws2"
    assert supabase.update_count >= 1


def test_get_gmail_service_for_workspace_raises_for_disconnected_mailbox(monkeypatch):
    monkeypatch.setenv(
        "MAILBOX_TOKEN_ENCRYPTION_KEY",
        "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
    )
    rows = [
        {
            "workspace_id": "ws-9",
            "email": "ops9@example.com",
            "status": "disconnected",
            "gmail_refresh_token_encrypted": None,
            "gmail_access_token_encrypted": None,
            "token_expires_at": None,
        }
    ]
    supabase = _FakeSupabase(rows)

    try:
        gwa.get_gmail_service_for_workspace(supabase, "ws-9")
        raised = False
    except gwa.WorkspaceMailboxNotConnectedError:
        raised = True

    assert raised is True
