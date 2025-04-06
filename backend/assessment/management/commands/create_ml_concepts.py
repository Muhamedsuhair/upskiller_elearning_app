from django.core.management.base import BaseCommand
from assessment.models import Concept

class Command(BaseCommand):
    help = 'Creates machine learning concepts in the database'

    def handle(self, *args, **kwargs):
        concepts = [
            {
                'name': 'Regularization Techniques (L2 Regularization vs. Batch Normalization)',
                'description': 'Understanding different regularization techniques in deep learning, specifically comparing L2 regularization and batch normalization, their effects on model performance, and when to use each approach.',
                'difficulty_level': 'intermediate'
            },
            {
                'name': 'GAN Training Dynamics (Discriminator Performance)',
                'description': 'Understanding the training dynamics of Generative Adversarial Networks (GANs), focusing on discriminator performance, stability issues, and techniques for balanced training between generator and discriminator.',
                'difficulty_level': 'advanced'
            },
            {
                'name': 'Transformer Networks (Self-Attention Mechanism)',
                'description': 'Deep dive into transformer architecture, focusing on the self-attention mechanism, its implementation, and how it revolutionized natural language processing tasks.',
                'difficulty_level': 'advanced'
            },
            {
                'name': 'Activation Functions for Multi-label Classification',
                'description': 'Understanding various activation functions specifically in the context of multi-label classification problems, including sigmoid, softmax, and their applications.',
                'difficulty_level': 'intermediate'
            },
            {
                'name': 'Residual Connections in Deep CNNs',
                'description': 'Understanding residual (skip) connections in deep convolutional neural networks, their importance in addressing the vanishing gradient problem, and implementation in modern architectures.',
                'difficulty_level': 'intermediate'
            },
            {
                'name': 'Exploding Gradient Problem in RNNs',
                'description': 'Understanding the exploding gradient problem in Recurrent Neural Networks (RNNs), its causes, detection methods, and various solutions including gradient clipping.',
                'difficulty_level': 'intermediate'
            },
            {
                'name': 'Training on Imbalanced Datasets',
                'description': 'Techniques and strategies for handling imbalanced datasets in machine learning, including resampling methods, class weights, and specialized loss functions.',
                'difficulty_level': 'intermediate'
            },
            {
                'name': 'Federated Learning',
                'description': 'Understanding federated learning as a machine learning approach that trains algorithms across multiple decentralized devices holding local data samples without exchanging them.',
                'difficulty_level': 'advanced'
            }
        ]

        for concept_data in concepts:
            concept, created = Concept.objects.get_or_create(
                name=concept_data['name'],
                defaults={
                    'description': concept_data['description'],
                    'difficulty_level': concept_data['difficulty_level']
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Successfully created concept: {concept.name}'))
            else:
                self.stdout.write(self.style.WARNING(f'Concept already exists: {concept.name}')) 