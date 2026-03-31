import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, User, Phone, Lock, Building2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const PLATFORMS = ["zepto", "blinkit", "swiggy", "zomato", "dunzo", "other"];

const Signup = () => {
  const { register, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    password: "",
    deliveryPlatform: "",
    city: "Mumbai",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    try {
      await register({
        name: form.name,
        phone: form.phone,
        password: form.password,
        deliveryPlatform: form.deliveryPlatform || undefined,
        location: { city: form.city },
        avgHourlyIncome: 100,
        weeklyAvgIncome: 5000,
      });
      toast.success("Account created! Welcome to InsurGo 🛡️");
      navigate("/pricing");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registration failed. Try again.";
      setError(msg);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-24 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 font-display text-2xl font-bold mb-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <span className="text-gradient">InsurGo</span>
          </Link>
          <p className="text-muted-foreground">Start protecting your earnings</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 rounded-2xl bg-card border border-border space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={form.name} onChange={set("name")} placeholder="Rahul Kumar" required className="pl-10 bg-secondary border-border" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="tel" value={form.phone} onChange={set("phone")} placeholder="9876543210" required className="pl-10 bg-secondary border-border" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="password" value={form.password} onChange={set("password")} placeholder="Min 6 characters" required className="pl-10 bg-secondary border-border" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Delivery Platform</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <select
                value={form.deliveryPlatform}
                onChange={set("deliveryPlatform")}
                className="flex h-10 w-full rounded-md border border-input bg-secondary px-3 py-2 pl-10 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select platform (optional)</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <Button variant="hero" size="lg" type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Signup;
