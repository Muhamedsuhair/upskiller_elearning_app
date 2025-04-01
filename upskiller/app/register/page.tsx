"use client"

import Link from "next/link";
import { useState } from "react";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import apiClient from '@/utils/apiClient'; // Import your API client
import './styles.css';

export default function RegisterPage() {
  const router = useRouter();
  const [selectedStyle, setSelectedStyle] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await apiClient.post('/user/api/register/', {
        username,
        email,
        password,
        learning_style: selectedStyle,
        bio
      }, {
        headers: {
          Authorization: undefined // Remove auth header for registration
        }
      });
      
      if (response.status === 201) {
        alert('Registration successful!');
        router.push('/login');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      alert(`Registration failed: ${error.response?.data?.message || 'Server error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
          <CardDescription>Enter your details to create your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input 
                id="username" 
                placeholder="John Doe" 
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                placeholder="m@example.com" 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            {/* Learning Style */}
            <div className="space-y-4">
              <Label>Learning Style</Label>
              <div className="flex items-center space-x-4">
              {['visual', 'auditory', 'kinesthetic', 'text'].map((style) => (
                <div key={style} className="flex items-center space-x-2">
                  <Input
                    id={`ls-${style}`}
                    type="radio"
                    name="learningStyle"
                    value={style} // lowercase value
                    checked={selectedStyle === style}
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    className={selectedStyle === style ? "border-black text-black" : ""}
                  />
                  <Label htmlFor={`ls-${style}`}>
                    {style.charAt(0).toUpperCase() + style.slice(1)} {/* Capitalize display text */}
                  </Label>
                </div>
              ))}
              </div>
            </div>

            {/* Brief about Yourself */}
            <div className="space-y-2">
              <Label htmlFor="bio">Brief about Yourself</Label>
              <textarea
                id="bio"
                rows={4}
                placeholder="Tell us something about yourself..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-50"
              ></textarea>
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Account'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          {/* Login Link */}
          <div className="text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Login
            </Link>
          </div>

          {/* Back to Dashboard Button */}
          <Button variant="outline" asChild className="w-full">
            <Link href="/">Back to Dashboard</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}