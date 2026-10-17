-- Recompute stellar_orders.paid_amount from the order's linked on-chain credits.
-- Run on ONE database at a time (sandbox first). Take a backup before running.
-- Read-only preview: run the SELECT; apply: run the UPDATEs inside the transaction.

-- Preview
SELECT o.id, o.reference, o.status, o.asset_amount, o.paid_amount AS stored_paid,
       COALESCE(t.s, 0) AS recomputed_paid
FROM stellar_orders o
LEFT JOIN (
  SELECT orderId, UPPER(currency) cur, SUM(amount) s
  FROM stellar_transactions
  WHERE type = 'credit' AND orderId IS NOT NULL
  GROUP BY orderId, UPPER(currency)
) t ON t.orderId = o.id AND t.cur = UPPER(o.currency)
WHERE o.paid_amount <> COALESCE(t.s, 0);

START TRANSACTION;

-- 1. paid_amount = sum of linked credits in the order currency
UPDATE stellar_orders o
LEFT JOIN (
  SELECT orderId, UPPER(currency) cur, SUM(amount) s
  FROM stellar_transactions
  WHERE type = 'credit' AND orderId IS NOT NULL
  GROUP BY orderId, UPPER(currency)
) t ON t.orderId = o.id AND t.cur = UPPER(o.currency)
SET o.paid_amount = COALESCE(t.s, 0)
WHERE o.paid_amount <> COALESCE(t.s, 0);

-- 2. Orders marked paid only because of double counting go back to partial_paid
UPDATE stellar_orders
SET status = 'partial_paid'
WHERE status = 'paid' AND paid_amount > 0 AND paid_amount < asset_amount;

COMMIT;
