-- Migration: Replace age with birth_date in students table
-- 1. Add birth_date column
ALTER TABLE students
ADD COLUMN birth_date DATE;
-- 2. (Optional) Backfill birth_date from age (Approximate: Jan 1st of estimated year)
-- Assuming current year 2026 (based on system time context) or just using CURRENT_DATE
-- This uses Postgres date arithmetic.
-- approximate_birth_year = current_year - age
-- We set birth_date to 'YYYY-01-01'
UPDATE students
SET birth_date = make_date(
        CAST(
            EXTRACT(
                YEAR
                FROM CURRENT_DATE
            ) - age AS INTEGER
        ),
        1,
        1
    )
WHERE age IS NOT NULL
    AND birth_date IS NULL;
-- 3. (Optional) Drop age column
-- It is recommended to verify the data before dropping the column.
-- ALTER TABLE students DROP COLUMN age;