# urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserProfileViewSet, CourseContentViewSet, RegisterView,CourseViewSet
import assessment.urls

router = DefaultRouter()
router.register(r'profile', UserProfileViewSet, basename='profile')
router.register(r'course-content', CourseContentViewSet, basename='course-content')
router.register(r'courses',CourseViewSet,basename='course')

urlpatterns = [
    path('', include(router.urls)),
    path('assessment/',include(assessment.urls)),
    path('api/register/', RegisterView.as_view(), name='register'),
]