ALTER TABLE lost_found
ADD COLUMN IF NOT EXISTS image_path text,
ADD COLUMN IF NOT EXISTS report_type varchar(10) DEFAULT 'lost',
ADD COLUMN IF NOT EXISTS contact_info varchar(120),
ADD COLUMN IF NOT EXISTS reported_date date DEFAULT CURRENT_DATE;

UPDATE lost_found
SET
    report_type = COALESCE(report_type, 'lost'),
    reported_date = COALESCE(reported_date, created_at::date, CURRENT_DATE)
WHERE report_type IS NULL OR reported_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_notes_user_id_created_at
ON notes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_event_date
ON events (event_date);

CREATE INDEX IF NOT EXISTS idx_timetable_day_time
ON timetable (day_of_week, start_time, end_time);

ALTER TABLE timetable
ADD COLUMN IF NOT EXISTS class_date date;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'timetable_day_of_week_check'
    ) THEN
        ALTER TABLE timetable
        ADD CONSTRAINT timetable_day_of_week_check
        CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lost_found_reported_date
ON lost_found (reported_date DESC);
