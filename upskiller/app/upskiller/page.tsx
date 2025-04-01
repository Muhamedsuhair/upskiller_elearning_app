"use client"

import Link from "next/link"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui"
import { Button } from "@/components/ui/button"

  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle>Learning</CardTitle>
        <CardDescription>Continue your learning journey</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/learning">
          <Button className="w-full">Go to Learning</Button>
        </Link>
      </CardContent>
    </Card>

    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle>Achievements</CardTitle>
        <CardDescription>View your certificates and achievements</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/achievements">
          <Button className="w-full">View Achievements</Button>
        </Link>
      </CardContent>
    </Card>

    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Manage your profile and settings</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/profile">
          <Button className="w-full">Go to Profile</Button>
        </Link>
      </CardContent>
    </Card>
  </div> 