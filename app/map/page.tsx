// app/map/page.tsx
// Backwards-compat redirect: the map now lives inside the dashboard shell.
import { redirect } from 'next/navigation'

export default function MapRedirect() {
  redirect('/dashboard/map')
}
