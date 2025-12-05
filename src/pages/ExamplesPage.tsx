import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight, Lock, Eye, Zap, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { type Prompt } from '@/types';
import { useCategories } from '@/hooks/useCategories';
import { ImageWrapper } from '@/components/ui/prompt-card/ImageWrapper';
import { useImageLoading } from '@/components/ui/prompt-card/hooks/useImageLoading';
import { useAuth } from '@/contexts/AuthContext';
import { createLogger } from '@/utils/logging';

const logger = createLogger('EXAMPLES_PAGE');

interface ExamplePrompt extends Prompt {
  previewText: string;
  isLocked: boolean;
}

function ExampleCard({ prompt }: { prompt: ExamplePrompt }) {
  const imageUrl = useImageLoading(prompt);
  const firstThreeWords = prompt.prompt_text.split(' ').slice(0, 3).join(' ') + '...';

  return (
    <div className="bg-white p-6 group hover:bg-gray-50/50 transition-colors duration-300 relative">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-medium text-dark-base mb-2 group-hover:text-warm-gold transition-colors">
            {prompt.title}
          </h3>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-warm-gold bg-warm-gold/5 px-2 py-1 rounded">
              {prompt.prompt_type}
            </span>
            {prompt.metadata.category && (
              <span className="text-xs text-muted-teal bg-muted-teal/5 px-2 py-1 rounded">
                {prompt.metadata.category}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 text-warm-gold">
          <Crown className="h-4 w-4" />
          <span className="text-xs font-medium">Premium</span>
        </div>
      </div>
      
      {/* Image */}
      <div className="relative mb-4">
        <div className="relative overflow-hidden rounded-xl">
          <div className="aspect-video">
            <ImageWrapper
              src={imageUrl}
              alt={prompt.title}
              aspect={1}
              className="w-full h-full object-cover"
            />
          </div>
          {prompt.metadata.media_files && prompt.metadata.media_files.length > 1 && (
            <div className="absolute top-2 right-2 bg-dark-base/70 text-white text-xs px-2 py-1 rounded">
              +{prompt.metadata.media_files.length - 1} files
            </div>
          )}
        </div>
        
        {prompt.isLocked && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center rounded-xl">
            <div className="text-center">
              <Lock className="h-5 w-5 text-warm-gold mx-auto mb-2" />
              <p className="text-warm-gold font-medium text-sm">Premium Content</p>
            </div>
          </div>
        )}
      </div>

      {/* Preview text */}
      <p className="text-sm text-muted-foreground font-light mb-4">
        {firstThreeWords}
      </p>
      
      {/* CTA Button */}
      <Button 
        asChild
        variant="outline" 
        className="w-full border-gray-200 hover:bg-gray-50 text-dark-base hover:text-warm-gold transition-colors"
      >
        <Link to="/pricing" className="flex items-center justify-center gap-2">
          <Zap className="h-4 w-4" />
          Unlock This Prompt
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>

      {/* Accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-100 group-hover:bg-warm-gold/30 transition-colors duration-300" />
    </div>
  );
}

export default function ExamplesPage() {
  const [examplePrompts, setExamplePrompts] = useState<ExamplePrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { categories: dbCategories } = useCategories();
  const { user } = useAuth();

  useEffect(() => {
    fetchExamplePrompts();
  }, [user]);

  const fetchExamplePrompts = async () => {
    try {
      setLoading(true);
      
      let data, error;
      
      if (user) {
        const response = await supabase
          .from('prompts')
          .select(`
            *,
            profiles!fk_prompts_user_id(username)
          `)
          .limit(12)
          .order('created_at', { ascending: false });
        
        data = response.data;
        error = response.error;
      } else {
        const response = await supabase.rpc('get_public_prompt_previews', { limit_count: 12 });
        data = response.data;
        error = response.error;
      }

      if (error) throw error;

      const transformedData: ExamplePrompt[] = (data || []).map((item: any) => {
        let metadata, category, profile, prompt_text, previewText;
        
        if (user) {
          metadata = typeof item.metadata === 'object' && item.metadata !== null ? item.metadata : {};
          const metadataObj = metadata as Record<string, any>;
          category = metadataObj.category || "";
          profile = item.profiles as any;
          prompt_text = item.prompt_text;
          previewText = prompt_text.length > 100 ? prompt_text.substring(0, 100) + "..." : prompt_text;
        } else {
          metadata = { category: item.category || "" };
          category = item.category || "";
          profile = null;
          prompt_text = item.prompt_preview || "";
          previewText = prompt_text;
        }

        return {
          id: item.id,
          user_id: item.user_id || '',
          title: item.title,
          prompt_text: prompt_text,
          image_path: item.image_path,
          default_image_path: item.default_image_path,
          image_url: null,
          prompt_type: item.prompt_type as 'text' | 'image' | 'workflow' | 'video' | 'sound' | 'button' | 'image-selection',
          created_at: item.created_at || "",
          uploader_name: profile?.username || 'Expert Creator',
          metadata: {
            category: category,
            style: undefined,
            tags: [],
            media_files: [],
            target_model: undefined,
            use_case: undefined,
            workflow_steps: undefined,
            workflow_files: [],
            buttons: undefined,
            image_options: undefined,
            button_text: undefined,
            button_action: undefined,
          },
          previewText,
          isLocked: !user
        };
      });

      setExamplePrompts(transformedData);
    } catch (error) {
      logger.error('Failed to fetch example prompts', { error });
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-warm-gold border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground font-light">Loading examples...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="pt-20 lg:pt-24 pb-12 sm:pb-16">
        <Container>
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-dark-base mb-4">
              Real Prompt <span className="text-warm-gold">Examples</span>
            </h1>
            <p className="text-lg text-muted-foreground font-light max-w-2xl mx-auto mb-8">
              See the quality difference between generic prompts and our professionally crafted ones.
            </p>
            
            {/* Trust indicators */}
            <div className="grid grid-cols-2 gap-px bg-gray-200 rounded-xl overflow-hidden max-w-md mx-auto">
              <div className="bg-white p-4 flex items-center justify-center gap-2">
                <Eye className="h-4 w-4 text-warm-gold" />
                <span className="text-sm text-muted-foreground">Real examples</span>
              </div>
              <div className="bg-white p-4 flex items-center justify-center gap-2">
                <Sparkles className="h-4 w-4 text-warm-gold" />
                <span className="text-sm text-muted-foreground">Premium collection</span>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Categories Filter */}
      <section className="pb-8">
        <Container>
          <div className="grid grid-cols-5 gap-px bg-gray-200 rounded-xl overflow-hidden max-w-2xl mx-auto">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`py-3 px-4 text-sm font-medium transition-colors duration-300 ${
                  selectedCategory === category 
                    ? 'bg-warm-gold/5 text-warm-gold' 
                    : 'bg-white text-muted-foreground hover:bg-gray-50/50'
                }`}
              >
                {category === 'all' ? 'All' : category}
              </button>
            ))}
          </div>
        </Container>
      </section>

      {/* Examples Grid */}
      <section className="pb-16">
        <Container>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-200 rounded-2xl overflow-hidden">
            {filteredPrompts.map((prompt) => (
              <ExampleCard key={prompt.id} prompt={prompt} />
            ))}
          </div>
        </Container>
      </section>

      {/* Bottom CTA Section */}
      <section className="pb-16">
        <Container>
          <div className="grid gap-px bg-gray-200 rounded-2xl overflow-hidden">
            <div className="bg-white p-8 sm:p-12 text-center group hover:bg-gray-50/50 transition-colors duration-300 relative">
              <h2 className="text-2xl sm:text-3xl font-light tracking-tight text-dark-base mb-4">
                Ready to Unlock <span className="text-warm-gold">All Premium Prompts?</span>
              </h2>
              <p className="text-lg text-muted-foreground font-light mb-8 max-w-2xl mx-auto">
                Get instant access to our professional prompts collection, lifetime updates, and proven results.
              </p>
              
              {/* Benefits */}
              <div className="grid grid-cols-3 gap-px bg-gray-200 rounded-xl overflow-hidden max-w-lg mx-auto mb-8">
                <div className="bg-white p-3 text-center">
                  <span className="text-warm-gold text-sm">✓ Premium Collection</span>
                </div>
                <div className="bg-white p-3 text-center">
                  <span className="text-warm-gold text-sm">✓ One-Time Payment</span>
                </div>
                <div className="bg-white p-3 text-center">
                  <span className="text-warm-gold text-sm">✓ 30-Day Guarantee</span>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  asChild 
                  size="lg"
                  className="bg-warm-gold hover:bg-warm-gold/90 text-white"
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
                  className="border-gray-200 hover:bg-gray-50 text-dark-base"
                >
                  <Link to="/pricing" className="flex items-center gap-2">
                    View Pricing
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              {/* Accent line */}
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gray-100 group-hover:bg-warm-gold/30 transition-colors duration-300" />
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
