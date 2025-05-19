
import React from 'react';
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function HeroSection() {
  return (
    <section className="pt-20 pb-16 md:pt-24 md:pb-20 relative overflow-hidden">
      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 text-center lg:text-left">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-dark-base mb-6">
              Discover Unique <span className="text-warm-gold">AI Prompts</span>
            </h1>
            
            <div className="space-y-4 mb-8 text-lg">
              <p className="flex items-center gap-2 justify-center lg:justify-start">
                <span className="h-1.5 w-1.5 rounded-full bg-warm-gold"></span>
                <span>No recurring subscription, pay once and enjoy forever.</span>
              </p>
              <p className="flex items-center gap-2 justify-center lg:justify-start">
                <span className="h-1.5 w-1.5 rounded-full bg-warm-gold"></span>
                <span>All prompts are hand-picked and very customizable to fit your needs.</span>
              </p>
              <p className="flex items-center gap-2 justify-center lg:justify-start">
                <span className="h-1.5 w-1.5 rounded-full bg-warm-gold"></span>
                <span>Special Arabic-crafted prompts.</span>
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button asChild size="lg" className="bg-warm-gold hover:bg-warm-gold/90 text-white px-8 py-6 font-semibold text-base rounded-md">
                <a href="#pricing">Choose Your Plan</a>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-warm-gold/30 hover:bg-warm-gold/5 text-dark-base px-8 py-6 font-semibold text-base rounded-md">
                <Link to="/prompts">Browse Prompts <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
          
          <div className="lg:col-span-5 flex justify-center lg:justify-end">
            <img 
              src="/lovable-uploads/eea1bdcd-7738-4e5f-810a-15c96fe07b94.png" 
              alt="JojoPrompts Premium AI Content" 
              className="rounded-lg shadow-lg border border-warm-gold/20 object-cover max-w-full" 
            />
          </div>
        </div>
      </div>
      
      {/* Decorative elements */}
      <div className="absolute top-20 left-0 w-64 h-64 bg-warm-gold/5 rounded-full -z-10 blur-3xl"></div>
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-muted-teal/5 rounded-full -z-10 blur-3xl"></div>
    </section>
  );
}
