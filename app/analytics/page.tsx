// app/analytics/page.tsx
// Backwards-compat redirect: analytics now lives inside the dashboard shell.
import { redirect } from 'next/navigation'

export default function AnalyticsRedirect() {
  redirect('/dashboard/analytics')
}
