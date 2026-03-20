ALTER TABLE rel_invite_applicants DROP CONSTRAINT IF EXISTS fk_invitation_id;
ALTER TABLE rel_invite_applicants DROP CONSTRAINT IF EXISTS unique_invitation_applicant;
DROP TABLE IF EXISTS rel_invite_applicants;

