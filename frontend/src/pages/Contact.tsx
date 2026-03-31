import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import AnimatedSection from "@/components/AnimatedSection";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { toast } from "sonner";

const Contact = () => {
  const [sending, setSending] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      setSending(false);
      toast.success("Message sent! We'll get back to you within 24 hours.");
    }, 1500);
  };

  return (
    <div className="min-h-screen pt-24">
      <section className="py-20">
        <div className="container">
          <AnimatedSection className="text-center max-w-2xl mx-auto mb-16">
            <h1 className="text-4xl sm:text-5xl font-display font-bold mb-4">
              Get in <span className="text-gradient">Touch</span>
            </h1>
            <p className="text-lg text-muted-foreground">Have questions? We're here to help riders like you.</p>
          </AnimatedSection>

          <div className="grid lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
            <AnimatedSection>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input placeholder="Your name" required className="bg-card border-border" />
                  <Input type="email" placeholder="Email address" required className="bg-card border-border" />
                </div>
                <Input placeholder="Subject" required className="bg-card border-border" />
                <Textarea placeholder="Your message..." rows={5} required className="bg-card border-border resize-none" />
                <Button variant="hero" size="lg" type="submit" disabled={sending} className="w-full sm:w-auto">
                  {sending ? "Sending..." : <>Send Message <Send className="ml-1 h-4 w-4" /></>}
                </Button>
              </form>
            </AnimatedSection>

            <AnimatedSection delay={0.2}>
              <div className="space-y-6">
                {[
                  { icon: Mail, label: "Email", value: "support@insurgo.in" },
                  { icon: Phone, label: "Phone", value: "+91 98765 43210" },
                  { icon: MapPin, label: "Office", value: "Bengaluru, Karnataka, India" },
                ].map((c) => (
                  <div key={c.label} className="flex items-start gap-4 p-5 rounded-xl bg-card border border-border">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <c.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{c.label}</p>
                      <p className="font-medium text-foreground">{c.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
