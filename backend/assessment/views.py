# assessments/views.py
import json
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.utils import timezone
from django.db import transaction
from .models import Assessment, Question, Option, AssessmentAttempt, UserResponse
from .serializers import SubmissionSerializer
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.shortcuts import get_object_or_404
import json
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.utils import timezone
from django.db import transaction
from django.core.exceptions import ValidationError
from .models import Assessment, Question, Option, AssessmentAttempt, UserResponse
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.shortcuts import get_object_or_404
from .ai_quiz import generate_ai_quiz  # Import your existing AI module
import logging

logger = logging.getLogger(__name__)

class GenerateQuizView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            topic = request.data.get('topic')
            difficulty = request.data.get('difficulty')
            
            if not all([topic, difficulty]):
                return Response({
                    "error": "Missing required parameters: topic and difficulty"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Generate quiz data using AI module
            quiz_data = generate_ai_quiz(topic, difficulty)
            print(quiz_data)
            
            # Validate required structure
            if 'questions' not in quiz_data:
                raise ValidationError("Invalid quiz data: Missing questions")

            # Create Assessment instance
            assessment = Assessment.objects.create(
                title=quiz_data.get('title', f"{topic} Quiz"),
                description=quiz_data.get('description', f"Test your knowledge on {topic}"),
                passing_score=quiz_data.get('passing_score', 70),
                time_limit=quiz_data.get('time_limit', 15),
                created_by=request.user
            )

            # Prepare response with REAL IDs
            response_data = {
                "id": assessment.id,
                "title": assessment.title,
                "description": assessment.description,
                "passing_score": assessment.passing_score,
                "time_limit": assessment.time_limit,
                "questions": []
            }

            # Create questions and options with ID tracking
            for q in quiz_data['questions']:
                question = Question.objects.create(
                    assessment=assessment,
                    text=q.get('question', 'Default Question')
                )
                
                correct_answer = q.get('correct_answer')
                options = q.get('options', [])
                
                # Validate options and correct answer
                if not isinstance(options, list) or len(options) < 2:
                    raise ValidationError(f"Invalid options for question: {question.text}")
                if correct_answer not in options:
                    raise ValidationError(f"Correct answer not found in options for question: {question.text}")

                # Build question data with real IDs
                question_data = {
                    "id": question.id,
                    "text": question.text,
                    "options": []
                }

                for opt_text in options:
                    option = Option.objects.create(
                        question=question,
                        text=opt_text,
                        is_correct=(opt_text == correct_answer)
                    )
                    question_data["options"].append({
                        "id": option.id,
                        "text": option.text
                    })

                response_data["questions"].append(question_data)

            return Response(response_data, status=status.HTTP_201_CREATED)
        
        except ValidationError as e:
            logger.error(f"Validation Error: {str(e)}")
            return Response({
                "error": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
        
        except Exception as e:
            logger.exception("Server Error")
            return Response({
                "error": "Internal Server Error",
                "details": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
class AssessmentSubmissionView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        try:
            serializer = SubmissionSerializer(data=request.data)
            if not serializer.is_valid():
                return Response({
                    "error": "Invalid data",
                    "details": serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)

            data = serializer.validated_data
            print(data)
            assessment = get_object_or_404(Assessment, id=data['assessment_id'])
            
            attempt = AssessmentAttempt.objects.create(
                user=request.user,
                assessment=assessment,
                started_at=timezone.now(),
                completed_at=timezone.now()
            )
            
            score = 0
            for answer in data['answers']:
                question = get_object_or_404(Question, id=answer['question_id'])
                selected_option = get_object_or_404(Option, id=answer['selected_option_id'])
                
                UserResponse.objects.create(
                    attempt=attempt,
                    question=question,
                    selected_option=selected_option,
                    is_correct=selected_option.is_correct,
                    points_awarded=1 if selected_option.is_correct else 0
                )
                score += 10 if selected_option.is_correct else 0
            
            attempt.score = score
            attempt.passed = score >= assessment.passing_score
            attempt.save()
            
            return Response({
                "attempt_id": attempt.id,
                "score": score,
                "passing_score": assessment.passing_score,
                "passed": attempt.passed
            }, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            return Response({
                "error": "Submission failed",
                "details": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)