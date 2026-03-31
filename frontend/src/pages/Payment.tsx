import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import AnimatedSection from "@/components/AnimatedSection";
import { ShieldCheck, CheckCircle, ArrowLeft, Lock, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { policyApi } from "@/lib/api";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

const Payment = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const planId = params.get("planId") || "";
  const planName = params.get("planName") || "Insurance Plan";
  const amount = parseInt(params.get("amount") || "49");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const razorpayLoaded = useRef(false);

  // Load Razorpay SDK once
  useEffect(() => {
    if (razorpayLoaded.current) return;
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    razorpayLoaded.current = true;
  }, []);

  const handlePay = async () => {
    if (!planId) {
      setError("No plan selected. Go back and choose a plan.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      // 1. Create subscription → get Razorpay order from backend
      const { data } = await policyApi.subscribe(planId);
      const { policy, payment } = data;

      // 2. Open Razorpay checkout
      const rzp = new window.Razorpay({
        key: payment.keyId,
        amount: payment.amount,
        currency: payment.currency,
        name: "InsurGo",
        description: `${planName} — Weekly Protection`,
        order_id: payment.orderId,
        prefill: {
          name: JSON.parse(localStorage.getItem("insurgo_user") || "{}").name || "",
          contact: JSON.parse(localStorage.getItem("insurgo_user") || "{}").phone || "",
        },
        theme: { color: "#3B5EF8" },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          // 3. Confirm payment with backend
          try {
            await policyApi.confirmPayment(policy._id, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast.success("🎉 Payment successful! Your policy is now active.");
            navigate("/dashboard");
          } catch {
            toast.error("Payment confirmed but policy activation failed. Contact support.");
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            toast.error("Payment cancelled.");
          },
        },
      });

      rzp.open();
      setLoading(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not initiate payment.";
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16 px-4">
      <div className="container max-w-2xl">
        <Link
          to="/pricing"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Plans
        </Link>

        <AnimatedSection>
          <div className="rounded-2xl border border-border bg-card p-8">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <ShieldCheck className="h-8 w-8 text-primary" />
              <div>
                <h2 className="font-display font-bold text-xl text-foreground">Confirm Your Plan</h2>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" /> Secure checkout via Razorpay
                </p>
              </div>
            </div>

            {/* Order Summary */}
            <div className="p-5 rounded-xl bg-primary/5 border border-primary/20 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-display font-bold text-primary text-lg">{planName}</p>
                  <p className="text-sm text-muted-foreground">Weekly protection plan</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-display font-bold text-foreground">₹{amount}</p>
                  <p className="text-sm text-muted-foreground">/week</p>
                </div>
              </div>
            </div>

            {/* What's included */}
            <div className="mb-6 space-y-2">
              {[
                "Automatic disruption detection",
                "Instant payouts — no forms needed",
                "Rain, AQI, flood, curfew coverage",
                "Cancel anytime",
              ].map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-accent shrink-0" />
                  <span className="text-foreground">{f}</span>
                </div>
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive mb-4">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Pay Button */}
            <Button
              variant="hero"
              size="xl"
              className="w-full"
              onClick={handlePay}
              disabled={loading || !planId}
            >
              {loading ? (
                <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Opening Checkout…</>
              ) : (
                `Pay ₹${amount} via Razorpay`
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground mt-4">
              Powered by Razorpay Sandbox. Use test card 4111 1111 1111 1111.
            </p>
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
};

export default Payment;
