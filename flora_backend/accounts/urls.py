from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path('register/', views.RegisterView.as_view(), name='register'),
    path('register/verify/', views.RegisterVerifyView.as_view(), name='register-verify'),
    path('register/resend/', views.RegisterResendView.as_view(), name='register-resend'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('2fa/verify/', views.TwoFactorVerifyView.as_view(), name='2fa-verify'),
    path('2fa/resend/', views.TwoFactorResendView.as_view(), name='2fa-resend'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('me/', views.MeView.as_view(), name='me'),
]
