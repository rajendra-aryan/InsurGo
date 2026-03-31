import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import AnimatedSection from "@/components/AnimatedSection";
import { ArrowRight, ClipboardList, Bike, Wallet, ShieldCheck } from "lucide-react";

const steps = [
  { icon: ClipboardList, title: "Sign Up & Choose a Plan", desc: "Create your account in under 2 minutes. Pick a weekly plan that suits your budget and riding schedule. No documents needed." },
  { icon: Bike, title: "Deliver As Usual", desc: "Continue your daily deliveries. Our system silently monitors weather, traffic, and policy disruptions across your city in real-time." },
  { icon: ShieldCheck, title: "Disruption Detected", desc: "When a qualifying event occurs — heavy rain, extreme heat, road closures — our system automatically flags it for your area." },
  { icon: Wallet, title: "Get Paid Instantly", desc: "Your compensation is calculated based on affected hours and credited to your InsurGo wallet instantly. No forms, no waiting." },
];

const HowItWorks = () => (
  <div className="min-h-screen pt-24">
    <section className="py-20">
      <div className="container">
        <AnimatedSection className="text-center max-w-2xl mx-auto mb-20">
          <h1 className="text-4xl sm:text-5xl font-display font-bold mb-4">
            How InsurGo <span className="text-gradient">Works</span>
          </h1>
          <p className="text-lg text-muted-foreground">Four simple steps to protect your delivery earnings.</p>
        </AnimatedSection>

        <div className="max-w-3xl mx-auto space-y-8">
          {steps.map((s, i) => (
            <AnimatedSection key={s.title} delay={i * 0.12}>
              <div className="flex gap-6 items-start p-6 rounded-xl bg-card border border-border hover:border-primary/30 transition-all duration-300">
                <div className="shrink-0 h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                  <s.icon className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <div className="text-xs font-bold text-primary mb-1">STEP {i + 1}</div>
                  <h3 className="font-display text-xl font-semibold mb-2">{s.title}</h3>
                  <p className="text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>

        <AnimatedSection delay={0.5} className="text-center mt-16">
          <Link to="/pricing">
            <Button variant="hero" size="xl">Get Started Now <ArrowRight className="ml-1 h-5 w-5" /></Button>
          </Link>
        </AnimatedSection>
      </div>
    </section>
  </div>
);

export default HowItWorks;
