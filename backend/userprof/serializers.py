# serializers.py
from rest_framework import serializers
from .models import UserProfile, CourseContent, ProgressRecord, Course, Enrollment, Certificate
from django.contrib.auth.models import User


# serializers.py
class CourseContentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseContent
        fields = [
            'id',
            'title',
            'description',
            'content_type',
            'difficulty_level',
            'duration_minutes',
            'created_by',
            'created_at',
            'updated_at',
            'has_diagrams'
        ]


class ProgressRecordSerializer(serializers.ModelSerializer):
    content = CourseContentSerializer(read_only=True)
    
    class Meta:
        model = ProgressRecord
        fields = ['id', 'content', 'status', 'completion_percentage', 'last_accessed', 'notes']


# serializers.py
class UserProfileSerializer(serializers.ModelSerializer):
    # Allow username and email to be written during registration
    username = serializers.CharField(source='user.username', required=True)
    email = serializers.EmailField(source='user.email', required=True)
    password = serializers.CharField(write_only=True, style={'input_type': 'password'}, required=True)

    class Meta:
        model = UserProfile
        fields = [
            'username',
            'email',
            'password',
            'learning_style',
            'bio',
            'date_joined',
            'last_active'
        ]
        extra_kwargs = {
            'date_joined': {'read_only': True},
            'last_active': {'read_only': True}
        }

    def create(self, validated_data):
        # Extract user-related data
        user_data = validated_data.pop('user', {})  # Data from source='user.username' and source='user.email'
        username = user_data.get('username')
        email = user_data.get('email')
        password = validated_data.pop('password', None)

        if not username or not email or not password:
            raise serializers.ValidationError({
                'username': 'This field is required.',
                'email': 'This field is required.',
                'password': 'This field is required.'
            })

        # Create the user. This will trigger your signal to automatically create a UserProfile.
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password
        )

        # Retrieve the UserProfile created by the post_save signal
        try:
            profile = UserProfile.objects.get(user=user)
        except UserProfile.DoesNotExist:
            # If for some reason the signal didn't create it, create it now
            profile = UserProfile.objects.create(user=user)

        # Update additional fields on the profile
        profile.learning_style = validated_data.get('learning_style', profile.learning_style)
        profile.bio = validated_data.get('bio', profile.bio)
        profile.save()
        return profile

class ProgressUpdateSerializer(serializers.Serializer):
    content_id = serializers.IntegerField()
    status = serializers.ChoiceField(
        choices=ProgressRecord.STATUS_CHOICES,
        default='not_started'
    )
    completion_percentage = serializers.IntegerField(
        min_value=0,
        max_value=100,
        default=0
    )
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        """
        Custom validation to ensure status and completion_percentage are consistent
        """
        status = data.get('status')
        completion_percentage = data.get('completion_percentage', 0)

        if status == 'completed' and completion_percentage < 100:
            raise serializers.ValidationError({
                'completion_percentage': 'Completion percentage must be 100 when status is completed'
            })

        if status == 'not_started' and completion_percentage > 0:
            raise serializers.ValidationError({
                'completion_percentage': 'Completion percentage must be 0 when status is not started'
            })

        return data

class CourseSerializer(serializers.ModelSerializer):
    is_enrolled = serializers.SerializerMethodField()
    contents = serializers.HyperlinkedRelatedField(
        many=True,
        read_only=True,
        view_name='coursecontent-detail'
    )

    class Meta:
        model = Course
        fields = [
            'id', 
            'title', 
            'description',
            'is_enrolled',
            'contents',
            'enrolled_users'
        ]
        extra_kwargs = {
            'enrolled_users': {'read_only': True}
        }

    def get_is_enrolled(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.enrollments.filter(user=request.user).exists()
        return False

class EnrollmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Enrollment
        fields = ['id', 'user', 'course', 'enrolled_at']
        read_only_fields = ['user', 'enrolled_at']

class CertificateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Certificate
        fields = ['id', 'title', 'course_title', 'completion_date', 'score', 'total_questions', 'certificate_data', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']    