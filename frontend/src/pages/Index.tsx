import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import AnimatedSection from "@/components/AnimatedSection";
import {
  CloudRain, Thermometer, TrafficCone, Clock, ShieldCheck,
  Zap, Wallet, CheckCircle, Star, ArrowRight, Users, Award
} from "lucide-react";
import heroImage from "@/assets/hero-rider.jpg";
import riderTraffic from "@/assets/rider-traffic.jpg";
import riderHeat from "@/assets/rider-heat.jpg";
import riderRain from "@/assets/rider-rain.jpg";

const problems = [
  { icon: CloudRain, title: "Heavy Rain", desc: "Orders cancelled, roads flooded, deliveries failed", img: riderRain },
  { icon: Thermometer, title: "Extreme Heat", desc: "Heatwaves reduce orders and slow delivery times", img: riderHeat },
  { icon: TrafficCone, title: "Traffic & Roadblocks", desc: "Stuck for hours, missing delivery windows", img: riderTraffic },
  { icon: Clock, title: "Curfews & Restrictions", desc: "Sudden lockdowns cut your working hours short" },
];

const whyUs = [
  { icon: ShieldCheck, title: "Real Protection", desc: "Coverage for real-world disruptions that affect your earnings" },
  { icon: Zap, title: "Fast Claims", desc: "Automatic detection means hassle-free, instant payouts" },
  { icon: Wallet, title: "Affordable Plans", desc: "Weekly plans starting from just ₹49 — less than a cup of coffee" },
  { icon: CheckCircle, title: "Simple to Use", desc: "Sign up in 2 minutes, no paperwork, no complex processes" },
];

const testimonials = [
  { name: "Ravi K.", role: "Food Delivery Rider", text: "Last monsoon I lost ₹3,000 in one week. With InsurGo, I got ₹2,500 back automatically. This is a lifesaver!", rating: 5 },
  { name: "Priya M.", role: "Parcel Delivery Partner", text: "The claims are instant — no forms, no waiting. I just focus on delivering and InsurGo has my back.", rating: 5 },
  { name: "Arjun S.", role: "Bike Courier", text: "₹99/week is nothing compared to what I'd lose without protection. Best decision I've made.", rating: 5 },
];

const Index = () => (
  <div className="min-h-screen bg-background">
    {/* Hero */}
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      <img src={heroImage} alt="Delivery rider in rain" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="container relative z-10 py-32">
        <AnimatedSection className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <Shield className="h-4 w-4" /> Weekly Insurance for Delivery Riders
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold leading-tight mb-6">
            Deliver Without <span className="text-gradient">Worry</span>
          </h1>
          <p className="text-lg sm:text-xl text-foreground font-bold mb-8 max-w-lg dark:text-white">
            Get weekly insurance for failed deliveries due to rain, traffic, roadblocks, or unexpected issues.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to="/pricing">
              <Button variant="hero" size="xl">Get Protected <ArrowRight className="ml-1 h-5 w-5" /></Button>
            </Link>
            <Link to="/how-it-works">
              <Button variant="outline" size="xl">Learn More</Button>
            </Link>
          </div>
          <div className="flex items-center gap-6 mt-10 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Users className="h-4 w-4 text-accent" /> 10,000+ Riders</span>
            <span className="flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> 4.9★ Rated</span>
          </div>
        </AnimatedSection>
      </div>
    </section>

    {/* Problems */}
    <section className="py-24">
      <div className="container">
        <AnimatedSection className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">The Challenges You <span className="text-gradient">Face Daily</span></h2>
          <p className="text-muted-foreground text-lg">Every day, delivery riders risk losing income to things beyond their control.</p>
        </AnimatedSection>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {problems.map((p, i) => (
            <AnimatedSection key={p.title} delay={i * 0.1}>
              <div className="group relative rounded-xl overflow-hidden bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:-translate-y-1">
                {p.img && <img src={p.img} alt={p.title} className="w-full h-40 object-cover opacity-60 group-hover:opacity-80 transition-opacity" />}
                {!p.img && <div className="h-40 bg-gradient-card flex items-center justify-center"><p.icon className="h-16 w-16 text-primary/30" /></div>}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <p.icon className="h-5 w-5 text-destructive" />
                    <h3 className="font-display font-semibold text-foreground">{p.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{p.desc}</p>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>

    {/* Solution */}
    <section className="py-24 bg-card/50">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <AnimatedSection>
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-6">
              We Protect Your <span className="text-gradient">Earnings</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              InsurGo automatically detects disruptions in your delivery area — heavy rain, extreme heat, traffic jams, or government restrictions — and compensates you for the hours you couldn't work.
            </p>
            <div className="space-y-4">
              {["Automatic disruption detection", "Compensation based on affected hours", "Instant credit to your wallet", "No paperwork or manual claims"].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-accent shrink-0" />
                  <span className="text-foreground">{item}</span>
                </div>
              ))}
            </div>
          </AnimatedSection>
          <AnimatedSection delay={0.2}>
            <div className="relative rounded-2xl overflow-hidden shadow-glow-blue">
              <img src={riderRain} alt="Protected rider" className="w-full h-80 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent flex items-end p-8">
                <div className="glass rounded-xl p-4 w-full">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-muted-foreground">This week's protection</p>
                      <p className="text-2xl font-display font-bold text-accent">₹1,250 saved</p>
                    </div>
                    <ShieldCheck className="h-10 w-10 text-accent" />
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </div>
    </section>

    {/* Why Choose Us */}
    <section className="py-24">
      <div className="container">
        <AnimatedSection className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">Why Choose <span className="text-gradient">InsurGo</span></h2>
        </AnimatedSection>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {whyUs.map((w, i) => (
            <AnimatedSection key={w.title} delay={i * 0.1}>
              <div className="p-6 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-glow-blue transition-all duration-300 h-full">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <w.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display font-semibold mb-2 text-foreground">{w.title}</h3>
                <p className="text-sm text-muted-foreground">{w.desc}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>

    {/* Trust */}
    <section className="py-24 bg-card/50">
      <div className="container">
        <AnimatedSection className="text-center max-w-3xl mx-auto">
          <p className="text-2xl sm:text-3xl font-display font-bold leading-relaxed">
            "You face risks every day just to earn. We make sure those risks{" "}
            <span className="text-gradient">don't take away your income.</span>"
          </p>
        </AnimatedSection>
      </div>
    </section>

    {/* How It Works */}
    <section className="py-24">
      <div className="container">
        <AnimatedSection className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">How It <span className="text-gradient">Works</span></h2>
        </AnimatedSection>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: "01", title: "Choose a Plan", desc: "Pick a weekly plan that fits your budget. Plans start from just ₹49/week." },
            { step: "02", title: "Work Normally", desc: "Keep delivering as usual. Our system monitors disruptions in real-time." },
            { step: "03", title: "Get Compensated", desc: "When disruptions happen, your compensation is credited automatically." },
          ].map((s, i) => (
            <AnimatedSection key={s.step} delay={i * 0.15}>
              <div className="text-center p-8 rounded-xl bg-card border border-border hover:border-primary/30 transition-all duration-300">
                <div className="text-5xl font-display font-bold text-gradient mb-4">{s.step}</div>
                <h3 className="font-display text-xl font-semibold mb-3 text-foreground">{s.title}</h3>
                <p className="text-muted-foreground">{s.desc}</p>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>

    {/* Testimonials */}
    <section className="py-24 bg-card/50">
      <div className="container">
        <AnimatedSection className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">What Riders <span className="text-gradient">Say</span></h2>
        </AnimatedSection>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <AnimatedSection key={t.name} delay={i * 0.1}>
              <div className="p-6 rounded-xl bg-card border border-border h-full flex flex-col">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-foreground mb-6 flex-1">"{t.text}"</p>
                <div>
                  <p className="font-display font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>

    {/* Final CTA */}
    <section className="py-24">
      <div className="container">
        <AnimatedSection className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-display font-bold mb-6">
            Don't Let Failed Deliveries <span className="text-gradient">Cost You</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-8">Start your protection today. Plans from just ₹49/week.</p>
          <Link to="/pricing">
            <Button variant="hero" size="xl">Start Your Protection <ArrowRight className="ml-1 h-5 w-5" /></Button>
          </Link>
        </AnimatedSection>
      </div>
    </section>
  </div>
);

const Shield = ({ className }: { className?: string }) => (
  <ShieldCheck className={className} />
);

export default Index;
