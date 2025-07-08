
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Search } from 'lucide-react';

const faqData = [
  {
    id: '1',
    category: 'Getting Started',
    question: 'How do I create an account?',
    answer: 'Click on the "Sign Up" button in the top navigation, fill out the registration form with your email and password, and verify your email address to activate your account.'
  },
  {
    id: '2',
    category: 'Getting Started',
    question: 'What types of prompts are available?',
    answer: 'We offer ChatGPT prompts for text generation, Midjourney prompts for image creation, and workflow prompts for automation. Each category contains hundreds of professionally crafted prompts.'
  },
  {
    id: '3',
    category: 'Subscriptions',
    question: 'What subscription plans do you offer?',
    answer: 'We offer multiple subscription tiers including Basic, Pro, and Enterprise plans. Each plan provides different levels of access to our prompt library and premium features.'
  },
  {
    id: '4',
    category: 'Subscriptions',
    question: 'Can I change my subscription plan?',
    answer: 'Yes, you can upgrade or downgrade your plan at any time from your account dashboard. Changes take effect immediately.'
  },
  {
    id: '5',
    category: 'Subscriptions',
    question: 'How do I cancel my subscription?',
    answer: 'You can cancel your subscription from your account dashboard under the "My Subscription" tab. Your access will continue until the end of your current billing period.'
  },
  {
    id: '6',
    category: 'Using Prompts',
    question: 'How do I copy and use prompts?',
    answer: 'Click on any prompt card to view its details, then use the copy button to copy the prompt text to your clipboard. You can then paste it into ChatGPT, Midjourney, or your preferred AI tool.'
  },
  {
    id: '7',
    category: 'Using Prompts',
    question: 'Can I save prompts to favorites?',
    answer: 'Yes, click the heart icon on any prompt card to add it to your favorites. You can view all your saved prompts in the Favorites section.'
  },
  {
    id: '8',
    category: 'Using Prompts',
    question: 'Can I create my own prompts?',
    answer: 'Yes, subscribers can create and submit their own prompts. Use the floating add button or navigate to the prompts section to create new prompts.'
  },
  {
    id: '9',
    category: 'Account Management',
    question: 'How do I update my profile information?',
    answer: 'Go to your account dashboard and click on the "Account Settings" tab to update your name, email, password, and other profile information.'
  },
  {
    id: '10',
    category: 'Account Management',
    question: 'How do I view my payment history?',
    answer: 'Your complete payment history is available in your account dashboard under the "Payment History" tab.'
  },
  {
    id: '11',
    category: 'Technical Support',
    question: 'What browsers are supported?',
    answer: 'Our platform works best on modern browsers including Chrome, Firefox, Safari, and Edge. We recommend keeping your browser updated for the best experience.'
  },
  {
    id: '12',
    category: 'Technical Support',
    question: 'I forgot my password. How do I reset it?',
    answer: 'Click on "Forgot Password" on the login page, enter your email address, and follow the instructions in the reset email we send you.'
  },
  {
    id: '13',
    category: 'Billing',
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards, PayPal, and other secure payment methods. All transactions are processed securely.'
  },
  {
    id: '14',
    category: 'Billing',
    question: 'Do you offer refunds?',
    answer: 'Yes, we offer a 30-day money-back guarantee for all new subscriptions. Contact our support team to request a refund.'
  },
  {
    id: '15',
    category: 'Features',
    question: 'Can I share prompts with others?',
    answer: 'Yes, you can share individual prompts or collections with others using the share functionality available on each prompt.'
  }
];

const categories = ['All', 'Getting Started', 'Subscriptions', 'Using Prompts', 'Account Management', 'Technical Support', 'Billing', 'Features'];

export default function FAQPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredFAQs = faqData.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         faq.answer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || faq.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="container max-w-4xl mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
        <p className="text-lg text-muted-foreground">
          Find answers to common questions about our prompt library and services.
        </p>
      </div>

      {/* Search and Filter */}
      <div className="mb-8 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search questions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <Badge
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Badge>
          ))}
        </div>
      </div>

      {/* FAQ Accordion */}
      <Card>
        <CardHeader>
          <CardTitle>
            {selectedCategory === 'All' ? 'All Questions' : selectedCategory}
          </CardTitle>
          <CardDescription>
            {filteredFAQs.length} question{filteredFAQs.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredFAQs.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {filteredFAQs.map((faq) => (
                <AccordionItem key={faq.id} value={faq.id}>
                  <AccordionTrigger className="text-left">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {faq.category}
                      </Badge>
                      <span>{faq.question}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No questions found matching your search criteria.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Still need help section */}
      <div className="mt-12 text-center">
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-xl font-semibold mb-2">Still need help?</h3>
            <p className="text-muted-foreground mb-4">
              Can't find what you're looking for? Our support team is here to help.
            </p>
            <div className="space-x-4">
              <a
                href="/contact"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-warm-gold text-white hover:bg-warm-gold/90 h-10 px-4 py-2"
              >
                Contact Support
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
