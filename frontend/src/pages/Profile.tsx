import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, User, Mail, Phone, MapPin, Calendar, LogOut, Loader2, Edit2, Save } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import { useAuth } from "@/hooks/useAuth";
import { policyApi, authApi, type Policy } from "@/lib/api";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const Profile = () => {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");

  useEffect(() => {
    policyApi.getMyPolicies()
      .then(({ data }) => setPolicy(data.active))
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await authApi.updateMe({ name, email } as Parameters<typeof authApi.updateMe>[0]);
      await refreshUser?.();
      toast.success("Profile updated!");
      setEditing(false);
    } catch {
      toast.error("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendOtp = async () => {
    setOtpLoading(true);
    try {
      const { data } = await authApi.sendPhoneOtp();
      setDevOtp(data.devOtp || null);
      toast.success("OTP sent to your phone.");
    } catch {
      toast.error("Failed to send OTP.");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpValue.length < 6) return;
    setOtpLoading(true);
    try {
      await authApi.verifyPhoneOtp(otpValue);
      await refreshUser?.();
      setOtpValue("");
      setDevOtp(null);
      toast.success("Phone verified. KYC updated.");
    } catch {
      toast.error("OTP verification failed.");
    } finally {
      setOtpLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please log in to view your profile.</p>
          <Link to="/login"><Button variant="hero">Log In</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-24 px-4">
      <div className="container max-w-2xl">
        <AnimatedSection>
          <div className="text-center mb-10">
            <div className="h-24 w-24 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center mx-auto mb-4">
              <User className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-3xl font-display font-bold mb-1">{user.name}</h1>
            <p className="text-muted-foreground">
              {user.deliveryPlatform
                ? user.deliveryPlatform.charAt(0).toUpperCase() + user.deliveryPlatform.slice(1) + " Delivery Partner"
                : "InsurGo Member"}
            </p>
            {user.kycScore >= 15 && (
              <span className="inline-block mt-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
                ✅ Verified Rider
              </span>
            )}
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.1}>
          <div className="rounded-2xl bg-card border border-border p-8 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg">Personal Information</h2>
              {!editing ? (
                <Button variant="ghost" size="sm" onClick={() => { setName(user.name); setEmail(user.email || ""); setEditing(true); }}>
                  <Edit2 className="h-4 w-4 mr-1" /> Edit
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              )}
            </div>

            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1">Full Name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1">Email</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Changes
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { icon: User, label: "Full Name", value: user.name },
                  { icon: Mail, label: "Email", value: user.email || "Not set" },
                  { icon: Phone, label: "Phone", value: user.phone },
                  { icon: MapPin, label: "City", value: user.location?.city || "Not set" },
                  { icon: Calendar, label: "Member Since", value: new Date(user.createdAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-4 p-3 rounded-lg bg-secondary/50">
                    <item.icon className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-sm font-medium text-foreground">{item.value}</p>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-4 p-3 rounded-lg bg-secondary/50">
                  <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">KYC Score</p>
                    <p className="text-sm font-medium text-foreground">
                      {user.kycScore}/100
                      <span className="ml-2" aria-label={user.phoneVerified ? "Phone verified" : "Phone not verified"}>
                        {user.phoneVerified ? "Phone Verified" : "Phone Not Verified"}
                      </span>
                    </p>
                  </div>
                </div>
                {!user.phoneVerified ? (
                  <div className="rounded-lg border border-amber-300/30 bg-amber-500/10 p-4 space-y-3">
                    <p className="text-sm text-amber-200">
                      KYC verification pending. Verify phone OTP to activate plan purchase.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={handleSendOtp} disabled={otpLoading}>
                        {otpLoading ? "Sending..." : "Send OTP"}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <InputOTP maxLength={6} value={otpValue} onChange={setOtpValue}>
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                      <Button size="sm" onClick={handleVerifyOtp} disabled={otpLoading || otpValue.length < 6}>
                        Verify OTP
                      </Button>
                      {devOtp ? (
                        <p className="text-xs text-muted-foreground">Dev OTP: {devOtp}</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.2}>
          <div className="rounded-2xl bg-card border border-border p-8 mb-6 space-y-4">
            <h2 className="font-display font-semibold text-lg mb-4">Active Plan</h2>
            {policy ? (
              <>
                <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div>
                    <p className="font-display font-bold text-primary capitalize">{policy.planName}</p>
                    <p className="text-sm text-muted-foreground">
                      ₹{policy.dynamicPremium ?? policy.weeklyPremium}/week • Expires {new Date(policy.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                    {policy.mlDecision?.modelVersion ? (
                      <p className="text-xs text-muted-foreground mt-1">Model: {policy.mlDecision.modelVersion}</p>
                    ) : null}
                  </div>
                  <ShieldCheck className="h-8 w-8 text-primary" />
                </div>
                <div className="grid grid-cols-3 gap-3 text-center text-sm">
                  <div className="p-3 rounded-lg bg-secondary/50">
                    <p className="text-lg font-bold text-foreground">{policy.claimsThisPeriod}</p>
                    <p className="text-xs text-muted-foreground">Claims</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50">
                    <p className="text-lg font-bold text-accent">₹{policy.totalPayoutThisPeriod}</p>
                    <p className="text-xs text-muted-foreground">Paid Out</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50">
                    <p className="text-lg font-bold text-foreground">₹{policy.maxPayoutPerWeek - policy.totalPayoutThisPeriod}</p>
                    <p className="text-xs text-muted-foreground">Remaining</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-3">No active plan</p>
                <Link to="/pricing">
                  <Button variant="hero">Get Protection</Button>
                </Link>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Link to="/dashboard" className="flex-1">
                <Button variant="outline" className="w-full">Dashboard</Button>
              </Link>
              <Link to="/pricing" className="flex-1">
                <Button variant="default" className="w-full">{policy ? "Upgrade" : "Get Plan"}</Button>
              </Link>
            </div>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.3}>
          <div className="text-center">
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" /> Log Out
            </Button>
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
};

export default Profile;
