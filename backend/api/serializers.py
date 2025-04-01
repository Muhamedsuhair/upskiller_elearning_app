from rest_framework import serializers
from userprof.models import CourseContent

class CourseContentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseContent
        fields = [
            'id',
            'title',
            'description',
            'content_type',
            'duration_minutes',
            'difficulty_level',
            'created_by',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']