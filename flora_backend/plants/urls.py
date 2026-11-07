from django.urls import include, path
from rest_framework.routers import SimpleRouter

from . import diagnosis_views, views

router = SimpleRouter()
router.register('plantas', views.PlantViewSet, basename='plant')

urlpatterns = [
    path('', include(router.urls)),
    path('rachas/me/', views.RachaMeView.as_view(), name='racha-me'),
    path('agenda/', views.AgendaView.as_view(), name='agenda'),
    path('sync/batch/', views.SyncBatchView.as_view(), name='sync-batch'),
    path('diagnostico/', diagnosis_views.DiagnosisView.as_view(), name='diagnostico'),
    path('diagnostico/sintomas/', diagnosis_views.SymptomListView.as_view(), name='diagnostico-sintomas'),
]
