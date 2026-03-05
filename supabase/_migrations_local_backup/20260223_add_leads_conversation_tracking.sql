alter table public.leads
  add column if not exists last_note text,
  add column if not exists last_contacted_at timestamptz;

update public.leads
set status = case
  when status is null or btrim(status) = '' then 'New'
  when lower(regexp_replace(status, '\s+', '', 'g')) like 'follow%' then 'Follow Up'
  when lower(btrim(status)) in ('nurture', 'waiting', 'pending') then 'Nurture'
  when lower(btrim(status)) = 'new' then 'New'
  when lower(btrim(status)) = 'contacted' then 'Contacted'
  when lower(btrim(status)) = 'confirmed' then 'Confirmed'
  when lower(btrim(status)) = 'lost' then 'Lost'
  else status
end
;
