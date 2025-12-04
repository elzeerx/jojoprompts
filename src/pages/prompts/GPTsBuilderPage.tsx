import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Search, 
  Plus, 
  Sparkles, 
  BookOpen, 
  TrendingUp,
  ArrowLeft,
  Globe,
  Code,
  Image,
  FileSearch
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  GPTsBuilderWizard, 
  GPTTemplateLibrary, 
  GPTConfiguration,
  TEMPLATES
} from '@/components/gpts-builder';

type ViewMode = 'browse' | 'create' | 'templates';

export default function GPTsBuilderPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConfig, setSelectedConfig] = useState<Partial<GPTConfiguration> | undefined>();
  const navigate = useNavigate();

  const handleSelectTemplate = (config: GPTConfiguration) => {
    setSelectedConfig(config);
    setViewMode('create');
  };

  const handleCreateNew = () => {
    setSelectedConfig(undefined);
    setViewMode('create');
  };

  const handleWizardComplete = (config: GPTConfiguration) => {
    // In a full implementation, this would save to the database
    console.log('GPT Configuration created:', config);
    setViewMode('browse');
  };

  const filteredTemplates = TEMPLATES.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (viewMode === 'create') {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Button 
            variant="ghost" 
            className="mb-6"
            onClick={() => setViewMode('browse')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to GPTs Builder
          </Button>
          
          <GPTsBuilderWizard
            initialConfig={selectedConfig}
            onComplete={handleWizardComplete}
            onCancel={() => setViewMode('browse')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-warm-gold/10 via-background to-muted-teal/10 border-b border-border/50">
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-center gap-2 mb-4">
            <Link to="/prompts" className="text-muted-foreground hover:text-foreground transition-colors">
              Prompts
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-foreground">GPTs Builder</span>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-3">
                <Sparkles className="h-8 w-8 text-warm-gold" />
                GPTs Builder
              </h1>
              <p className="text-muted-foreground text-lg">
                Create and discover custom GPT configurations for ChatGPT
              </p>
            </div>
            
            <Button 
              size="lg" 
              className="bg-warm-gold hover:bg-warm-gold/90"
              onClick={handleCreateNew}
            >
              <Plus className="h-5 w-5 mr-2" />
              Create New GPT
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="browse" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <TabsList>
              <TabsTrigger value="browse" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Browse
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Templates
              </TabsTrigger>
            </TabsList>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search GPTs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <TabsContent value="browse" className="space-y-8">
            {/* Featured Section */}
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-warm-gold" />
                Featured GPTs
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredTemplates.slice(0, 6).map(template => (
                  <Card 
                    key={template.id}
                    className="hover:shadow-md transition-all cursor-pointer group hover:border-warm-gold/30"
                    onClick={() => handleSelectTemplate(template.config)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="p-2 rounded-lg bg-warm-gold/10 text-warm-gold">
                          {template.icon}
                        </div>
                        <Badge variant="outline">{template.category}</Badge>
                      </div>
                      <CardTitle className="text-lg mt-3 group-hover:text-warm-gold transition-colors">
                        {template.name}
                      </CardTitle>
                      <CardDescription>{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-1">
                        {template.config.capabilities.webBrowsing && (
                          <Badge variant="secondary" className="text-xs">
                            <Globe className="h-3 w-3 mr-1" /> Web
                          </Badge>
                        )}
                        {template.config.capabilities.codeInterpreter && (
                          <Badge variant="secondary" className="text-xs">
                            <Code className="h-3 w-3 mr-1" /> Code
                          </Badge>
                        )}
                        {template.config.capabilities.dallE && (
                          <Badge variant="secondary" className="text-xs">
                            <Image className="h-3 w-3 mr-1" /> DALL·E
                          </Badge>
                        )}
                        {template.config.capabilities.fileSearch && (
                          <Badge variant="secondary" className="text-xs">
                            <FileSearch className="h-3 w-3 mr-1" /> Files
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Browse by Category</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {['Productivity', 'Development', 'Academic', 'Creative'].map(category => (
                  <Card 
                    key={category}
                    className="hover:shadow-md transition-all cursor-pointer hover:border-warm-gold/30"
                    onClick={() => setSearchQuery(category)}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <span className="font-medium">{category}</span>
                      <Badge variant="secondary">
                        {TEMPLATES.filter(t => t.category === category).length}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="templates">
            <GPTTemplateLibrary onSelectTemplate={handleSelectTemplate} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
