import LegalShell from "../legal-shell";

export const metadata = {title:"Terms of use — Meanwhile"};

export default function TermsPage() {
  return <LegalShell eyebrow="The small print" title="Terms of use" updated="August 28, 2026">
    <p>By using Meanwhile, you agree to these terms.</p>
    <h2>What Meanwhile is</h2>
    <p>Meanwhile is a discovery service that collects links to stories, videos and other material published elsewhere. It is provided for general information, curiosity and enjoyment.</p>
    <h2>Publisher content</h2>
    <p>Articles, images, names and trademarks belong to their respective publishers and creators. Meanwhile provides links and brief previews. When you follow a link, the publisher’s own terms apply.</p>
    <h2>No guarantees</h2>
    <p>We work to keep the feed useful, accurate and available, but we cannot promise that every item is complete, correct, current or always accessible. Nothing on Meanwhile is professional medical, legal or financial advice.</p>
    <h2>Your account</h2>
    <p>You are responsible for keeping your password secure and for activity on your account. Tell us if you think someone else has accessed it.</p>
    <h2>Fair use of the service</h2>
    <p>Do not misuse Meanwhile, attempt to break or overload it, interfere with other people, scrape it in a harmful way or use it for illegal activity.</p>
    <h2>Feedback</h2>
    <p>If you send suggestions, you give us permission to use them to improve Meanwhile without payment or obligation.</p>
    <h2>Limits</h2>
    <p>To the extent allowed by law, Meanwhile and Ault Industries are not responsible for losses caused by using the service, relying on linked material or visiting third-party websites.</p>
    <h2>Changes and contact</h2>
    <p>We may update these terms as the service changes. Questions may be sent to <a href="mailto:hello@meanwhile.now">hello@meanwhile.now</a>.</p>
  </LegalShell>;
}
