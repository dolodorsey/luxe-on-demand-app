"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Scissors,
  Sparkles,
  Eye,
  Palette,
  Heart,
  Hand,
  Droplets,
  User,
  Search,
  MapPin,
  Star,
  Clock,
  Shield,
  ChevronRight,
  Home,
  CalendarDays,
  MessageSquare,
  UserCircle,
} from "lucide-react";

const categories = [
  { id: "hair", name: "Hair", icon: Scissors, color: "#C8A96E", services: 8 },
  { id: "nails", name: "Nails", icon: Sparkles, color: "#B5505A", services: 6 },
  { id: "lashes", name: "Lashes", icon: Eye, color: "#9B7DB8", services: 5 },
  { id: "makeup", name: "Makeup", icon: Palette, color: "#E8C4C4", services: 5 },
  { id: "skincare", name: "Skincare", icon: Heart, color: "#7DABB8", services: 5 },
  { id: "massage", name: "Massage", icon: Hand, color: "#8BAF7D", services: 5 },
  { id: "waxing", name: "Waxing", icon: Droplets, color: "#D4A76A", services: 5 },
  { id: "barber", name: "Barber", icon: User, color: "#6B7DB5", services: 5 },
];

const featuredStylists = [
  {
    name: "Jasmine R.",
    specialty: "Braids & Locs",
    rating: 4.9,
    reviews: 247,
    image: null,
    level: "elite",
    price: "From $75",
  },
  {
    name: "Marcus T.",
    specialty: "Fades & Lineups",
    rating: 4.8,
    reviews: 183,
    image: null,
    level: "pro",
    price: "From $30",
  },
  {
    name: "Nia W.",
    specialty: "Full Glam Makeup",
    rating: 5.0,
    reviews: 312,
    image: null,
    level: "master",
    price: "From $100",
  },
  {
    name: "Destiny K.",
    specialty: "Nail Art",
    rating: 4.9,
    reviews: 195,
    image: null,
    level: "elite",
    price: "From $50",
  },
];

const levelBadge: Record<string, { label: string; color: string }> = {
  new: { label: "NEW", color: "#8B8B9E" },
  standard: { label: "STD", color: "#6B7DB5" },
  pro: { label: "PRO", color: "#C8A96E" },
  elite: { label: "ELITE", color: "#B5505A" },
  master: { label: "MASTER", color: "#1A1A2E" },
};

const navItems = [
  { icon: Home, label: "Home", active: true },
  { icon: Search, label: "Explore", active: false },
  { icon: CalendarDays, label: "Book", active: false },
  { icon: MessageSquare, label: "Inbox", active: false },
  { icon: UserCircle, label: "Profile", active: false },
];

export default function LuxeHome() {
  const [activeNav, setActiveNav] = useState("Home");

  return (
    <div className="min-h-screen bg-[#FAF7F4] relative">
      {/* STATUS BAR SPACER */}
      <div className="h-[env(safe-area-inset-top,44px)]" />

      {/* HEADER */}
      <header className="px-5 pt-2 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-luxe-muted font-mono tracking-wider uppercase">
              Good evening
            </p>
            <h1 className="font-display text-2xl font-semibold text-luxe-primary mt-0.5">
              LUXE On Demand
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-10 h-10 rounded-full bg-white border border-luxe-border flex items-center justify-center">
              <MapPin size={18} className="text-luxe-muted" />
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-luxe-accent to-luxe-rose flex items-center justify-center">
              <span className="text-white text-sm font-semibold">D</span>
            </div>
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="mt-4 relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-luxe-muted"
          />
          <input
            type="text"
            placeholder="Search services, stylists..."
            className="w-full pl-11 pr-4 py-3.5 bg-white rounded-2xl border border-luxe-border text-sm text-luxe-primary placeholder:text-luxe-muted/60 focus:outline-none focus:border-luxe-accent focus:ring-1 focus:ring-luxe-accent/30 transition-all"
          />
        </div>
      </header>

      {/* HERO BANNER */}
      <motion.section
        className="mx-5 rounded-3xl overflow-hidden relative"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="luxe-gradient p-6 pb-7 relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
          <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-white/5" />

          <div className="relative z-10">
            <p className="text-white/80 text-xs font-mono tracking-widest uppercase mb-2">
              Premium Beauty
            </p>
            <h2 className="font-display text-[28px] leading-[1.1] font-semibold text-white">
              Your stylist,
              <br />
              your schedule.
            </h2>
            <p className="text-white/70 text-sm mt-2 max-w-[240px] leading-relaxed">
              Book elite beauty professionals — on-demand at your door or at their studio.
            </p>
            <button className="mt-5 bg-white text-luxe-primary text-sm font-semibold px-6 py-3 rounded-full flex items-center gap-2 hover:bg-luxe-cream transition-colors">
              Book Now
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </motion.section>

      {/* TRUST BADGES */}
      <div className="flex items-center justify-center gap-6 py-5 px-5">
        <div className="flex items-center gap-1.5 text-xs text-luxe-muted">
          <Shield size={14} className="text-luxe-accent" />
          <span>Licensed & Verified</span>
        </div>
        <div className="w-px h-3 bg-luxe-border" />
        <div className="flex items-center gap-1.5 text-xs text-luxe-muted">
          <Clock size={14} className="text-luxe-accent" />
          <span>On-Demand</span>
        </div>
        <div className="w-px h-3 bg-luxe-border" />
        <div className="flex items-center gap-1.5 text-xs text-luxe-muted">
          <Star size={14} className="text-luxe-accent" />
          <span>5-Star Rated</span>
        </div>
      </div>

      {/* CATEGORIES GRID */}
      <section className="px-5 pb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-semibold">Services</h3>
          <button className="text-xs text-luxe-accent font-medium">
            View All
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {categories.map((cat, i) => {
            const Icon = cat.icon;
            return (
              <motion.button
                key={cat.id}
                className="category-card p-3 flex flex-col items-center gap-2"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05, duration: 0.4 }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ backgroundColor: `${cat.color}15` }}
                >
                  <Icon size={22} style={{ color: cat.color }} />
                </div>
                <span className="text-[11px] font-medium text-luxe-charcoal leading-tight">
                  {cat.name}
                </span>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* FEATURED STYLISTS */}
      <section className="px-5 pb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-semibold">Top Stylists</h3>
          <button className="text-xs text-luxe-accent font-medium">
            See All
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-5 px-5">
          {featuredStylists.map((stylist, i) => {
            const badge = levelBadge[stylist.level];
            return (
              <motion.div
                key={i}
                className="min-w-[200px] bg-white rounded-2xl border border-luxe-border p-4 flex-shrink-0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.5 }}
              >
                {/* Avatar placeholder */}
                <div className="w-full h-32 rounded-xl bg-luxe-cream/60 mb-3 flex items-center justify-center">
                  <UserCircle size={48} className="text-luxe-border" />
                </div>

                {/* Badge */}
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="service-badge"
                    style={{
                      backgroundColor: `${badge.color}15`,
                      color: badge.color,
                    }}
                  >
                    {badge.label}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <Star
                      size={12}
                      className="text-luxe-accent"
                      fill="#C8A96E"
                    />
                    <span className="text-xs font-medium">{stylist.rating}</span>
                    <span className="text-[10px] text-luxe-muted">
                      ({stylist.reviews})
                    </span>
                  </div>
                </div>

                <h4 className="font-semibold text-sm text-luxe-primary">
                  {stylist.name}
                </h4>
                <p className="text-xs text-luxe-muted mt-0.5">
                  {stylist.specialty}
                </p>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-luxe-border/50">
                  <span className="text-xs font-mono text-luxe-accent-dark">
                    {stylist.price}
                  </span>
                  <button className="text-xs font-semibold text-luxe-rose">
                    Book →
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-5 pb-8">
        <h3 className="font-display text-xl font-semibold mb-4">
          How It Works
        </h3>
        <div className="space-y-3">
          {[
            {
              step: "01",
              title: "Choose Your Service",
              desc: "Browse 44 cosmetic services across 8 categories",
            },
            {
              step: "02",
              title: "Pick Your Stylist",
              desc: "View portfolios, ratings, and availability",
            },
            {
              step: "03",
              title: "Book & Relax",
              desc: "On-demand to your door or schedule at their studio",
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              className="flex items-start gap-4 bg-white rounded-2xl border border-luxe-border p-4"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1, duration: 0.4 }}
            >
              <div className="w-10 h-10 rounded-xl bg-luxe-cream flex items-center justify-center flex-shrink-0">
                <span className="font-mono text-xs font-semibold text-luxe-accent-dark">
                  {item.step}
                </span>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-luxe-primary">
                  {item.title}
                </h4>
                <p className="text-xs text-luxe-muted mt-0.5 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 left-0 right-0 glass-bar z-50">
        <div className="flex items-center justify-around px-2 py-2 pb-[calc(8px+env(safe-area-inset-bottom,0px))]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.label;
            return (
              <button
                key={item.label}
                onClick={() => setActiveNav(item.label)}
                className="flex flex-col items-center gap-0.5 min-w-[56px] py-1 transition-colors"
              >
                <Icon
                  size={22}
                  className={
                    isActive ? "text-luxe-accent" : "text-luxe-muted/60"
                  }
                  strokeWidth={isActive ? 2.2 : 1.6}
                />
                <span
                  className={`text-[10px] font-medium ${
                    isActive ? "text-luxe-accent" : "text-luxe-muted/60"
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
