# views.py
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from .models import UserProfile, CourseContent, ProgressRecord, Course, Enrollment
import re
from .serializers import (
    UserProfileSerializer, 
    CourseContentSerializer,
    ProgressRecordSerializer,
    ProgressUpdateSerializer,
    CourseSerializer,
    EnrollmentSerializer
    
)

class RegisterView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = UserProfileSerializer(data=request.data)
        if serializer.is_valid():
            user_profile = serializer.save()
            return Response({
                "message": "User and profile created successfully",
                "username": user_profile.user.username,
                "learning_style": user_profile.learning_style
            }, status=status.HTTP_201_CREATED)
        else:
            # Debugging: Print validation errors to the console
            print("Validation Errors:", serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
         # If using DRF APIView

    
    
class UserProfileViewSet(viewsets.ModelViewSet):
    """ViewSet for viewing and editing user profiles"""
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Users can only access their own profile
        return UserProfile.objects.filter(user=self.request.user)

    # --- Custom Actions ---
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get the profile of the currently authenticated user"""
        profile = request.user.profile  # Access via OneToOneField
        serializer = self.get_serializer(profile)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def update_progress(self, request):
        """Update progress on course content (no PK needed)"""
        profile = request.user.profile  # Get current user's profile
        serializer = ProgressUpdateSerializer(data=request.data)
        
        if serializer.is_valid():
            content_id = serializer.validated_data['content_id']
            status = serializer.validated_data['status']
            completion_percentage = serializer.validated_data['completion_percentage']
            notes = serializer.validated_data.get('notes', '')
            
            content = get_object_or_404(CourseContent, id=content_id)
            
            # Update progress (assuming profile has an update_progress method)
            progress = profile.update_progress(
                content=content,
                status=status,
                completion_percentage=completion_percentage
            )
            
            if notes:  # Update notes if provided
                progress.notes = notes
                progress.save()
            
            return Response(
                ProgressRecordSerializer(progress).data,
                status=status.HTTP_200_OK
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def progress_summary(self, request):
        """Get progress summary for the current user"""
        profile = request.user.profile
        return Response(profile.get_progress_summary())

    @action(detail=False, methods=['get'])
    def recommended_content(self, request):
        """Get recommended content for the current user"""
        profile = request.user.profile
        next_difficulty = profile.determine_next_difficulty()
        
        # Get existing content matching criteria
        recommended = CourseContent.objects.filter(
            learning_style=profile.learning_style,
            difficulty_level=next_difficulty
        ).exclude(progress_records__user_profile=profile).first()
        
        if not recommended:
            # Placeholder: Add logic to generate new content via AI
            pass
        
        serializer = CourseContentSerializer(recommended)
        return Response(serializer.data)

class CourseContentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CourseContentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return CourseContent.objects.filter(
            created_by=self.request.user
        ).order_by('-created_at')

    def _parse_content(self, raw_text):
        """Minimal parser that just splits modules and extracts description"""
        # Split description and modules using module header as delimiter
        module_split = re.split(r'^##\s*Module\s*\d+:.*$', raw_text, 1, 
                               flags=re.IGNORECASE | re.MULTILINE)
        description = module_split[0].strip() if len(module_split) > 1 else raw_text.strip()
        
        # Find all modules with content
        modules = []
        module_pattern = re.compile(
            r'^##\s*Module\s*(\d+):\s*(.*?)$([\s\S]*?)(?=^##\s*Module\s*\d+:|\Z)',
            re.IGNORECASE | re.MULTILINE
        )
        
        for match in module_pattern.finditer(raw_text):
            modules.append({
                'number': int(match.group(1)),
                'title': match.group(2).strip(),
                'content': match.group(3).rstrip()
            })
        
        return {
            'description': description,
            'modules': modules
        }

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        
        try:
            processed = self._parse_content(instance.description)
            progress, _ = ProgressRecord.objects.get_or_create(
                user_profile=request.user.profile,
                content=instance,
                defaults={'status': 'not_started', 'completion_percentage': 0}
            )

            response_data = {
                **CourseContentSerializer(instance).data,
                **processed,
                'progress': ProgressRecordSerializer(progress).data
            }
            return Response(response_data)
            
        except Exception as e:
            return Response(
                {"detail": f"Error processing content: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['get'])
    def user_progress(self, request, pk=None):
        content = self.get_object()
        try:
            progress = ProgressRecord.objects.get(
                user_profile=request.user.profile,
                content=content
            )
            return Response(ProgressRecordSerializer(progress).data)
        except ProgressRecord.DoesNotExist:
            return Response(
                {"detail": "Progress not found"},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['get'])
    def latest(self, request):
        recent_content = self.get_queryset()[:5]
        processed_data = []

        for content in recent_content:
            content_data = self._parse_content(content.description)
            progress, _ = ProgressRecord.objects.get_or_create(
                user_profile=request.user.profile,
                content=content,
                defaults={'status': 'not_started', 'completion_percentage': 0}
            )

            processed_data.append({
                "id": content.id,
                "title": content.title,
                **content_data,
                "progress": progress.completion_percentage,
                "status": progress.status,
                "last_accessed": progress.last_accessed
            })

        return Response(processed_data)
class CourseViewSet(viewsets.ModelViewSet):
    """
    ViewSet for handling Course operations.
    List view shows only enrolled courses for authenticated users.
    """
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Return only courses where user is enrolled"""
        return Course.objects.filter(
            enrollment__user=self.request.user  # Changed from enrollments to enrollment
        ).prefetch_related('contents').order_by('-id')

    @action(detail=True, methods=['get'])
    def contents(self, request, pk=None):
        """Get all contents for a specific course"""
        course = self.get_object()
        contents = course.contents.all()
        serializer = CourseContentSerializer(contents, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def enroll(self, request, pk=None):
        """Enroll the current user in a course"""
        course = self.get_object()
        user = request.user
        
        # Check if already enrolled
        if Enrollment.objects.filter(user=user, course=course).exists():
            return Response(
                {"detail": "User is already enrolled in this course"},
                status=status.HTTP_400_BAD_REQUEST
            )

        Enrollment.objects.create(user=user, course=course)
        return Response(
            {"detail": "Successfully enrolled in course"},
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=['get'])
    def enrolled(self, request):
        """Get all courses the user is enrolled in (same as default list)"""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)