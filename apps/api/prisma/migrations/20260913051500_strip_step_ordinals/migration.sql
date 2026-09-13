-- Steps and preconditions are rendered inside an ordered list; the prompt no
-- longer asks the model to number them and the schema strips any ordinal the
-- model still emits. Existing rows carry the old prefix, so strip it once here.

UPDATE "test_case" SET "steps" = ARRAY(
  SELECT regexp_replace(s, '^\d+[.)]\s*', '')
  FROM unnest("steps") WITH ORDINALITY AS u(s, ord)
  ORDER BY ord
) WHERE EXISTS (SELECT 1 FROM unnest("steps") s WHERE s ~ '^\d+[.)]');

UPDATE "extracted_proposal" SET "steps" = ARRAY(
  SELECT regexp_replace(s, '^\d+[.)]\s*', '')
  FROM unnest("steps") WITH ORDINALITY AS u(s, ord)
  ORDER BY ord
) WHERE EXISTS (SELECT 1 FROM unnest("steps") s WHERE s ~ '^\d+[.)]');

UPDATE "extracted_proposal" SET "preconditions" = ARRAY(
  SELECT regexp_replace(s, '^\d+[.)]\s*', '')
  FROM unnest("preconditions") WITH ORDINALITY AS u(s, ord)
  ORDER BY ord
) WHERE EXISTS (SELECT 1 FROM unnest("preconditions") s WHERE s ~ '^\d+[.)]');

UPDATE "test_case_version" SET "steps" = ARRAY(
  SELECT regexp_replace(s, '^\d+[.)]\s*', '')
  FROM unnest("steps") WITH ORDINALITY AS u(s, ord)
  ORDER BY ord
) WHERE EXISTS (SELECT 1 FROM unnest("steps") s WHERE s ~ '^\d+[.)]');

UPDATE "test_case_version" SET "preconditions" = ARRAY(
  SELECT regexp_replace(s, '^\d+[.)]\s*', '')
  FROM unnest("preconditions") WITH ORDINALITY AS u(s, ord)
  ORDER BY ord
) WHERE EXISTS (SELECT 1 FROM unnest("preconditions") s WHERE s ~ '^\d+[.)]');

UPDATE "run_case" SET "steps" = ARRAY(
  SELECT regexp_replace(s, '^\d+[.)]\s*', '')
  FROM unnest("steps") WITH ORDINALITY AS u(s, ord)
  ORDER BY ord
) WHERE EXISTS (SELECT 1 FROM unnest("steps") s WHERE s ~ '^\d+[.)]');
