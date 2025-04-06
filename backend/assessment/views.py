# assessments/views.py
import json
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.utils import timezone
from django.db import transaction
from .models import (
    Assessment, Question, Option, AssessmentAttempt, UserResponse,
    LearningPath, LearningPathNode, Concept, UserConceptProficiency
)
from .serializers import (
    SubmissionSerializer, ConceptSerializer, LearningPathSerializer,
    LearningPathNodeSerializer, UserConceptProficiencySerializer
)
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
from .learning_path_service import AdaptiveLearningPathService
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from .models import LearningPath, LearningPathNode
from django.db.models import Max

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

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_assessment(request, attempt_id):
    """
    Complete an assessment attempt and generate/update a learning path.
    """
    try:
        logger.info(f"Completing assessment attempt {attempt_id} for user: {request.user.username}")
        
        # Get the assessment attempt
        attempt = AssessmentAttempt.objects.get(id=attempt_id, user=request.user)
        logger.info(f"Found assessment attempt: {attempt.id} for assessment: {attempt.assessment.title}")
        
        # Mark the attempt as completed
        attempt.completed_at = timezone.now()
        attempt.save()
        logger.info(f"Marked assessment attempt {attempt_id} as completed")
        
        # Get user's learning style and difficulty level
        try:
            learning_style = request.user.profile.learning_style
            difficulty_level = request.user.profile.difficulty_level
            logger.info(f"User profile found: learning_style={learning_style}, difficulty_level={difficulty_level}")
        except Exception as e:
            learning_style = 'visual'
            difficulty_level = 'beginner'
            logger.warning(f"User profile not found, using defaults: learning_style={learning_style}, difficulty_level={difficulty_level}")
        
        # Get the course content from the assessment
        course_content_id = getattr(attempt.assessment, 'course_content_id', None)
        course_content_title = getattr(attempt.assessment, 'course_content_title', attempt.assessment.title)
        logger.info(f"Course content for assessment: ID={course_content_id}, Title={course_content_title}")
        
        # Initialize the learning path service
        learning_service = AdaptiveLearningPathService(request.user)
        
        # Check if a learning path already exists for this course content
        learning_path = LearningPath.objects.filter(
            user=request.user,
            course_content_id=course_content_id
        ).first()
        
        if learning_path:
            logger.info(f"Updating existing learning path for course: {course_content_title}")
            # Update the existing learning path
            learning_service.update_learning_path(learning_path)
        else:
            logger.info(f"Creating new learning path for course: {course_content_title}")
            # Generate a new learning path
            learning_path = learning_service.generate_learning_path(
                topic=course_content_title,
                learning_style=learning_style,
                difficulty_level=difficulty_level
            )
            # Associate the learning path with the course content
            learning_path.course_content_id = course_content_id
            learning_path.course_content_title = course_content_title
            learning_path.save()
            logger.info(f"Created new learning path: {learning_path.title} with ID: {learning_path.id}")
        
        # Serialize the learning path
        serializer = LearningPathSerializer(learning_path)
        logger.info(f"Returning learning path data: {serializer.data}")
        
        return Response({
            'message': 'Assessment completed and learning path updated',
            'learning_path': serializer.data
        })
        
    except AssessmentAttempt.DoesNotExist:
        logger.warning(f"Assessment attempt {attempt_id} not found for user: {request.user.username}")
        return Response({'error': 'Assessment attempt not found'}, status=404)
    except Exception as e:
        logger.exception(f"Error completing assessment for user: {request.user.username}")
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_learning_path(request):
    """
    Get user's current learning path.
    """
    try:
        logger.info(f"Getting learning path for user: {request.user.username}")
        
        learning_path = LearningPath.objects.filter(
            user=request.user,
            is_active=True
        ).first()
        
        if not learning_path:
            logger.warning(f"No active learning path found for user: {request.user.username}")
            return Response({
                'error': 'No active learning path found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        logger.info(f"Found learning path: {learning_path.title} with {learning_path.nodes.count()} nodes")
        
        # Use the serializer to format the response
        serializer = LearningPathSerializer(learning_path)
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.exception(f"Error getting learning path for user: {request.user.username}")
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_learning_node(request, node_id):
    """
    Mark a learning path node as completed.
    """
    try:
        node = LearningPathNode.objects.get(
            id=node_id,
            learning_path__user=request.user
        )
        
        node.completed = True
        node.save()
        
        # Update concept proficiency
        learning_service = AdaptiveLearningPathService(request.user)
        learning_service.update_concept_proficiency({
            node.concept: 1.0  # Assume mastery after completing the node
        })
        
        # Return the updated node
        serializer = LearningPathNodeSerializer(node)
        return Response({
            'message': 'Learning node completed successfully',
            'node': serializer.data
        }, status=status.HTTP_200_OK)
        
    except LearningPathNode.DoesNotExist:
        return Response({
            'error': 'Learning node not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)