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
GRANT ALL ON FUNCTION "public"."get_matching_active_note_count"("p_domain" "text", "p_exact" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_matching_active_note_count"("p_domain" "text", "p_exact" "text") TO "service_role";
