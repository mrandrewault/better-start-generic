import Link from "next/link";

export default function LegalShell({eyebrow, title, updated, children}) {
  return <main className="legalPage">
    <article className="legalWrap">
      <Link className="legalBack" href="/">← Back to Meanwhile</Link>
      <p className="legalEyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {updated && <p className="legalDate">Last updated: {updated}</p>}
      <div className="legalBody">{children}</div>
    </article>
  </main>;
}
