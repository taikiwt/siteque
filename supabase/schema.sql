


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."check_array_elements_length"("arr" "text"[], "max_len" integer) RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY arr LOOP
        IF length(t) > max_len THEN
            RETURN false;
        END IF;
    END LOOP;
    RETURN true;
END;
$$;


ALTER FUNCTION "public"."check_array_elements_length"("arr" "text"[], "max_len" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_diary_content_length"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  user_plan text;
begin
  select plan into user_plan from public.sitecue_profiles where id = auth.uid();
  if (user_plan = 'free' or user_plan is null) and char_length(NEW.content) > 50000 then
    raise exception 'content length exceeds free plan limit (50000 chars)';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."check_diary_content_length"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_draft_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  user_plan text;
  draft_count int;
begin
  select plan into user_plan
  from public.sitecue_profiles
  where id = auth.uid();

  if user_plan = 'free' then
    select count(*) into draft_count
    from public.sitecue_drafts
    where user_id = auth.uid();

    if draft_count >= 50 then
      raise exception 'draft storage limit reached';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."check_draft_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_note_content_length"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  user_plan text;
begin
  select plan into user_plan from public.sitecue_profiles where id = auth.uid();
  if (user_plan = 'free' or user_plan is null) and char_length(NEW.content) > 10000 then
    raise exception 'content length exceeds free plan limit (10000 chars)';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."check_note_content_length"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_note_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  user_plan text;
  note_count int;
begin
  select plan into user_plan
  from public.sitecue_profiles
  where id = auth.uid();

  if user_plan = 'free' then
    select count(*) into note_count
    from public.sitecue_notes
    where user_id = auth.uid();

    -- Note limit is 500 as per latest migration
    if note_count >= 500 then
      raise exception 'note storage limit reached';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."check_note_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dashboard_domain_activity"("p_user_id" "uuid", "p_limit" integer DEFAULT 6) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
DECLARE
  result json;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  WITH note_with_domain AS (
    SELECT
      *,
      regexp_replace(url_pattern, '^(?:https?://)?(?:www\.)?([^/]+).*$', '\1') AS domain_name
    FROM public.sitecue_notes
    WHERE user_id = p_user_id AND scope IN ('domain', 'exact')
  ),
  
  top_domains AS (
    SELECT
      domain_name,
      count(*) AS total_count
    FROM note_with_domain
    GROUP BY domain_name
    ORDER BY total_count DESC, domain_name ASC
    LIMIT p_limit
  ),
  
  domain_latest_notes AS (
    SELECT
      td.domain_name,
      COALESCE(
        json_agg(json_build_object('id', ln.id, 'content', ln.content, 'is_resolved', ln.is_resolved) ORDER BY ln.created_at DESC) 
        FILTER (WHERE ln.id IS NOT NULL), 
        '[]'::json
      ) AS domain_notes
    FROM top_domains td
    LEFT JOIN LATERAL (
      SELECT id, content, is_resolved, created_at
      FROM note_with_domain n2
      WHERE n2.domain_name = td.domain_name AND n2.scope = 'domain'
      ORDER BY n2.created_at DESC
      LIMIT 2
    ) ln ON TRUE
    GROUP BY td.domain_name
  ),
  
  page_ranking AS (
    SELECT
      n.domain_name,
      n.url_pattern AS page_url,
      count(*) AS page_count,
      row_number() OVER (PARTITION BY n.domain_name ORDER BY count(*) DESC, n.url_pattern ASC) as rank
    FROM note_with_domain n
    WHERE n.scope = 'exact'
    GROUP BY n.domain_name, n.url_pattern
  ),
  
  top_pages_filtered AS (
    SELECT domain_name, page_url, page_count
    FROM page_ranking
    WHERE rank <= 3
  ),
  
  page_latest_notes AS (
    SELECT
      tp.domain_name,
      tp.page_url,
      COALESCE(
        json_agg(json_build_object('id', lpn.id, 'content', lpn.content, 'is_resolved', lpn.is_resolved) ORDER BY lpn.created_at DESC)
        FILTER (WHERE lpn.id IS NOT NULL),
        '[]'::json
      ) AS page_notes
    FROM top_pages_filtered tp
    LEFT JOIN LATERAL (
      SELECT id, content, is_resolved, created_at
      FROM note_with_domain n2
      WHERE n2.domain_name = tp.domain_name AND n2.url_pattern = tp.page_url AND n2.scope = 'exact'
      ORDER BY n2.created_at DESC
      LIMIT 2
    ) lpn ON TRUE
    GROUP BY tp.domain_name, tp.page_url
  ),
  
  domain_pages_json AS (
    SELECT
      tp.domain_name,
      json_agg(
        json_build_object(
          'page_url', tp.page_url,
          'page_title', NULL,
          'page_count', tp.page_count,
          'page_notes', COALESCE(pn.page_notes, '[]'::json)
        ) ORDER BY tp.page_count DESC, tp.page_url ASC
      ) AS top_pages
    FROM top_pages_filtered tp
    LEFT JOIN page_latest_notes pn ON pn.domain_name = tp.domain_name AND pn.page_url = tp.page_url
    GROUP BY tp.domain_name
  )
  
  SELECT json_agg(
    json_build_object(
      'domain', td.domain_name,
      'total_count', td.total_count,
      'domain_notes', COALESCE(dn.domain_notes, '[]'::json),
      'top_pages', COALESCE(dp.top_pages, '[]'::json)
    ) ORDER BY td.total_count DESC, td.domain_name ASC
  ) INTO result
  FROM top_domains td
  LEFT JOIN domain_latest_notes dn ON dn.domain_name = td.domain_name
  LEFT JOIN domain_pages_json dp ON dp.domain_name = td.domain_name;
  
  RETURN COALESCE(result, '[]'::json);
END;
$_$;


ALTER FUNCTION "public"."get_dashboard_domain_activity"("p_user_id" "uuid", "p_limit" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."sitecue_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "title" "text",
    "content" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "template_id" "uuid",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    CONSTRAINT "sitecue_drafts_content_len_check" CHECK (("char_length"("content") <= 100000))
);


ALTER TABLE "public"."sitecue_drafts" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_drafts_by_date"("p_user_id" "uuid", "p_date" "text") RETURNS SETOF "public"."sitecue_drafts"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM public.sitecue_drafts
    WHERE user_id = p_user_id AND (timezone('Asia/Tokyo', updated_at)::date)::text = p_date
    ORDER BY updated_at ASC;
END;
$$;


ALTER FUNCTION "public"."get_drafts_by_date"("p_user_id" "uuid", "p_date" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_matching_active_note_count"("p_domain" "text", "p_exact" "text") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT count(*)::integer
  FROM public.sitecue_notes
  WHERE user_id = auth.uid()
    AND is_resolved = false
    AND ((scope = 'domain' AND url_pattern = p_domain)
      OR (scope = 'exact' AND url_pattern = p_exact));
$$;


ALTER FUNCTION "public"."get_matching_active_note_count"("p_domain" "text", "p_exact" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sitecue_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "url_pattern" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "scope" "text" DEFAULT 'domain'::"text" NOT NULL,
    "note_type" "text" DEFAULT 'info'::"text" NOT NULL,
    "is_resolved" boolean DEFAULT false NOT NULL,
    "is_pinned" boolean DEFAULT false NOT NULL,
    "is_favorite" boolean DEFAULT false NOT NULL,
    "sort_order" double precision DEFAULT 0 NOT NULL,
    "is_expanded" boolean DEFAULT false NOT NULL,
    "draft_id" "uuid",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    CONSTRAINT "sitecue_notes_content_len_check" CHECK (("char_length"("content") <= 30000)),
    CONSTRAINT "sitecue_notes_note_type_check" CHECK (("note_type" = ANY (ARRAY['info'::"text", 'alert'::"text", 'idea'::"text"]))),
    CONSTRAINT "sitecue_notes_scope_check" CHECK (("scope" = ANY (ARRAY['domain'::"text", 'exact'::"text", 'inbox'::"text", 'draft'::"text"])))
);


ALTER TABLE "public"."sitecue_notes" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_matching_notes"("p_domain" "text", "p_exact" "text") RETURNS SETOF "public"."sitecue_notes"
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select * from sitecue_notes
  where (scope = 'domain' and url_pattern = p_domain)
     or (scope = 'exact' and url_pattern = p_exact);
end;
$$;


ALTER FUNCTION "public"."get_matching_notes"("p_domain" "text", "p_exact" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_notes_by_date"("p_user_id" "uuid", "p_date" "text") RETURNS SETOF "public"."sitecue_notes"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM public.sitecue_notes
    WHERE user_id = p_user_id AND (timezone('Asia/Tokyo', created_at)::date)::text = p_date
    ORDER BY created_at ASC;
END;
$$;


ALTER FUNCTION "public"."get_notes_by_date"("p_user_id" "uuid", "p_date" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.sitecue_profiles (id, plan)
  values (new.id, 'free');
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_todo01"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.todo01_profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user_todo01"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_sitecue_notes_inbox_consistency"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.scope = 'inbox' THEN
        NEW.url_pattern := 'inbox';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_sitecue_notes_inbox_consistency"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_drafts"("search_query" "text") RETURNS SETOF "public"."sitecue_drafts"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.sitecue_drafts
  WHERE (content ILIKE '%' || search_query || '%'
     OR title ILIKE '%' || search_query || '%');
END;
$$;


ALTER FUNCTION "public"."search_drafts"("search_query" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_notes"("search_query" "text") RETURNS SETOF "public"."sitecue_notes"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.sitecue_notes
  WHERE (content ILIKE '%' || search_query || '%'
     OR url_pattern ILIKE '%' || search_query || '%');
END;
$$;


ALTER FUNCTION "public"."search_notes"("search_query" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sitecue_diaries" (
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "topics" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "sitecue_diaries_content_len_check" CHECK (("char_length"("content") <= 100000)),
    CONSTRAINT "sitecue_diaries_topics_count_check" CHECK (("cardinality"("topics") <= 10)),
    CONSTRAINT "sitecue_diaries_topics_length_check" CHECK ("public"."check_array_elements_length"("topics", 50))
);


ALTER TABLE "public"."sitecue_diaries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sitecue_domain_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "label" "text",
    "color" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."sitecue_domain_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sitecue_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "domain" "text" NOT NULL,
    "target_url" "text" NOT NULL,
    "label" "text" NOT NULL,
    "type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sitecue_links_type_check" CHECK (("type" = ANY (ARRAY['related'::"text", 'env'::"text"])))
);


ALTER TABLE "public"."sitecue_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sitecue_pinned_sites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "title" "text" NOT NULL,
    "url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."sitecue_pinned_sites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sitecue_profiles" (
    "id" "uuid" NOT NULL,
    "plan" "text" DEFAULT 'free'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "ai_usage_count" integer DEFAULT 0 NOT NULL,
    "ai_usage_reset_at" timestamp with time zone DEFAULT ("now"() + '1 mon'::interval),
    CONSTRAINT "sitecue_profiles_plan_check" CHECK (("plan" = ANY (ARRAY['free'::"text", 'pro'::"text"])))
);


ALTER TABLE "public"."sitecue_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sitecue_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "icon" "text",
    "max_length" integer,
    "boilerplate" "text",
    "weave_prompt" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sitecue_templates_boilerplate_len_check" CHECK (("char_length"("boilerplate") <= 5000)),
    CONSTRAINT "sitecue_templates_weave_prompt_len_check" CHECK (("char_length"("weave_prompt") <= 5000))
);


ALTER TABLE "public"."sitecue_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."todo01_profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."todo01_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."todo01_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "is_complete" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."todo01_tasks" OWNER TO "postgres";


ALTER TABLE ONLY "public"."sitecue_diaries"
    ADD CONSTRAINT "sitecue_diaries_pkey" PRIMARY KEY ("user_id", "date");



ALTER TABLE ONLY "public"."sitecue_domain_settings"
    ADD CONSTRAINT "sitecue_domain_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sitecue_domain_settings"
    ADD CONSTRAINT "sitecue_domain_settings_user_id_domain_key" UNIQUE ("user_id", "domain");



ALTER TABLE ONLY "public"."sitecue_drafts"
    ADD CONSTRAINT "sitecue_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sitecue_links"
    ADD CONSTRAINT "sitecue_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sitecue_notes"
    ADD CONSTRAINT "sitecue_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sitecue_pinned_sites"
    ADD CONSTRAINT "sitecue_pinned_sites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sitecue_profiles"
    ADD CONSTRAINT "sitecue_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sitecue_templates"
    ADD CONSTRAINT "sitecue_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."todo01_profiles"
    ADD CONSTRAINT "todo01_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."todo01_tasks"
    ADD CONSTRAINT "todo01_tasks_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_sitecue_drafts_template_id" ON "public"."sitecue_drafts" USING "btree" ("template_id");



CREATE INDEX "sitecue_links_domain_idx" ON "public"."sitecue_links" USING "btree" ("domain");



CREATE INDEX "sitecue_links_target_url_idx" ON "public"."sitecue_links" USING "btree" ("target_url");



CREATE INDEX "sitecue_notes_url_idx" ON "public"."sitecue_notes" USING "btree" ("url_pattern");



CREATE INDEX "sitecue_notes_user_idx" ON "public"."sitecue_notes" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "on_diary_content_length_check" BEFORE INSERT OR UPDATE ON "public"."sitecue_diaries" FOR EACH ROW EXECUTE FUNCTION "public"."check_diary_content_length"();



CREATE OR REPLACE TRIGGER "on_draft_created_check_limit" BEFORE INSERT ON "public"."sitecue_drafts" FOR EACH ROW EXECUTE FUNCTION "public"."check_draft_limit"();



CREATE OR REPLACE TRIGGER "on_note_content_length_check" BEFORE INSERT OR UPDATE ON "public"."sitecue_notes" FOR EACH ROW EXECUTE FUNCTION "public"."check_note_content_length"();



CREATE OR REPLACE TRIGGER "on_note_created_check_limit" BEFORE INSERT ON "public"."sitecue_notes" FOR EACH ROW EXECUTE FUNCTION "public"."check_note_limit"();



CREATE OR REPLACE TRIGGER "sitecue_notes_inbox_consistency_trigger" BEFORE INSERT OR UPDATE ON "public"."sitecue_notes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_sitecue_notes_inbox_consistency"();



ALTER TABLE ONLY "public"."sitecue_diaries"
    ADD CONSTRAINT "sitecue_diaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sitecue_domain_settings"
    ADD CONSTRAINT "sitecue_domain_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."sitecue_drafts"
    ADD CONSTRAINT "sitecue_drafts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."sitecue_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sitecue_drafts"
    ADD CONSTRAINT "sitecue_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sitecue_links"
    ADD CONSTRAINT "sitecue_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sitecue_notes"
    ADD CONSTRAINT "sitecue_notes_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "public"."sitecue_drafts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sitecue_notes"
    ADD CONSTRAINT "sitecue_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sitecue_pinned_sites"
    ADD CONSTRAINT "sitecue_pinned_sites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sitecue_profiles"
    ADD CONSTRAINT "sitecue_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sitecue_templates"
    ADD CONSTRAINT "sitecue_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo01_profiles"
    ADD CONSTRAINT "todo01_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo01_tasks"
    ADD CONSTRAINT "todo01_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."todo01_profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Enable update for users based on user_id" ON "public"."sitecue_notes" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own domain settings" ON "public"."sitecue_domain_settings" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own notes" ON "public"."sitecue_notes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own pinned sites" ON "public"."sitecue_pinned_sites" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."todo01_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert their own domain settings" ON "public"."sitecue_domain_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own notes" ON "public"."sitecue_notes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own pinned sites" ON "public"."sitecue_pinned_sites" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own diaries" ON "public"."sitecue_diaries" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own templates" ON "public"."sitecue_templates" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can perform all actions on their own drafts" ON "public"."sitecue_drafts" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can perform all actions on their own links" ON "public"."sitecue_links" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can perform all operations on own tasks" ON "public"."todo01_tasks" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."todo01_profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own domain settings" ON "public"."sitecue_domain_settings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own notes" ON "public"."sitecue_notes" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile." ON "public"."sitecue_profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own profile" ON "public"."todo01_profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own domain settings" ON "public"."sitecue_domain_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own notes" ON "public"."sitecue_notes" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own pinned sites" ON "public"."sitecue_pinned_sites" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile." ON "public"."sitecue_profiles" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."sitecue_diaries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sitecue_domain_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sitecue_drafts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sitecue_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sitecue_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sitecue_pinned_sites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sitecue_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sitecue_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."todo01_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."todo01_tasks" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."check_array_elements_length"("arr" "text"[], "max_len" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_array_elements_length"("arr" "text"[], "max_len" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_array_elements_length"("arr" "text"[], "max_len" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_diary_content_length"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_diary_content_length"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_diary_content_length"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_draft_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_draft_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_draft_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_note_content_length"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_note_content_length"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_note_content_length"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_note_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_note_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_note_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dashboard_domain_activity"("p_user_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_dashboard_domain_activity"("p_user_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dashboard_domain_activity"("p_user_id" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON TABLE "public"."sitecue_drafts" TO "anon";
GRANT ALL ON TABLE "public"."sitecue_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."sitecue_drafts" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_drafts_by_date"("p_user_id" "uuid", "p_date" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_drafts_by_date"("p_user_id" "uuid", "p_date" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_drafts_by_date"("p_user_id" "uuid", "p_date" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_matching_active_note_count"("p_domain" "text", "p_exact" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_matching_active_note_count"("p_domain" "text", "p_exact" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_matching_active_note_count"("p_domain" "text", "p_exact" "text") TO "service_role";



GRANT ALL ON TABLE "public"."sitecue_notes" TO "anon";
GRANT ALL ON TABLE "public"."sitecue_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."sitecue_notes" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_matching_notes"("p_domain" "text", "p_exact" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_matching_notes"("p_domain" "text", "p_exact" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_matching_notes"("p_domain" "text", "p_exact" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_notes_by_date"("p_user_id" "uuid", "p_date" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_notes_by_date"("p_user_id" "uuid", "p_date" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_notes_by_date"("p_user_id" "uuid", "p_date" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_todo01"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_todo01"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_todo01"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_sitecue_notes_inbox_consistency"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_sitecue_notes_inbox_consistency"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_sitecue_notes_inbox_consistency"() TO "service_role";



GRANT ALL ON FUNCTION "public"."search_drafts"("search_query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_drafts"("search_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_drafts"("search_query" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_notes"("search_query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_notes"("search_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_notes"("search_query" "text") TO "service_role";
























GRANT ALL ON TABLE "public"."sitecue_diaries" TO "anon";
GRANT ALL ON TABLE "public"."sitecue_diaries" TO "authenticated";
GRANT ALL ON TABLE "public"."sitecue_diaries" TO "service_role";



GRANT ALL ON TABLE "public"."sitecue_domain_settings" TO "anon";
GRANT ALL ON TABLE "public"."sitecue_domain_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."sitecue_domain_settings" TO "service_role";



GRANT ALL ON TABLE "public"."sitecue_links" TO "anon";
GRANT ALL ON TABLE "public"."sitecue_links" TO "authenticated";
GRANT ALL ON TABLE "public"."sitecue_links" TO "service_role";



GRANT ALL ON TABLE "public"."sitecue_pinned_sites" TO "anon";
GRANT ALL ON TABLE "public"."sitecue_pinned_sites" TO "authenticated";
GRANT ALL ON TABLE "public"."sitecue_pinned_sites" TO "service_role";



GRANT ALL ON TABLE "public"."sitecue_profiles" TO "anon";
GRANT ALL ON TABLE "public"."sitecue_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."sitecue_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."sitecue_templates" TO "anon";
GRANT ALL ON TABLE "public"."sitecue_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."sitecue_templates" TO "service_role";



GRANT ALL ON TABLE "public"."todo01_profiles" TO "anon";
GRANT ALL ON TABLE "public"."todo01_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."todo01_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."todo01_tasks" TO "anon";
GRANT ALL ON TABLE "public"."todo01_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."todo01_tasks" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































