import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // TODO: Replace this with actual database query
  const mockAssessmentData = {
    title: "JavaScript Fundamentals Quiz",
    totalQuestions: 10,
    timeLimit: 30, // in minutes
    passingScore: 70,
    maxAttempts: 3,
    currentAttempt: 1,
    description: "This assessment tests your understanding of JavaScript fundamentals including variables, data types, functions, and basic syntax.",
    questions: [
      {
        id: 3,
        question: "Which of the following is NOT a valid way to declare a variable in JavaScript?",
        options: [
          { id: 1, text: "var name = \"John\";" },
          { id: 2, text: "let age = 25;" },
          { id: 3, text: "const PI = 3.14;" },
          { id: 4, text: "variable city = \"New York\";" }
        ]
      }
      // Add more questions here
    ]
  };

  return NextResponse.json(mockAssessmentData);
} 