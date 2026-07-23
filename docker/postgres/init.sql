-- PostgreSQL initialization script for BFN
-- This script is run automatically when the postgres container starts for the first time

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant necessary permissions to the bfn_user
GRANT ALL PRIVILEGES ON DATABASE bfn_production TO bfn_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO bfn_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO bfn_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO bfn_user;

-- Set default permissions for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO bfn_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO bfn_user;

-- Log initialization
SELECT 'BFN database initialized successfully' AS status;