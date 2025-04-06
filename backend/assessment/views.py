# assessments/views.py
import json
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.utils import timezone
from django.db import transaction
from .models import (
    Assessment, Question, Option, AssessmentAttempt, UserResponse,
    LearningPath, LearningPathNode, Concept, UserConceptProficiency,
    QuestionConceptMapping
)
from .serializers import (
    SubmissionSerializer, ConceptSerializer, LearningPathSerializer,
    LearningPathNodeSerializer, UserConceptProficiencySerializer,
    AssessmentSerializer, QuestionSerializer, OptionSerializer,
    AssessmentAttemptSerializer, UserResponseSerializer
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
from rest_framework import viewsets
from rest_framework.decorators import action
from .concept_extraction import ConceptExtractionService
import uuid

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
            
            # Get course content information from the request
            course_content_id = request.data.get('course_content_id')
            course_content_title = request.data.get('course_content_title')
            
            # Set course content information on the assessment
            assessment.course_content_id = course_content_id
            assessment.course_content_title = course_content_title
            assessment.save()
            
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
    """Complete an assessment attempt and generate/update a learning path."""
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
        learning_service = AdaptiveLearningPathService(user=request.user)
        
        # First, analyze the assessment results to get weak concepts
        analysis = learning_service.analyze_assessment_results(attempt)
        logger.info(f"Assessment analysis results: {analysis}")
        
        if not analysis or not analysis.get('weak_concepts'):
            logger.warning("No weak concepts identified from assessment")
            # Get concepts from questions that were answered incorrectly
            incorrect_responses = attempt.responses.filter(is_correct=False)
            weak_concepts = []
            for response in incorrect_responses:
                question = response.question
                if question.concepts.exists():
                    concept = question.concepts.first()
                    weak_concepts.append({
                        'concept': concept.name,
                        'proficiency_level': 'low',
                        'description': concept.description
                    })
            
            if not weak_concepts:
                # If still no concepts, use default concepts
                weak_concepts = [
                    {
                        'concept': 'Regularization Techniques (L2 Regularization vs. Batch Normalization)',
                        'proficiency_level': 'low',
                        'description': 'Understanding different regularization techniques in deep learning.'
                    },
                    {
                        'concept': 'GAN Training Dynamics (Discriminator Performance)',
                        'proficiency_level': 'low',
                        'description': 'Understanding the training dynamics of GANs.'
                    },
                    {
                        'concept': 'Transformer Networks (Self-Attention Mechanism)',
                        'proficiency_level': 'low',
                        'description': 'Deep dive into transformer architecture.'
                    }
                ]
            analysis = {'weak_concepts': weak_concepts}
            logger.info(f"Using concepts from incorrect responses or defaults: {analysis}")
        
        # Get or create learning path specific to this course
        learning_path = LearningPath.objects.filter(
            user=request.user,
            course_content_id=course_content_id,
            is_active=True
        ).first()
        
        if learning_path:
            logger.info(f"Updating existing learning path for course: {course_content_title}")
            # Update the existing learning path
            learning_path = learning_service.update_learning_path(
                user=request.user,
                assessment_attempt=attempt,
                learning_style=learning_style
            )
        else:
            logger.info(f"Creating new learning path for course: {course_content_title}")
            # Generate a new learning path with the analyzed concepts
            learning_path = learning_service.generate_learning_path(
                user=request.user,
                weak_concepts=analysis['weak_concepts'],
                learning_style=learning_style,
                course_content_id=course_content_id,
                course_content_title=course_content_title
            )
        
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
def get_learning_path(request, course_id=None):
    """
    Get user's current learning path for a specific course.
    """
    try:
        logger.info(f"Getting learning path for user: {request.user.username} and course: {course_id}")
        
        # Filter by course_id if provided
        query_params = {
            'user': request.user,
            'is_active': True
        }
        
        if course_id:
            query_params['course_content_id'] = course_id
        
        learning_path = LearningPath.objects.filter(**query_params).first()
        
        if not learning_path:
            logger.warning(f"No active learning path found for user: {request.user.username} and course: {course_id}")
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
        learning_service = AdaptiveLearningPathService()
        learning_service.update_concept_proficiency(
            user=request.user,
            weak_concepts=[{
                'concept': node.concept.name,
                'proficiency_level': 'high',
                'description': node.concept.description
            }]
        )
        
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

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_learning_content(request, node_id):
    """
    Generate learning content for a specific node using Gemini AI.
    """
    try:
        node = LearningPathNode.objects.get(
            id=node_id,
            learning_path__user=request.user
        )
        
        # Initialize the concept extraction service
        concept_service = ConceptExtractionService()
        
        # Get the user's learning style from their profile
        try:
            learning_style = request.user.profile.learning_style
        except:
            learning_style = 'visual'  # Default to visual if not set
        
        # Define style instructions based on learning style
        style_instructions = {
            'visual': (
                "Teaching Approach:\n"
                "- Begin each concept with a mermaid diagram/flowchart\n"
                "- Use color-coded markdown tables for comparisons\n"
                "- Include 2-3 annotated visual examples\n"
                "- Add 'Visual Insight' callout boxes with SVG graphics"
            ),
            'auditory': (
                "Teaching Approach:\n"
                "- Use conversational, lecture-style explanations\n"
                "- Include audio transcript formatting with timestamps\n"
                "- Add memorable rhymes/acronyms (highlight with 🎵 icon)\n"
                "- Embed interactive audio quizzes with transcript gaps"
            ),
            'kinesthetic': (
                "Teaching Approach:\n"
                "- Create browser-executable code playgrounds\n"
                "- Add draggable/droppable HTML elements\n"
                "- Include step-by-step virtual labs\n"
                "- Embed interactive simulations with jsFiddle/CodePen\n"
                "- Use reaction-based learning (click-to-reveal steps)"
            )
        }.get(learning_style, "")
        
        # Create a prompt for Gemini based on the concept and learning style
        prompt = f"""Create a learning module for {node.concept.name} at {node.concept.difficulty_level} level.

**Role**: You are an expert educator specializing in {learning_style} learning.

**Student Profile**:
- Learning style: {learning_style}
- Topic: {node.concept.name}
- Level: {node.concept.difficulty_level}
- Format: Self-paced study

**Content Requirements**:
1. Begin with a clear introduction to the concept
2. Organize the content into clearly defined sections
3. For each section:
   - Explain concepts with clear examples
   - Include visual aids or diagrams where appropriate
   - Add practical applications
   - Include interactive elements if applicable
4. Conclude with a summary and key takeaways

**Format Requirements**:
- Use markdown formatting
- Include code examples in code blocks with language specification
- For interactive elements, use the following format:

```json
{{
  "type": "interactive_type",
  "title": "Interactive Title",
  "content": "Interactive content description",
  "config": {{
    "key": "value"
  }}
}}
```

**Learning Style Instructions**:
{style_instructions}

**Concept Description**:
{node.concept.description}
"""
        
        # Generate content using the concept extraction service
        content = concept_service.generate_learning_content(
            concept_name=node.concept.name,
            concept_description=node.concept.description,
            content_type=node.content_type,
            difficulty_level=node.concept.difficulty_level,
            prompt=prompt
        )
        
        # Clean up the content if it has markdown code block formatting
        if content.startswith('```json'):
            content = content[7:]
        if content.endswith('```'):
            content = content[:-3]
        content = content.strip()
        
        # Update the node's content_id with the generated content
        node.content_id = str(uuid.uuid4())  # Generate a unique ID for the content
        node.save()
        
        # Log the content type and length for debugging
        logger.info(f"Generated {node.content_type} content for node {node_id}, length: {len(content)}")
        
        return Response({
            'content': content,
            'content_id': node.content_id,
            'content_type': node.content_type
        }, status=status.HTTP_200_OK)
        
    except LearningPathNode.DoesNotExist:
        return Response({
            'error': 'Learning node not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.exception(f"Error generating learning content: {str(e)}")
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class AssessmentViewSet(viewsets.ModelViewSet):
    queryset = Assessment.objects.all()
    serializer_class = AssessmentSerializer

    @action(detail=True, methods=['post'])
    def start_attempt(self, request, pk=None):
        assessment = self.get_object()
        user = request.user

        # Create a new attempt
        attempt = AssessmentAttempt.objects.create(
            user=user,
            assessment=assessment,
            started_at=timezone.now()
        )

        # Get questions for the assessment
        questions = Question.objects.filter(assessment=assessment)
        
        # Extract concepts for each question if not already mapped
        concept_extractor = ConceptExtractionService()
        for question in questions:
            # Always try to map concepts for each question
            concepts = concept_extractor.extract_concepts_from_question(question.text)
            for concept_data in concepts:
                try:
                    # Try to get existing concept
                    concept = Concept.objects.get(name=concept_data['name'])
                except Concept.DoesNotExist:
                    # If concept doesn't exist, create it
                    concept = Concept.objects.create(
                        name=concept_data['name'],
                        description=concept_data['description'],
                        difficulty_level=concept_data.get('difficulty_level', 'beginner')
                    )
                    logger.info(f"Created new concept: {concept.name}")
                
                # Create or update the mapping
                QuestionConceptMapping.objects.update_or_create(
                    question=question,
                    concept=concept,
                    defaults={'weight': concept_data.get('weight', 1.0)}
                )
                logger.info(f"Mapped concept {concept.name} to question {question.id}")

        serializer = AssessmentAttemptSerializer(attempt)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def submit_attempt(self, request, pk=None):
        attempt_id = request.data.get('attempt_id')
        responses = request.data.get('responses', [])

        try:
            attempt = AssessmentAttempt.objects.get(id=attempt_id)
        except AssessmentAttempt.DoesNotExist:
            return Response(
                {'error': 'Assessment attempt not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if attempt.completed_at:
            return Response(
                {'error': 'Assessment attempt already completed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        incorrect_responses = []
        with transaction.atomic():
            # Process each response
            for response_data in responses:
                question_id = response_data.get('question_id')
                selected_option_id = response_data.get('selected_option_id')

                try:
                    question = Question.objects.get(id=question_id)
                    selected_option = Option.objects.get(id=selected_option_id)
                except (Question.DoesNotExist, Option.DoesNotExist):
                    return Response(
                        {'error': f'Invalid question or option ID: {question_id}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Create user response
                user_response = UserResponse.objects.create(
                    attempt=attempt,
                    question=question,
                    selected_option=selected_option,
                    is_correct=selected_option.is_correct
                )

                # Track incorrect responses
                if not selected_option.is_correct:
                    incorrect_responses.append({
                        'question': question.text,
                        'selected_answer': selected_option.text,
                        'correct_answer': question.options.filter(is_correct=True).first().text
                    })

            # Complete the attempt
            attempt.completed_at = timezone.now()
            attempt.save()

            # Initialize services
            learning_path_service = AdaptiveLearningPathService(request.user)
            concept_extractor = ConceptExtractionService()

            # Analyze incorrect responses to identify concepts
            analysis = concept_extractor.analyze_assessment_results(incorrect_responses)
            logger.info(f"Analysis results: {analysis}")

            # Create concepts for incorrect answers
            weak_concepts = []
            if incorrect_responses:
                for concept_data in analysis.get('weak_concepts', []):
                    try:
                        # Try to get or create the concept
                        concept, created = Concept.objects.get_or_create(
                            name=concept_data['concept'],
                            defaults={
                                'description': concept_data.get('recommendations', [''])[0],
                                'difficulty_level': 'intermediate'
                            }
                        )
                        if created:
                            logger.info(f"Created new concept: {concept.name}")

                        # Add to weak concepts list
                        weak_concepts.append({
                            'concept': concept.name,
                            'proficiency_level': concept_data.get('proficiency_level', 'low'),
                            'description': concept.description
                        })

                        # Map concept to questions that were answered incorrectly
                        for response in incorrect_responses:
                            question = Question.objects.get(text=response['question'])
                            QuestionConceptMapping.objects.get_or_create(
                                question=question,
                                concept=concept,
                                defaults={'weight': 1.0}
                            )
                    except Exception as e:
                        logger.error(f"Error creating concept {concept_data['concept']}: {str(e)}")

            # If no concepts were identified, use default concepts from questions
            if not weak_concepts:
                weak_concepts = [
                    {
                        'concept': 'Regularization Techniques (L2 Regularization vs. Batch Normalization)',
                        'proficiency_level': 'low',
                        'description': 'Understanding different regularization techniques in deep learning.'
                    },
                    {
                        'concept': 'GAN Training Dynamics (Discriminator Performance)',
                        'proficiency_level': 'low',
                        'description': 'Understanding the training dynamics of GANs.'
                    },
                    {
                        'concept': 'Transformer Networks (Self-Attention Mechanism)',
                        'proficiency_level': 'low',
                        'description': 'Deep dive into transformer architecture.'
                    }
                ]
                for concept_data in weak_concepts:
                    concept, created = Concept.objects.get_or_create(
                        name=concept_data['concept'],
                        defaults={
                            'description': concept_data['description'],
                            'difficulty_level': 'intermediate'
                        }
                    )

            # Get or create learning path
            learning_path = LearningPath.objects.filter(
                user=request.user,
                is_active=True
            ).first()

            if learning_path:
                learning_path = learning_path_service.update_learning_path(
                    user=request.user,
                    assessment_attempt=attempt,
                    learning_style=request.user.profile.learning_style
                )
            else:
                learning_path = learning_path_service.generate_learning_path(
                    user=request.user,
                    weak_concepts=weak_concepts,
                    learning_style=request.user.profile.learning_style
                )

            # Return the learning path
            serializer = LearningPathSerializer(learning_path)
            return Response(serializer.data)

class LearningPathViewSet(viewsets.ModelViewSet):
    queryset = LearningPath.objects.all()
    serializer_class = LearningPathSerializer

    def get_queryset(self):
        return LearningPath.objects.filter(user=self.request.user)

    @action(detail=True, methods=['post'])
    def complete_node(self, request, pk=None):
        learning_path = self.get_object()
        node_id = request.data.get('node_id')

        try:
            node = LearningPathNode.objects.get(
                id=node_id,
                learning_path=learning_path
            )
        except LearningPathNode.DoesNotExist:
            return Response(
                {'error': 'Learning path node not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Mark node as completed
        node.completed = True
        node.save()

        # Update concept proficiency
        learning_path_service = AdaptiveLearningPathService()
        learning_path_service.update_concept_proficiency(
            user=request.user,
            weak_concepts=[{
                'concept': node.concept.name,
                'proficiency_level': 'high',
                'description': node.concept.description
            }]
        )

        serializer = LearningPathNodeSerializer(node)
        return Response(serializer.data)