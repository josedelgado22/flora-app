from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.utils import timezone


def at_noon(days_ago):
    """Mediodía (hora local de Chile) de hace `days_ago` días: su fecha local es siempre hoy - days_ago."""
    day = timezone.localdate() - timedelta(days=days_ago)
    return datetime.combine(day, time(12, 0), tzinfo=ZoneInfo(settings.TIME_ZONE))
