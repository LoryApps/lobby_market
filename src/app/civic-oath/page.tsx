import { redirect } from 'next/navigation'

// /civic-oath is the canonical link shared from /civic-doctrine and other
// platform pages. The actual ceremony lives at /oath to keep the URL short.
export default function CivicOathRedirect() {
  redirect('/oath')
}
