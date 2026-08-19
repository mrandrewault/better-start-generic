import './globals.css';
import './interview.css';

export const metadata = {
  title: "Meanwhile Reader",
  description: "A playful, rage-free wall of good news, discovery and delight"
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
