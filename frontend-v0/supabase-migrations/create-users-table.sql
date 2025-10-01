-- Create users table for user management
-- This table stores system users for authentication and authorization

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create index on role for filtering
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Insert default admin user (gustavo.canuto@ciaramaquinas.com.br)
-- Password: ciara123@
-- Password hash generated with bcrypt (10 rounds)
INSERT INTO users (id, email, name, password_hash, role)
VALUES (
  1,
  'gustavo.canuto@ciaramaquinas.com.br',
  'Gustavo Canuto',
  '$2b$10$2shIPK5DUiVUeF4y0y8o6ezsKeY7FZTClbdCv16/59xmO1nMn6Bve',
  'admin'
)
ON CONFLICT (id) DO NOTHING;

-- Update sequence to start from 2 (after the admin user)
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- Add comment to table
COMMENT ON TABLE users IS 'System users table for authentication and authorization';
COMMENT ON COLUMN users.email IS 'User email address (unique)';
COMMENT ON COLUMN users.name IS 'User full name';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password';
COMMENT ON COLUMN users.role IS 'User role: user or admin';
