import json
import logging
import urllib.error
import urllib.request
from email.utils import parseaddr

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)

API_URL = 'https://api.brevo.com/v3/smtp/email'


class BrevoEmailBackend(BaseEmailBackend):
    """Envía correos por la API HTTPS de Brevo (funciona en Render gratis)."""

    def send_messages(self, email_messages):
        api_key = getattr(settings, 'BREVO_API_KEY', '')
        if not api_key:
            if not self.fail_silently:
                raise RuntimeError('Falta la variable BREVO_API_KEY')
            return 0
        return sum(1 for m in email_messages if self._send(m, api_key))

    def _send(self, message, api_key):
        name, address = parseaddr(message.from_email or settings.DEFAULT_FROM_EMAIL)
        sender = {'email': address}
        if name:
            sender['name'] = name
        payload = {
            'sender': sender,
            'to': [{'email': r} for r in message.to],
            'subject': message.subject,
            'textContent': message.body,
        }
        for content, mimetype in getattr(message, 'alternatives', []):
            if mimetype == 'text/html':
                payload['htmlContent'] = content
        request = urllib.request.Request(
            API_URL,
            data=json.dumps(payload).encode('utf-8'),
            headers={
                'api-key': api_key,
                'content-type': 'application/json',
                'accept': 'application/json',
            },
            method='POST',
        )
        try:
            with urllib.request.urlopen(request, timeout=settings.EMAIL_TIMEOUT) as response:
                return 200 <= response.status < 300
        except urllib.error.HTTPError as exc:
            body = exc.read().decode('utf-8', 'replace')[:300]
            logger.error('Brevo respondió %s: %s', exc.code, body)
            if not self.fail_silently:
                raise
            return False
        except (urllib.error.URLError, TimeoutError):
            if not self.fail_silently:
                raise
            return False