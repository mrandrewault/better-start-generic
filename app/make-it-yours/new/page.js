import { redirect } from "next/navigation";

// The test address for the one-screen "Make it yours". It is now the real
// page, so this just sends people there.
export default function OldTestAddress() {
  redirect("/make-it-yours");
}
