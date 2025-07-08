import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ArrowRight, Lock, Eye, Zap, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { type Prompt } from '@/types';
import { useCategories } from '@/hooks/useCategories';
import { ImageWrapper } from '@/components/ui/prompt-card/ImageWrapper';
import { useImageLoading } from '@/components/ui/prompt-card/hooks/useImageLoading';

interface ExamplePrompt extends Prompt {
  previewText: string;
  isLocked: boolean;
}

function ExampleCard({ prompt, index }: { prompt: ExamplePrompt; index: number }) {
  const imageUrl = useImageLoading(prompt);
  
  // Get first 3 words from prompt text
  const firstThreeWords = prompt.prompt_text.split(' ').slice(0, 3).join(' ') + '...';

  return (
    <Card 
      className="group bg-white hover:shadow-xl border border-gray-200 hover:border-warm-gold/30 transition-all duration-300 transform hover:-translate-y-2 animate-fade-in relative overflow-hidden"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold text-dark-base mb-2 group-hover:text-warm-gold transition-colors">
              {prompt.title}
            </CardTitle>
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant="secondary" className="bg-warm-gold/10 text-warm-gold">
                {prompt.prompt_type}
              </Badge>
              {prompt.metadata.category && (
                <Badge variant="outline" className="border-muted-teal/30 text-muted-teal">
                  {prompt.metadata.category}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 bg-warm-gold/10 px-2 py-1 rounded-full">
            <Crown className="h-3 w-3 text-warm-gold" />
            <span className="text-xs text-warm-gold font-medium">Premium</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="relative mb-4">
          {/* Image Display */}
          <div className="relative overflow-hidden rounded-xl bg-white/50">
            <div className="aspect-video">
              <ImageWrapper
                src={imageUrl}
                alt={prompt.title}
                aspect={1}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
            </div>
            {/* Media files indicator */}
            {prompt.metadata.media_files && prompt.metadata.media_files.length > 1 && (
              <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                +{prompt.metadata.media_files.length - 1} files
              </div>
            )}
          </div>
          
          {/* Locked overlay */}
          {prompt.isLocked && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center rounded-xl">
              <div className="text-center">
                <Lock className="h-6 w-6 text-warm-gold mx-auto mb-2" />
                <p className="text-warm-gold font-medium text-sm">Premium Content</p>
              </div>
            </div>
          )}
        </div>

        {/* Brief text preview - first 3 words */}
        <div className="mb-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            {firstThreeWords}
          </p>
        </div>
        
        {/* CTA Button */}
        <Button 
          asChild
          variant="outline" 
          className="w-full border-warm-gold/30 hover:border-warm-gold/50 text-warm-gold hover:bg-warm-gold/10 group-hover:shadow-md transition-all duration-300"
        >
          <Link to="/pricing" className="flex items-center justify-center gap-2">
            <Zap className="h-4 w-4" />
            Unlock This Prompt
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ExamplesPage() {
  const [examplePrompts, setExamplePrompts] = useState<ExamplePrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { categories: dbCategories } = useCategories();

  useEffect(() => {
    fetchExamplePrompts();
  }, []);

  const fetchExamplePrompts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('prompts')
        .select(`
          *,
          profiles!fk_prompts_user_id(username)
        `)
        .limit(12)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedData: ExamplePrompt[] = (data || []).map((item) => {
        const metadata = typeof item.metadata === 'object' && item.metadata !== null ? item.metadata : {};
        const metadataObj = metadata as Record<string, any>;
        const category = metadataObj.category || "";
        const profile = item.profiles as any;
        
        // Create preview text (first 100 characters)
        const previewText = item.prompt_text.length > 100 
          ? item.prompt_text.substring(0, 100) + "..."
          : item.prompt_text;

        return {
          id: item.id,
          user_id: item.user_id,
          title: item.title,
          prompt_text: item.prompt_text,
          image_path: item.image_path,
          default_image_path: item.default_image_path,
          image_url: null,
          prompt_type: item.prompt_type as 'text' | 'image' | 'workflow' | 'video' | 'sound' | 'button' | 'image-selection',
          created_at: item.created_at || "",
          uploader_name: profile?.username || 'Expert Creator',
          metadata: {
            category: category,
            style: metadataObj.style ?? undefined,
            tags: Array.isArray(metadataObj.tags) ? metadataObj.tags : [],
            media_files: Array.isArray(metadataObj.media_files) ? metadataObj.media_files : [],
            target_model: metadataObj.target_model ?? undefined,
            use_case: metadataObj.use_case ?? undefined,
            workflow_steps: metadataObj.workflow_steps ?? undefined,
            workflow_files: Array.isArray(metadataObj.workflow_files) ? metadataObj.workflow_files : [],
            buttons: metadataObj.buttons ?? undefined,
            image_options: metadataObj.image_options ?? undefined,
            button_text: metadataObj.button_text ?? undefined,
            button_action: metadataObj.button_action ?? undefined,
          },
          previewText,
          isLocked: true // All prompts are locked for non-users
        };
      });

      setExamplePrompts(transformedData);
    } catch (error) {
      console.error('Error fetching example prompts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPrompts = selectedCategory === 'all' 
    ? examplePrompts 
    : examplePrompts.filter(prompt => 
        prompt.metadata.category?.toLowerCase() === selectedCategory.toLowerCase()
      );

  const categories = ['all', 'ChatGPT', 'Midjourney', 'Claude', 'Workflow'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-soft-bg via-warm-gold/5 to-muted-teal/5 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-warm-gold border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading examples...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-soft-bg via-warm-gold/5 to-muted-teal/5">
      {/* Hero Section */}
      <section className="py-16 sm:py-20">
        <Container>
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-dark-base">
              Real Prompt
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-warm-gold to-muted-teal block sm:inline sm:ml-3">
                Examples
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              See the quality difference between generic prompts and our professionally crafted ones. 
              These examples show why thousands of creators trust JojoPrompts.
            </p>
            
            {/* Trust indicators */}
            <div className="flex flex-wrap gap-4 justify-center mb-8 text-sm">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-warm-gold/20">
                <Eye className="h-4 w-4 text-warm-gold" />
                <span>Real examples from our collection</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-warm-gold/20">
                <Sparkles className="h-4 w-4 text-warm-gold" />
                <span>Premium prompts collection</span>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Categories Filter */}
      <section className="pb-8">
        <Container>
          <div className="flex flex-wrap gap-2 sm:gap-4 justify-center">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                onClick={() => setSelectedCategory(category)}
                className={`transition-all duration-300 ${
                  selectedCategory === category 
                    ? 'bg-warm-gold text-white shadow-lg scale-105' 
                    : 'border-warm-gold/30 hover:border-warm-gold/50'
                }`}
              >
                {category === 'all' ? 'All Categories' : category}
              </Button>
            ))}
          </div>
        </Container>
      </section>

      {/* Examples Grid */}
      <section className="pb-16">
        <Container>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {filteredPrompts.map((prompt, index) => (
              <ExampleCard key={prompt.id} prompt={prompt} index={index} />
            ))}
          </div>
        </Container>
      </section>

      {/* Bottom CTA Section */}
      <section className="py-16 bg-gradient-to-br from-dark-base via-dark-base/95 to-warm-gold/20 text-white">
        <Container>
          <div className="text-center max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6">
              Ready to Unlock
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-warm-gold to-muted-teal block sm:inline sm:ml-3">
                All Premium Prompts?
              </span>
            </h2>
            <p className="text-lg sm:text-xl mb-8 opacity-90">
              Get instant access to our professional prompts collection, lifetime updates, and proven results.
            </p>
            
            {/* Benefits */}
            <div className="flex flex-wrap gap-4 justify-center mb-8 text-sm">
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/20">
                <span className="text-green-400">✓</span>
                <span>Premium Prompts Collection</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/20">
                <span className="text-green-400">✓</span>
                <span>One-Time Payment</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/20">
                <span className="text-green-400">✓</span>
                <span>30-Day Guarantee</span>
              </div>
            </div>
            
            <div className="space-y-4 sm:space-y-0 sm:space-x-4 sm:flex sm:justify-center">
              <Button 
                asChild 
                size="lg"
                className="bg-gradient-to-r from-warm-gold to-warm-gold/90 hover:from-warm-gold/90 hover:to-warm-gold/80 text-white px-8 py-6 font-bold text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
              >
                <Link to="/pricing" className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Get Full Access Now
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              
              <Button 
                asChild 
                variant="outline" 
                size="lg"
                className="border-warm-gold/30 bg-white/10 hover:bg-white/20 text-white px-8 py-6 font-semibold text-lg"
              >
                <Link to="/pricing" className="flex items-center gap-2">
                  View Pricing
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            
            <p className="text-warm-gold/90 text-sm font-medium mt-6 animate-pulse-gentle">
              🚀 Start getting 10x better AI results today
            </p>
          </div>
        </Container>
      </section>
    </div>
  );
}