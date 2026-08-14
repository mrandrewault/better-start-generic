import './globals.css';

export const metadata = {
  title: "Better Start — Good Things Worth Knowing",
  description: "A playful, rage-free wall of good news, discovery and delight"
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
