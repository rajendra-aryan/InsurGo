import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import AnimatedSection from "@/components/AnimatedSection";
import {
  ShieldCheck, Wallet, Clock, CheckCircle, AlertTriangle,
  TrendingUp, ArrowRight, Loader2, CloudRain, Wind, AlertCircle, RefreshCw
} from "lucide-react";
import { claimApi, policyApi, eventApi, premiumApi, type Claim, type Policy, type ClaimStats, type ActiveEvent } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const statusIcon = (status: Claim["status"]) => {
  if (status === "paid") return <CheckCircle className="h-5 w-5 text-accent shrink-0" />;
  if (status === "rejected") return <AlertCircle className="h-5 w-5 text-destructive shrink-0" />;
  return <AlertTriangle className="h-5 w-5 text-primary shrink-0" />;
};

const eventIcon = (type: string) => {
  if (type === "aqi") return <Wind className="h-4 w-4 text-destructive" />;
  return <CloudRain className="h-4 w-4 text-blue-400" />;
};

const Dashboard = () => {
  const { user } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [stats, setStats] = useState<ClaimStats | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [events, setEvents] = useState<ActiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveChecking, setLiveChecking] = useState(false);
  const [mlOnline, setMlOnline] = useState<boolean | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [claimsRes, statsRes, policiesRes, eventsRes] = await Promise.allSettled([
        claimApi.getMyClaims(),
        claimApi.getStats(),
        policyApi.getMyPolicies(),
        eventApi.getActive(),
      ]);

      if (claimsRes.status === "fulfilled") setClaims(claimsRes.value.data.claims.slice(0, 4));
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data);
      if (policiesRes.status === "fulfilled") setPolicy(policiesRes.value.data.active);
      if (eventsRes.status === "fulfilled") setEvents(eventsRes.value.data.events);
      try {
        const ml = await premiumApi.getMlStatus();
        setMlOnline(ml.data.ok);
      } catch {
        setMlOnline(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const checkLive = async () => {
    setLiveChecking(true);
    try {
      const { data } = await eventApi.liveCheck("Mumbai");
      if (data.overallStatus === "DISRUPTION_DETECTED") {
        alert(`🚨 Disruption detected in Mumbai!\n${JSON.stringify(data.checks, null, 2)}`);
      } else {
        alert("✅ All clear — no active disruptions in Mumbai right now.");
      }
    } catch {
      alert("Could not reach backend — is the server running?");
    } finally {
      setLiveChecking(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const firstName = user?.name?.split(" ")[0] || "Rider";

  if (loading) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24">
      <section className="py-10">
        <div className="container">
          <AnimatedSection className="mb-8 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-3xl font-display font-bold mb-1">Welcome back, {firstName} 👋</h1>
              <p className="text-muted-foreground">Your protection overview for this week.</p>
              <p className="text-xs text-muted-foreground mt-1">
                ML pipeline: {mlOnline === null ? "checking..." : mlOnline ? "online" : "degraded"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={checkLive} disabled={liveChecking}>
                {liveChecking ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CloudRain className="h-4 w-4 mr-1" />}
                Live Check
              </Button>
              <Button variant="ghost" size="sm" onClick={fetchAll}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </AnimatedSection>

          {/* Stats */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              {
                icon: ShieldCheck,
                label: "Active Plan",
                value: policy?.planName ? policy.planName.replace(/\b\w/g, (c) => c.toUpperCase()) : "No Plan",
                sub: policy ? `₹${policy.weeklyPremium}/week` : "Subscribe now",
                color: "text-primary",
              },
              {
                icon: Wallet,
                label: "Total Paid Out",
                value: stats ? `₹${stats.totalPaidOut}` : "₹0",
                sub: "All time",
                color: "text-accent",
              },
              {
                icon: Clock,
                label: "Claims Filed",
                value: stats ? String(stats.totalClaims) : "0",
                sub: `${stats?.paidClaims ?? 0} approved`,
                color: "text-primary",
              },
              {
                icon: TrendingUp,
                label: "This Period",
                value: policy ? `₹${policy.totalPayoutThisPeriod}` : "₹0",
                sub: `${policy?.claimsThisPeriod ?? 0} claims`,
                color: "text-accent",
              },
            ].map((s, i) => (
              <AnimatedSection key={s.label} delay={i * 0.08}>
                <div className="p-5 rounded-xl bg-card border border-border">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{s.label}</span>
                    <s.icon className={`h-5 w-5 ${s.color}`} />
                  </div>
                  <p className="text-2xl font-display font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Claims */}
            <AnimatedSection delay={0.2} className="lg:col-span-2">
              <div className="p-6 rounded-xl bg-card border border-border h-full">
                <h3 className="font-display font-semibold mb-4">Recent Claims</h3>
                {claims.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No claims yet — you're protected!</p>
                    {!policy && (
                      <Link to="/pricing">
                        <Button variant="outline" size="sm" className="mt-4">Get a Plan</Button>
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {claims.map((c) => (
                      <div key={c._id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 border border-border/50">
                        <div className="flex items-center gap-3">
                          {statusIcon(c.status)}
                          <div>
                            <p className="text-sm font-medium text-foreground capitalize">
                              {c.eventId?.type ?? "Disruption"} — {c.eventId?.city ?? "Mumbai"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-accent">₹{c.payoutAmount}</p>
                          <p className="text-xs text-muted-foreground capitalize">{c.status}</p>
                          {c.mlDecision?.triggerReasons?.length ? (
                            <p className="text-xs text-muted-foreground">
                              ML: {c.mlDecision.triggerReasons.join(", ")}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </AnimatedSection>

            <div className="space-y-4">
              {/* Policy */}
              <AnimatedSection delay={0.3}>
                <div className="p-6 rounded-xl bg-card border border-border">
                  <h3 className="font-display font-semibold mb-4">Your Plan</h3>
                  {policy ? (
                    <>
                      <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 mb-4">
                        <p className="text-sm text-muted-foreground">Active</p>
                        <p className="text-xl font-display font-bold text-primary capitalize">{policy.planName}</p>
                        <p className="text-sm text-muted-foreground">
                          ₹{policy.dynamicPremium ?? policy.weeklyPremium}/week • Expires {new Date(policy.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </p>
                        {policy.mlDecision?.modelVersion ? (
                          <p className="text-xs text-muted-foreground mt-1">
                            Model: {policy.mlDecision.modelVersion}
                          </p>
                        ) : null}
                      </div>
                      <Link to="/pricing">
                        <Button variant="outline" className="w-full justify-between" size="sm">
                          Upgrade Plan <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground mb-3">No active plan</p>
                      <Link to="/pricing">
                        <Button variant="hero" size="sm">Get Protected</Button>
                      </Link>
                    </div>
                  )}
                </div>
              </AnimatedSection>

              {/* Active Disruptions */}
              {events.length > 0 && (
                <AnimatedSection delay={0.4}>
                  <div className="p-6 rounded-xl bg-destructive/5 border border-destructive/20">
                    <h3 className="font-display font-semibold mb-3 text-destructive flex items-center gap-2">
                      <CloudRain className="h-4 w-4" /> Live Disruptions
                    </h3>
                    <div className="space-y-2">
                      {events.slice(0, 3).map((ev) => (
                        <div key={ev._id} className="flex items-center gap-2 text-sm">
                          {eventIcon(ev.type)}
                          <span className="text-foreground capitalize">{ev.type} in {ev.city}</span>
                          <span className="text-xs text-muted-foreground ml-auto capitalize">{ev.severity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </AnimatedSection>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
