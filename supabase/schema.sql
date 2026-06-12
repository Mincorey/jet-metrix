-- JetMetrix — PostgreSQL schema for Supabase
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

CREATE TABLE IF NOT EXISTS "Employees" (
  id SERIAL PRIMARY KEY,
  "Date" TEXT,
  "Name" TEXT,
  "Role" TEXT,
  "Status" TEXT,
  "Password" TEXT,
  "Archive_Date" TEXT
);

CREATE TABLE IF NOT EXISTS "Workdays" (
  id SERIAL PRIMARY KEY,
  "Date" TEXT,
  "Name" TEXT,
  "Fuel_Received_L" DOUBLE PRECISION,
  "Fuel_Received_KG" DOUBLE PRECISION,
  "Fuel_Issued_TZA_L" DOUBLE PRECISION,
  "Fuel_Issued_TZA_KG" DOUBLE PRECISION,
  "Fuel_Issued_VS_L" DOUBLE PRECISION,
  "Fuel_Issued_VS_KG" DOUBLE PRECISION,
  "Workday_Status" TEXT,
  "Checklist_Sent" INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "Fuel_Reception" (
  id SERIAL PRIMARY KEY,
  "Workday_ID" INTEGER,
  "Date" TEXT,
  "Name" TEXT,
  "Tank_Name" TEXT,
  "Counter_Before" DOUBLE PRECISION,
  "Counter_After" DOUBLE PRECISION,
  "Density" DOUBLE PRECISION,
  "Volume" DOUBLE PRECISION,
  "Mass" DOUBLE PRECISION,
  "Timestamp" BIGINT
);

CREATE TABLE IF NOT EXISTS "Fuel_Reception_Auto" (
  id SERIAL PRIMARY KEY,
  "Workday_ID" INTEGER,
  "Date" TEXT,
  "Name" TEXT,
  "Gos_Number" TEXT,
  "Tank_Name" TEXT,
  "Counter_Before" DOUBLE PRECISION,
  "Counter_After" DOUBLE PRECISION,
  "Density" DOUBLE PRECISION,
  "Temperature" DOUBLE PRECISION,
  "Volume" DOUBLE PRECISION,
  "Mass" DOUBLE PRECISION,
  "Timestamp" BIGINT
);

CREATE TABLE IF NOT EXISTS "Fuel_Dispensing_TZA" (
  id SERIAL PRIMARY KEY,
  "Workday_ID" INTEGER,
  "Date" TEXT,
  "Name" TEXT,
  "TZA" TEXT,
  "Tank_Name" TEXT,
  "Counter_Before" DOUBLE PRECISION,
  "Counter_After" DOUBLE PRECISION,
  "Density" DOUBLE PRECISION,
  "Volume" DOUBLE PRECISION,
  "Mass" DOUBLE PRECISION,
  "Timestamp" BIGINT
);

CREATE TABLE IF NOT EXISTS "Fuel_Dispensing_VS" (
  id SERIAL PRIMARY KEY,
  "Workday_ID" INTEGER,
  "Date" TEXT,
  "Name" TEXT,
  "TZA" TEXT,
  "Control_Number" TEXT,
  "Passport_Number" TEXT,
  "Passport_Date" TEXT,
  "Counter_Before" DOUBLE PRECISION,
  "Counter_After" DOUBLE PRECISION,
  "Density" DOUBLE PRECISION,
  "Volume" DOUBLE PRECISION,
  "Mass" DOUBLE PRECISION,
  "Timestamp" BIGINT
);

CREATE TABLE IF NOT EXISTS "Trains" (
  id SERIAL PRIMARY KEY,
  "Workday_ID" INTEGER,
  "Date" TEXT,
  "Name" TEXT,
  "Number" TEXT,
  "Type" TEXT,
  "Level_1" DOUBLE PRECISION,
  "Level_2" DOUBLE PRECISION,
  "Level_3" DOUBLE PRECISION,
  "Average_Level" DOUBLE PRECISION,
  "Density" DOUBLE PRECISION,
  "Temperature" DOUBLE PRECISION,
  "Volume" DOUBLE PRECISION,
  "Mass" DOUBLE PRECISION,
  "Density_20" DOUBLE PRECISION,
  "Timestamp" BIGINT
);

CREATE TABLE IF NOT EXISTS "Daily_Measurements" (
  id SERIAL PRIMARY KEY,
  "Workday_ID" INTEGER,
  "Date" TEXT,
  "Name" TEXT,
  "Tank_Name" TEXT,
  "Level_1" DOUBLE PRECISION,
  "Level_2" DOUBLE PRECISION,
  "Level_3" DOUBLE PRECISION,
  "Average_Level" DOUBLE PRECISION,
  "Density" DOUBLE PRECISION,
  "Temperature" DOUBLE PRECISION,
  "Volume" DOUBLE PRECISION,
  "Mass" DOUBLE PRECISION,
  "Timestamp" BIGINT
);

CREATE TABLE IF NOT EXISTS "Monthly_Inventory" (
  id SERIAL PRIMARY KEY,
  "Date" TEXT,
  "Name" TEXT,
  "Total_Volume" DOUBLE PRECISION,
  "Total_Mass" DOUBLE PRECISION,
  "Details" TEXT
);

CREATE TABLE IF NOT EXISTS "Tanks_Directory" (
  id SERIAL PRIMARY KEY,
  "Name" TEXT UNIQUE,
  "Status" TEXT DEFAULT 'active',
  "Calibration" TEXT,
  "Category" TEXT DEFAULT 'tank'
);

CREATE TABLE IF NOT EXISTS "TZA_Directory" (
  id SERIAL PRIMARY KEY,
  "Name" TEXT UNIQUE,
  "Volume" DOUBLE PRECISION,
  "Is_Monitoring" INTEGER DEFAULT 0,
  "Current_Volume" DOUBLE PRECISION DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "Tech_Lines" (
  id SERIAL PRIMARY KEY,
  "Name" TEXT UNIQUE,
  "Volume" DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS "Settings" (
  "key" TEXT PRIMARY KEY,
  "value" TEXT
);

CREATE TABLE IF NOT EXISTS "In_warehouse" (
  id SERIAL PRIMARY KEY,
  "Workday_ID" INTEGER,
  "Date" TEXT,
  "Name" TEXT,
  "From_Tank" TEXT,
  "To_Tank" TEXT,
  "Counter_Before" DOUBLE PRECISION,
  "Counter_After" DOUBLE PRECISION,
  "Density" DOUBLE PRECISION,
  "Temperature" DOUBLE PRECISION,
  "Volume" DOUBLE PRECISION,
  "Mass" DOUBLE PRECISION,
  "Timestamp" BIGINT
);

-- Function used by DELETE /api/database/clear-operations
-- Clears all operational tables and resets their auto-increment sequences
CREATE OR REPLACE FUNCTION clear_operations() RETURNS void AS $$
BEGIN
  TRUNCATE TABLE
    "Fuel_Reception",
    "Fuel_Reception_Auto",
    "Fuel_Dispensing_TZA",
    "Fuel_Dispensing_VS",
    "Daily_Measurements",
    "In_warehouse",
    "Trains"
  RESTART IDENTITY;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
