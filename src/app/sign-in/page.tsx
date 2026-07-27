import { redirect } from 'next/navigation'

// Exchange pages and other components link to /sign-in — redirect to the actual login page.
export default function SignInRedirect() {
  redirect('/login')
}
