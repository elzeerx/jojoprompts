
import React from "react";

export default function TermsOfServicePage() {
  return (
    <div className="mobile-container-padding mobile-section-padding max-w-4xl mx-auto">
      <h1 className="section-title text-dark-base">Terms of Service</h1>
      
      <div className="prose prose-slate max-w-none space-y-6 sm:space-y-8 text-sm sm:text-base leading-relaxed">
        <p className="text-muted-foreground">Last updated: May 20, 2025</p>
        
        <div className="bg-warm-gold/5 p-4 sm:p-6 rounded-lg border border-warm-gold/20">
          <h2 className="text-lg sm:text-xl font-semibold mt-0 mb-3 sm:mb-4 text-dark-base">1. Agreement to Terms</h2>
          <p className="mb-3 sm:mb-4">
            These Terms of Service constitute a legally binding agreement made between you and JojoPrompts, concerning your access to and use of the website as well as any other media form, media channel, mobile website or mobile application related, linked, or otherwise connected thereto.
          </p>
          <p>
            You agree that by accessing the Site, you have read, understood, and agree to be bound by all of these Terms of Service. If you do not agree with all of these terms, then you are expressly prohibited from using the Site and you must discontinue use immediately.
          </p>
        </div>
        
        <section>
          <h2 className="text-lg sm:text-xl font-semibold mt-6 sm:mt-8 mb-3 sm:mb-4 text-dark-base">2. Intellectual Property Rights</h2>
          <p className="mb-3 sm:mb-4">
            Unless otherwise indicated, the Site is our proprietary property and all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics on the Site and the trademarks, service marks, and logos contained therein are owned or controlled by us or licensed to us, and are protected by copyright and trademark laws and various other intellectual property rights.
          </p>
          <p>
            Provided that you are eligible to use the Site, you are granted a limited license to access and use the Site and to download or print a copy of any portion of the Content to which you have properly gained access solely for your personal, non-commercial use. We reserve all rights not expressly granted to you in and to the Site, the Content and the Marks.
          </p>
        </section>
        
        <section>
          <h2 className="text-lg sm:text-xl font-semibold mt-6 sm:mt-8 mb-3 sm:mb-4 text-dark-base">3. User Representations</h2>
          <p className="mb-2 sm:mb-3">By using the Site, you represent and warrant that:</p>
          <ul className="list-disc ml-6 sm:ml-8 mb-3 sm:mb-4 space-y-1 sm:space-y-2">
            <li>You have the legal capacity and you agree to comply with these Terms of Service.</li>
            <li>You are not a minor in the jurisdiction in which you reside.</li>
            <li>You will not access the Site through automated or non-human means, whether through a bot, script, or otherwise.</li>
            <li>You will not use the Site for any illegal or unauthorized purpose.</li>
            <li>Your use of the Site will not violate any applicable law or regulation.</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-lg sm:text-xl font-semibold mt-6 sm:mt-8 mb-3 sm:mb-4 text-dark-base">4. Purchases and Payment</h2>
          <p className="mb-3 sm:mb-4">
            We accept the following forms of payment: credit cards, debit cards, and other payment methods as specified at the time of purchase.
          </p>
          <p>
            You agree to provide current, complete, and accurate purchase and account information for all purchases made via the Site. You further agree to promptly update account and payment information, including email address, payment method, and payment card expiration date, so that we can complete your transactions and contact you as needed.
          </p>
        </section>
        
        <section>
          <h2 className="text-lg sm:text-xl font-semibold mt-6 sm:mt-8 mb-3 sm:mb-4 text-dark-base">5. Prohibited Activities</h2>
          <p>You may not access or use the Site for any purpose other than that for which we make the Site available. The Site may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by us.</p>
        </section>
        
        <section>
          <h2 className="text-lg sm:text-xl font-semibold mt-6 sm:mt-8 mb-3 sm:mb-4 text-dark-base">6. Term and Termination</h2>
          <p>
            These Terms of Service shall remain in full force and effect while you use the Site. Without limiting any other provision of these terms of service, we reserve the right to, in our sole discretion and without notice or liability, deny access to and use of the site to any person for any reason or for no reason.
          </p>
        </section>
        
        <section>
          <h2 className="text-lg sm:text-xl font-semibold mt-6 sm:mt-8 mb-3 sm:mb-4 text-dark-base">7. Modifications and Interruptions</h2>
          <p>
            We reserve the right to change, modify, or remove the contents of the Site at any time or for any reason at our sole discretion without notice. We also reserve the right to modify or discontinue all or part of the Site without notice at any time.
          </p>
        </section>
        
        <section className="bg-muted-teal/5 p-4 sm:p-6 rounded-lg border border-muted-teal/20">
          <h2 className="text-lg sm:text-xl font-semibold mt-0 mb-3 sm:mb-4 text-dark-base">8. Contact Us</h2>
          <p>
            In order to resolve a complaint regarding the Site or to receive further information regarding use of the Site, please contact us at:<br />
            <span className="font-medium text-warm-gold">Email: support@jojoprompts.com</span>
          </p>
        </section>
      </div>
    </div>
  );
}
