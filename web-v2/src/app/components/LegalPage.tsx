import { ArrowLeft, Mail, ExternalLink } from "lucide-react";
import { CafyzLogo } from "./CafyzLogo";

type LegalSlug = "privacy" | "support" | "terms";

const SUPPORT_EMAIL = "support@cafyz.com";
const FOUNDER_EMAIL = "cafyzofficial@gmail.com";
const SITE_URL = "https://cafyz.ametronyx.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 style={{ color: "var(--cafyz-text)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.05rem" }}>
        {title}
      </h2>
      <div className="space-y-2 text-sm leading-relaxed" style={{ color: "var(--cafyz-text-secondary)" }}>
        {children}
      </div>
    </section>
  );
}

function privacyContent() {
  return (
    <>
      <p>Last updated: July 15, 2026</p>
      <Section title="Who we are">
        <p>
          Cafyz (“we”, “us”) provides restaurant management software for web and mobile.
          This policy explains how we handle information when you use the Cafyz app and website at{" "}
          <a href={SITE_URL} style={{ color: "#1e7fff" }}>{SITE_URL}</a>.
        </p>
      </Section>
      <Section title="Information we collect">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Account data:</strong> name, email, phone, role, restaurant affiliation, password (stored hashed).</li>
          <li><strong>Restaurant data:</strong> menu items, orders, tables, staff, inventory, reservations, analytics.</li>
          <li><strong>Photos you upload:</strong> restaurant logos and menu images (processed via Cloudinary).</li>
          <li><strong>Device data:</strong> optional push notification tokens if you enable notifications.</li>
          <li><strong>Support messages:</strong> content you send through in-app customer support.</li>
        </ul>
      </Section>
      <Section title="How we use information">
        <p>We use data to operate the service: authentication, POS/KDS workflows, reporting, printing, and support. We do not sell your personal information.</p>
      </Section>
      <Section title="Third-party services">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Hosting & API:</strong> Render (backend API).</li>
          <li><strong>Web hosting:</strong> Vercel.</li>
          <li><strong>Images:</strong> Cloudinary (menu and logo uploads).</li>
          <li><strong>Email:</strong> Resend (password reset and transactional email, when configured).</li>
        </ul>
      </Section>
      <Section title="Data retention">
        <p>We retain restaurant and account data while your subscription is active. When you delete your account (or your restaurant is removed), associated personal data is deleted from our systems, subject to reasonable backup retention periods.</p>
      </Section>
      <Section title="Account deletion">
        <p>
          You can delete your personal account from <strong>Account Settings</strong> in the app (Profile menu → Account Settings → Delete account).
          Restaurant owners can delete their entire restaurant and all associated data. Deletion requires password confirmation and cannot be undone.
        </p>
        <p>
          You may also email <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "#1e7fff" }}>{SUPPORT_EMAIL}</a> to request deletion.
        </p>
      </Section>
      <Section title="Security">
        <p>We use HTTPS for all API communication. Passwords are hashed. Access is role-based within each restaurant.</p>
      </Section>
      <Section title="Contact">
        <p>
          Questions: <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "#1e7fff" }}>{SUPPORT_EMAIL}</a> or{" "}
          <a href={`mailto:${FOUNDER_EMAIL}`} style={{ color: "#1e7fff" }}>{FOUNDER_EMAIL}</a>.
        </p>
      </Section>
    </>
  );
}

function supportContent() {
  return (
    <>
      <Section title="Customer support">
        <p>Cafyz is a business app for restaurants. We help with setup, billing, technical issues, and account questions.</p>
      </Section>
      <Section title="Contact us">
        <ul className="space-y-3">
          <li className="flex items-start gap-2">
            <Mail size={16} className="mt-0.5 flex-shrink-0" style={{ color: "#1e7fff" }} />
            <span>
              Email: <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "#1e7fff" }}>{SUPPORT_EMAIL}</a>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Mail size={16} className="mt-0.5 flex-shrink-0" style={{ color: "#1e7fff" }} />
            <span>
              Billing & licensing: <a href={`mailto:${FOUNDER_EMAIL}`} style={{ color: "#1e7fff" }}>{FOUNDER_EMAIL}</a>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ExternalLink size={16} className="mt-0.5 flex-shrink-0" style={{ color: "#1e7fff" }} />
            <span>
              Website: <a href={SITE_URL} style={{ color: "#1e7fff" }}>{SITE_URL}</a>
            </span>
          </li>
        </ul>
      </Section>
      <Section title="In-app support">
        <p>Logged-in users can open <strong>Customer support</strong> from the headset icon in the top bar or the AI assistant widget.</p>
      </Section>
      <Section title="Account & billing">
        <p>Subscriptions are managed outside the App Store. Owners and managers can view plan details under <strong>License & Plan</strong>. Contact us to renew, upgrade, or cancel.</p>
      </Section>
      <Section title="Account deletion">
        <p>Delete your account from <strong>Account Settings → Delete account</strong>, or email {SUPPORT_EMAIL}. See our <a href="/privacy" style={{ color: "#1e7fff" }}>Privacy Policy</a> for details.</p>
      </Section>
      <Section title="Response times">
        <p>We aim to respond within 1–2 business days. Urgent production issues for paying customers are prioritized.</p>
      </Section>
    </>
  );
}

function termsContent() {
  return (
    <>
      <p>Last updated: July 15, 2026</p>
      <Section title="Service">
        <p>Cafyz provides restaurant operating software (POS, kitchen display, menu, staff, inventory, analytics). Access requires a valid license or trial arranged with Cafyz.</p>
      </Section>
      <Section title="Accounts">
        <p>You are responsible for credentials and staff access within your restaurant. Do not share owner credentials. You must provide accurate registration information.</p>
      </Section>
      <Section title="Acceptable use">
        <p>Use Cafyz only for lawful restaurant operations. Do not attempt to disrupt the service, access other tenants&apos; data, or reverse engineer the application.</p>
      </Section>
      <Section title="Subscriptions">
        <p>Plans are billed outside the mobile app stores unless otherwise agreed in writing. Trial and renewal terms are shown in the License section of the app.</p>
      </Section>
      <Section title="Termination">
        <p>You may delete your account at any time from Account Settings. We may suspend access for non-payment or abuse. Upon termination, your right to use the service ends.</p>
      </Section>
      <Section title="Disclaimer">
        <p>The service is provided “as is” to the extent permitted by law. Cafyz is not liable for indirect damages arising from use of the software.</p>
      </Section>
      <Section title="Contact">
        <p>Legal inquiries: <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "#1e7fff" }}>{SUPPORT_EMAIL}</a></p>
      </Section>
    </>
  );
}

const PAGES: Record<LegalSlug, { title: string; subtitle: string; body: () => React.ReactNode }> = {
  privacy: { title: "Privacy Policy", subtitle: "How Cafyz handles your data", body: privacyContent },
  support: { title: "Support", subtitle: "Get help with Cafyz", body: supportContent },
  terms: { title: "Terms of Service", subtitle: "Using Cafyz", body: termsContent },
};

export function legalPathToSlug(pathname: string): LegalSlug | null {
  const slug = pathname.replace(/\/$/, "").slice(1);
  if (slug === "privacy" || slug === "support" || slug === "terms") return slug;
  return null;
}

export function LegalPage({ page }: { page: LegalSlug }) {
  const meta = PAGES[page];
  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/";
  };

  return (
    <div className="min-h-[100dvh] w-full overflow-y-auto" style={{ background: "var(--cafyz-app-bg)", color: "var(--cafyz-text)" }}>
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b"
        style={{ background: "var(--cafyz-topbar-bg)", borderColor: "var(--cafyz-border)", backdropFilter: "blur(12px)" }}
      >
        <button
          type="button"
          onClick={goBack}
          className="flex items-center justify-center w-9 h-9 rounded-xl"
          style={{ background: "var(--cafyz-surface-hover)", color: "var(--cafyz-muted)" }}
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </button>
        <CafyzLogo size="xs" className="flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.95rem" }}>{meta.title}</h1>
          <p className="truncate" style={{ color: "var(--cafyz-muted)", fontSize: "0.68rem" }}>{meta.subtitle}</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 md:py-8 space-y-6">
        {meta.body()}
        <footer className="pt-4 border-t text-xs flex flex-wrap gap-3" style={{ borderColor: "var(--cafyz-border)", color: "var(--cafyz-muted)" }}>
          <a href="/privacy" style={{ color: page === "privacy" ? "#1e7fff" : "var(--cafyz-muted)" }}>Privacy</a>
          <a href="/support" style={{ color: page === "support" ? "#1e7fff" : "var(--cafyz-muted)" }}>Support</a>
          <a href="/terms" style={{ color: page === "terms" ? "#1e7fff" : "var(--cafyz-muted)" }}>Terms</a>
          <a href="/" style={{ color: "var(--cafyz-muted)" }}>App home</a>
        </footer>
      </main>
    </div>
  );
}
