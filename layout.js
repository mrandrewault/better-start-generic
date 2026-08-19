import './globals.css';

export const metadata = {
  title: "Meanwhile — Andrew's Edition",
  description: "A personalized editorial morning homepage"
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
