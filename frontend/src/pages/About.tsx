import AnimatedSection from "@/components/AnimatedSection";
import { ShieldCheck, CloudRain, Thermometer, Wind, TrafficCone, Clock, Zap, CreditCard, Smartphone } from "lucide-react";

const coverage = [
  { icon: CloudRain, title: "Heavy Rain" },
  { icon: Thermometer, title: "Extreme Heat" },
  { icon: Wind, title: "High Pollution (AQI)" },
  { icon: TrafficCone, title: "Traffic Disruptions" },
  { icon: Clock, title: "Local Restrictions / Curfews" },
];

const payoutSteps = [
  { icon: Zap, title: "Automatic Detection", desc: "Automatic detection of disruption in your area using real-time data." },
  { icon: CreditCard, title: "Hours-Based Payout", desc: "Based on your working hours affected — fair and transparent." },
  { icon: Smartphone, title: "Instant Credit", desc: "Money credited instantly to your InsurGo wallet — no forms needed." },
];

const About = () => (
  <div className="min-h-screen pt-24">
    {/* Hero */}
    <section className="py-20">
      <div className="container">
        <AnimatedSection className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <ShieldCheck className="h-4 w-4" /> About Us
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-bold mb-8">
            Protecting the People Who <span className="text-gradient">Keep Cities Moving</span>
          </h1>
        </AnimatedSection>

        <AnimatedSection delay={0.1} className="max-w-3xl mx-auto space-y-6 text-lg text-muted-foreground leading-relaxed">
          <p>
            Every day, thousands of delivery riders step out to keep cities moving — facing unpredictable challenges like heavy rain, extreme heat, pollution, traffic, and sudden restrictions. Yet, when deliveries fail due to these conditions, it's often the rider who bears the loss.
          </p>
          <p className="text-foreground font-semibold text-xl">
            We are here to change that.
          </p>
          <p>
            Our platform is built with one simple mission: <strong className="text-foreground">to protect the earnings of delivery riders.</strong> We understand that behind every delivery is effort, time, and risk. That's why we provide affordable weekly insurance plans designed specifically for real-world delivery challenges.
          </p>
        </AnimatedSection>
      </div>
    </section>

    {/* What We Cover */}
    <section className="py-20 bg-card/50">
      <div className="container">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">What We <span className="text-gradient">Cover</span></h2>
        </AnimatedSection>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6 max-w-4xl mx-auto">
          {coverage.map((c, i) => (
            <AnimatedSection key={c.title} delay={i * 0.08}>
              <div className="p-6 rounded-xl bg-card border border-border text-center hover:border-primary/30 hover:shadow-glow-blue transition-all duration-300">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <c.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-sm">{c.title}</h3>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>

    {/* Payout System */}
    <section className="py-20">
      <div className="container">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">How Payout <span className="text-gradient">Works</span></h2>
        </AnimatedSection>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {payoutSteps.map((s, i) => (
            <AnimatedSection key={s.title} delay={i * 0.15}>
              <div className="p-8 rounded-xl bg-card border border-border h-full text-center">
                <div className="h-14 w-14 rounded-xl bg-accent/10 flex items-center justify-center mb-5 mx-auto">
                  <s.icon className="h-7 w-7 text-accent" />
                </div>
                <h3 className="font-display text-lg font-semibold mb-3">{s.title}</h3>
                <p className="text-muted-foreground text-sm">{s.desc}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  </div>
);

export default About;
