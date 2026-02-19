import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, FlaskConical } from "lucide-react";
import { LandingAnimations } from "@/components/landing-animations";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 relative overflow-hidden">
      <LandingAnimations />
      <div className="text-center space-y-6 max-w-2xl px-4 z-10 relative">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-white rounded-full shadow-lg">
            <FlaskConical className="w-12 h-12 text-indigo-600" />
          </div>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Inquiry Based Learning Platform
        </h1>
        <p className="text-lg leading-8 text-gray-600">
          Empower your students with interactive simulations and digital worksheets. 
          Design experiments, track progress, and enhance learning outcomes.
        </p>
        <div className="flex items-center justify-center gap-x-6">
          <Button asChild size="lg" className="rounded-full px-8">
            <Link href="/dashboard">
              Teacher Dashboard <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
