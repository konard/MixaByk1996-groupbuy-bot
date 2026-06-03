from django.urls import path
from .auth_app import views

urlpatterns = [
    path('api/auth/register/', views.RegisterView.as_view()),
    path('api/auth/login/', views.LoginView.as_view()),
    path('api/auth/logout/', views.LogoutView.as_view()),
    path('api/auth/profile/', views.ProfileView.as_view()),

    path('api/admin/roles/', views.RoleListView.as_view()),
    path('api/admin/elements/', views.BusinessElementListView.as_view()),
    path('api/admin/rules/', views.AccessRuleListView.as_view()),
    path('api/admin/rules/<int:pk>/', views.AccessRuleDetailView.as_view()),
    path('api/admin/users/<int:user_id>/roles/', views.UserRoleAssignView.as_view()),

    path('api/products/', views.MockProductListView.as_view()),
    path('api/orders/', views.MockOrderListView.as_view()),
    path('api/shops/', views.MockShopListView.as_view()),
]
