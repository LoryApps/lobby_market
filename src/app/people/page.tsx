import { redirect } from 'next/navigation'

// /people redirects to the full Citizens Directory
export default function PeoplePage() {
  redirect('/citizens')
}
