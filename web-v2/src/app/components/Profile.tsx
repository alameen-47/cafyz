import { useState } from "react";
import { motion } from "motion/react";
import { Camera, Save, Globe, DollarSign, FileText, MapPin, Phone, Mail, Shield, QrCode, Download, ExternalLink } from "lucide-react";
import { toast } from "./Toast";

export function Profile() {
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState({
    name: "The Spice Garden",
    tagline: "Authentic Indian & Continental Cuisine",
    email: "info@spicegarden.in",
    phone: "+91 98765 43210",
    address: "12, MG Road, Koramangala",
    city: "Bangalore",
    state: "Karnataka",
    pincode: "560034",
    country: "India",
    currency: "INR",
    language: "en",
    dateFormat: "DD/MM/YYYY",
    taxName: "GST",
    taxRate: "18",
    serviceCharge: "5",
    receiptFooter: "Thank you for dining with us! Visit again soon. ❤️",
    vatNumber: "29ABCDE1234F1Z5",
  });

  const update = (key: string, val: string) => setProfile(p => ({ ...p, [key]: val }));

  const handleSave = () => {
    setSaved(true);
    toast.success("Profile saved", "Your restaurant settings have been updated");
    setTimeout(() => setSaved(false), 2000);
  };

  const InputField = ({ label, field, type = "text", placeholder = "" }: { label: string; field: string; type?: string; placeholder?: string }) => (
    <div>
      <label style={{ color: "#a8bdd4", fontSize: "0.78rem", display: "block", marginBottom: 5 }}>{label}</label>
      <input
        type={type}
        value={(profile as any)[field]}
        placeholder={placeholder}
        onChange={e => update(field, e.target.value)}
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-[#6b82a0] transition-all focus:ring-1 focus:ring-[rgba(30,127,255,0.4)]"
        style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.12)" }}
      />
    </div>
  );

  const Section = ({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5 space-y-4"
      style={{ background: "#0d1326", border: "1px solid rgba(30,127,255,0.1)" }}
    >
      <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: "rgba(30,127,255,0.08)" }}>
        <Icon size={16} style={{ color: "#1e7fff" }} />
        <h3 style={{ color: "#e8eef8", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.95rem" }}>{title}</h3>
      </div>
      {children}
    </motion.div>
  );

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-3xl w-full">
      {/* Brand section */}
      <Section title="Brand Identity" icon={Shield}>
        <div className="flex items-start gap-4">
          {/* Logo upload */}
          <div className="relative flex-shrink-0">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden"
              style={{ background: "linear-gradient(135deg, #1e7fff, #00c6ff)", boxShadow: "0 0 20px rgba(30,127,255,0.3)" }}
            >
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, color: "#fff", fontSize: "1.4rem" }}>SG</span>
            </div>
            <button
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: "#1e7fff", boxShadow: "0 2px 8px rgba(30,127,255,0.4)" }}
            >
              <Camera size={13} className="text-white" />
            </button>
          </div>
          <div className="flex-1 space-y-3">
            <InputField label="Restaurant Name" field="name" placeholder="The Spice Garden" />
            <InputField label="Tagline" field="tagline" placeholder="A short brand tagline" />
          </div>
        </div>
      </Section>

      {/* Contact */}
      <Section title="Contact Details" icon={Phone}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InputField label="Email" field="email" type="email" />
          <InputField label="Phone" field="phone" />
        </div>
      </Section>

      {/* Address */}
      <Section title="Address" icon={MapPin}>
        <InputField label="Street Address" field="address" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <InputField label="City" field="city" />
          <InputField label="State" field="state" />
          <InputField label="PIN Code" field="pincode" />
          <InputField label="Country" field="country" />
        </div>
      </Section>

      {/* Localisation */}
      <Section title="Localisation" icon={Globe}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label style={{ color: "#a8bdd4", fontSize: "0.78rem", display: "block", marginBottom: 5 }}>Currency</label>
            <select value={profile.currency} onChange={e => update("currency", e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.12)" }}>
              {["INR", "USD", "EUR", "GBP", "AED", "SGD"].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: "#a8bdd4", fontSize: "0.78rem", display: "block", marginBottom: 5 }}>Language</label>
            <select value={profile.language} onChange={e => update("language", e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.12)" }}>
              {[["en","English"],["hi","Hindi"],["ta","Tamil"],["ar","Arabic"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: "#a8bdd4", fontSize: "0.78rem", display: "block", marginBottom: 5 }}>Date Format</label>
            <select value={profile.dateFormat} onChange={e => update("dateFormat", e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.12)" }}>
              {["DD/MM/YYYY","MM/DD/YYYY","YYYY-MM-DD"].map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
        </div>
      </Section>

      {/* Tax */}
      <Section title="Tax & Charges" icon={DollarSign}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <InputField label="Tax Name" field="taxName" placeholder="GST / VAT" />
          <InputField label="Tax Rate (%)" field="taxRate" type="number" />
          <InputField label="Service Charge (%)" field="serviceCharge" type="number" />
          <InputField label="Tax/VAT Number" field="vatNumber" />
        </div>
      </Section>

      {/* Receipt */}
      <Section title="Receipt Footer" icon={FileText}>
        <div>
          <label style={{ color: "#a8bdd4", fontSize: "0.78rem", display: "block", marginBottom: 5 }}>Footer message (printed on receipts)</label>
          <textarea
            value={profile.receiptFooter}
            onChange={e => update("receiptFooter", e.target.value)}
            rows={2}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
            style={{ background: "#111b35", color: "#e8eef8", border: "1px solid rgba(30,127,255,0.12)" }}
          />
        </div>
      </Section>

      {/* QR Menu card */}
      <Section title="Customer QR Menu" icon={QrCode}>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#fff" }}>
            <div className="grid grid-cols-3 gap-0.5">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="w-4 h-4 rounded-sm" style={{ background: [0,2,6,8].includes(i) ? "#06091a" : i === 4 ? "#1e7fff" : "rgba(6,9,26,0.3)" }} />
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <p style={{ color: "#a8bdd4", fontSize: "0.82rem" }}>
              Share your digital menu with customers via QR code.
            </p>
            <p style={{ color: "#6b82a0", fontSize: "0.72rem", fontFamily: "var(--font-mono)" }}>
              cafyz.app/m/spice-garden-001
            </p>
            <div className="flex gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "rgba(30,127,255,0.1)", color: "#1e7fff" }}>
                <Download size={12} /> Download
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "rgba(30,127,255,0.06)", color: "#6b82a0" }}>
                <ExternalLink size={12} /> Open
              </button>
            </div>
          </div>
        </div>
      </Section>

      {/* Save */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSave}
        className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
        style={{ background: saved ? "rgba(34,197,94,0.15)" : "linear-gradient(135deg, #1e7fff, #00c6ff)", color: saved ? "#22c55e" : "#fff", border: saved ? "1px solid rgba(34,197,94,0.3)" : "none" }}
      >
        <Save size={16} /> {saved ? "Saved!" : "Save Changes"}
      </motion.button>
    </div>
  );
}
