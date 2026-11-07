"""Validación de entrada y representación de salida."""
from rest_framework import serializers

from .models import User

PASSWORD_MESSAGE = 'La contraseña debe tener al menos 8 caracteres, una letra y un número.'


class RegisterSerializer(serializers.Serializer):
    nombre = serializers.CharField(min_length=2, max_length=100)
    apellido = serializers.CharField(min_length=2, max_length=100)
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True)

    def validate_email(self, value):
        return value.strip().lower()

    def validate_password(self, value):
        # Misma regla que validateRegister() en la app (src/utils/validation.js)
        if len(value) < 8 or not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
            raise serializers.ValidationError(PASSWORD_MESSAGE)
        return value


class LoginSerializer(serializers.Serializer):
    # CharField (no EmailField): un correo mal escrito responde 401 igual que uno inexistente
    email = serializers.CharField(max_length=254)
    password = serializers.CharField(max_length=128, trim_whitespace=False)


class ChallengeSerializer(serializers.Serializer):
    challenge_id = serializers.UUIDField()


class VerifyCodeSerializer(ChallengeSerializer):
    code = serializers.RegexField(r'^\d{6}$', error_messages={'invalid': 'El código debe tener 6 dígitos.'})


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'nombre', 'apellido', 'fecha_registro')
        read_only_fields = fields
