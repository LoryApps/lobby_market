-- Civic Oral Questions: rotating departmental questions system
-- Each week a different department "faces the chamber" for questions from citizens

create table if not exists civic_oral_question_sessions (
  id uuid primary key default gen_random_uuid(),
  department text not null,
  department_slug text not null,
  spokesperson_name text,
  spokesperson_avatar_url text,
  week_start date not null,
  week_end date not null,
  is_active boolean not null default false,
  session_notes text,
  created_at timestamptz not null default now(),
  unique (department_slug, week_start)
);

create table if not exists civic_oral_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references civic_oral_question_sessions(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  question_text text not null check (char_length(question_text) between 10 and 500),
  upvotes integer not null default 0,
  is_selected boolean not null default false,
  is_answered boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists civic_oral_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references civic_oral_questions(id) on delete cascade,
  session_id uuid not null references civic_oral_question_sessions(id) on delete cascade,
  answer_text text not null check (char_length(answer_text) between 10 and 2000),
  answered_by text,
  created_at timestamptz not null default now()
);

create table if not exists civic_oral_question_upvotes (
  question_id uuid not null references civic_oral_questions(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (question_id, user_id)
);

create index if not exists idx_oral_question_sessions_active on civic_oral_question_sessions(is_active) where is_active = true;
create index if not exists idx_oral_question_sessions_week on civic_oral_question_sessions(week_start desc);
create index if not exists idx_oral_questions_session on civic_oral_questions(session_id, upvotes desc);
create index if not exists idx_oral_questions_author on civic_oral_questions(author_id);
create index if not exists idx_oral_answers_question on civic_oral_answers(question_id);

-- Seed the rotating department schedule for the next 12 weeks
-- Departments rotate on a 10-department cycle (matching category system)
do $$
declare
  v_week_start date;
  v_departments text[] := array[
    'Treasury & Economy',
    'Health & Social Care',
    'Education & Skills',
    'Home Affairs & Justice',
    'Foreign Affairs & Defence',
    'Environment & Climate',
    'Transport & Infrastructure',
    'Housing & Communities',
    'Science, Technology & Innovation',
    'Culture, Media & Sport'
  ];
  v_slugs text[] := array[
    'treasury',
    'health',
    'education',
    'home-affairs',
    'foreign-affairs',
    'environment',
    'transport',
    'housing',
    'science',
    'culture'
  ];
  v_spokespersons text[] := array[
    'Chancellor of the Exchequer',
    'Secretary of State for Health',
    'Secretary of State for Education',
    'Home Secretary',
    'Foreign Secretary',
    'Secretary of State for Environment',
    'Secretary of State for Transport',
    'Secretary of State for Housing',
    'Secretary of State for Science',
    'Secretary of State for Culture'
  ];
  i integer;
  v_dept_idx integer;
  v_is_active boolean;
begin
  -- Start from the current Monday (or most recent Monday)
  v_week_start := date_trunc('week', current_date)::date;

  for i in 0..11 loop
    v_dept_idx := (i % 10) + 1;
    v_is_active := (i = 0);

    insert into civic_oral_question_sessions (
      department,
      department_slug,
      spokesperson_name,
      week_start,
      week_end,
      is_active
    ) values (
      v_departments[v_dept_idx],
      v_slugs[v_dept_idx],
      v_spokespersons[v_dept_idx],
      v_week_start + (i * 7),
      v_week_start + (i * 7) + 6,
      v_is_active
    )
    on conflict (department_slug, week_start) do nothing;
  end loop;
end $$;

-- Function to upvote a question
create or replace function civic_upvote_oral_question(p_question_id uuid, p_user_id uuid)
returns boolean
language plpgsql security definer as $$
declare
  v_already_voted boolean;
begin
  select exists(
    select 1 from civic_oral_question_upvotes
    where question_id = p_question_id and user_id = p_user_id
  ) into v_already_voted;

  if v_already_voted then
    delete from civic_oral_question_upvotes
    where question_id = p_question_id and user_id = p_user_id;
    update civic_oral_questions set upvotes = upvotes - 1 where id = p_question_id;
    return false;
  else
    insert into civic_oral_questions_upvotes (question_id, user_id)
    values (p_question_id, p_user_id)
    on conflict do nothing;
    update civic_oral_questions set upvotes = upvotes + 1 where id = p_question_id;
    return true;
  end if;
end $$;
