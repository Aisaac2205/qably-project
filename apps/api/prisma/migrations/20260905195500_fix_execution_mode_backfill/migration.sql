UPDATE "test_case" tc
SET "executionMode" = 'manual',
    "automationKey" = NULL,
    "automationClassName" = NULL,
    "automationFilePath" = NULL
WHERE tc."executionMode" = 'automated'
  AND NOT EXISTS (
    SELECT 1
    FROM "run_case" rc
    JOIN "run" r ON r."id" = rc."runId"
    WHERE rc."testCaseId" = tc."id"
      AND r."source" <> 'manual'
  );
