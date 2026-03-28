import smtplib
from email.message import EmailMessage
from typing import Optional

from app.config import settings


class EmailNotConfigured(Exception):
    """Raised when SMTP settings are missing."""


def _get_smtp_client() -> smtplib.SMTP:
    if not settings.SMTP_HOST or not settings.SMTP_PORT:
        raise EmailNotConfigured("SMTP host/port are not configured")

    client = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
    if settings.SMTP_TLS:
        client.starttls()

    if settings.SMTP_USER and settings.SMTP_PASSWORD:
        client.login(settings.SMTP_USER, settings.SMTP_PASSWORD)

    return client


def send_email(
    to_email: str,
    subject: str,
    body: str,
    *,
    from_email: Optional[str] = None,
) -> None:
    """
    Send a plain text email via configured SMTP settings.
    """
    sender = from_email or settings.SMTP_FROM_EMAIL
    if not sender:
        raise EmailNotConfigured("SMTP_FROM_EMAIL is not configured")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to_email
    msg.set_content(body)

    with _get_smtp_client() as client:
        client.send_message(msg)
