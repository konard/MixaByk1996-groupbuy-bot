from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import User, Session, Role, UserRole, BusinessElement, AccessRoleRule
from .serializers import (
    RegisterSerializer, LoginSerializer, UserSerializer, UpdateUserSerializer,
    RoleSerializer, BusinessElementSerializer, AccessRoleRuleSerializer, UpdateAccessRuleSerializer,
)
from .tokens import generate_token
from .permissions import require_auth, require_admin, require_permission


class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        user = User(
            first_name=data['first_name'],
            last_name=data['last_name'],
            patronymic=data.get('patronymic', ''),
            email=data['email'],
        )
        user.set_password(data['password'])
        user.save()

        try:
            user_role = Role.objects.get(name='user')
            UserRole.objects.create(user=user, role=user_role)
        except Role.DoesNotExist:
            pass

        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        try:
            user = User.objects.get(email=data['email'])
        except User.DoesNotExist:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
        if not user.is_active:
            return Response({'error': 'Account is deactivated'}, status=status.HTTP_401_UNAUTHORIZED)
        if not user.check_password(data['password']):
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
        token = generate_token(user.id)
        Session.objects.create(user=user, token=token)
        return Response({'token': token, 'user': UserSerializer(user).data})


class LogoutView(APIView):
    @require_auth
    def post(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        token = auth_header[7:]
        Session.objects.filter(user=request.user_obj, token=token).update(is_active=False)
        return Response({'message': 'Logged out'})


class ProfileView(APIView):
    @require_auth
    def get(self, request):
        return Response(UserSerializer(request.user_obj).data)

    @require_auth
    def patch(self, request):
        serializer = UpdateUserSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        user = request.user_obj
        for field, value in serializer.validated_data.items():
            setattr(user, field, value)
        user.save()
        return Response(UserSerializer(user).data)

    @require_auth
    def delete(self, request):
        user = request.user_obj
        user.is_active = False
        user.save()
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        token = auth_header[7:]
        Session.objects.filter(user=user, token=token).update(is_active=False)
        return Response({'message': 'Account deactivated'})


class RoleListView(APIView):
    @require_admin
    def get(self, request):
        return Response(RoleSerializer(Role.objects.all(), many=True).data)

    @require_admin
    def post(self, request):
        serializer = RoleSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        role = serializer.save()
        return Response(RoleSerializer(role).data, status=status.HTTP_201_CREATED)


class BusinessElementListView(APIView):
    @require_admin
    def get(self, request):
        return Response(BusinessElementSerializer(BusinessElement.objects.all(), many=True).data)

    @require_admin
    def post(self, request):
        serializer = BusinessElementSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        element = serializer.save()
        return Response(BusinessElementSerializer(element).data, status=status.HTTP_201_CREATED)


class AccessRuleListView(APIView):
    @require_admin
    def get(self, request):
        rules = AccessRoleRule.objects.select_related('role', 'element').all()
        return Response(AccessRoleRuleSerializer(rules, many=True).data)

    @require_admin
    def post(self, request):
        serializer = AccessRoleRuleSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        rule = serializer.save()
        return Response(AccessRoleRuleSerializer(rule).data, status=status.HTTP_201_CREATED)


class AccessRuleDetailView(APIView):
    def _get_rule(self, pk):
        try:
            return AccessRoleRule.objects.select_related('role', 'element').get(pk=pk)
        except AccessRoleRule.DoesNotExist:
            return None

    @require_admin
    def get(self, request, pk):
        rule = self._get_rule(pk)
        if rule is None:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(AccessRoleRuleSerializer(rule).data)

    @require_admin
    def patch(self, request, pk):
        rule = self._get_rule(pk)
        if rule is None:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = UpdateAccessRuleSerializer(rule, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        rule = serializer.save()
        return Response(AccessRoleRuleSerializer(rule).data)

    @require_admin
    def delete(self, request, pk):
        rule = self._get_rule(pk)
        if rule is None:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserRoleAssignView(APIView):
    @require_admin
    def post(self, request, user_id):
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        role_name = request.data.get('role')
        if not role_name:
            return Response({'error': 'role is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            role = Role.objects.get(name=role_name)
        except Role.DoesNotExist:
            return Response({'error': 'Role not found'}, status=status.HTTP_404_NOT_FOUND)
        UserRole.objects.get_or_create(user=user, role=role)
        return Response({'message': f'Role {role_name} assigned to user {user_id}'})


class MockProductListView(APIView):
    @require_permission('products', 'read_permission')
    def get(self, request):
        return Response([
            {'id': 1, 'name': 'Widget A', 'price': 9.99},
            {'id': 2, 'name': 'Widget B', 'price': 19.99},
            {'id': 3, 'name': 'Widget C', 'price': 4.99},
        ])


class MockOrderListView(APIView):
    @require_permission('orders', 'read_permission')
    def get(self, request):
        return Response([
            {'id': 1, 'product_id': 1, 'quantity': 2, 'status': 'pending'},
            {'id': 2, 'product_id': 2, 'quantity': 1, 'status': 'shipped'},
        ])


class MockShopListView(APIView):
    @require_permission('shops', 'read_permission')
    def get(self, request):
        return Response([
            {'id': 1, 'name': 'Main Store', 'address': '123 Main St'},
            {'id': 2, 'name': 'Branch Store', 'address': '456 Oak Ave'},
        ])
