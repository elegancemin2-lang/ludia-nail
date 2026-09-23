-- LUDIA NAIL · customer profile editing
-- Apply after salon_os.sql and customer_360.sql.
-- Keeps Customer 360 edits server-authorized and salon-scoped.

create or replace function public.ludia_update_customer_profile(
  p_salon_id uuid,
  p_customer_id uuid,
  p_memo text default null,
  p_tags text[] default null,
  p_preferences jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_customer public.ludia_customers%rowtype;
  v_tags text[];
begin
  if p_salon_id is null or p_customer_id is null then
    raise exception 'customer_context_required';
  end if;
  if not public.ludia_is_salon_member(p_salon_id) then
    raise exception 'salon_access_denied';
  end if;
  if p_preferences is not null and jsonb_typeof(p_preferences) <> 'object' then
    raise exception 'preferences_must_be_object';
  end if;
  if p_memo is not null and length(p_memo) > 2000 then
    raise exception 'memo_too_long';
  end if;

  if p_tags is not null then
    select coalesce(array_agg(tag order by ord),'{}'::text[])
      into v_tags
    from (
      select min(ord) ord, btrim(tag) tag
      from unnest(p_tags) with ordinality as t(tag,ord)
      where btrim(tag) <> '' and length(btrim(tag)) <= 30
      group by btrim(tag)
      order by min(ord)
      limit 20
    ) cleaned;
  end if;

  update public.ludia_customers
     set memo=case when p_memo is null then memo else nullif(btrim(p_memo),'') end,
         tags=case when p_tags is null then tags else v_tags end,
         preferences=case when p_preferences is null then preferences else p_preferences end,
         updated_at=now()
   where id=p_customer_id and salon_id=p_salon_id
   returning * into v_customer;

  if not found then raise exception 'customer_not_found'; end if;

  return jsonb_build_object(
    'id',v_customer.id,
    'memo',v_customer.memo,
    'tags',coalesce(v_customer.tags,'{}'::text[]),
    'preferences',coalesce(v_customer.preferences,'{}'::jsonb),
    'updatedAt',v_customer.updated_at
  );
end
$$;

revoke all on function public.ludia_update_customer_profile(uuid,uuid,text,text[],jsonb) from public, anon;
grant execute on function public.ludia_update_customer_profile(uuid,uuid,text,text[],jsonb) to authenticated;

comment on function public.ludia_update_customer_profile(uuid,uuid,text,text[],jsonb) is
  'Salon-member authorized Customer 360 editor for memo, tags and structured preferences. Null parameters preserve existing values.';
