CREATE TABLE IF NOT EXISTS assignment_submissions (
  id UUID PRIMARY KEY,
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submission_text TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','passed','failed')),
  score_percent DOUBLE PRECISION,
  feedback TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  graded_at TIMESTAMPTZ,
  graded_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (enrollment_id, assessment_id)
);

CREATE INDEX IF NOT EXISTS ix_assignment_submissions_assessment
  ON assignment_submissions (assessment_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS ix_assignment_submissions_user
  ON assignment_submissions (user_id, submitted_at DESC);
