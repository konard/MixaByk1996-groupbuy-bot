import json
import pytest
from django.test import Client, RequestFactory
from django.urls import reverse

from test_assignment_356.auth_app.models import User, Role, UserRole, BusinessElement, AccessRoleRule, Session
from test_assignment_356.auth_app.tokens import generate_token, decode_token


pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client():
    return Client()


@pytest.fixture
def roles():
    admin = Role.objects.create(name='admin', description='Administrator')
    user_role = Role.objects.create(name='user', description='Regular user')
    manager = Role.objects.create(name='manager', description='Manager')
    return {'admin': admin, 'user': user_role, 'manager': manager}


@pytest.fixture
def elements(roles):
    products = BusinessElement.objects.create(name='products', description='Products')
    orders = BusinessElement.objects.create(name='orders', description='Orders')
    shops = BusinessElement.objects.create(name='shops', description='Shops')
    access_rules = BusinessElement.objects.create(name='access_rules', description='Access rules')
    users_el = BusinessElement.objects.create(name='users', description='Users')
    return {'products': products, 'orders': orders, 'shops': shops,
            'access_rules': access_rules, 'users': users_el}


@pytest.fixture
def access_rules(roles, elements):
    admin_products = AccessRoleRule.objects.create(
        role=roles['admin'], element=elements['products'],
        read_permission=True, read_all_permission=True, create_permission=True,
        update_permission=True, update_all_permission=True,
        delete_permission=True, delete_all_permission=True,
    )
    AccessRoleRule.objects.create(
        role=roles['admin'], element=elements['orders'],
        read_permission=True, read_all_permission=True, create_permission=True,
        update_permission=True, update_all_permission=True,
        delete_permission=True, delete_all_permission=True,
    )
    AccessRoleRule.objects.create(
        role=roles['admin'], element=elements['shops'],
        read_permission=True, read_all_permission=True, create_permission=True,
        update_permission=True, update_all_permission=True,
        delete_permission=True, delete_all_permission=True,
    )
    AccessRoleRule.objects.create(
        role=roles['admin'], element=elements['access_rules'],
        read_permission=True, read_all_permission=True, create_permission=True,
        update_permission=True, update_all_permission=True,
        delete_permission=True, delete_all_permission=True,
    )
    AccessRoleRule.objects.create(
        role=roles['user'], element=elements['products'],
        read_permission=True,
    )
    return admin_products


@pytest.fixture
def admin_user(roles):
    user = User(first_name='Admin', last_name='User', email='admin@test.com')
    user.set_password('adminpass123')
    user.save()
    UserRole.objects.create(user=user, role=roles['admin'])
    return user


@pytest.fixture
def regular_user(roles):
    user = User(first_name='Regular', last_name='User', email='user@test.com')
    user.set_password('userpass123')
    user.save()
    UserRole.objects.create(user=user, role=roles['user'])
    return user


@pytest.fixture
def admin_token(admin_user):
    token = generate_token(admin_user.id)
    Session.objects.create(user=admin_user, token=token)
    return token


@pytest.fixture
def user_token(regular_user):
    token = generate_token(regular_user.id)
    Session.objects.create(user=regular_user, token=token)
    return token


def auth_headers(token):
    return {'HTTP_AUTHORIZATION': f'Bearer {token}'}


class TestRegister:
    def test_register_success(self, api_client, roles):
        response = api_client.post(
            '/api/auth/register/',
            data=json.dumps({
                'first_name': 'John', 'last_name': 'Doe',
                'email': 'john@test.com', 'password': 'pass123', 'password_confirm': 'pass123',
            }),
            content_type='application/json',
        )
        assert response.status_code == 201
        data = response.json()
        assert data['email'] == 'john@test.com'
        assert data['first_name'] == 'John'
        assert 'password_hash' not in data

    def test_register_with_patronymic(self, api_client, roles):
        response = api_client.post(
            '/api/auth/register/',
            data=json.dumps({
                'first_name': 'Ivan', 'last_name': 'Petrov', 'patronymic': 'Sidorovich',
                'email': 'ivan@test.com', 'password': 'pass123', 'password_confirm': 'pass123',
            }),
            content_type='application/json',
        )
        assert response.status_code == 201
        assert response.json()['patronymic'] == 'Sidorovich'

    def test_register_duplicate_email(self, api_client, roles):
        api_client.post(
            '/api/auth/register/',
            data=json.dumps({
                'first_name': 'A', 'last_name': 'B',
                'email': 'dup@test.com', 'password': 'pass123', 'password_confirm': 'pass123',
            }),
            content_type='application/json',
        )
        response = api_client.post(
            '/api/auth/register/',
            data=json.dumps({
                'first_name': 'C', 'last_name': 'D',
                'email': 'dup@test.com', 'password': 'pass123', 'password_confirm': 'pass123',
            }),
            content_type='application/json',
        )
        assert response.status_code == 400

    def test_register_password_mismatch(self, api_client):
        response = api_client.post(
            '/api/auth/register/',
            data=json.dumps({
                'first_name': 'A', 'last_name': 'B',
                'email': 'a@test.com', 'password': 'pass123', 'password_confirm': 'wrong',
            }),
            content_type='application/json',
        )
        assert response.status_code == 400

    def test_register_missing_fields(self, api_client):
        response = api_client.post(
            '/api/auth/register/',
            data=json.dumps({'email': 'a@test.com'}),
            content_type='application/json',
        )
        assert response.status_code == 400


class TestLogin:
    def test_login_success(self, api_client, regular_user):
        response = api_client.post(
            '/api/auth/login/',
            data=json.dumps({'email': 'user@test.com', 'password': 'userpass123'}),
            content_type='application/json',
        )
        assert response.status_code == 200
        data = response.json()
        assert 'token' in data
        assert data['user']['email'] == 'user@test.com'

    def test_login_wrong_password(self, api_client, regular_user):
        response = api_client.post(
            '/api/auth/login/',
            data=json.dumps({'email': 'user@test.com', 'password': 'wrongpass'}),
            content_type='application/json',
        )
        assert response.status_code == 401

    def test_login_unknown_email(self, api_client):
        response = api_client.post(
            '/api/auth/login/',
            data=json.dumps({'email': 'unknown@test.com', 'password': 'pass'}),
            content_type='application/json',
        )
        assert response.status_code == 401

    def test_login_deactivated_user(self, api_client, regular_user):
        regular_user.is_active = False
        regular_user.save()
        response = api_client.post(
            '/api/auth/login/',
            data=json.dumps({'email': 'user@test.com', 'password': 'userpass123'}),
            content_type='application/json',
        )
        assert response.status_code == 401

    def test_login_creates_session(self, api_client, regular_user):
        response = api_client.post(
            '/api/auth/login/',
            data=json.dumps({'email': 'user@test.com', 'password': 'userpass123'}),
            content_type='application/json',
        )
        token = response.json()['token']
        assert Session.objects.filter(token=token, is_active=True).exists()


class TestLogout:
    def test_logout_success(self, api_client, regular_user, user_token):
        response = api_client.post(
            '/api/auth/logout/',
            **auth_headers(user_token),
        )
        assert response.status_code == 200
        assert not Session.objects.filter(token=user_token, is_active=True).exists()

    def test_logout_without_token(self, api_client):
        response = api_client.post('/api/auth/logout/')
        assert response.status_code == 401


class TestProfile:
    def test_get_profile(self, api_client, regular_user, user_token):
        response = api_client.get('/api/auth/profile/', **auth_headers(user_token))
        assert response.status_code == 200
        assert response.json()['email'] == 'user@test.com'

    def test_get_profile_unauthenticated(self, api_client):
        response = api_client.get('/api/auth/profile/')
        assert response.status_code == 401

    def test_update_profile(self, api_client, regular_user, user_token):
        response = api_client.patch(
            '/api/auth/profile/',
            data=json.dumps({'first_name': 'Updated'}),
            content_type='application/json',
            **auth_headers(user_token),
        )
        assert response.status_code == 200
        assert response.json()['first_name'] == 'Updated'

    def test_soft_delete_user(self, api_client, regular_user, user_token):
        response = api_client.delete('/api/auth/profile/', **auth_headers(user_token))
        assert response.status_code == 200
        regular_user.refresh_from_db()
        assert not regular_user.is_active

    def test_soft_delete_invalidates_session(self, api_client, regular_user, user_token):
        api_client.delete('/api/auth/profile/', **auth_headers(user_token))
        assert not Session.objects.filter(token=user_token, is_active=True).exists()

    def test_deleted_user_cannot_login(self, api_client, regular_user, user_token):
        api_client.delete('/api/auth/profile/', **auth_headers(user_token))
        response = api_client.post(
            '/api/auth/login/',
            data=json.dumps({'email': 'user@test.com', 'password': 'userpass123'}),
            content_type='application/json',
        )
        assert response.status_code == 401


class TestTokens:
    def test_generate_and_decode(self, regular_user):
        token = generate_token(regular_user.id)
        payload = decode_token(token)
        assert payload is not None
        assert payload['user_id'] == regular_user.id

    def test_invalid_token_returns_none(self):
        assert decode_token('invalid.token.here') is None

    def test_tampered_token_returns_none(self, regular_user):
        token = generate_token(regular_user.id)
        tampered = token[:-5] + 'AAAAA'
        assert decode_token(tampered) is None


class TestAdminRoles:
    def test_admin_can_list_roles(self, api_client, admin_user, admin_token, roles):
        response = api_client.get('/api/admin/roles/', **auth_headers(admin_token))
        assert response.status_code == 200
        names = [r['name'] for r in response.json()]
        assert 'admin' in names

    def test_non_admin_cannot_list_roles(self, api_client, regular_user, user_token, roles):
        response = api_client.get('/api/admin/roles/', **auth_headers(user_token))
        assert response.status_code == 403

    def test_unauthenticated_cannot_list_roles(self, api_client):
        response = api_client.get('/api/admin/roles/')
        assert response.status_code == 401

    def test_admin_can_create_role(self, api_client, admin_user, admin_token):
        response = api_client.post(
            '/api/admin/roles/',
            data=json.dumps({'name': 'new_role', 'description': 'A new role'}),
            content_type='application/json',
            **auth_headers(admin_token),
        )
        assert response.status_code == 201
        assert response.json()['name'] == 'new_role'


class TestAdminAccessRules:
    def test_admin_can_list_rules(self, api_client, admin_user, admin_token, access_rules):
        response = api_client.get('/api/admin/rules/', **auth_headers(admin_token))
        assert response.status_code == 200
        assert len(response.json()) > 0

    def test_admin_can_update_rule(self, api_client, admin_user, admin_token, access_rules):
        rule_id = access_rules.id
        response = api_client.patch(
            f'/api/admin/rules/{rule_id}/',
            data=json.dumps({'read_permission': False}),
            content_type='application/json',
            **auth_headers(admin_token),
        )
        assert response.status_code == 200
        assert response.json()['read_permission'] is False

    def test_admin_can_delete_rule(self, api_client, admin_user, admin_token, access_rules):
        rule_id = access_rules.id
        response = api_client.delete(f'/api/admin/rules/{rule_id}/', **auth_headers(admin_token))
        assert response.status_code == 204
        assert not AccessRoleRule.objects.filter(pk=rule_id).exists()

    def test_non_admin_cannot_manage_rules(self, api_client, regular_user, user_token):
        response = api_client.get('/api/admin/rules/', **auth_headers(user_token))
        assert response.status_code == 403

    def test_admin_can_assign_role_to_user(self, api_client, admin_user, admin_token, regular_user, roles):
        response = api_client.post(
            f'/api/admin/users/{regular_user.id}/roles/',
            data=json.dumps({'role': 'manager'}),
            content_type='application/json',
            **auth_headers(admin_token),
        )
        assert response.status_code == 200
        assert UserRole.objects.filter(user=regular_user, role=roles['manager']).exists()


class TestMockBusinessViews:
    def test_user_with_permission_can_access_products(self, api_client, regular_user, user_token, access_rules):
        response = api_client.get('/api/products/', **auth_headers(user_token))
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

    def test_unauthenticated_cannot_access_products(self, api_client):
        response = api_client.get('/api/products/')
        assert response.status_code == 401

    def test_user_without_order_permission_gets_403(self, api_client, regular_user, user_token, elements):
        response = api_client.get('/api/orders/', **auth_headers(user_token))
        assert response.status_code == 403

    def test_admin_can_access_products(self, api_client, admin_user, admin_token, access_rules):
        response = api_client.get('/api/products/', **auth_headers(admin_token))
        assert response.status_code == 200

    def test_admin_can_access_orders(self, api_client, admin_user, admin_token, access_rules):
        response = api_client.get('/api/orders/', **auth_headers(admin_token))
        assert response.status_code == 200

    def test_admin_can_access_shops(self, api_client, admin_user, admin_token, access_rules):
        response = api_client.get('/api/shops/', **auth_headers(admin_token))
        assert response.status_code == 200
