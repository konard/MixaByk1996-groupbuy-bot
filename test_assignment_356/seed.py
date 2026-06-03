"""
Seed script: populates roles, business elements, access rules, and test users.
Run once after migrations: python seed.py
"""
import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'test_assignment_356.settings')
django.setup()

from test_assignment_356.auth_app.models import User, Role, UserRole, BusinessElement, AccessRoleRule

roles_data = [
    ('admin', 'Full access to everything'),
    ('manager', 'Can manage products and orders'),
    ('user', 'Standard user access'),
    ('guest', 'Read-only access to public data'),
]

elements_data = [
    ('users', 'User accounts'),
    ('products', 'Product catalog'),
    ('shops', 'Shop directory'),
    ('orders', 'Customer orders'),
    ('access_rules', 'Access control rules'),
]

roles = {}
for name, desc in roles_data:
    role, _ = Role.objects.get_or_create(name=name, defaults={'description': desc})
    roles[name] = role

elements = {}
for name, desc in elements_data:
    el, _ = BusinessElement.objects.get_or_create(name=name, defaults={'description': desc})
    elements[name] = el

rules = [
    ('admin',   'users',        True,  True,  True,  True,  True,  True,  True),
    ('admin',   'products',     True,  True,  True,  True,  True,  True,  True),
    ('admin',   'shops',        True,  True,  True,  True,  True,  True,  True),
    ('admin',   'orders',       True,  True,  True,  True,  True,  True,  True),
    ('admin',   'access_rules', True,  True,  True,  True,  True,  True,  True),
    ('manager', 'products',     True,  True,  True,  True,  False, True,  False),
    ('manager', 'orders',       True,  True,  True,  True,  False, True,  False),
    ('manager', 'shops',        True,  True,  False, False, False, False, False),
    ('user',    'products',     True,  False, False, False, False, False, False),
    ('user',    'orders',       True,  False, True,  True,  False, True,  False),
    ('guest',   'products',     True,  False, False, False, False, False, False),
]

for role_name, el_name, r, ra, c, u, ua, d, da in rules:
    AccessRoleRule.objects.get_or_create(
        role=roles[role_name], element=elements[el_name],
        defaults=dict(
            read_permission=r, read_all_permission=ra,
            create_permission=c,
            update_permission=u, update_all_permission=ua,
            delete_permission=d, delete_all_permission=da,
        )
    )

test_users = [
    ('Admin', 'User', '', 'admin@example.com', 'adminpass', 'admin'),
    ('Manager', 'User', '', 'manager@example.com', 'managerpass', 'manager'),
    ('Regular', 'User', '', 'user@example.com', 'userpass', 'user'),
    ('Guest', 'User', '', 'guest@example.com', 'guestpass', 'guest'),
]

for first, last, pat, email, password, role_name in test_users:
    if not User.objects.filter(email=email).exists():
        user = User(first_name=first, last_name=last, patronymic=pat, email=email)
        user.set_password(password)
        user.save()
        UserRole.objects.create(user=user, role=roles[role_name])
        print(f'Created {email} with role {role_name}')
    else:
        print(f'Skipped {email} (already exists)')

print('Seed complete.')
