// app/dashboard/contacts/page.tsx
import { redirect } from 'next/navigation'

// Contacts management lives inside the SOS page for now (single source of truth).
export default function ContactsPage() {
  redirect('/dashboard/sos')
}
