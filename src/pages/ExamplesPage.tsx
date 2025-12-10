import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Container } from '@/components/ui/container';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { type PromptRow } from '@/types/prompts';
import { useCategories } from '@/hooks/useCategories';
import { ModernPromptCard } from '@/components/ui/modern-prompt-card';
import { CategoryFilter } from '@/components/ui/category-filter';
import { PageLoadingState, EmptyState } from '@/components/ui/loading-states';
import { usePromptAccess } from '@/hooks/usePromptAccess';
import { createLogger } from '@/utils/logging';

const logger = createLogger('EXAMPLES_PAGE');

export default function ExamplesPage() {
  const [examplePrompts, setExamplePrompts] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { categories: dbCategories } = useCategories();
  const { user, checkPromptAccess } = usePromptAccess();
  const navigate = useNavigate();

  useEffect(() => {
    fetchExamplePrompts();
  }, [user]);

  const fetchExamplePrompts = async () => {
    try {
      setLoading(true);
      
      // Step 1: Fetch prompts WITHOUT profile join (avoids FK ambiguity)
      const { data, error } = await supabase
        .from('prompts')
        .select(`
          id,
          title,
          prompt_text,
          prompt_type,
          user_id,
          image_path,
          default_image_path,
          metadata,
          created_at
        `)
        .limit(12)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Step 2: Batch fetch profiles separately
      const uniqueUserIds = [...new Set((data || []).map(p => p.user_id))];
      let profileMap: Record<string, { username: string; avatar_url: string | null }> = {};
      
      if (uniqueUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, first_name, last_name, avatar_url')
          .in('id', uniqueUserIds);
        
        profileMap = (profiles || []).reduce((acc, profile) => {
          acc[profile.id] = {
            username: profile.username || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Expert Creator',
            avatar_url: profile.avatar_url
          };
          return acc;
        }, {} as Record<string, { username: string; avatar_url: string | null }>);
      }

      // Step 3: Transform data with profile info
      const transformedData: PromptRow[] = (data || []).map((item: any) => {
        const profileInfo = profileMap[item.user_id];
        const metadata = typeof item.metadata === 'object' && item.metadata !== null ? item.metadata : {};
        
        return {
          id: item.id,
          user_id: item.user_id || '',
          title: item.title,
          prompt_text: item.prompt_text,
          image_path: item.image_path,
          default_image_path: item.default_image_path,
          prompt_type: item.prompt_type,
          created_at: item.created_at || "",
          metadata: metadata,
          uploader_name: profileInfo?.username || 'Expert Creator',
          uploader_username: profileInfo?.username,
          uploader_avatar_url: profileInfo?.avatar_url
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
        prompt.metadata?.category?.toLowerCase() === selectedCategory.toLowerCase()
      );

  const categories = ['all', 'ChatGPT', 'Midjourney', 'Claude', 'Workflow'];

  const handleUpgradeClick = () => {
    navigate('/pricing');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <PageLoadingState message="Loading examples..." />
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
          <CategoryFilter
            categories={categories}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            allLabel="All"
            className="max-w-2xl mx-auto"
          />
        </Container>
      </section>

      {/* Examples Grid - Using ModernPromptCard */}
      <section className="pb-16">
        <Container>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPrompts.map((prompt) => (
              <ModernPromptCard
                key={prompt.id}
                prompt={prompt}
                isLocked={checkPromptAccess(prompt)}
                onUpgradeClick={handleUpgradeClick}
              />
            ))}
          </div>
          
          {filteredPrompts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No prompts found in this category.</p>
            </div>
          )}
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
