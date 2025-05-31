
import React from 'react';
import { ArrowRight, Lock, Sparkles, Zap, Workflow, Image, Video, Music, Code, Palette, Bot, Brain, Cpu, Database } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from "@/contexts/AuthContext";
import { Button } from '@/components/ui/button';
import { useCategories } from "@/hooks/useCategories";

const iconMap = {
  Sparkles,
  Zap,
  Workflow,
  Image,
  Video,
  Music,
  Code,
  Palette,
  Bot,
  Brain,
  Cpu,
  Database,
};

export function CategoryShowcase() {
  const { user } = useAuth();
  const { categories, loading } = useCategories();
  
  // Filter only active categories for public display
  const activeCategories = categories.filter(category => category.is_active);

  if (loading) {
    return (
      <section className="py-20 overflow-hidden">
        <div className="container">
          <div className="text-center">
            <div className="animate-pulse">Loading categories...</div>
          </div>
        </div>
      </section>
    );
  }

  if (activeCategories.length === 0) {
    return (
      <section className="py-20 overflow-hidden">
        <div className="container">
          <div className="text-center">
            <p className="text-muted-foreground">No categories available at the moment.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 overflow-hidden">
      <div className="container relative">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-warm-gold/5 rounded-full animate-pulse"></div>
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-muted-teal/5 rounded-full animate-pulse delay-1000"></div>
        </div>

        {/* Header */}
        <div className="text-center mb-16 relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-dark-base mb-6 animate-fade-in">
            Explore Our
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-warm-gold to-muted-teal ml-3">
              Categories
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed animate-fade-in delay-200">
            Discover curated prompts for different AI platforms to enhance your creativity and productivity
          </p>
        </div>
        
        {/* Dynamic Categories Layout */}
        <div className="space-y-24 relative z-10">
          {activeCategories.map((category, index) => {
            const IconComponent = iconMap[category.icon_name as keyof typeof iconMap] || Sparkles;
            const isReversed = index % 2 === 1;
            
            return (
              <div 
                key={category.id} 
                className={`flex flex-col ${isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-12 lg:gap-16 group`}
              >
                {/* Image Section */}
                <div className="flex-1 relative">
                  <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${category.bg_gradient} p-8 transform transition-all duration-700 group-hover:scale-105 group-hover:rotate-1`}>
                    <div className="relative">
                      {category.image_path ? (
                        <img 
                          src={category.image_path} 
                          alt={category.name} 
                          className={`w-full h-80 object-cover rounded-2xl shadow-2xl transition-all duration-500 ${!user ? "blur-sm" : ""} group-hover:shadow-3xl`} 
                        />
                      ) : (
                        <div className="w-full h-80 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl shadow-2xl flex items-center justify-center">
                          <IconComponent className="h-24 w-24 text-gray-400" />
                        </div>
                      )}
                      {!user && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl backdrop-blur-sm">
                          <div className="text-center text-white animate-pulse">
                            <Lock className="h-12 w-12 mx-auto mb-3 opacity-80" />
                            <p className="text-sm font-medium">Subscribe to unlock</p>
                          </div>
                        </div>
                      )}
                      {/* Plan Badge */}
                      <div className="absolute top-4 right-4">
                        <span className="bg-white/90 backdrop-blur-sm text-dark-base text-sm font-bold px-4 py-2 rounded-full shadow-lg capitalize animate-bounce">
                          {category.required_plan} Plan
                        </span>
                      </div>
                    </div>
                    
                    {/* Floating Icon */}
                    <div className="absolute -top-6 -left-6 bg-white rounded-full p-4 shadow-xl border-4 border-warm-gold/20 transform rotate-12 group-hover:rotate-0 transition-transform duration-500">
                      <IconComponent className="h-8 w-8 text-warm-gold" />
                    </div>
                  </div>
                </div>

                {/* Content Section */}
                <div className="flex-1 space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-3xl md:text-4xl font-bold text-dark-base group-hover:text-warm-gold transition-colors duration-300">
                      {category.name}
                    </h3>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                      {category.description}
                    </p>
                  </div>
                  
                  {/* Feature Grid */}
                  {category.features && category.features.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {category.features.map((feature, featureIndex) => (
                        <div 
                          key={featureIndex}
                          className="flex items-center space-x-2 bg-white/60 backdrop-blur-sm px-4 py-3 rounded-xl border border-warm-gold/10 transform hover:scale-105 transition-transform duration-200"
                        >
                          <div className="w-2 h-2 bg-warm-gold rounded-full animate-pulse"></div>
                          <span className="text-sm font-medium text-dark-base">{feature}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CTA Section */}
                  <div className="pt-4">
                    {user ? (
                      <Link 
                        to={category.link_path}
                        className="inline-flex items-center space-x-3 text-warm-gold font-bold text-lg hover:text-warm-gold/80 transition-all duration-300 group/link"
                      >
                        <span>Explore Collection</span>
                        <ArrowRight className="h-5 w-5 transition-transform group-hover/link:translate-x-2" />
                      </Link>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2 text-muted-foreground">
                          <Lock className="h-4 w-4" />
                          <span className="text-sm">
                            <span className="font-bold capitalize text-warm-gold">{category.required_plan} plan</span> or higher required
                          </span>
                        </div>
                        <Button 
                          onClick={() => window.location.href = "/pricing"}
                          size="lg"
                          className="bg-gradient-to-r from-warm-gold to-muted-teal hover:from-warm-gold/90 hover:to-muted-teal/90 text-white font-bold px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                        >
                          <Sparkles className="h-5 w-5 mr-2" />
                          Subscribe to Access
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-20 relative z-10">
          <div className="bg-gradient-to-r from-warm-gold/10 via-transparent to-muted-teal/10 rounded-3xl p-12 backdrop-blur-sm border border-warm-gold/20">
            <h3 className="text-2xl md:text-3xl font-bold text-dark-base mb-4">
              Ready to Transform Your AI Experience?
            </h3>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join thousands of creators, writers, and professionals who trust JojoPrompts for their AI needs
            </p>
            <Button 
              onClick={() => window.location.href = "/pricing"}
              size="lg"
              className="bg-gradient-to-r from-warm-gold to-muted-teal hover:from-warm-gold/90 hover:to-muted-teal/90 text-white font-bold px-10 py-5 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
            >
              <Zap className="h-5 w-5 mr-2" />
              Get Started Today
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
