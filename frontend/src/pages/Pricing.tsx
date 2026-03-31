import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import AnimatedSection from "@/components/AnimatedSection";
import { CheckCircle, Star, Loader2 } from "lucide-react";
import { policyApi, type Plan } from "@/lib/api";
import { getToken } from "@/lib/api";

// Map plan names to their best-for copy
const planMeta: Record<string, { desc: string; popular: boolean }> = {
  lite:   { desc: "Best for: Part-time riders",      popular: false },
  smart:  { desc: "Best for: Regular riders",         popular: true  },
  pro:    { desc: "Best for: Full-time earners",       popular: false },
  flex:   { desc: "Pay only on work days",             popular: false },
};

const Pricing = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    policyApi.getPlans()
      .then(({ data }) => { setPlans(data.plans); setLoading(false); })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Could not load plans.";
        setError(msg);
        setLoading(false);
      });
  }, []);

  const handleSelectPlan = (plan: Plan) => {
    if (!getToken()) {
      navigate("/signup");
      return;
    }
    navigate(`/payment?planId=${plan._id}&planName=${encodeURIComponent(plan.displayName)}&amount=${plan.weeklyPremium}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">Loading plans…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-destructive font-medium mb-2">{error}</p>
          <p className="text-sm text-muted-foreground">
            Make sure the backend is running on port 5000 and plans have been seeded{" "}
            (<code className="text-xs bg-muted px-1 rounded">npm run seed</code>).
          </p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!loading && plans.length === 0) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-foreground font-medium mb-2">No insurance plans found.</p>
          <p className="text-sm text-muted-foreground">
            Run{" "}
            <code className="text-xs bg-muted px-1 rounded">npm run seed</code>{" "}
            in the backend directory to populate the plans.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  // Split flex from weekly plans for separate rendering
  const weeklyPlans = plans.filter((p) => p.name !== "flex");
  const flexPlan = plans.find((p) => p.name === "flex");

  return (
    <div className="min-h-screen pt-24">
      <section className="py-20">
        <div className="container">
          <AnimatedSection className="text-center max-w-2xl mx-auto mb-16">
            <h1 className="text-4xl sm:text-5xl font-display font-bold mb-4">
              Simple, Affordable <span className="text-gradient">Weekly Plans</span>
            </h1>
            <p className="text-lg text-muted-foreground">No long-term contracts. Cancel anytime. Protection that fits your pocket.</p>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {weeklyPlans.map((plan, i) => {
              const meta = planMeta[plan.name] || { desc: plan.description, popular: false };
              return (
                <AnimatedSection key={plan._id} delay={i * 0.1}>
                  <div className={`relative p-8 rounded-2xl border h-full flex flex-col ${
                    meta.popular
                      ? "border-primary shadow-glow-blue bg-card"
                      : "border-border bg-card"
                  }`}>
                    {meta.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-primary text-primary-foreground text-xs font-bold flex items-center gap-1">
                        <Star className="h-3 w-3" /> Most Popular
                      </div>
                    )}
                    <div className="mb-6">
                      <h3 className="font-display text-lg font-semibold mb-1 text-foreground">{plan.displayName}</h3>
                      <p className="text-sm text-muted-foreground mb-4">{meta.desc}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-display font-bold text-foreground">₹{plan.weeklyPremium}</span>
                        <span className="text-muted-foreground">/week</span>
                      </div>
                    </div>
                    <ul className="space-y-3 mb-8 flex-1">
                      {[
                        `₹${plan.coveragePerHour}/hr coverage`,
                        `₹${plan.maxPayoutPerEvent} max per event`,
                        `₹${plan.maxPayoutPerWeek} weekly cap`,
                        `Up to ${plan.maxHoursPerEvent} hrs/event`,
                        ...plan.triggerTypes.map((t) => t.charAt(0).toUpperCase() + t.slice(1) + " protection"),
                        "Auto payouts",
                      ].map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                          <span className="text-foreground">{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant={meta.popular ? "hero" : "outline"}
                      className="w-full"
                      size="lg"
                      onClick={() => handleSelectPlan(plan)}
                    >
                      Get Started
                    </Button>
                  </div>
                </AnimatedSection>
              );
            })}
          </div>

          {/* Daily Flex Plan */}
          {flexPlan && (
            <AnimatedSection className="max-w-2xl mx-auto mt-12">
              <div className="relative p-8 rounded-2xl border border-accent/30 bg-card">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                  <div>
                    <h3 className="font-display text-lg font-semibold mb-1 text-foreground">{flexPlan.displayName}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{flexPlan.description}</p>
                    <ul className="space-y-2">
                      {[
                        `₹${flexPlan.maxPayoutPerEvent} payout per disruption`,
                        "Pay only when active",
                        "No weekly commitment",
                        "Ideal for part-time gig workers",
                      ].map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                          <span className="text-foreground">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="text-center sm:text-right shrink-0">
                    <div className="flex items-baseline gap-1 justify-center sm:justify-end">
                      <span className="text-4xl font-display font-bold text-foreground">₹{flexPlan.weeklyPremium}</span>
                      <span className="text-muted-foreground">/week</span>
                    </div>
                    <Button
                      variant="outline"
                      className="mt-4 w-full sm:w-auto"
                      size="lg"
                      onClick={() => handleSelectPlan(flexPlan)}
                    >
                      Get Started
                    </Button>
                  </div>
                </div>
              </div>
            </AnimatedSection>
          )}
        </div>
      </section>
    </div>
  );
};

export default Pricing;
