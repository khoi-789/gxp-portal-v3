-- SQL Migration: Add visa_no, decision_no, and valid_until to imp_shipment_items
-- Please execute this in your Supabase Dashboard SQL Editor:

ALTER TABLE public.imp_shipment_items 
ADD COLUMN IF NOT EXISTS visa_no TEXT,
ADD COLUMN IF NOT EXISTS decision_no TEXT,
ADD COLUMN IF NOT EXISTS valid_until TEXT;
