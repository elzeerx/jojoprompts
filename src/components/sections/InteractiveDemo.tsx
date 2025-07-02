import React, { useState } from 'react';
import { Check, X, ArrowRight, Sparkles, Copy, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';

const demoPrompts = [
  {
    category: "Creative Writing",
    generic: "Write a story about a cat",
    premium: "Create a captivating 500-word short story about a mysterious alley cat who discovers an ancient secret in the heart of Tokyo. Include sensory details, dialogue, and a surprising twist that reveals the cat's true identity. Write in a noir style with Japanese cultural elements.",
    results: {
      generic: "Basic story, lacks depth and engagement",
      premium: "Rich, detailed narrative with cultural authenticity and compelling plot"
    }
  },
  {
    category: "Business Content",
    generic: "Write marketing copy for a product",
    premium: "Craft a persuasive product description for [PRODUCT] targeting [AUDIENCE] that highlights 3 key benefits, addresses the main objection of [OBJECTION], includes emotional triggers related to [DESIRE], and ends with a compelling call-to-action. Use the PAS (Problem-Agitate-Solution) framework and include social proof elements.",
    results: {
      generic: "Generic sales copy that sounds robotic",
      premium: "Conversion-focused copy with psychological triggers and clear structure"
    }
  },
  {
    category: "Arabic Content",
    generic: "اكتب مقال عن التكنولوجيا",
    premium: "اكتب مقالًا شيقًا من 800 كلمة عن تأثير الذكاء الاصطناعي على مستقبل التعليم في الوطن العربي، مع التركيز على الفرص والتحديات، وتضمين أمثلة من دول مختلفة، واستخدام أسلوب صحفي احترافي يناسب القارئ المثقف العربي.",
    results: {
      generic: "مقال عام بدون عمق أو تخصص",
      premium: "محتوى متخصص ومفصل يناسب الثقافة العربية"
    }
  }
];

export function InteractiveDemo() {
  const [activeDemo, setActiveDemo] = useState(0);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(type);
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  return (
    <section className="mobile-section-padding bg-gradient-to-br from-soft-bg via-white to-warm-gold/5">
      <Container>
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="section-title animate-fade-in">
            See the
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-warm-gold to-muted-teal block sm:inline sm:ml-3">
              Difference
            </span>
          </h2>
          <p className="section-subtitle animate-fade-in delay-200">
            Compare generic prompts vs our premium, hand-crafted prompts
          </p>
        </div>

        {/* Demo Categories */}
        <div className="flex flex-wrap gap-2 sm:gap-4 justify-center mb-8 sm:mb-12">
          {demoPrompts.map((demo, index) => (
            <Button
              key={index}
              variant={activeDemo === index ? "default" : "outline"}
              onClick={() => setActiveDemo(index)}
              className={`mobile-tab transition-all duration-300 ${
                activeDemo === index 
                  ? 'bg-warm-gold text-white shadow-lg scale-105' 
                  : 'border-warm-gold/30 hover:border-warm-gold/50'
              }`}
            >
              {demo.category}
            </Button>
          ))}
        </div>

        {/* Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 max-w-6xl mx-auto">
          {/* Generic Prompt */}
          <div className="space-y-4 sm:space-y-6 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <X className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-700">Generic Prompt</h3>
            </div>
            
            <div className="bg-white border-2 border-red-200 rounded-xl p-4 sm:p-6 relative group hover:shadow-lg transition-all duration-300">
              <div className="absolute top-3 right-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(demoPrompts[activeDemo].generic, 'generic')}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copiedPrompt === 'generic' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-4">
                {demoPrompts[activeDemo].generic}
              </p>
              
              <div className="border-t border-red-100 pt-4">
                <p className="text-red-600 text-sm font-medium flex items-center gap-2">
                  <X className="h-4 w-4" />
                  Result: {demoPrompts[activeDemo].results.generic}
                </p>
              </div>
            </div>
          </div>

          {/* Premium Prompt */}
          <div className="space-y-4 sm:space-y-6 animate-fade-in delay-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-warm-gold to-muted-teal rounded-full flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-warm-gold">JojoPrompts Premium</h3>
            </div>
            
            <div className="bg-gradient-to-br from-warm-gold/5 to-muted-teal/5 border-2 border-warm-gold/30 rounded-xl p-4 sm:p-6 relative group hover:shadow-xl hover:border-warm-gold/50 transition-all duration-300">
              <div className="absolute top-3 right-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(demoPrompts[activeDemo].premium, 'premium')}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copiedPrompt === 'premium' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              <p className="text-dark-base text-sm sm:text-base leading-relaxed mb-4">
                {demoPrompts[activeDemo].premium}
              </p>
              
              <div className="border-t border-warm-gold/20 pt-4">
                <p className="text-green-600 text-sm font-medium flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Result: {demoPrompts[activeDemo].results.premium}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12 sm:mt-16">
          <Button 
            asChild
            size="lg"
            className="mobile-button-primary bg-gradient-to-r from-warm-gold to-muted-teal hover:from-warm-gold/90 hover:to-muted-teal/90 text-white font-bold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
          >
            <a href="#pricing" className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Get Premium Prompts Now
              <ArrowRight className="h-5 w-5" />
            </a>
          </Button>
          <p className="text-muted-foreground text-sm mt-3">
            Join thousands of creators getting 10x better AI results
          </p>
        </div>
      </Container>
    </section>
  );
}