import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Shield, User, Sun, Moon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/pricing", label: "Plans" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/contact", label: "Contact" },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const location = useLocation();
  const { isLoggedIn } = useAuth();

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
      setIsDark(true);
    }
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[hsl(220_20%_15%)] text-white backdrop-blur-2xl border-b border-white/10">
      <div className="container flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold">
          <Shield className="h-7 w-7 text-primary" />
          <span className="text-gradient">InsurGo</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === l.to
                  ? "text-white bg-white/15"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          {isLoggedIn ? (
            <Link to="/profile">
              <Button variant="ghost" size="sm"><User className="h-4 w-4 mr-1" /> My Profile</Button>
            </Link>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">Log in</Button>
              </Link>
              <Link to="/signup">
                <Button variant="hero" size="sm">Get Protected</Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-white" onClick={() => setOpen(!open)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-[hsl(220_20%_15%)] border-t border-white/10 animate-fade-in">
          <div className="container py-4 flex flex-col gap-2">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === l.to
                    ? "text-white bg-white/15"
                    : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                {l.label}
              </Link>
            ))}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              {isDark ? "Light Mode" : "Dark Mode"}
            </button>
            <div className="flex gap-3 mt-2">
              {isLoggedIn ? (
                <Link to="/profile" className="flex-1" onClick={() => setOpen(false)}>
                  <Button variant="outline" className="w-full"><User className="h-4 w-4 mr-1" /> My Profile</Button>
                </Link>
              ) : (
                <>
                  <Link to="/login" className="flex-1" onClick={() => setOpen(false)}>
                    <Button variant="outline" className="w-full">Log in</Button>
                  </Link>
                  <Link to="/signup" className="flex-1" onClick={() => setOpen(false)}>
                    <Button variant="hero" className="w-full">Sign up</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
