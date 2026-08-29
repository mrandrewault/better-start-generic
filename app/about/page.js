import LegalShell from "../legal-shell";

export const metadata = {title:"About us — Meanwhile"};

export default function AboutPage() {
  return <LegalShell eyebrow="Meanwhile" title="Who we are">
    <p>MEANWHILE is a product of Ault Industries, based just outside New York City. This is an independent experiment in adding a little more humanity, curiosity, good times and random tangents to the daily mix of life. We’re also friends to all animals.</p>
    <h2>Say hello</h2>
    <p>Questions, suggestions, publisher recommendations or complaints are welcome:</p>
    <p><a href="mailto:hello@meanwhile.now">hello@meanwhile.now</a></p>
  </LegalShell>;
}
