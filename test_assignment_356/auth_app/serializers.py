from rest_framework import serializers
from .models import User, Role, BusinessElement, AccessRoleRule


class RegisterSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    patronymic = serializers.CharField(max_length=100, required=False, default='')
    email = serializers.EmailField()
    password = serializers.CharField(min_length=6, write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('Email already registered')
        return value

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Passwords do not match'})
        return data


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'patronymic', 'email', 'is_active', 'created_at']
        read_only_fields = ['id', 'email', 'is_active', 'created_at']


class UpdateUserSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100, required=False)
    last_name = serializers.CharField(max_length=100, required=False)
    patronymic = serializers.CharField(max_length=100, required=False)


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'name', 'description']


class BusinessElementSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusinessElement
        fields = ['id', 'name', 'description']


class AccessRoleRuleSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source='role.name', read_only=True)
    element_name = serializers.CharField(source='element.name', read_only=True)

    class Meta:
        model = AccessRoleRule
        fields = [
            'id', 'role', 'role_name', 'element', 'element_name',
            'read_permission', 'read_all_permission',
            'create_permission',
            'update_permission', 'update_all_permission',
            'delete_permission', 'delete_all_permission',
        ]


class UpdateAccessRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccessRoleRule
        fields = [
            'read_permission', 'read_all_permission',
            'create_permission',
            'update_permission', 'update_all_permission',
            'delete_permission', 'delete_all_permission',
        ]
