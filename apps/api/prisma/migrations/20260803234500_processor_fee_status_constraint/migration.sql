-- Keep processor-fee reconciliation state within the contract-backed lifecycle.
ALTER TABLE "payment_records"
ADD CONSTRAINT "payment_records_processor_fee_status_check"
CHECK (
  "processorFeeStatus" IS NULL OR
  "processorFeeStatus" IN ('not-applicable', 'pending', 'reconciled', 'failed')
);
