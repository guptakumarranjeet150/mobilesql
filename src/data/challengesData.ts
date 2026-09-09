import type { SkillLevel } from '../types';

export interface ChallengeTestCase {
  id: string;
  name: string;
  description: string;
  expectedRowCount: number;
  expectedFirstRow: Record<string, any>;
}

export interface SQLChallenge {
  id: string;
  title: string;
  slug: string;
  difficulty: SkillLevel;
  category: 'Aggregation' | 'Joins' | 'Window Functions' | 'CTEs' | 'Data Cleaning' | 'Optimization' | 'FAANG Interview';
  companyTags: string[];
  passRatePercentage: number;
  pointsReward: number;
  estimatedTimeMins: number;
  databaseId: string;
  descriptionMarkdown: string;
  initialSql: string;
  solutionSql: string;
  testCases: ChallengeTestCase[];
  hints: string[];
  interviewTip: string;
}

export const SQL_CHALLENGES: SQLChallenge[] = [
  {
    id: 'ch_01',
    title: 'Top 3 Revenue Customers Per Country',
    slug: 'top-3-revenue-customers-per-country',
    difficulty: 'Intermediate',
    category: 'Window Functions',
    companyTags: ['Amazon', 'Stripe', 'Meta'],
    passRatePercentage: 42,
    pointsReward: 120,
    estimatedTimeMins: 15,
    databaseId: 'ecommerce_prod',
    descriptionMarkdown: `### Top 3 Revenue Customers Per Country

You are given a \`customers\` table and an \`orders\` table. 

Write a SQL query to identify the **top 3 customers by total spending** in each country.

#### Schema Requirements:
- Calculate total order spending per customer for completed orders (\`status = 'completed'\`).
- Rank customers within each country using \`DENSE_RANK()\`.
- Output columns: \`country\`, \`customer_id\`, \`first_name\`, \`total_spent\`, \`rank\`.
- Order results by \`country\` ASC, \`rank\` ASC.`,
    initialSql: `-- Write your SQL query below
SELECT 
  c.country,
  c.id AS customer_id,
  c.first_name,
  SUM(o.total_amount) AS total_spent
FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE o.status = 'completed'
GROUP BY c.country, c.id, c.first_name;`,
    solutionSql: `WITH customer_spend AS (
  SELECT 
    c.country,
    c.id AS customer_id,
    c.first_name,
    SUM(o.total_amount) AS total_spent,
    DENSE_RANK() OVER (PARTITION BY c.country ORDER BY SUM(o.total_amount) DESC) AS rank
  FROM customers c
  JOIN orders o ON c.id = o.customer_id
  WHERE o.status = 'completed'
  GROUP BY c.country, c.id, c.first_name
)
SELECT country, customer_id, first_name, total_spent, rank
FROM customer_spend
WHERE rank <= 3
ORDER BY country ASC, rank ASC;`,
    testCases: [
      {
        id: 'tc_1',
        name: 'Top Spenders Ranking',
        description: 'Verify DENSE_RANK partition grouping per country',
        expectedRowCount: 3,
        expectedFirstRow: { country: 'Germany', rank: 1 },
      },
    ],
    hints: [
      'Use a Common Table Expression (CTE) to aggregate SUM(total_amount) first.',
      'Apply DENSE_RANK() OVER (PARTITION BY country ORDER BY SUM(total_amount) DESC).',
      'Filter WHERE rank <= 3 in the outer query.',
    ],
    interviewTip: 'When ranking records in interviews, explain why you chose DENSE_RANK() vs RANK() vs ROW_NUMBER() based on handling tie values.',
  },
  {
    id: 'ch_02',
    title: 'Department Highest & Lowest Paid Salary Ratio',
    slug: 'department-highest-lowest-salary-ratio',
    difficulty: 'Advanced',
    category: 'Aggregation',
    companyTags: ['Google', 'Netflix', 'Microsoft'],
    passRatePercentage: 35,
    pointsReward: 150,
    estimatedTimeMins: 20,
    databaseId: 'hr_payroll',
    descriptionMarkdown: `### Department Salary Disparity Analysis

Analyze payroll disparity across departments.

Write a query to calculate:
1. \`department_name\`
2. Highest employee salary (\`max_salary\`)
3. Lowest employee salary (\`min_salary\`)
4. Salary disparity ratio (\`max_salary / min_salary\` rounded to 2 decimal places)

#### Rules:
- Exclude departments with fewer than 2 active employees.
- Order output by salary disparity ratio DESC.`,
    initialSql: `-- Calculate salary disparity ratio per department
SELECT 
  d.name AS department_name,
  MAX(e.salary) AS max_salary,
  MIN(e.salary) AS min_salary
FROM employees e
JOIN departments d ON e.department_id = d.id
GROUP BY d.name;`,
    solutionSql: `SELECT 
  d.name AS department_name,
  MAX(e.salary) AS max_salary,
  MIN(e.salary) AS min_salary,
  ROUND(CAST(MAX(e.salary) AS DECIMAL) / NULLIF(MIN(e.salary), 0), 2) AS disparity_ratio
FROM employees e
JOIN departments d ON e.department_id = d.id
WHERE e.is_active = true
GROUP BY d.name
HAVING COUNT(e.id) >= 2
ORDER BY disparity_ratio DESC;`,
    testCases: [
      {
        id: 'tc_2',
        name: 'Salary Disparity Output',
        description: 'Verify HAVING COUNT >= 2 filter and ROUND calculation',
        expectedRowCount: 2,
        expectedFirstRow: { department_name: 'Engineering' },
      },
    ],
    hints: [
      'Use NULLIF(MIN(e.salary), 0) to avoid division-by-zero runtime exceptions.',
      'Filter group counts with HAVING COUNT(e.id) >= 2.',
    ],
    interviewTip: 'Always safeguard division in production SQL with NULLIF or CASE WHEN to prevent division-by-zero crashes.',
  },
  {
    id: 'ch_03',
    title: 'Monthly Recurring Revenue (MRR) Churn Analysis',
    slug: 'monthly-recurring-revenue-mrr-churn',
    difficulty: 'Pro Architect',
    category: 'CTEs',
    companyTags: ['Stripe', 'Airbnb', 'Uber'],
    passRatePercentage: 28,
    pointsReward: 200,
    estimatedTimeMins: 25,
    databaseId: 'saas_crm',
    descriptionMarkdown: `### SaaS MRR Churn Rate Tracker

Calculate month-over-month MRR churn for active subscription plans.

#### Required Output Columns:
- \`month\`: YYYY-MM formatted date
- \`total_mrr\`: Sum of active plan amounts
- \`churned_mrr\`: Sum of cancelled subscriptions in that month
- \`churn_rate_pct\`: \`(churned_mrr / total_mrr) * 100\` rounded to 2 decimals.`,
    initialSql: `-- Write your SQL for SaaS MRR churn calculation
SELECT * FROM subscriptions LIMIT 10;`,
    solutionSql: `WITH monthly_summary AS (
  SELECT 
    DATE_TRUNC('month', start_date) AS month,
    SUM(mrr_amount) AS total_mrr,
    SUM(CASE WHEN status = 'cancelled' THEN mrr_amount ELSE 0 END) AS churned_mrr
  FROM subscriptions
  GROUP BY DATE_TRUNC('month', start_date)
)
SELECT 
  TO_CHAR(month, 'YYYY-MM') AS month,
  total_mrr,
  churned_mrr,
  ROUND(CAST(churned_mrr AS DECIMAL) * 100 / NULLIF(total_mrr, 0), 2) AS churn_rate_pct
FROM monthly_summary
ORDER BY month ASC;`,
    testCases: [
      {
        id: 'tc_3',
        name: 'MRR Metrics',
        description: 'Check month aggregation and percentage calculation',
        expectedRowCount: 3,
        expectedFirstRow: { month: '2024-01' },
      },
    ],
    hints: [
      'Use DATE_TRUNC(\'month\', start_date) for monthly grouping.',
      'Use conditional aggregation with SUM(CASE WHEN status = \'cancelled\' THEN mrr_amount ELSE 0 END).',
    ],
    interviewTip: 'Conditional aggregation with SUM(CASE...) is one of the most tested techniques in FinTech and SaaS analytics interviews.',
  },
  {
    id: 'ch_04',
    title: 'Stellar Top Payment Volume Assets',
    slug: 'stellar-top-payment-volume-assets',
    difficulty: 'Intermediate',
    category: 'Aggregation',
    companyTags: ['Stellar', 'FinTech', 'Web3'],
    passRatePercentage: 48,
    pointsReward: 130,
    estimatedTimeMins: 15,
    databaseId: 'stellar_network',
    descriptionMarkdown: `### Stellar Top Payment Volume Assets

Analyze payment volume across different Stellar assets in the network ledger history.

Write a query to calculate:
- \`asset_code\`: The Stellar asset symbol
- \`payment_count\`: Number of payments executed with this asset
- \`total_volume\`: Total amount transferred

#### Requirements:
- Aggregate from \`stellar_payments\`.
- Order by \`total_volume\` DESC, \`asset_code\` ASC.`,
    initialSql: `-- Write your SQL for Stellar asset payment volume
SELECT * FROM stellar_payments LIMIT 5;`,
    solutionSql: `SELECT 
  asset_code,
  COUNT(*) AS payment_count,
  SUM(amount) AS total_volume
FROM stellar_payments
GROUP BY asset_code
ORDER BY total_volume DESC, asset_code ASC;`,
    testCases: [
      {
        id: 'tc_stellar_1',
        name: 'Asset Volume Leaderboard',
        description: 'Check aggregation and sorting by volume',
        expectedRowCount: 5,
        expectedFirstRow: { asset_code: 'AQUA' },
      },
    ],
    hints: [
      'Group by asset_code.',
      'Use SUM(amount) for total volume and COUNT(*) for count.',
      'Sort with ORDER BY total_volume DESC.',
    ],
    interviewTip: 'Blockchain analytics frequently groups ledger payments by asset to calculate decentralized volume and anchor liquidity metrics.',
  },
  {
    id: 'ch_05',
    title: 'Soroban Smart Contract Invocations & Event Frequency',
    slug: 'soroban-smart-contract-invocations-and-events',
    difficulty: 'Advanced',
    category: 'Joins',
    companyTags: ['Stellar', 'Soroban', 'Web3'],
    passRatePercentage: 39,
    pointsReward: 160,
    estimatedTimeMins: 20,
    databaseId: 'stellar_network',
    descriptionMarkdown: `### Soroban Smart Contract Activity & Events

Analyze Soroban smart contract performance and emitted runtime events.

Write a query to calculate:
- \`contract_id\`: The contract identifier
- \`contract_type\`: Functionality type (AMM, Oracle, Staking, etc.)
- \`invocation_count\`: Recorded contract invocations
- \`event_count\`: Emitted runtime events count

#### Requirements:
- Join \`soroban_contracts\` with \`soroban_events\` using a \`LEFT JOIN\` so contracts with zero events are still included.
- Group by \`contract_id\`, \`contract_type\`, and \`invocation_count\`.
- Order by \`event_count\` DESC, \`invocation_count\` DESC.`,
    initialSql: `-- Write your Soroban analysis query below
SELECT * FROM soroban_contracts LIMIT 5;`,
    solutionSql: `SELECT 
  c.contract_id,
  c.contract_type,
  c.invocation_count,
  COUNT(e.event_id) AS event_count
FROM soroban_contracts c
LEFT JOIN soroban_events e ON c.contract_id = e.contract_id
GROUP BY c.contract_id, c.contract_type, c.invocation_count
ORDER BY event_count DESC, c.invocation_count DESC;`,
    testCases: [
      {
        id: 'tc_stellar_2',
        name: 'Soroban Activity Join',
        description: 'Verify LEFT JOIN and event count calculation',
        expectedRowCount: 5,
        expectedFirstRow: { contract_id: 'CAQUA_AMM_ROUTER_V1_8X9Y7Z6A5B4C3D2E1F0G9H8J7K6L5M4N3P2Q1R0S', event_count: 5 },
      },
    ],
    hints: [
      'Use a LEFT JOIN between soroban_contracts and soroban_events on contract_id.',
      'Count the event identifier COUNT(e.event_id) rather than COUNT(*) to avoid counting null joined rows.',
      'Group by contract_id, contract_type, invocation_count.',
    ],
    interviewTip: 'When joining parent-child records in smart contract analytics, prefer COUNT(foreign_table.id) over COUNT(*) to preserve zero-event metrics accurately.',
  },
];
