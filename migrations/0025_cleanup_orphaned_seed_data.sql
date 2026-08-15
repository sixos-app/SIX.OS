-- Remove legacy demo rows that referenced a non-existent organization.
DELETE FROM agency_feed
WHERE organization_id IS NULL
   OR organization_id NOT IN (SELECT id FROM organizations);
