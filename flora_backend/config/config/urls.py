"""URLs raíz. La app móvil usa API_BASE_URL = https://<host>/api/v1."""
from django.contrib import admin
from django.urls import include, path

from accounts.views import HealthView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/health/', HealthView.as_view(), name='health'),
    path('api/v1/auth/', include('accounts.urls')),
    path('api/v1/', include('plants.urls')),
]
