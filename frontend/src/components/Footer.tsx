import { Link } from "react-router-dom";
import { Shield } from "lucide-react";

const Footer = () => (
  <footer className="bg-[hsl(220_20%_15%)] text-white border-t border-white/10">
    <div className="container py-12">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold mb-4">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-gradient">InsurGo</span>
          </Link>
          <p className="text-sm text-white/60">Protecting delivery riders' earnings, one week at a time.</p>
        </div>
        <div>
          <h4 className="font-display font-semibold text-sm mb-3 text-white">Product</h4>
          <div className="flex flex-col gap-2 text-sm text-white/60">
            <Link to="/pricing" className="hover:text-white transition-colors">Plans</Link>
            <Link to="/how-it-works" className="hover:text-white transition-colors">How It Works</Link>
            <Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          </div>
        </div>
        <div>
          <h4 className="font-display font-semibold text-sm mb-3 text-white">Company</h4>
          <div className="flex flex-col gap-2 text-sm text-white/60">
            <Link to="/about" className="hover:text-white transition-colors">About Us</Link>
            <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
          </div>
        </div>
        <div>
          <h4 className="font-display font-semibold text-sm mb-3 text-white">Legal</h4>
          <div className="flex flex-col gap-2 text-sm text-white/60">
            <Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link to="/terms-of-service" className="hover:text-white transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
      <div className="mt-10 pt-6 border-t border-white/10 text-center text-sm text-white/50">
        © 2026 InsurGo. All rights reserved.
      </div>
    </div>
  </footer>
);

export default Footer;
