-- Per-representative override for holder finance visibility (null = inherit from org)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "holderFinanceOverride" "HolderFinanceVisibility";
