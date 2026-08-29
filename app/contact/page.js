import LegalShell from "../legal-shell";

export const metadata = {title:"Contact us — Meanwhile"};

export default function ContactPage() {
  return <LegalShell eyebrow="Meanwhile" title="Contact us">
    <p>Questions, suggestions, publisher recommendations, complaints and excellent animal stories are all welcome.</p>
    <p><a href="mailto:hello@meanwhile.now">hello@meanwhile.now</a></p>
    <h2>Privacy or account help</h2>
    <p>Use the same address if you want help with your account, want a copy of your information or want your account deleted.</p>
  </LegalShell>;
}
