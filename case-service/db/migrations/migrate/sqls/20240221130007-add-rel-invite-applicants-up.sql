CREATE TABLE IF NOT EXISTS "rel_invite_applicants" (
    invitation_id UUID NOT NULL,
    applicant_id UUID NOT NULL,
    CONSTRAINT fk_invitation_id FOREIGN KEY (invitation_id) REFERENCES data_invites(id),
    CONSTRAINT unique_invitation_applicant UNIQUE (invitation_id, applicant_id)
)

