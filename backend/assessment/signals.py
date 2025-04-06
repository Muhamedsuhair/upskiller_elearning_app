from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Question, QuestionConceptMapping, Concept
import logging

logger = logging.getLogger(__name__)

@receiver(post_save, sender=Question)
def create_question_concept_mapping(sender, instance, created, **kwargs):
    """
    Create a QuestionConceptMapping object when a question is created.
    """
    if created:
        logger.info(f"Question created: {instance.text}")
        
        # Extract keywords from the question text
        keywords = instance.text.lower().split()
        
        # Find concepts that match the keywords
        concepts = Concept.objects.filter(
            name__in=keywords
        )
        
        if concepts.exists():
            logger.info(f"Found {concepts.count()} concepts for question: {instance.text}")
            for concept in concepts:
                QuestionConceptMapping.objects.create(
                    question=instance,
                    concept=concept,
                    weight=1.0
                )
        else:
            # Create a generic concept based on the assessment title
            assessment_title = instance.assessment.title
            concept = Concept.objects.filter(name__icontains=assessment_title).first()
            
            if not concept:
                concept = Concept.objects.create(
                    name=assessment_title,
                    description=f"Learning materials for {assessment_title}",
                    difficulty_level='beginner'
                )
                logger.info(f"Created new concept: {concept.name}")
            
            QuestionConceptMapping.objects.create(
                question=instance,
                concept=concept,
                weight=1.0
            )
            logger.info(f"Created QuestionConceptMapping for question: {instance.text} and concept: {concept.name}") 