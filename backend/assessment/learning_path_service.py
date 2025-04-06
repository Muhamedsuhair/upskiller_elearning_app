import logging
from django.core.exceptions import ValidationError
from django.db.models import Max, Avg, Count
from .models import LearningPath, LearningPathNode, Concept, UserConceptProficiency, AssessmentAttempt, UserResponse, QuestionConceptMapping, Assessment, Question
from .concept_extraction import ConceptExtractionService
import numpy as np
from typing import List, Dict, Tuple
import uuid
import json
from django.db import transaction
from django.utils import timezone
from datetime import datetime

logger = logging.getLogger(__name__)

class AdaptiveLearningPathService:
    def __init__(self, user=None):
        self.user = user
        self.concept_extractor = ConceptExtractionService()

    def analyze_assessment_results(self, assessment_attempt):
        """Analyze assessment results to identify weak concepts."""
        if not assessment_attempt:
            raise ValidationError("Assessment attempt is required")
        
        if not isinstance(assessment_attempt, AssessmentAttempt):
            raise ValidationError("Invalid assessment attempt object")

        incorrect_responses = assessment_attempt.responses.filter(is_correct=False)
        
        # Get the analysis from Gemini AI
        analysis = self.concept_extractor.analyze_assessment_results([
            {
                'question': response.question.text,
                'selected_answer': response.selected_option.text if response.selected_option else response.response_text,
                'correct_answer': response.question.options.filter(is_correct=True).first().text if response.question.options.filter(is_correct=True).exists() else None
            }
            for response in incorrect_responses
        ])
        
        return analysis

    def ensure_concepts_exist(self, concepts_data):
        """Ensure all concepts exist in the database, creating them if necessary."""
        created_concepts = []
        for concept_data in concepts_data:
            if not isinstance(concept_data, dict):
                logger.warning(f"Invalid concept data format: {concept_data}")
                continue

            concept_name = concept_data.get('concept')
            if not concept_name:
                logger.warning(f"Missing concept name in data: {concept_data}")
                continue

            try:
                # Try to get or create the concept
                concept, created = Concept.objects.get_or_create(
                    name=concept_name,
                    defaults={
                        'description': concept_data.get('recommendations', ['No description available'])[0] if concept_data.get('recommendations') else concept_data.get('description', 'No description available'),
                        'difficulty_level': 'intermediate'
                    }
                )
                if created:
                    logger.info(f"Created new concept: {concept.name}")
                created_concepts.append({
                    'concept': concept.name,
                    'proficiency_level': concept_data.get('proficiency_level', 'low'),
                    'description': concept.description
                })
            except Exception as e:
                logger.error(f"Error creating concept {concept_name}: {str(e)}")
                continue

        return created_concepts

    def update_concept_proficiency(self, user, weak_concepts):
        """Update user's concept proficiency based on assessment results."""
        if not user:
            raise ValidationError("User is required")
        
        if not weak_concepts:
            logger.warning("No weak concepts provided for proficiency update")
            return

        # First ensure all concepts exist
        weak_concepts = self.ensure_concepts_exist(weak_concepts)

        for concept_data in weak_concepts:
            concept_name = concept_data.get('concept')
            proficiency_level = concept_data.get('proficiency_level')
            
            if not concept_name or not proficiency_level:
                logger.warning(f"Missing required concept data: {concept_data}")
                continue
            
            # Convert proficiency level to score
            proficiency_score = {
                'low': 0.3,
                'medium': 0.6,
                'high': 0.9
            }.get(proficiency_level.lower(), 0.3)
            
            try:
                concept = Concept.objects.get(name=concept_name)
                proficiency, created = UserConceptProficiency.objects.update_or_create(
                    user=user,
                    concept=concept,
                    defaults={'score': proficiency_score}
                )
                logger.info(f"Updated proficiency for concept {concept_name}: {proficiency_score}")
            except Exception as e:
                logger.error(f"Error updating proficiency for concept {concept_name}: {str(e)}")
                continue

    def generate_learning_path(self, user, weak_concepts, learning_style, course_content_id=None, course_content_title=None):
        """Generate a new learning path for the user based on weak concepts."""
        if not user:
            raise ValidationError("User is required")
        
        if not learning_style:
            raise ValidationError("Learning style is required")
        
        if learning_style not in ['visual', 'auditory', 'kinesthetic']:
            raise ValidationError("Invalid learning style")

        try:
            # Deactivate any existing active learning paths for this course
            if course_content_id:
                LearningPath.objects.filter(
                    user=user,
                    course_content_id=course_content_id,
                    is_active=True
                ).update(is_active=False)

            # Create new learning path
            title = f"Learning Path - {course_content_title}" if course_content_title else f"Learning Path - {datetime.now().strftime('%Y-%m-%d')}"
            learning_path = LearningPath.objects.create(
                user=user,
                title=title,
                course_content_id=course_content_id,
                course_content_title=course_content_title,
                is_active=True
            )

            # Add nodes for each weak concept
            for order, concept_data in enumerate(weak_concepts):
                concept_name = concept_data.get('concept')
                try:
                    concept = Concept.objects.get(name=concept_name)
                    
                    content_type = {
                        'visual': 'video',
                        'auditory': 'text',
                        'kinesthetic': 'interactive'
                    }.get(learning_style, 'text')
                    
                    LearningPathNode.objects.create(
                        learning_path=learning_path,
                        concept=concept,
                        order=order,
                        content_type=content_type,
                        content_id=f"{concept.id}_{content_type}"
                    )
                except Concept.DoesNotExist:
                    logger.warning(f"Concept not found: {concept_name}")
                    continue

            return learning_path

        except Exception as e:
            logger.error(f"Error generating learning path: {str(e)}")
            raise

    def update_learning_path(self, user, assessment_attempt, learning_style):
        """Update or create a learning path based on latest assessment results."""
        if not user:
            raise ValidationError("User is required")
        
        if not assessment_attempt:
            raise ValidationError("Assessment attempt is required")
        
        if not learning_style:
            raise ValidationError("Learning style is required")
        
        if learning_style not in ['visual', 'auditory', 'kinesthetic']:
            raise ValidationError("Invalid learning style")

        try:
            # Get course content information from the assessment
            course_content_id = getattr(assessment_attempt.assessment, 'course_content_id', None)
            course_content_title = getattr(assessment_attempt.assessment, 'course_content_title', 
                                         assessment_attempt.assessment.title)

            if not course_content_id:
                raise ValidationError("Assessment must be associated with a course")

            # Analyze the assessment results
            analysis = self.analyze_assessment_results(assessment_attempt)
            
            # Ensure concepts exist and update proficiency
            if analysis and 'weak_concepts' in analysis:
                # First ensure all concepts exist
                weak_concepts = self.ensure_concepts_exist(analysis['weak_concepts'])
                self.update_concept_proficiency(user, weak_concepts)
            else:
                logger.warning("No weak concepts found in analysis")
                weak_concepts = []
            
            # Get or create learning path for this specific course
            learning_path = LearningPath.objects.filter(
                user=user,
                course_content_id=course_content_id,
                is_active=True
            ).first()
            
            if not learning_path:
                # Create new learning path if none exists for this course
                learning_path = self.generate_learning_path(
                    user=user,
                    weak_concepts=weak_concepts,
                    learning_style=learning_style,
                    course_content_id=course_content_id,
                    course_content_title=course_content_title
                )
            else:
                # Add new nodes for weak concepts
                existing_concepts = set(learning_path.nodes.values_list('concept__name', flat=True))
                new_concepts = [
                    concept for concept in weak_concepts
                    if concept['concept'] not in existing_concepts
                ]
                
                if new_concepts:
                    # Get the highest order number
                    max_order = learning_path.nodes.aggregate(max_order=Max('order'))['max_order'] or 0
                    
                    # Add new nodes
                    for order, concept_data in enumerate(new_concepts, max_order + 1):
                        concept_name = concept_data.get('concept')
                        try:
                            concept = Concept.objects.get(name=concept_name)
                            
                            content_type = {
                                'visual': 'video',
                                'auditory': 'text',
                                'kinesthetic': 'interactive'
                            }.get(learning_style, 'text')
                            
                            LearningPathNode.objects.create(
                                learning_path=learning_path,
                                concept=concept,
                                order=order,
                                content_type=content_type,
                                content_id=f"{concept.id}_{content_type}"
                            )
                        except Concept.DoesNotExist:
                            logger.warning(f"Concept not found after creation attempt: {concept_name}")
                            continue
            
            return learning_path
            
        except Exception as e:
            logger.error(f"Error updating learning path: {str(e)}")
            raise 