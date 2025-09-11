import { neon } from "@neondatabase/serverless";
import "dotenv/config";

export const sql= neon( process.env.DATABASE_URL);
export async function initDB() {
    try {
        // Create 'users' table if it doesn't exist
        await sql`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL
            )
        `;

        // Create 'user_transactions' table if it doesn't exist
        await sql`
            CREATE TABLE IF NOT EXISTS user_transactions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                amount NUMERIC(12,2) NOT NULL,
                currency VARCHAR(3) NOT NULL DEFAULT 'INR',
                type VARCHAR(20) NOT NULL CHECK (type IN ('debit','credit')),
                status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','failed')),
                category VARCHAR(64),
                tags TEXT[] NOT NULL DEFAULT '{}'::text[],
                merchant VARCHAR(128),
                reference VARCHAR(64),
                transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `;

        // Create indexes for performance optimization
        await sql`CREATE INDEX IF NOT EXISTS idx_user_transactions_user_id_created_at ON user_transactions(user_id, created_at)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_user_transactions_user_id_transaction_date ON user_transactions(user_id, transaction_date)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_user_transactions_category ON user_transactions(category)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_user_transactions_tags_gin ON user_transactions USING GIN (tags)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_user_transactions_merchant ON user_transactions(merchant)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_user_transactions_reference ON user_transactions(reference)`;

        console.log("Tables ensured successfully");
    } catch (error) {
        console.error("Error connecting to the database", error);
        process.exit(1); // Exit process if DB init fails
    }
}
