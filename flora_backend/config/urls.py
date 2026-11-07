# flora-backend/config/urls.py
from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView

urlpatterns = [
    # Redirección automática de /api/v1/ hacia la documentación interactiva Swagger
    path('api/v1/', RedirectView.as_view(url='/api/docs/', permanent=False)), 
    path('admin/', admin.site.urls),
    path('api/v1/health/', include('config.health_urls')), # O tu vista de health
    path('api/v1/auth/', include('accounts.urls')),
    path('api/v1/', include('plants.urls')),
    path('api/v1/diagnostico/', include('plants.diagnosis_urls')),
    path('api/v1/identificacion/', include('identification.urls')),
    path('api/schema/', include('drf_spectacular.urls')), # Generador OpenAPI 3.0
    path('api/docs/', include('drf_spectacular.urls')), # Interface UI Swagger
]