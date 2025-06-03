
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Mail, MessageSquare, Phone, Clock } from 'lucide-react';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    setTimeout(() => {
      toast({
        title: "Message Sent",
        description: "Thank you for contacting us. We'll get back to you within 24 hours.",
      });
      setFormData({ name: '', email: '', subject: '', message: '' });
      setIsSubmitting(false);
    }, 1000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="mobile-container-padding mobile-section-padding max-w-4xl mx-auto">
      <div className="text-center mb-8 sm:mb-12">
        <h1 className="section-title">Contact Us</h1>
        <p className="section-subtitle">
          Have questions or need support? We're here to help.
        </p>
      </div>

      <div className="mobile-grid-2 gap-6 sm:gap-8">
        {/* Mobile-optimized Contact Form */}
        <Card className="border-2 border-warm-gold/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl text-dark-base">Send us a message</CardTitle>
            <CardDescription>
              Fill out the form below and we'll get back to you as soon as possible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="mobile-input"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="mobile-input"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="subject" className="text-sm font-medium">Subject</Label>
                <Input
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  className="mobile-input"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="message" className="text-sm font-medium">Message</Label>
                <Textarea
                  id="message"
                  name="message"
                  rows={6}
                  value={formData.message}
                  onChange={handleChange}
                  className="mobile-textarea"
                  required
                />
              </div>
              
              <Button type="submit" disabled={isSubmitting} className="w-full mobile-button-primary">
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Mobile-optimized Contact Information */}
        <div className="space-y-6">
          <Card className="border-2 border-warm-gold/20 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl text-dark-base">Get in touch</CardTitle>
              <CardDescription>
                Choose the best way to reach us
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="rounded-full bg-warm-gold/10 p-2 flex-shrink-0">
                  <Mail className="h-5 w-5 text-warm-gold" />
                </div>
                <div>
                  <p className="font-medium text-sm sm:text-base">Email Support</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">support@promptlibrary.com</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="rounded-full bg-warm-gold/10 p-2 flex-shrink-0">
                  <MessageSquare className="h-5 w-5 text-warm-gold" />
                </div>
                <div>
                  <p className="font-medium text-sm sm:text-base">Live Chat</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Available 9 AM - 6 PM EST</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="rounded-full bg-warm-gold/10 p-2 flex-shrink-0">
                  <Clock className="h-5 w-5 text-warm-gold" />
                </div>
                <div>
                  <p className="font-medium text-sm sm:text-base">Response Time</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Within 24 hours</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-warm-gold/20 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl text-dark-base">Frequently Asked Questions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-1 text-sm sm:text-base">How do I access premium prompts?</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Subscribe to any of our plans to unlock access to premium prompt collections.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1 text-sm sm:text-base">Can I cancel my subscription?</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Yes, you can cancel your subscription at any time from your account dashboard.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1 text-sm sm:text-base">Do you offer refunds?</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    We offer a 30-day money-back guarantee for all subscription plans.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
