from django.urls import path

from .views import IdentifyView

urlpatterns = [path('identificacion/', IdentifyView.as_view(), name='identify')]
