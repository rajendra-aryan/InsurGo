import AnimatedSection from "@/components/AnimatedSection";

const TermsOfService = () => (
  <div className="min-h-screen pt-24 pb-16">
    <div className="container max-w-3xl">
      <AnimatedSection>
        <h1 className="text-3xl sm:text-4xl font-display font-bold mb-8">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: March 28, 2026</p>
      </AnimatedSection>

      <AnimatedSection delay={0.1}>
        <div className="space-y-8 text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-xl font-display font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">By accessing or using InsurGo's services, you agree to be bound by these Terms of Service. If you do not agree, please do not use our platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">2. Eligibility</h2>
            <p className="text-muted-foreground">You must be at least 18 years old and an active delivery rider to use our services. You must provide accurate and complete information during registration.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">3. Insurance Plans</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Plans are billed on a weekly or daily basis as selected</li>
              <li>Coverage begins immediately upon successful payment</li>
              <li>Each plan has specific disruption limits and payout caps</li>
              <li>Plans auto-renew unless cancelled before the renewal date</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">4. Claims & Payouts</h2>
            <p className="text-muted-foreground">Claims are processed automatically based on verified disruption data (weather, traffic, government restrictions). Payouts are credited to your registered wallet. InsurGo reserves the right to verify claims and deny fraudulent requests.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">5. User Responsibilities</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Provide accurate personal and delivery information</li>
              <li>Do not misuse the platform or submit false claims</li>
              <li>Keep your account credentials secure</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">6. Limitation of Liability</h2>
            <p className="text-muted-foreground">InsurGo's liability is limited to the maximum payout specified in your active plan. We are not responsible for losses beyond the plan's coverage limits or for disruptions not covered by your plan.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">7. Termination</h2>
            <p className="text-muted-foreground">We may suspend or terminate your account if you violate these terms, engage in fraudulent activity, or misuse the platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">8. Changes to Terms</h2>
            <p className="text-muted-foreground">We reserve the right to modify these terms at any time. Continued use of our services after changes constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-display font-semibold mb-3">9. Contact</h2>
            <p className="text-muted-foreground">For questions regarding these terms, reach us at <span className="text-primary font-medium">legal@insurgo.in</span>.</p>
          </section>
        </div>
      </AnimatedSection>
    </div>
  </div>
);

export default TermsOfService;
