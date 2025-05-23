
import React from 'react';
import { ArrowRight, Lock, Sparkles, Zap, Workflow } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from "@/contexts/AuthContext";
import { Button } from '@/components/ui/button';

export function CategoryShowcase() {
  const { user } = useAuth();
  
  const categories = [
    {
      title: "ChatGPT Prompts",
      description: "Professional prompts for content creation, copywriting, coding assistance, and business communication. Perfect for writers, marketers, and professionals.",
      image: "/lovable-uploads/498050108023-c5249f4df085.jpg",
      bgGradient: "from-warm-gold/20 via-warm-gold/10 to-transparent",
      link: "/prompts/chatgpt",
      requiredPlan: "basic",
      icon: Sparkles,
      features: ["Content Creation", "Code Generation", "Business Writing", "Creative Stories"]
    },
    {
      title: "Midjourney Prompts",
      description: "Expertly crafted prompts for stunning AI art generation. Create professional artwork, illustrations, and visual content with precise style control.",
      image: "/lovable-uploads/ff979f5e-633f-404f-8799-bd078ad6c678.png",
      bgGradient: "from-muted-teal/20 via-muted-teal/10 to-transparent",
      link: "/prompts/midjourney",
      requiredPlan: "standard",
      icon: Zap,
      features: ["Art Generation", "Style Control", "Commercial Use", "High Resolution"]
    },
    {
      title: "N8N Workflows",
      description: "Ready-to-use automation workflows for streamlining business processes. Connect apps, automate tasks, and boost productivity effortlessly.",
      image: "/lovable-uploads/eea1bdcd-7738-4e5f-810a-15c96fe07b94.png",
      bgGradient: "from-warm-gold/20 via-warm-gold/10 to-transparent",
      link: "/prompts/workflows",
      requiredPlan: "premium",
      icon: Workflow,
      features: ["Process Automation", "App Integration", "Task Scheduling", "Data Processing"]
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-soft-bg via-white to-soft-bg overflow-hidden">
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
          {categories.map((category, index) => {
            const IconComponent = category.icon;
            const isReversed = index % 2 === 1;
            
            return (
              <div 
                key={index} 
                className={`flex flex-col ${isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-12 lg:gap-16 group`}
              >
                {/* Image Section */}
                <div className="flex-1 relative">
                  <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${category.bgGradient} p-8 transform transition-all duration-700 group-hover:scale-105 group-hover:rotate-1`}>
                    <div className="relative">
                      <img 
                        src={category.image} 
                        alt={category.title} 
                        className={`w-full h-80 object-cover rounded-2xl shadow-2xl transition-all duration-500 ${!user ? "blur-sm" : ""} group-hover:shadow-3xl`} 
                      />
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
                          {category.requiredPlan} Plan
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
                      {category.title}
                    </h3>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                      {category.description}
                    </p>
                  </div>
                  
                  {/* Feature Grid */}
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

                  {/* CTA Section */}
                  <div className="pt-4">
                    {user ? (
                      <Link 
                        to={category.link}
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
                            <span className="font-bold capitalize text-warm-gold">{category.requiredPlan} plan</span> or higher required
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
