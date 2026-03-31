import AnimatedSection from "@/components/AnimatedSection";

const PrivacyPolicy = () => (
  <div className="min-h-screen pt-24 pb-16">
    <div className="container max-w-3xl">
      <AnimatedSection>
        <h1 className="text-3xl sm:text-4xl font-display font-bold mb-8">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: March 28, 2026</p>
      </AnimatedSection>

      <AnimatedSection delay={0.1}>
        <div className="space-y-8 text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-xl font-display font-semibold mb-3">1. Information We Collect</h2>
            <p className="text-muted-foreground">We collect information you provide when creating an account, purchasing a plan, or contacting us. This includes your name, email address, phone number, delivery platform details, and payment information.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Process insurance claims and payouts</li>
              <li>Monitor weather, traffic, and disruption data in your delivery area</li>
              <li>Send plan updates, claim notifications, and promotional offers</li>
              <li>Improve our services and user experience</li>
              <li>Comply with legal and regulatory requirements</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">3. Data Sharing</h2>
            <p className="text-muted-foreground">We do not sell your personal data. We may share information with trusted third-party payment processors, weather data providers, and as required by law.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">4. Data Security</h2>
            <p className="text-muted-foreground">We use industry-standard encryption and security measures to protect your data. All payment transactions are processed through secure, PCI-compliant payment gateways.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">5. Cookies</h2>
            <p className="text-muted-foreground">We use cookies and similar technologies to enhance your experience, analyze usage patterns, and deliver relevant content. You can manage cookie preferences through your browser settings.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">6. Your Rights</h2>
            <p className="text-muted-foreground">You may request access to, correction of, or deletion of your personal data at any time by contacting us at <span className="text-primary font-medium">privacy@insurgo.in</span>.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">7. Changes to This Policy</h2>
            <p className="text-muted-foreground">We may update this Privacy Policy from time to time. Changes will be posted on this page with the updated date.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">8. Contact Us</h2>
            <p className="text-muted-foreground">If you have questions about this Privacy Policy, contact us at <span className="text-primary font-medium">privacy@insurgo.in</span>.</p>
          </section>
        </div>
      </AnimatedSection>
    </div>
  </div>
);

export default PrivacyPolicy;
