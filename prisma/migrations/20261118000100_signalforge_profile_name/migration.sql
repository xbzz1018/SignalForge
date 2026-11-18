-- Keep previously applied migrations intact so their checksums remain valid.
ALTER TABLE "projects" ALTER COLUMN "agent_profile_id" SET DEFAULT 'signalforge.finance-research';

UPDATE "projects"
SET "agent_profile_id" = 'signalforge.finance-research'
WHERE "agent_profile_id" = 'quantpilot.finance-research';
