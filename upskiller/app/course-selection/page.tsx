// CourseSelectionPage.jsx (React Component)
"use client"
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import apiClient from "@/utils/apiClient";

type LearningStyle = 'Visual' | 'Audio' | 'Interactive';
type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Expert';

interface GenerateContentResponse {
  id: string;
  [key: string]: any;
}

export default function CourseSelectionPage() {
  const router = useRouter();
  const [courseName, setCourseName] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<DifficultyLevel | null>(null);
  const [selectedPreference, setSelectedPreference] = useState<LearningStyle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  

  const levels: DifficultyLevel[] = ["Beginner", "Intermediate", "Expert"];
  const preferences: LearningStyle[] = ["Visual", "Audio", "Interactive"];
  
  const learningStyleMap: Record<LearningStyle, string> = {
    Visual: 'visual',
    Audio: 'auditory',
    Interactive: 'kinesthetic',
  };

  const handleContinue = async () => {
    if (!courseName.trim() || !selectedLevel || !selectedPreference) return;

    setIsGenerating(true);
    setError(null);

    try {
      const payload = {
        learning_style: learningStyleMap[selectedPreference],
        topic: courseName,
        difficulty_level: selectedLevel.toLowerCase(),
      };

      const response = await apiClient.post<GenerateContentResponse>('/api/generate-content/', payload, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('jwt_token')}`,
        },
      });
      
      if (response.status === 201) {
        router.push(`/learning?courseId=${response.data.id}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate content';
      setError(errorMessage);
      console.error('API Error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
      <div className="container px-4 py-6 md:px-6 md:py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to dashboard</span>
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Course Selection</h1>
        </div>
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Choose Your Learning Path</CardTitle>
            <CardDescription>Tell us what you want to learn and your preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <Label htmlFor="course">What do you want to study?</Label>
              <Input
                id="course"
                placeholder="Enter the subject or course you want to learn..."
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                disabled={isGenerating}
              />
            </div>
            <div className="space-y-4">
              <Label>Learning Level</Label>
              <div className="flex flex-wrap gap-4">
                {levels.map((level) => (
                  <div
                    key={level}
                    onClick={() => !isGenerating && setSelectedLevel(level)}
                    className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                      selectedLevel === level
                        ? "border-primary bg-primary/10"
                        : "hover:border-primary"
                    } ${isGenerating ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {level}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <Label>Study Preference</Label>
              <div className="flex flex-wrap gap-4">
                {preferences.map((preference) => (
                  <div
                    key={preference}
                    onClick={() => !isGenerating && setSelectedPreference(preference)}
                    className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                      selectedPreference === preference
                        ? "border-primary bg-primary/10"
                        : "hover:border-primary"
                    } ${isGenerating ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {preference}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full relative"
              onClick={handleContinue}
              disabled={!courseName.trim() || !selectedLevel || !selectedPreference || isGenerating}
            >
              {isGenerating ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Generating Your Course...
                </>
              ) : (
                'Continue to Learning'
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
      {isGenerating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl flex flex-col items-center gap-4">
            <LoadingSpinner size="lg" />
            <div className="text-center">
              <h3 className="font-semibold text-lg mb-2">Generating Your Course</h3>
              <p className="text-gray-500 dark:text-gray-400">
                Please wait while we create personalized content for you...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}