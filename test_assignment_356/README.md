# Test Assignment — Developer (issue #356)

Implementation of the test assignment attached to
[issue #356](https://github.com/MixaByk1996/groupbuy-bot/issues/356).

## Task

Build a backend application implementing a custom authentication and authorization system
using **DRF + SQLite** (production recommendation: DRF + Postgres).

## Layout

```
test_assignment_356/
├── README.md                          # this file
├── settings.py                        # Django settings
├── urls.py                            # URL routing
├── seed.py                            # Populate DB with test data
├── manage.py                          # Django management script
├── auth_app/
│   ├── models.py                      # DB models
│   ├── views.py                       # API views
│   ├── serializers.py                 # DRF serializers
│   ├── middleware.py                  # JWT auth middleware
│   ├── tokens.py                      # JWT generate/decode
│   ├── permissions.py                 # Permission decorators
│   ├── exceptions.py                  # Custom error handler
│   └── migrations/0001_initial.py    # DB schema
└── tests/
    ├── conftest.py
    └── test_auth.py                   # 36 tests
```

## Database Schema

### `auth_app_user`
| Column        | Type        | Notes                          |
|---------------|-------------|--------------------------------|
| id            | INTEGER PK  |                                |
| first_name    | VARCHAR     |                                |
| last_name     | VARCHAR     |                                |
| patronymic    | VARCHAR     | optional                       |
| email         | VARCHAR     | unique                         |
| password_hash | VARCHAR     | bcrypt hash                    |
| is_active     | BOOLEAN     | False = soft-deleted           |
| created_at    | DATETIME    |                                |

### `auth_app_role`
| Column      | Type       | Notes                                    |
|-------------|------------|------------------------------------------|
| id          | INTEGER PK |                                          |
| name        | VARCHAR    | unique; e.g. admin, manager, user, guest |
| description | VARCHAR    |                                          |

### `auth_app_userrole`
| Column  | Type       | Notes              |
|---------|------------|--------------------|
| id      | INTEGER PK |                    |
| user_id | FK → user  |                    |
| role_id | FK → role  |                    |

### `auth_app_businesselement`
| Column      | Type       | Notes                                          |
|-------------|------------|------------------------------------------------|
| id          | INTEGER PK |                                                |
| name        | VARCHAR    | unique; e.g. users, products, shops, orders    |
| description | VARCHAR    |                                                |

### `auth_app_accessrolerule`
| Column              | Type       | Notes                                    |
|---------------------|------------|------------------------------------------|
| id                  | INTEGER PK |                                          |
| role_id             | FK → role  |                                          |
| element_id          | FK → element |                                        |
| read_permission     | BOOLEAN    | read own objects                         |
| read_all_permission | BOOLEAN    | read all objects                         |
| create_permission   | BOOLEAN    | create new objects                       |
| update_permission   | BOOLEAN    | update own objects                       |
| update_all_permission | BOOLEAN  | update any object                        |
| delete_permission   | BOOLEAN    | delete own objects                       |
| delete_all_permission | BOOLEAN  | delete any object                        |

### `auth_app_session`
| Column     | Type       | Notes                     |
|------------|------------|---------------------------|
| id         | INTEGER PK |                           |
| user_id    | FK → user  |                           |
| token      | VARCHAR    | JWT token (unique)        |
| created_at | DATETIME   |                           |
| is_active  | BOOLEAN    | False = logged out        |

## Access Control Design

The system uses **RBAC** (Role-Based Access Control):

1. Each **User** can have multiple **Roles**.
2. Each **Role** has an **AccessRoleRule** per **BusinessElement** describing exactly
   which operations the role may perform (read/read_all/create/update/update_all/delete/delete_all).
3. On every protected request, `JWTAuthMiddleware` resolves the user from the
   `Authorization: Bearer <token>` header by looking up the active session.
4. The `require_permission(element, permission)` decorator checks the resolved
   user's roles against the access rules table.
5. Missing/invalid token → **401 Unauthorized**.
6. Valid user but insufficient permissions → **403 Forbidden**.

### Seed roles and their default permissions

| Role    | products                        | orders                        | shops | access_rules |
|---------|---------------------------------|-------------------------------|-------|--------------|
| admin   | full (r/ra/c/u/ua/d/da)         | full                          | full  | full         |
| manager | r, ra, c, u, d (no ua/da)       | r, ra, c, u, d (no ua/da)    | r, ra | —            |
| user    | r only                          | r, c, u, d (own)              | —     | —            |
| guest   | r only                          | —                             | —     | —            |

## API Endpoints

### Authentication

| Method | Path                  | Auth required | Description                          |
|--------|-----------------------|---------------|--------------------------------------|
| POST   | /api/auth/register/   | No            | Register new user                    |
| POST   | /api/auth/login/      | No            | Login, returns JWT token             |
| POST   | /api/auth/logout/     | Yes           | Invalidate current session           |
| GET    | /api/auth/profile/    | Yes           | Get current user profile             |
| PATCH  | /api/auth/profile/    | Yes           | Update profile (name/patronymic)     |
| DELETE | /api/auth/profile/    | Yes           | Soft-delete account (is_active=False)|

### Admin — Access Control Management

| Method | Path                           | Role  | Description                     |
|--------|--------------------------------|-------|---------------------------------|
| GET    | /api/admin/roles/              | admin | List all roles                  |
| POST   | /api/admin/roles/              | admin | Create a role                   |
| GET    | /api/admin/elements/           | admin | List all business elements      |
| POST   | /api/admin/elements/           | admin | Create a business element       |
| GET    | /api/admin/rules/              | admin | List all access rules           |
| POST   | /api/admin/rules/              | admin | Create an access rule           |
| GET    | /api/admin/rules/<id>/         | admin | Get a single rule               |
| PATCH  | /api/admin/rules/<id>/         | admin | Update permission flags         |
| DELETE | /api/admin/rules/<id>/         | admin | Delete a rule                   |
| POST   | /api/admin/users/<id>/roles/   | admin | Assign role to a user           |

### Mock Business Resources (demonstrate RBAC)

| Method | Path          | Required permission        |
|--------|---------------|----------------------------|
| GET    | /api/products/| products.read_permission   |
| GET    | /api/orders/  | orders.read_permission     |
| GET    | /api/shops/   | shops.read_permission      |

## Running

```bash
# Install dependencies
pip install django djangorestframework bcrypt PyJWT

# Apply migrations
cd test_assignment_356
python manage.py migrate

# Populate test data
python seed.py

# Run server
python manage.py runserver

# Run tests (36 tests)
pytest test_assignment_356/tests/ -v
```

### Test credentials (after seed.py)

| Email                | Password    | Role    |
|----------------------|-------------|---------|
| admin@example.com    | adminpass   | admin   |
| manager@example.com  | managerpass | manager |
| user@example.com     | userpass    | user    |
| guest@example.com    | guestpass   | guest   |

## Tests

```
36 passed
```

Coverage:
- Registration (success, duplicate email, password mismatch, missing fields)
- Login (success, wrong password, unknown email, deactivated user, session created)
- Logout (success, session invalidated, unauthenticated)
- Profile (get, update, soft-delete, deleted user cannot login)
- JWT tokens (generate/decode, invalid, tampered)
- Admin roles API (list/create, non-admin blocked, unauthenticated blocked)
- Admin access rules API (list/update/delete, assign role to user)
- Mock business views (user with permission allowed, without → 403, unauthenticated → 401)
