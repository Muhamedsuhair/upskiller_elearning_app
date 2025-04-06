from django.db.models import Avg, Count, Max
from .models import (
    AssessmentAttempt, UserResponse, QuestionConceptMapping,
    Concept, UserConceptProficiency, LearningPath, LearningPathNode
)
import numpy as np
from typing import List, Dict, Tuple
import logging
import uuid

logger = logging.getLogger(__name__)

class AdaptiveLearningPathService:
    def __init__(self, user):
        self.user = user

    def analyze_assessment_results(self, attempt: AssessmentAttempt) -> Dict[Concept, float]:
        """
        Analyze assessment results and return concept proficiency scores.
        """
        logger.info(f"Analyzing assessment results for attempt {attempt.id}")
        
        # Get all incorrect responses
        incorrect_responses = UserResponse.objects.filter(
            attempt=attempt,
            is_correct=False
        ).select_related('question')
        
        logger.info(f"Found {incorrect_responses.count()} incorrect responses")
        
        # Get concept mappings for incorrect questions
        concept_scores = {}
        for response in incorrect_responses:
            mappings = QuestionConceptMapping.objects.filter(
                question=response.question
            ).select_related('concept')
            
            logger.info(f"Found {mappings.count()} concept mappings for question {response.question.id}")
            
            for mapping in mappings:
                concept = mapping.concept
                if concept not in concept_scores:
                    concept_scores[concept] = []
                concept_scores[concept].append(1 - mapping.weight)

        # Calculate average proficiency for each concept
        concept_proficiency = {}
        for concept, scores in concept_scores.items():
            concept_proficiency[concept] = 1 - np.mean(scores)
            logger.info(f"Concept {concept.name}: proficiency = {concept_proficiency[concept]:.2f}")
        
        # If no concept mappings found, create a generic concept
        if not concept_proficiency:
            logger.warning("No concept mappings found, creating a generic concept")
            topic = attempt.assessment.title
            concept = Concept.objects.filter(name__icontains=topic).first()
            
            if not concept:
                concept = Concept.objects.create(
                    name=topic,
                    description=f"Learning materials for {topic}",
                    difficulty_level='beginner'
                )
                logger.info(f"Created new concept: {concept.name}")
            
            concept_proficiency[concept] = 0.5  # Default proficiency

        return concept_proficiency

    def update_concept_proficiency(self, concept_proficiency: Dict[Concept, float]):
        """
        Update user's concept proficiency scores based on assessment results.
        """
        for concept, score in concept_proficiency.items():
            UserConceptProficiency.objects.update_or_create(
                user=self.user,
                concept=concept,
                defaults={'proficiency_score': score}
            )

    def get_weak_concepts(self, threshold: float = 0.7) -> List[Concept]:
        """
        Get concepts where user's proficiency is below the threshold.
        """
        return Concept.objects.filter(
            userconceptproficiency__user=self.user,
            userconceptproficiency__proficiency_score__lt=threshold
        ).distinct()

    def generate_learning_path(self, topic: str, learning_style: str, difficulty_level: str) -> LearningPath:
        """
        Generate a new learning path based on assessment results and user preferences.
        """
        logger.info(f"Generating learning path for topic: {topic}, learning_style: {learning_style}, difficulty_level: {difficulty_level}")
        
        # Create new learning path
        learning_path = LearningPath.objects.create(
            user=self.user,
            title=f"Learning Path: {topic}",
            description=f"Personalized learning path for {topic}"
        )
        
        logger.info(f"Created learning path: {learning_path.title} with ID: {learning_path.id}")

        # Get all concepts for the topic
        concepts = Concept.objects.filter(
            name__icontains=topic,
            difficulty_level=difficulty_level
        )
        
        logger.info(f"Found {concepts.count()} concepts for topic: {topic}")
        
        # If no concepts found for the topic, create a generic concept
        if not concepts.exists():
            logger.warning(f"No concepts found for topic: {topic}, creating a generic concept")
            concept = Concept.objects.create(
                name=topic,
                description=f"Learning materials for {topic}",
                difficulty_level=difficulty_level
            )
            concepts = [concept]
            logger.info(f"Created generic concept: {concept.name} with ID: {concept.id}")
            
        # Sort concepts by prerequisites and proficiency
        sorted_concepts = self._sort_concepts_by_dependencies(concepts)
        logger.info(f"Sorted {len(sorted_concepts)} concepts by dependencies")

        # Create learning path nodes
        used_orders = set()
        for concept in sorted_concepts:
            # Determine content type based on learning style
            content_type = self._get_content_type_for_style(learning_style)
            
            # Generate content ID
            content_id = self._generate_content_id(concept, content_type)
            
            # Find the next available order
            order = 0
            while order in used_orders:
                order += 1
            
            # Create node
            try:
                node = LearningPathNode.objects.create(
                    learning_path=learning_path,
                    concept=concept,
                    order=order,
                    content_type=content_type,
                    content_id=content_id
                )
                used_orders.add(order)
                logger.info(f"Created learning path node: {node.id} for concept: {concept.name} with content type: {content_type} and order: {order}")
            except Exception as e:
                logger.exception(f"Error creating learning path node: {str(e)}")
                raise

        # Verify nodes were created
        nodes_count = LearningPathNode.objects.filter(learning_path=learning_path).count()
        logger.info(f"Verified {nodes_count} nodes were created for learning path: {learning_path.title}")

        return learning_path

    def _sort_concepts_by_dependencies(self, concepts: List[Concept]) -> List[Concept]:
        """
        Sort concepts based on their prerequisites and proficiency levels.
        """
        logger.info(f"Sorting {len(concepts)} concepts by dependencies")
        
        # Create a graph of concept dependencies
        graph = {}
        for concept in concepts:
            logger.info(f"Processing concept: {concept.name} (ID: {concept.id})")
            prerequisites = concept.prerequisites.all()
            logger.info(f"Found {prerequisites.count()} prerequisites for concept: {concept.name}")
            
            graph[concept.id] = {
                'concept': concept,
                'dependencies': [p.id for p in prerequisites],
                'visited': False,
                'temp_mark': False
            }
        
        # Perform topological sort
        sorted_concepts = []
        
        def visit(concept_id):
            if graph[concept_id]['temp_mark']:
                logger.error(f"Circular dependency detected for concept ID: {concept_id}")
                raise ValueError("Circular dependency detected in concept prerequisites")
            if graph[concept_id]['visited']:
                return
                
            graph[concept_id]['temp_mark'] = True
            
            for dep_id in graph[concept_id]['dependencies']:
                if dep_id in graph:
                    visit(dep_id)
                    
            graph[concept_id]['temp_mark'] = False
            graph[concept_id]['visited'] = True
            sorted_concepts.append(graph[concept_id]['concept'])
            logger.info(f"Added concept {graph[concept_id]['concept'].name} to sorted list")
        
        # Visit all concepts
        for concept_id in graph:
            if not graph[concept_id]['visited']:
                visit(concept_id)
        
        logger.info(f"Successfully sorted {len(sorted_concepts)} concepts")
        return sorted_concepts

    def _get_content_type_for_style(self, learning_style: str) -> str:
        """
        Determine the appropriate content type based on learning style.
        """
        logger.info(f"Determining content type for learning style: {learning_style}")
        
        content_type_mapping = {
            'visual': 'video',
            'auditory': 'audio',
            'reading': 'text',
            'kinesthetic': 'interactive'
        }
        
        content_type = content_type_mapping.get(learning_style.lower(), 'text')
        logger.info(f"Selected content type: {content_type} for learning style: {learning_style}")
        return content_type

    def _generate_content_id(self, concept: Concept, content_type: str) -> str:
        """
        Generate a unique content ID for a concept and content type.
        """
        logger.info(f"Generating content ID for concept: {concept.name} with content type: {content_type}")
        
        # Create a unique identifier based on concept and content type
        content_id = f"{concept.id}_{content_type}_{uuid.uuid4().hex[:8]}"
        logger.info(f"Generated content ID: {content_id}")
        return content_id

    def update_learning_path(self, learning_path: LearningPath):
        """
        Update an existing learning path based on the latest assessment results.
        """
        logger.info(f"Updating learning path: {learning_path.title} with ID: {learning_path.id}")
        
        # Get the latest assessment attempt
        latest_attempt = AssessmentAttempt.objects.filter(
            user=self.user,
            completed_at__isnull=False  # Use completed_at instead of completed
        ).order_by('-completed_at').first()
        
        if not latest_attempt:
            logger.warning(f"No completed assessment attempts found for user: {self.user.username}")
            return learning_path
        
        logger.info(f"Found latest assessment attempt: {latest_attempt.id} for assessment: {latest_attempt.assessment.title}")
        
        # Analyze the latest assessment results
        concept_proficiency = self.analyze_assessment_results(latest_attempt)
        logger.info(f"Analyzed assessment results, found {len(concept_proficiency)} concepts with proficiency scores")
        
        # Update concept proficiency scores
        self.update_concept_proficiency(concept_proficiency)
        
        # Get user's learning style and difficulty level
        try:
            learning_style = self.user.profile.learning_style
            difficulty_level = self.user.profile.difficulty_level
            logger.info(f"User profile found: learning_style={learning_style}, difficulty_level={difficulty_level}")
        except Exception as e:
            learning_style = 'visual'
            difficulty_level = 'beginner'
            logger.warning(f"User profile not found, using defaults: learning_style={learning_style}, difficulty_level={difficulty_level}")
        
        # Get all concepts for the learning path
        existing_concepts = set(learning_path.nodes.values_list('concept_id', flat=True))
        logger.info(f"Found {len(existing_concepts)} existing concepts in learning path")
        
        # Get concepts from the latest assessment
        new_concepts = set(concept.id for concept in concept_proficiency.keys())
        logger.info(f"Found {len(new_concepts)} concepts from latest assessment")
        
        # Find concepts that need to be added
        concepts_to_add = new_concepts - existing_concepts
        logger.info(f"Found {len(concepts_to_add)} concepts to add to learning path")
        
        # Add new concepts to the learning path
        if concepts_to_add:
            # Get the highest order in the existing nodes
            max_order = learning_path.nodes.aggregate(Max('order'))['order__max'] or -1
            logger.info(f"Highest order in existing nodes: {max_order}")
            
            # Get all existing orders to avoid duplicates
            existing_orders = set(learning_path.nodes.values_list('order', flat=True))
            logger.info(f"Existing orders: {existing_orders}")
            
            # Create new nodes for the concepts to add
            for i, concept_id in enumerate(concepts_to_add):
                concept = Concept.objects.get(id=concept_id)
                content_type = self._get_content_type_for_style(learning_style)
                content_id = self._generate_content_id(concept, content_type)
                
                # Find the next available order
                next_order = max_order + 1
                while next_order in existing_orders:
                    next_order += 1
                
                # Create the node with the next available order
                try:
                    node = LearningPathNode.objects.create(
                        learning_path=learning_path,
                        concept=concept,
                        order=next_order,
                        content_type=content_type,
                        content_id=content_id
                    )
                    logger.info(f"Created new node: {node.id} for concept: {concept.name} with order: {node.order}")
                    existing_orders.add(next_order)
                except Exception as e:
                    logger.exception(f"Error creating node for concept {concept.name}: {str(e)}")
                    # Continue with the next concept
        
        # Verify the updated learning path
        nodes_count = learning_path.nodes.count()
        logger.info(f"Learning path now has {nodes_count} nodes")
        
        return learning_path 