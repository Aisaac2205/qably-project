-- AlterTable
-- New projects also detect React/Vue component tests (*.spec.tsx, *.test.tsx)
-- and Nest e2e specs (*.e2e-spec.ts). Existing rows are deliberately left
-- untouched: projects keep the patterns they have and edit them in the UI.
ALTER TABLE "project" ALTER COLUMN "testFilePatterns" SET DEFAULT ARRAY['*.spec.ts', '*.test.ts', '*.spec.tsx', '*.test.tsx', '*.e2e-spec.ts']::TEXT[];
