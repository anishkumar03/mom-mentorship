update public.students
set full_name = name
where full_name is null and name is not null;
