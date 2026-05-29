-- =====================================================
-- Clean up duplicate rows in holiday_periods table
-- Keeps the OLDEST row for each unique (start_date, end_date)
-- Run this directly in the Neon SQL Editor
-- =====================================================

DELETE FROM holiday_periods
WHERE id IN (
    SELECT id
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY start_date, end_date 
                ORDER BY created_at ASC
            ) as rn
        FROM holiday_periods
    ) t
    WHERE t.rn > 1
);

-- After running, you can verify with:
-- SELECT * FROM holiday_periods ORDER BY start_date;
