-- Philippine address hierarchy (PSGC) for the cascading address dropdowns:
-- Region -> Province -> City/Municipality -> Barangay. Data: 024_address_data.sql.
-- Purok/street is free text because no official list exists below barangay.
CREATE TABLE IF NOT EXISTS address_regions (
  code VARCHAR(12) NOT NULL,
  name VARCHAR(120) NOT NULL,
  PRIMARY KEY (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Includes one pseudo-province per region for cities that belong to no province
-- (Metro Manila for NCR, "Independent cities" elsewhere), so every city has a parent.
CREATE TABLE IF NOT EXISTS address_provinces (
  code VARCHAR(12) NOT NULL,
  name VARCHAR(120) NOT NULL,
  region_code VARCHAR(12) NOT NULL,
  PRIMARY KEY (code),
  KEY address_provinces_region (region_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS address_cities (
  code VARCHAR(12) NOT NULL,
  name VARCHAR(120) NOT NULL,
  province_code VARCHAR(12) NOT NULL,
  region_code VARCHAR(12) NOT NULL,
  PRIMARY KEY (code),
  KEY address_cities_province (province_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS address_barangays (
  code VARCHAR(12) NOT NULL,
  name VARCHAR(120) NOT NULL,
  city_code VARCHAR(12) NOT NULL,
  PRIMARY KEY (code),
  KEY address_barangays_city (city_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Accounts keep the readable names in province/city/barangay/street as before,
-- plus the region name and the barangay's PSGC code.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS region VARCHAR(120) NULL AFTER street,
  ADD COLUMN IF NOT EXISTS barangay_code VARCHAR(12) NULL AFTER barangay;
ALTER TABLE pending_registrations
  ADD COLUMN IF NOT EXISTS region VARCHAR(120) NULL AFTER street,
  ADD COLUMN IF NOT EXISTS barangay_code VARCHAR(12) NULL AFTER barangay;
