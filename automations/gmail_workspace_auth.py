import base64
import binascii
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Tuple

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build


TOKEN_VERSION = "v1"
TOKEN_URI = "https://oauth2.googleapis.com/token"
GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]
ACCESS_TOKEN_REFRESH_SKEW = timedelta(seconds=30)


class WorkspaceMailboxAuthError(Exception):
    """Base class for workspace mailbox auth failures."""


class WorkspaceMailboxNotConnectedError(WorkspaceMailboxAuthError):
    """Raised when mailbox row is missing or disconnected."""


class WorkspaceMailboxTokenError(WorkspaceMailboxAuthError):
    """Raised when mailbox token payload is missing/invalid."""


def _to_b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def _from_b64url(raw: str) -> bytes:
    return base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))


def _try_decode_key_candidate(raw: str) -> Optional[bytes]:
    value = (raw or "").strip()
    if not value:
        return None

    if len(value) == 64:
        try:
            return binascii.unhexlify(value)
        except (binascii.Error, ValueError):
            pass

    try:
        return _from_b64url(value)
    except Exception:
        return None


def _load_encryption_key() -> bytes:
    raw = os.environ.get("MAILBOX_TOKEN_ENCRYPTION_KEY")
    if not raw:
        raise WorkspaceMailboxTokenError(
            "MAILBOX_TOKEN_ENCRYPTION_KEY is not configured"
        )

    decoded = _try_decode_key_candidate(raw)
    key = decoded if decoded else raw.encode("utf-8")
    if len(key) != 32:
        raise WorkspaceMailboxTokenError(
            "MAILBOX_TOKEN_ENCRYPTION_KEY must decode to 32 bytes"
        )
    return key


def encrypt_workspace_token(token: str, workspace_id: str) -> str:
    if not token or not workspace_id:
        raise WorkspaceMailboxTokenError(
            "encrypt_workspace_token requires token and workspace_id"
        )

    key = _load_encryption_key()
    iv = os.urandom(12)
    aad = workspace_id.encode("utf-8")
    encrypted = AESGCM(key).encrypt(iv, token.encode("utf-8"), aad)
    ciphertext = encrypted[:-16]
    tag = encrypted[-16:]

    return ".".join(
        [TOKEN_VERSION, _to_b64url(iv), _to_b64url(ciphertext), _to_b64url(tag)]
    )


def decrypt_workspace_token(payload: str, workspace_id: str) -> str:
    if not payload or not workspace_id:
        raise WorkspaceMailboxTokenError(
            "decrypt_workspace_token requires payload and workspace_id"
        )

    parts = payload.split(".")
    if len(parts) != 4 or parts[0] != TOKEN_VERSION:
        raise WorkspaceMailboxTokenError("Invalid workspace token payload format")

    _, iv_part, ciphertext_part, tag_part = parts
    try:
        iv = _from_b64url(iv_part)
        ciphertext = _from_b64url(ciphertext_part)
        tag = _from_b64url(tag_part)
        decrypted = AESGCM(_load_encryption_key()).decrypt(
            iv,
            ciphertext + tag,
            workspace_id.encode("utf-8"),
        )
    except Exception as exc:
        raise WorkspaceMailboxTokenError("Failed to decrypt workspace token") from exc

    return decrypted.decode("utf-8")


def get_workspace_mailbox_row(
    supabase,
    *,
    workspace_id: Optional[str] = None,
    mailbox_email: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    if not workspace_id and not mailbox_email:
        raise ValueError("workspace_id or mailbox_email is required")

    query = supabase.table("workspace_mailboxes").select(
        "workspace_id, email, status, gmail_refresh_token_encrypted, "
        "gmail_access_token_encrypted, token_expires_at"
    )
    if workspace_id:
        query = query.eq("workspace_id", workspace_id)
    else:
        query = query.eq("email", (mailbox_email or "").strip().lower())

    rows = query.limit(1).execute().data or []
    return rows[0] if rows else None


def _parse_token_expiry(token_expires_at: Optional[str]) -> Optional[datetime]:
    """Parse token expiry into a timezone-NAIVE UTC datetime.

    google-auth stores Credentials.expiry as a naive UTC datetime internally.
    Setting a timezone-aware expiry causes a TypeError when google-auth compares
    it against its own _helpers.utcnow() (also naive). We always strip tzinfo.
    """
    if not token_expires_at:
        return None
    value = str(token_expires_at).strip()
    if not value:
        return None

    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None

    if parsed.tzinfo is None:
        return parsed  # already naive UTC
    # Convert to UTC, then strip tzinfo so google-auth is happy
    return parsed.astimezone(timezone.utc).replace(tzinfo=None)


def _require_google_oauth_client_credentials() -> Tuple[str, str]:
    client_id = os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise WorkspaceMailboxAuthError(
            "GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be configured"
        )
    return client_id, client_secret


def _mark_mailbox_error(supabase, workspace_id: str, error_message: str) -> None:
    try:
        supabase.table("workspace_mailboxes").update(
            {
                "status": "error",
                "last_error": error_message,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("workspace_id", workspace_id).execute()
    except Exception:
        pass


def _persist_credentials(supabase, workspace_id: str, credentials: Credentials) -> None:
    payload: Dict[str, Any] = {
        "status": "connected",
        "last_error": None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    if credentials.token:
        payload["gmail_access_token_encrypted"] = encrypt_workspace_token(
            credentials.token, workspace_id
        )
    if credentials.refresh_token:
        payload["gmail_refresh_token_encrypted"] = encrypt_workspace_token(
            credentials.refresh_token, workspace_id
        )

    expiry = credentials.expiry
    if expiry:
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        payload["token_expires_at"] = expiry.astimezone(timezone.utc).isoformat()
    else:
        payload["token_expires_at"] = None

    supabase.table("workspace_mailboxes").update(payload).eq(
        "workspace_id", workspace_id
    ).execute()


def _build_credentials_from_row(row: Dict[str, Any]) -> Credentials:
    workspace_id = row.get("workspace_id")
    refresh_encrypted = row.get("gmail_refresh_token_encrypted")
    if not workspace_id or not refresh_encrypted:
        raise WorkspaceMailboxTokenError(
            "Connected mailbox is missing refresh token credentials"
        )

    refresh_token = decrypt_workspace_token(refresh_encrypted, workspace_id)
    access_token = None
    if row.get("gmail_access_token_encrypted"):
        access_token = decrypt_workspace_token(
            row["gmail_access_token_encrypted"], workspace_id
        )

    client_id, client_secret = _require_google_oauth_client_credentials()
    credentials = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri=TOKEN_URI,
        client_id=client_id,
        client_secret=client_secret,
        scopes=GMAIL_SCOPES,
    )
    credentials.expiry = _parse_token_expiry(row.get("token_expires_at"))
    return credentials


def _needs_refresh(credentials: Credentials) -> bool:
    if not credentials.token:
        return True
    if not credentials.expiry:
        return False
    # credentials.expiry is naive UTC (google-auth convention); compare with naive UTC now
    expiry = credentials.expiry
    if expiry.tzinfo is not None:
        # Defensive: strip tzinfo if somehow set
        expiry = expiry.astimezone(timezone.utc).replace(tzinfo=None)
    now_naive_utc = datetime.utcnow()
    return expiry <= now_naive_utc + ACCESS_TOKEN_REFRESH_SKEW


def _assert_mailbox_connected(row: Dict[str, Any]) -> None:
    status = (row.get("status") or "").strip().lower()
    if status != "connected":
        raise WorkspaceMailboxNotConnectedError(
            f"Mailbox for workspace {row.get('workspace_id')} is not connected"
        )


def _hydrate_gmail_service(supabase, row: Dict[str, Any]) -> Tuple[Any, str]:
    workspace_id = row.get("workspace_id")
    mailbox_email = (row.get("email") or "").strip().lower()
    if not workspace_id or not mailbox_email:
        raise WorkspaceMailboxTokenError("Workspace mailbox row is incomplete")

    _assert_mailbox_connected(row)
    try:
        credentials = _build_credentials_from_row(row)
        if _needs_refresh(credentials):
            credentials.refresh(Request())
            _persist_credentials(supabase, workspace_id, credentials)

        service = build("gmail", "v1", credentials=credentials)
        return service, mailbox_email
    except WorkspaceMailboxAuthError:
        raise
    except Exception as exc:
        error_message = f"Mailbox auth failed for workspace {workspace_id}: {exc}"
        _mark_mailbox_error(supabase, workspace_id, error_message)
        raise WorkspaceMailboxAuthError(error_message) from exc


def get_gmail_service_for_workspace(supabase, workspace_id: str) -> Tuple[Any, str]:
    row = get_workspace_mailbox_row(supabase, workspace_id=workspace_id)
    if not row:
        raise WorkspaceMailboxNotConnectedError(
            f"No mailbox row found for workspace {workspace_id}"
        )
    return _hydrate_gmail_service(supabase, row)


def get_gmail_service_for_mailbox(
    supabase, mailbox_email: str
) -> Tuple[Any, str, str]:
    row = get_workspace_mailbox_row(supabase, mailbox_email=mailbox_email)
    if not row:
        raise WorkspaceMailboxNotConnectedError(
            f"No mailbox row found for {mailbox_email}"
        )
    service, resolved_mailbox = _hydrate_gmail_service(supabase, row)
    workspace_id = row.get("workspace_id")
    return service, resolved_mailbox, workspace_id
