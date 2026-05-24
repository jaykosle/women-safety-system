// app/sos/page.tsx
// Backwards-compat redirect: SOS now lives inside the dashboard shell.
import { redirect } from 'next/navigation'

export default function SosRedirect() {
  redirect('/dashboard/sos')
}
