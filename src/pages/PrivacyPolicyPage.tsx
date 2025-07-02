
import React from "react";

export default function PrivacyPolicyPage() {
  return (
    <div className="mobile-container-padding mobile-section-padding max-w-4xl mx-auto">
      <h1 className="section-title text-dark-base">Privacy Policy</h1>
      
      <div className="prose prose-slate max-w-none space-y-6 sm:space-y-8 text-sm sm:text-base leading-relaxed">
        <p className="text-muted-foreground">Last updated: May 20, 2025</p>
        
        <div className="bg-warm-gold/5 p-4 sm:p-6 rounded-lg border border-warm-gold/20">
          <h2 className="text-lg sm:text-xl font-semibold mt-0 mb-3 sm:mb-4 text-dark-base">1. Introduction</h2>
          <p className="mb-3 sm:mb-4">
            Welcome to JojoPrompts ("we," "our," or "us"). We respect your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website jojoprompts.com, including any other media form, media channel, mobile website, or mobile application related or connected thereto (collectively, the "Site").
          </p>
          <p>
            Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the site.
          </p>
        </div>
        
        <section>
          <h2 className="text-lg sm:text-xl font-semibold mt-6 sm:mt-8 mb-3 sm:mb-4 text-dark-base">2. Information We Collect</h2>
          <p className="mb-2 sm:mb-3">We may collect information about you in a variety of ways including:</p>
          <ul className="list-disc ml-6 sm:ml-8 mb-3 sm:mb-4 space-y-2 sm:space-y-3">
            <li><strong>Personal Data:</strong> Personally identifiable information, such as your name, email address, and telephone number, that you voluntarily give to us when you register with the Site or when you choose to participate in various activities related to the Site.</li>
            <li><strong>Derivative Data:</strong> Information our servers automatically collect when you access the Site, such as your IP address, browser type, operating system, access times, and the pages you have viewed directly before and after accessing the Site.</li>
            <li><strong>Financial Data:</strong> Financial information, such as data related to your payment method (e.g., valid credit card number, card brand, expiration date) that we may collect when you purchase products from the Site.</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-lg sm:text-xl font-semibold mt-6 sm:mt-8 mb-3 sm:mb-4 text-dark-base">3. Use of Your Information</h2>
          <p className="mb-2 sm:mb-3">Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you via the Site to:</p>
          <ul className="list-disc ml-6 sm:ml-8 mb-3 sm:mb-4 space-y-1 sm:space-y-2">
            <li>Create and manage your account.</li>
            <li>Process payments and refunds.</li>
            <li>Send you technical notices, updates, security alerts, and support and administrative messages.</li>
            <li>Respond to your comments, questions, and requests.</li>
            <li>Monitor and analyze trends, usage, and activities in connection with our Services.</li>
            <li>Improve the Site, products or services, marketing, or customer relations.</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-lg sm:text-xl font-semibold mt-6 sm:mt-8 mb-3 sm:mb-4 text-dark-base">4. Disclosure of Your Information</h2>
          <p className="mb-2 sm:mb-3">We may share information we have collected about you in certain situations. Your information may be disclosed as follows:</p>
          <ul className="list-disc ml-6 sm:ml-8 mb-3 sm:mb-4 space-y-2 sm:space-y-3">
            <li><strong>By Law or to Protect Rights:</strong> If we believe the release of information about you is necessary to respond to legal process, to investigate or remedy potential violations of our policies, or to protect the rights, property, and safety of others, we may share your information as permitted or required by any applicable law, rule, or regulation.</li>
            <li><strong>Third-Party Service Providers:</strong> We may share your information with third parties that perform services for us or on our behalf, including payment processing, data analysis, email delivery, hosting services, customer service, and marketing assistance.</li>
            <li><strong>Marketing Communications:</strong> With your consent, or with an opportunity for you to withdraw consent, we may share your information with third parties for marketing purposes.</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-lg sm:text-xl font-semibold mt-6 sm:mt-8 mb-3 sm:mb-4 text-dark-base">5. Security of Your Information</h2>
          <p>
            We use administrative, technical, and physical security measures to help protect your personal information. While we have taken reasonable steps to secure the personal information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.
          </p>
        </section>
        
        <section className="bg-muted-teal/5 p-4 sm:p-6 rounded-lg border border-muted-teal/20">
          <h2 className="text-lg sm:text-xl font-semibold mt-0 mb-3 sm:mb-4 text-dark-base">6. Contact Us</h2>
          <p>
            If you have questions or comments about this Privacy Policy, please contact us at:<br />
            <span className="font-medium text-warm-gold">Email: info@jojoprompts.com</span>
          </p>
        </section>
      </div>
    </div>
  );
}
