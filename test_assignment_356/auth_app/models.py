import bcrypt
from django.db import models


class User(models.Model):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    patronymic = models.CharField(max_length=100, blank=True)
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'auth_app'

    def set_password(self, raw_password):
        self.password_hash = bcrypt.hashpw(
            raw_password.encode(), bcrypt.gensalt()
        ).decode()

    def check_password(self, raw_password):
        return bcrypt.checkpw(raw_password.encode(), self.password_hash.encode())


class Role(models.Model):
    name = models.CharField(max_length=50, unique=True)
    description = models.CharField(max_length=200, blank=True)

    class Meta:
        app_label = 'auth_app'


class UserRole(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_roles')
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='user_roles')

    class Meta:
        app_label = 'auth_app'
        unique_together = ('user', 'role')


class BusinessElement(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=200, blank=True)

    class Meta:
        app_label = 'auth_app'


class AccessRoleRule(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='access_rules')
    element = models.ForeignKey(BusinessElement, on_delete=models.CASCADE, related_name='access_rules')
    read_permission = models.BooleanField(default=False)
    read_all_permission = models.BooleanField(default=False)
    create_permission = models.BooleanField(default=False)
    update_permission = models.BooleanField(default=False)
    update_all_permission = models.BooleanField(default=False)
    delete_permission = models.BooleanField(default=False)
    delete_all_permission = models.BooleanField(default=False)

    class Meta:
        app_label = 'auth_app'
        unique_together = ('role', 'element')


class Session(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions')
    token = models.CharField(max_length=512, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        app_label = 'auth_app'
