from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import BaseUserCreationForm, UserChangeForm as DjangoUserChangeForm

from .models import OTPCode, User


class UserCreationForm(BaseUserCreationForm):
    class Meta:
        model = User
        fields = ('email', 'nombre', 'apellido')


class UserChangeForm(DjangoUserChangeForm):
    class Meta:
        model = User
        fields = '__all__'


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    ordering = ('-fecha_registro',)
    list_display = ('email', 'nombre', 'apellido', 'is_active', 'is_staff', 'fecha_registro')
    list_filter = ('is_active', 'is_staff', 'two_factor_enabled')
    search_fields = ('email', 'nombre', 'apellido')
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Datos', {'fields': ('nombre', 'apellido', 'two_factor_enabled')}),
        ('Permisos', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Fechas', {'fields': ('last_login', 'fecha_registro')}),
    )
    add_fieldsets = (
        (None, {'classes': ('wide',), 'fields': ('email', 'nombre', 'apellido', 'password1', 'password2')}),
    )


@admin.register(OTPCode)
class OTPCodeAdmin(admin.ModelAdmin):
    """Solo lectura: el campo `code` es un resumen HMAC, no el código."""

    list_display = ('challenge_id', 'user', 'purpose', 'created_at', 'is_used', 'attempts')
    list_filter = ('purpose', 'is_used')
    readonly_fields = [field.name for field in OTPCode._meta.fields]

    def has_add_permission(self, request):
        return False
