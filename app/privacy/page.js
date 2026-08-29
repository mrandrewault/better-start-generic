import LegalShell from "../legal-shell";

export const metadata = {title:"Privacy policy — Meanwhile"};

export default function PrivacyPage() {
  return <LegalShell eyebrow="The small print" title="Privacy policy" updated="August 28, 2026">
    <p>This policy explains what information Meanwhile collects, why we use it and the choices you have.</p>
    <h2>What we collect</h2>
    <p>If you create an account, we collect your email address and account information. We may also save the interests, story feedback, reading history and saved stories you choose to use. Like most websites, our service providers may collect basic technical information such as browser type, device type, approximate location and site activity.</p>
    <h2>How we use it</h2>
    <p>We use this information to sign you in, remember your edition, personalize stories, improve Meanwhile, prevent abuse and keep the service working.</p>
    <h2>Who helps us</h2>
    <p>We use service providers including Supabase for accounts and stored preferences, Vercel for website hosting and Resend for account emails. They process information for us under their own privacy and security terms.</p>
    <h2>What we do not do</h2>
    <p>We do not sell your personal information. Meanwhile links to independent publishers and other websites; their privacy policies apply after you leave Meanwhile.</p>
    <h2>Your choices</h2>
    <p>You may use the general feed without creating an account. You may ask to access, correct or delete your account information by emailing <a href="mailto:hello@meanwhile.now">hello@meanwhile.now</a>.</p>
    <h2>Children</h2>
    <p>Meanwhile is not intended for children under 13, and we do not knowingly collect their personal information.</p>
    <h2>Changes</h2>
    <p>We may update this policy as Meanwhile changes. The latest version will always appear on this page.</p>
  </LegalShell>;
}
