import { redirect } from 'next/navigation'

// /topics/[id] is a legacy URL pattern — canonical topic URLs use the
// singular form /topic/[id]. Redirect transparently so old links work.
export default function TopicRedirectPage({ params }: { params: { id: string } }) {
  redirect(`/topic/${params.id}`)
}
