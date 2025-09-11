import { sql } from "../config/db.js";

// Get financial summary by day, week, month, year using transaction_date
export async function getFinancialSummary(req, res) {
    try {
        const id  = req.userId;  
        const { period = 'all' } = req.query; // 'day', 'week', 'month', 'year', 'all'

        let dateFilter = '';

        // Build date filter based on period using transaction_date
        switch (period) {
            case 'day':
                dateFilter = 'AND transaction_date >= CURRENT_DATE - INTERVAL \'1 day\'';
                break;
            case 'week':
                dateFilter = 'AND transaction_date >= CURRENT_DATE - INTERVAL \'7 days\'';
                break;
            case 'month':
                dateFilter = 'AND transaction_date >= CURRENT_DATE - INTERVAL \'1 month\'';
                break;
            case 'year':
                dateFilter = 'AND transaction_date >= CURRENT_DATE - INTERVAL \'1 year\'';
                break;
            case 'all':
            default:
               
                break;
        }

        // Get income (credit transactions)
        const incomeQuery = await sql`
            SELECT COALESCE(SUM(amount), 0) as total_income
            FROM user_transactions
            WHERE user_id = ${id} AND type = 'credit' ${sql.unsafe(dateFilter)}
        `;

        // Get expenses (debit transactions)
        const expensesQuery = await sql`
            SELECT COALESCE(SUM(amount), 0) as total_expenses
            FROM user_transactions
            WHERE user_id = ${id} AND type = 'debit' ${sql.unsafe(dateFilter)}
        `;

        const totalIncome = incomeQuery[0]?.total_income || 0;
        const totalExpenses = expensesQuery[0]?.total_expenses || 0;
        const balance = totalIncome - totalExpenses;

        const result = {
            period: period,
            income: parseFloat(totalIncome),
            expenses: parseFloat(totalExpenses),
            balance: parseFloat(balance),
            transaction_count: {
                income: await sql`
                    SELECT COUNT(*) as count
                    FROM user_transactions
                    WHERE user_id = ${id} AND type = 'credit' ${sql.unsafe(dateFilter)}
                `.then(result => result[0]?.count || 0),
                expenses: await sql`
                    SELECT COUNT(*) as count
                    FROM user_transactions
                    WHERE user_id = ${id} AND type = 'debit' ${sql.unsafe(dateFilter)}
                `.then(result => result[0]?.count || 0)
            }
        };

        res.json(result);
    } catch (error) {
        console.error("Error fetching financial summary", error);
        res.status(500).json({ error: "Failed to fetch financial summary" });
    }
}

// Get detailed financial breakdown by day, week, month, year using transaction_date
export  async function getFinancialBreakdown(req, res) {
    try {
        const id = req.userId;
        const { groupBy = 'month' } = req.query; // 'day', 'week', 'month', 'year'

        let incomeBreakdown, expensesBreakdown;

        // Handle different grouping strategies
        if (groupBy === 'day') {
            // Get income breakdown by day
            incomeBreakdown = await sql`
                SELECT
                    EXTRACT(YEAR FROM transaction_date) as year,
                    EXTRACT(MONTH FROM transaction_date) as month,
                    EXTRACT(DAY FROM transaction_date) as day,
                    TO_CHAR(transaction_date, 'YYYY-MM-DD') as period,
                    SUM(amount) as income,
                    COUNT(*) as transaction_count
                FROM user_transactions
                WHERE user_id = ${id} AND type = 'credit'
                GROUP BY transaction_date
                ORDER BY transaction_date DESC
            `;

            // Get expenses breakdown by day
            expensesBreakdown = await sql`
                SELECT
                    EXTRACT(YEAR FROM transaction_date) as year,
                    EXTRACT(MONTH FROM transaction_date) as month,
                    EXTRACT(DAY FROM transaction_date) as day,
                    TO_CHAR(transaction_date, 'YYYY-MM-DD') as period,
                    SUM(amount) as expenses,
                    COUNT(*) as transaction_count
                FROM user_transactions
                WHERE user_id = ${id} AND type = 'debit'
                GROUP BY transaction_date
                ORDER BY transaction_date DESC
            `;
        } else if (groupBy === 'week') {
            // Get income breakdown by week
            incomeBreakdown = await sql`
                SELECT
                    EXTRACT(YEAR FROM transaction_date) as year,
                    EXTRACT(WEEK FROM transaction_date) as week,
                    CONCAT(EXTRACT(YEAR FROM transaction_date), '-W', LPAD(EXTRACT(WEEK FROM transaction_date)::text, 2, '0')) as period,
                    SUM(amount) as income,
                    COUNT(*) as transaction_count
                FROM user_transactions
                WHERE user_id = ${id} AND type = 'credit'
                GROUP BY EXTRACT(YEAR FROM transaction_date), EXTRACT(WEEK FROM transaction_date)
                ORDER BY year DESC, week DESC
            `;

            // Get expenses breakdown by week
            expensesBreakdown = await sql`
                SELECT
                    EXTRACT(YEAR FROM transaction_date) as year,
                    EXTRACT(WEEK FROM transaction_date) as week,
                    CONCAT(EXTRACT(YEAR FROM transaction_date), '-W', LPAD(EXTRACT(WEEK FROM transaction_date)::text, 2, '0')) as period,
                    SUM(amount) as expenses,
                    COUNT(*) as transaction_count
                FROM user_transactions
                WHERE user_id = ${id} AND type = 'debit'
                GROUP BY EXTRACT(YEAR FROM transaction_date), EXTRACT(WEEK FROM transaction_date)
                ORDER BY year DESC, week DESC
            `;
        } else if (groupBy === 'month') {
            // Get income breakdown by month
            incomeBreakdown = await sql`
                SELECT
                    EXTRACT(YEAR FROM transaction_date) as year,
                    EXTRACT(MONTH FROM transaction_date) as month,
                    CONCAT(EXTRACT(YEAR FROM transaction_date), '-', LPAD(EXTRACT(MONTH FROM transaction_date)::text, 2, '0')) as period,
                    SUM(amount) as income,
                    COUNT(*) as transaction_count
                FROM user_transactions
                WHERE user_id = ${id} AND type = 'credit'
                GROUP BY EXTRACT(YEAR FROM transaction_date), EXTRACT(MONTH FROM transaction_date)
                ORDER BY year DESC, month DESC
            `;

            // Get expenses breakdown by month
            expensesBreakdown = await sql`
                SELECT
                    EXTRACT(YEAR FROM transaction_date) as year,
                    EXTRACT(MONTH FROM transaction_date) as month,
                    CONCAT(EXTRACT(YEAR FROM transaction_date), '-', LPAD(EXTRACT(MONTH FROM transaction_date)::text, 2, '0')) as period,
                    SUM(amount) as expenses,
                    COUNT(*) as transaction_count
                FROM user_transactions
                WHERE user_id = ${id} AND type = 'debit'
                GROUP BY EXTRACT(YEAR FROM transaction_date), EXTRACT(MONTH FROM transaction_date)
                ORDER BY year DESC, month DESC
            `;
        } else if (groupBy === 'year') {
            // Get income breakdown by year
            incomeBreakdown = await sql`
                SELECT
                    EXTRACT(YEAR FROM transaction_date) as year,
                    EXTRACT(YEAR FROM transaction_date)::text as period,
                    SUM(amount) as income,
                    COUNT(*) as transaction_count
                FROM user_transactions
                WHERE user_id = ${id} AND type = 'credit'
                GROUP BY EXTRACT(YEAR FROM transaction_date)
                ORDER BY year DESC
            `;

            // Get expenses breakdown by year
            expensesBreakdown = await sql`
                SELECT
                    EXTRACT(YEAR FROM transaction_date) as year,
                    EXTRACT(YEAR FROM transaction_date)::text as period,
                    SUM(amount) as expenses,
                    COUNT(*) as transaction_count
                FROM user_transactions
                WHERE user_id = ${id} AND type = 'debit'
                GROUP BY EXTRACT(YEAR FROM transaction_date)
                ORDER BY year DESC
            `;
        }
        // Combine and calculate balance for each period
        const allPeriods = new Set([
            ...incomeBreakdown.map(item => item.period),
            ...expensesBreakdown.map(item => item.period)
        ]);

        const breakdown = Array.from(allPeriods).map(period => {
            const income = incomeBreakdown.find(item => item.period === period);
            const expenses = expensesBreakdown.find(item => item.period === period);
            
            return {
                period: period,
                income: parseFloat(income?.income || 0),
                expenses: parseFloat(expenses?.expenses || 0),
                balance: parseFloat((income?.income || 0) - (expenses?.expenses || 0)),
                transaction_count: {
                    income: parseInt(income?.transaction_count || 0),
                    expenses: parseInt(expenses?.transaction_count || 0),
                    total: parseInt(income?.transaction_count || 0) + parseInt(expenses?.transaction_count || 0)
                }
            };
        }).sort((a, b) => b.period.localeCompare(a.period));

        res.json({
            group_by: groupBy,
            summary: {
                total_income: breakdown.reduce((sum, item) => sum + parseFloat(item.income || 0), 0),
                total_expenses: breakdown.reduce((sum, item) => sum + parseFloat(item.expenses || 0), 0),
                total_balance: breakdown.reduce((sum, item) => sum + parseFloat(item.balance || 0), 0),
                total_transactions: breakdown.reduce((sum, item) => sum + parseInt(item.transaction_count.total || 0), 0)
            },
            breakdown: breakdown
        });
    } catch (error) {
        console.error("Error fetching financial breakdown", error);
        res.status(500).json({ error: "Failed to fetch financial breakdown" });
    }
}   