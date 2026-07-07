-- SECURITY DEFINER function so anon can unsubscribe without a direct UPDATE policy
create or replace function public.newsletter_unsubscribe(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.newsletter_subscribers
  set unsubscribed_at = now()
  where lower(trim(email)) = lower(trim(p_email))
    and unsubscribed_at is null;
  return found;
end;
$$;

grant execute on function public.newsletter_unsubscribe(text) to anon, authenticated;
