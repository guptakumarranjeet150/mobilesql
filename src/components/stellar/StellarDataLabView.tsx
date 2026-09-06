import React, { useState } from 'react';
import {
  Globe,
  Database,
  Terminal,
  Play,
  Copy,
  Download,
  ExternalLink,
  Zap,
  BookOpen,
  ShieldCheck,
  Layers,
  Cpu,
  Coins,
  ArrowRight,
  Code,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { usePlaygroundStore } from '../../stores/usePlaygroundStore';
import { executePlaygroundQuery } from '../../services/sqlExecutionEngine';
import { PRACTICE_DATABASES } from '../../data/playgroundDatabases';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface QueryPreset {
  id: string;
  name: string;
  description: string;
  category: 'Ledger' | 'Payments' | 'Soroban' | 'Economics';
  sql: string;
}

const STELLAR_QUERY_PRESETS: QueryPreset[] = [
  {
    id: 'preset_asset_volume',
    name: 'Payment Volume by Stellar Asset',
    category: 'Payments',
    description: 'Calculate aggregate payment volume and transfer count per asset symbol.',
    sql: `SELECT 
  asset_code,
  COUNT(*) AS payment_count,
  SUM(amount) AS total_volume,
  ROUND(AVG(amount), 2) AS avg_transfer_size
FROM stellar_payments
GROUP BY asset_code
ORDER BY total_volume DESC;`,
  },
  {
    id: 'preset_soroban_events',
    name: 'Soroban Contracts & Event Emissions',
    category: 'Soroban',
    description: 'Join smart contracts with emitted event logs to measure on-chain activity.',
    sql: `SELECT 
  c.contract_id,
  c.contract_type,
  c.invocation_count,
  COUNT(e.event_id) AS event_count
FROM soroban_contracts c
LEFT JOIN soroban_events e ON c.contract_id = e.contract_id
GROUP BY c.contract_id, c.contract_type, c.invocation_count
ORDER BY event_count DESC, c.invocation_count DESC;`,
  },
  {
    id: 'preset_ledger_throughput',
    name: 'Ledger Sequence & Transaction Throughput',
    category: 'Ledger',
    description: 'Inspect block closing timestamps, transaction volumes, and operation counts.',
    sql: `SELECT 
  sequence,
  closed_at,
  transaction_count,
  operation_count,
  successful_transaction_count,
  failed_transaction_count
FROM stellar_ledgers
ORDER BY sequence ASC;`,
  },
  {
    id: 'preset_top_transfers',
    name: 'High-Value Payment Counterparties',
    category: 'Payments',
    description: 'Filter payments above 10,000 units with sender and recipient addresses.',
    sql: `SELECT 
  payment_id,
  source_account,
  destination_account,
  asset_code,
  amount,
  created_at
FROM stellar_payments
WHERE amount >= 10000
ORDER BY amount DESC;`,
  },
  {
    id: 'preset_soroban_topics',
    name: 'Soroban Liquidity & Swap Events',
    category: 'Soroban',
    description: 'Extract automated market maker swaps and liquidity pool activity.',
    sql: `SELECT 
  event_id,
  contract_id,
  topic,
  event_type,
  payload,
  ledger_sequence
FROM soroban_events
WHERE topic IN ('swap', 'liquidity', 'collateral')
ORDER BY ledger_sequence ASC;`,
  },
  {
    id: 'preset_tx_fees',
    name: 'Transaction Success Rates & Fee Burdens',
    category: 'Economics',
    description: 'Analyze network transaction fees in stroops categorized by execution outcome.',
    sql: `SELECT 
  successful,
  COUNT(*) AS total_transactions,
  AVG(fee_charged_stroops) AS avg_fee_stroops,
  SUM(fee_charged_stroops) AS total_fees_stroops
FROM stellar_transactions
GROUP BY successful;`,
  },
];

export const StellarDataLabView: React.FC = () => {
  const { setActiveTab, addToast } = useUIStore();
  const { createNewTab } = usePlaygroundStore();

  const stellarDb = PRACTICE_DATABASES.find((db) => db.id === 'stellar_network');
  const [activeSubTab, setActiveSubTab] = useState<'console' | 'schema' | 'soroban' | 'payments' | 'learning'>('console');
  
  const [currentSql, setCurrentSql] = useState<string>(STELLAR_QUERY_PRESETS[0].sql);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(STELLAR_QUERY_PRESETS[0].id);
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryResult, setQueryResult] = useState<{
    columns: string[];
    rows: Record<string, unknown>[];
    rowCount: number;
    executionTimeMs: number;
    error?: string;
  } | null>(null);

  const [selectedSchemaTable, setSelectedSchemaTable] = useState<string>('stellar_ledgers');

  const handleExecuteSql = async (sqlToRun?: string) => {
    const sql = sqlToRun || currentSql;
    if (!sql.trim()) return;

    setIsExecuting(true);
    try {
      const { result } = await executePlaygroundQuery(sql, 'stellar_network', 'PostgreSQL');
      setQueryResult({
        columns: result.columns,
        rows: result.rows,
        rowCount: result.rowCount,
        executionTimeMs: result.executionTimeMs,
        error: result.error,
      });

      if (result.error) {
        addToast({
          title: 'Query Error',
          message: result.error,
          type: 'error',
        });
      } else {
        addToast({
          title: 'Query Complete',
          message: `${result.rowCount} row(s) returned in ${result.executionTimeMs}ms`,
          type: 'success',
        });
      }
    } catch (err: any) {
      setQueryResult({
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
        error: err.message || 'Execution error',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleOpenInWorkspace = (sql: string) => {
    createNewTab('stellar_analytics.sql', sql, 'stellar_network');
    setActiveTab('playground');
    addToast({
      title: 'Opened in SQL Workspace',
      message: 'stellar_network database loaded into editor tab.',
      type: 'info',
    });
  };

  const handleSelectPreset = (preset: QueryPreset) => {
    setSelectedPresetId(preset.id);
    setCurrentSql(preset.sql);
    handleExecuteSql(preset.sql);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(currentSql);
    addToast({
      title: 'SQL Copied',
      message: 'Query copied to clipboard.',
      type: 'info',
    });
  };

  const handleExportCsv = () => {
    if (!queryResult || !queryResult.rows.length) return;
    const cols = queryResult.columns;
    const header = cols.join(',');
    const body = queryResult.rows
      .map((row) =>
        cols
          .map((c) => {
            const val = row[c];
            if (typeof val === 'string' && val.includes(',')) {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return String(val ?? '');
          })
          .join(',')
      )
      .join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stellar_query_results.csv';
    a.click();
    URL.revokeObjectURL(url);
    addToast({
      title: 'CSV Exported',
      message: 'Downloaded query results as CSV.',
      type: 'success',
    });
  };

  const activeTableSchema = stellarDb?.tables.find((t) => t.name === selectedSchemaTable);

  return (
    <div id="stellar-data-lab-view" className="space-y-6 font-sans text-[#FFFFFF] pb-16 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Header Banner */}
      <div
        id="stellar-lab-hero"
        className="relative overflow-hidden rounded-3xl bg-[#1B1B1E] border border-[#2D2D31] p-6 sm:p-8 shadow-2xl"
      >
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#3B82F6]/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-[#62DF7D]/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#131315] border border-[#3B82F6]/40 flex items-center justify-center text-[#3B82F6] shadow-md">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#FFFFFF]">
                    Stellar <span className="text-[#3B82F6]">Data Lab</span>
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#3B82F6]/20 text-[#3B82F6] border border-[#3B82F6]/40">
                    ECOSYSTEM LAB
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#8A8A90] mt-0.5">
                  Decentralized Ledger & Soroban Smart Contract Analytics
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                id="btn-open-in-sql-workspace"
                variant="outline"
                size="sm"
                onClick={() => handleOpenInWorkspace(currentSql)}
                className="gap-1.5 text-xs font-mono border-[#3B82F6]/40 text-[#FFFFFF] hover:border-[#3B82F6]"
              >
                <Terminal className="w-3.5 h-3.5 text-[#3B82F6]" />
                Open SQL Workspace
              </Button>
              <Button
                id="btn-go-to-challenges"
                variant="primary"
                size="sm"
                onClick={() => setActiveTab('challenges')}
                className="gap-1.5 text-xs font-mono"
              >
                <Zap className="w-3.5 h-3.5" />
                Solve Challenges
              </Button>
            </div>
          </div>

          {/* Educational Disclaimer */}
          <div
            id="stellar-lab-disclaimer"
            className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#131315] border border-[#2D2D31] text-xs text-[#C8C8CC] leading-relaxed"
          >
            <ShieldCheck className="w-5 h-5 text-[#62DF7D] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-[#FFFFFF]">Synthetic Educational Ledger Architecture:</span>
              <p className="text-[#8A8A90]">
                This dataset models the authentic schema of the Stellar network (SCP protocol v20), cross-border
                payment trustlines, anchor assets, and Soroban WebAssembly smart contract execution logs. All records
                run client-side and server-side in-memory for zero-latency educational exploration.
              </p>
            </div>
          </div>

          {/* Live Ecosystem Summary Stats */}
          <div id="stellar-lab-metrics" className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-2">
            {[
              { label: 'Ledgers', value: '8 Closed', icon: Database, color: 'text-[#3B82F6]' },
              { label: 'Accounts', value: '8 Entities', icon: Layers, color: 'text-[#62DF7D]' },
              { label: 'Assets', value: '5 Currencies', icon: Coins, color: 'text-[#F59E0B]' },
              { label: 'Payments', value: '16 Transfers', icon: ArrowRight, color: 'text-[#8B5CF6]' },
              { label: 'Transactions', value: '16 Bundles', icon: Cpu, color: 'text-[#EC4899]' },
              { label: 'Contracts', value: '5 Soroban', icon: Code, color: 'text-[#06B6D4]' },
              { label: 'Events', value: '14 Emitted', icon: Sparkles, color: 'text-[#10B981]' },
            ].map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-[#131315]/80 border border-[#2D2D31] flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-[#8A8A90]">{stat.label}</span>
                    <Icon className={`w-3.5 h-3.5 ${stat.color}`} />
                  </div>
                  <span className="text-xs font-bold text-[#FFFFFF] font-mono mt-1">{stat.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div
        id="stellar-lab-subtabs"
        className="bg-[#1B1B1E] border border-[#2D2D31] rounded-2xl p-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar shadow-lg font-mono text-xs"
      >
        {[
          { id: 'console', label: 'Interactive SQL Console', icon: Terminal },
          { id: 'schema', label: 'Schema & Table Explorer (8)', icon: Layers },
          { id: 'soroban', label: 'Soroban Smart Contracts', icon: Code },
          { id: 'payments', label: 'Cross-Border Payments', icon: Coins },
          { id: 'learning', label: 'Curriculum & Challenges', icon: BookOpen },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-btn-${tab.id}`}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap text-[11px] ${
                isActive
                  ? 'bg-[#3B82F6] text-[#FFFFFF] shadow-md'
                  : 'text-[#8A8A90] hover:text-[#FFFFFF] hover:bg-[#131315]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: INTERACTIVE SQL CONSOLE */}
      {activeSubTab === 'console' && (
        <div id="stellar-lab-console-tab" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Preset Queries Sidebar */}
          <div className="space-y-4 lg:col-span-1">
            <div className="p-4 rounded-2xl bg-[#1B1B1E] border border-[#2D2D31] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#FFFFFF] uppercase tracking-wider font-mono">
                  Ecosystem Query Presets
                </h3>
                <span className="text-[10px] font-mono text-[#3B82F6]">{STELLAR_QUERY_PRESETS.length} ready</span>
              </div>
              <p className="text-[11px] text-[#8A8A90] leading-relaxed">
                Click any pre-crafted analytical query to populate the editor and run it instantly.
              </p>

              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {STELLAR_QUERY_PRESETS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      id={`preset-btn-${preset.id}`}
                      onClick={() => handleSelectPreset(preset)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-[#131315] border-[#3B82F6] text-[#FFFFFF] shadow-sm'
                          : 'bg-[#131315]/50 border-[#2D2D31] text-[#C8C8CC] hover:border-[#3F3F46]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold truncate text-[#FFFFFF]">{preset.name}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#2D2D31] text-[#8A8A90]">
                          {preset.category}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#8A8A90] line-clamp-2 mt-1">{preset.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Editor & Results Console */}
          <div className="space-y-4 lg:col-span-2">
            {/* SQL Editor Box */}
            <div className="rounded-2xl bg-[#1B1B1E] border border-[#2D2D31] overflow-hidden shadow-xl">
              <div className="bg-[#131315] px-4 py-2.5 border-b border-[#2D2D31] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#EF4444]/60" />
                  <div className="w-3 h-3 rounded-full bg-[#F59E0B]/60" />
                  <div className="w-3 h-3 rounded-full bg-[#62DF7D]/60" />
                  <span className="text-xs font-mono text-[#8A8A90] ml-2">stellar_network.sql</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleCopySql}
                    className="p-1.5 rounded-lg bg-[#1B1B1E] hover:bg-[#2D2D31] text-[#8A8A90] hover:text-[#FFFFFF] transition-colors"
                    title="Copy SQL"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <Button
                    id="btn-run-stellar-sql"
                    variant="primary"
                    size="sm"
                    disabled={isExecuting}
                    onClick={() => handleExecuteSql()}
                    className="gap-1.5 text-xs font-mono"
                  >
                    {isExecuting ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        Run Query
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="p-3">
                <textarea
                  id="stellar-sql-textarea"
                  value={currentSql}
                  onChange={(e) => setCurrentSql(e.target.value)}
                  rows={6}
                  className="w-full bg-[#131315] text-[#62DF7D] font-mono text-xs p-3 rounded-xl border border-[#2D2D31] focus:outline-none focus:border-[#3B82F6] resize-y leading-relaxed"
                  placeholder="Type any SQL query to execute against the stellar_network database..."
                />
              </div>
            </div>

            {/* Results Table Panel */}
            <div className="rounded-2xl bg-[#1B1B1E] border border-[#2D2D31] overflow-hidden shadow-xl">
              <div className="bg-[#131315] px-4 py-2.5 border-b border-[#2D2D31] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold font-mono text-[#FFFFFF]">Query Output</h4>
                  {queryResult && !queryResult.error && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#62DF7D]/10 text-[#62DF7D] border border-[#62DF7D]/30">
                      {queryResult.rowCount} rows in {queryResult.executionTimeMs}ms
                    </span>
                  )}
                </div>

                {queryResult && queryResult.rows.length > 0 && (
                  <button
                    onClick={handleExportCsv}
                    className="flex items-center gap-1 text-[11px] font-mono text-[#3B82F6] hover:underline"
                  >
                    <Download className="w-3 h-3" />
                    Export CSV
                  </button>
                )}
              </div>

              <div className="p-4">
                {queryResult?.error ? (
                  <div className="p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-xs text-[#EF4444] font-mono flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{queryResult.error}</span>
                  </div>
                ) : queryResult?.rows ? (
                  queryResult.rows.length === 0 ? (
                    <div className="text-center py-8 text-xs text-[#8A8A90] font-mono">
                      Query executed successfully with 0 rows returned.
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="sticky top-0 bg-[#131315] border-b border-[#2D2D31] text-[#8A8A90]">
                          <tr>
                            {queryResult.columns.map((col) => (
                              <th key={col} className="p-2.5 font-bold">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2D2D31]/50 text-[#C8C8CC]">
                          {queryResult.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-[#131315]/40 transition-colors">
                              {queryResult.columns.map((col) => {
                                const val = row[col];
                                const isNull = val === null || val === undefined;
                                return (
                                  <td key={col} className="p-2.5 truncate max-w-[200px]">
                                    {isNull ? (
                                      <span className="text-[#8A8A90] italic">NULL</span>
                                    ) : typeof val === 'boolean' ? (
                                      <span className={val ? 'text-[#62DF7D]' : 'text-[#EF4444]'}>
                                        {String(val)}
                                      </span>
                                    ) : (
                                      String(val)
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : (
                  <div className="text-center py-10 text-xs text-[#8A8A90] font-mono space-y-2">
                    <Terminal className="w-8 h-8 mx-auto text-[#2D2D31]" />
                    <p>Click "Run Query" above or select a preset to execute analytical SQL on Stellar.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SCHEMA EXPLORER */}
      {activeSubTab === 'schema' && (
        <div id="stellar-lab-schema-tab" className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Table List */}
          <div className="lg:col-span-1 space-y-2">
            <h3 className="text-xs font-bold text-[#FFFFFF] uppercase tracking-wider font-mono px-1">
              Stellar Network Tables
            </h3>
            <div className="space-y-1">
              {stellarDb?.tables.map((table) => {
                const isSelected = selectedSchemaTable === table.name;
                return (
                  <button
                    key={table.name}
                    id={`table-select-${table.name}`}
                    onClick={() => setSelectedSchemaTable(table.name)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-mono transition-all ${
                      isSelected
                        ? 'bg-[#1B1B1E] border-[#3B82F6] text-[#3B82F6] font-bold shadow-sm'
                        : 'bg-[#131315] border-[#2D2D31] text-[#C8C8CC] hover:bg-[#1B1B1E]'
                    }`}
                  >
                    <span className="truncate">{table.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#2D2D31] text-[#8A8A90]">
                      {table.rowCount} rows
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table Detail View */}
          <div className="lg:col-span-3 space-y-4">
            {activeTableSchema && (
              <div className="p-6 rounded-2xl bg-[#1B1B1E] border border-[#2D2D31] space-y-4 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2D2D31] pb-4">
                  <div>
                    <h3 className="text-base font-bold font-mono text-[#FFFFFF] flex items-center gap-2">
                      <Database className="w-4 h-4 text-[#3B82F6]" />
                      {activeTableSchema.name}
                    </h3>
                    <p className="text-xs text-[#8A8A90] mt-0.5 font-mono">
                      {activeTableSchema.columns.length} columns • {activeTableSchema.rowCount} records populated
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const quickSql = `SELECT * FROM ${activeTableSchema.name} LIMIT 10;`;
                      setCurrentSql(quickSql);
                      setActiveSubTab('console');
                      handleExecuteSql(quickSql);
                    }}
                    className="text-xs font-mono gap-1"
                  >
                    <Play className="w-3 h-3 text-[#62DF7D]" />
                    SELECT * FROM table
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#131315] text-[#8A8A90] border-b border-[#2D2D31]">
                      <tr>
                        <th className="p-3">Column Name</th>
                        <th className="p-3">Data Type</th>
                        <th className="p-3">Keys / Constraints</th>
                        <th className="p-3">Nullable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2D2D31]/60 text-[#C8C8CC]">
                      {activeTableSchema.columns.map((col) => (
                        <tr key={col.name} className="hover:bg-[#131315]/30">
                          <td className="p-3 font-bold text-[#FFFFFF]">{col.name}</td>
                          <td className="p-3 text-[#3B82F6]">{col.type}</td>
                          <td className="p-3">
                            {col.isPrimaryKey && (
                              <span className="px-2 py-0.5 rounded bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30 font-bold mr-1">
                                PRIMARY KEY
                              </span>
                            )}
                            {col.isForeignKey && (
                              <span className="px-2 py-0.5 rounded bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/30">
                                FK {col.references ? `-> ${col.references}` : ''}
                              </span>
                            )}
                            {!col.isPrimaryKey && !col.isForeignKey && <span className="text-[#8A8A90]">—</span>}
                          </td>
                          <td className="p-3">
                            {col.nullable ? (
                              <span className="text-[#8A8A90]">YES</span>
                            ) : (
                              <span className="text-[#62DF7D] font-bold">NO</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SOROBAN SMART CONTRACTS */}
      {activeSubTab === 'soroban' && (
        <div id="stellar-lab-soroban-tab" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-[#1B1B1E] border border-[#2D2D31] space-y-1">
              <span className="text-[10px] font-mono text-[#8A8A90]">Soroban Contracts</span>
              <p className="text-xl font-extrabold font-mono text-[#FFFFFF]">5 Deployed</p>
              <p className="text-xs text-[#8A8A90]">AMM, Oracles, Yield & Escrow</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#1B1B1E] border border-[#2D2D31] space-y-1">
              <span className="text-[10px] font-mono text-[#8A8A90]">Total Invocations</span>
              <p className="text-xl font-extrabold font-mono text-[#62DF7D]">7,840 Calls</p>
              <p className="text-xs text-[#8A8A90]">Average 1,568 calls per contract</p>
            </div>
            <div className="p-4 rounded-2xl bg-[#1B1B1E] border border-[#2D2D31] space-y-1">
              <span className="text-[10px] font-mono text-[#8A8A90]">Event Diagnostics</span>
              <p className="text-xl font-extrabold font-mono text-[#3B82F6]">14 Structured Logs</p>
              <p className="text-xs text-[#8A8A90]">Swaps, price updates, distributions</p>
            </div>
          </div>

          {/* Soroban Contract Cards */}
          <div className="p-6 rounded-2xl bg-[#1B1B1E] border border-[#2D2D31] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2D2D31] pb-3">
              <div>
                <h3 className="text-sm font-bold font-mono text-[#FFFFFF]">Registered Soroban Contracts</h3>
                <p className="text-xs text-[#8A8A90]">Rust-based WebAssembly contracts running on Stellar</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const sql = `SELECT * FROM soroban_contracts ORDER BY invocation_count DESC;`;
                  setCurrentSql(sql);
                  setActiveSubTab('console');
                  handleExecuteSql(sql);
                }}
                className="text-xs font-mono gap-1.5"
              >
                <Code className="w-3.5 h-3.5 text-[#3B82F6]" />
                Inspect in SQL Console
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  id: 'CAQUA_AMM_ROUTER_V1_8X9Y7Z6A5B4C3D2E1F0G9H8J7K6L5M4N3P2Q1R0S',
                  type: 'Automated Market Maker',
                  wasm: 'd41d8cd98f00b204e9800998ecf8427e',
                  invocations: 3240,
                  desc: 'Constant-product liquidity pool router for XLM, USDC, and AQUA asset swaps.',
                },
                {
                  id: 'CORACLE_BAND_FEED_V2_1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P7Q8R9S0T',
                  type: 'Decentralized Oracle',
                  wasm: 'e2fc714c4727ee9395f324cd2e7f331f',
                  invocations: 1890,
                  desc: 'Multi-signature price attestations for XLM/USD and EURC/USD feeds.',
                },
                {
                  id: 'CLEND_VAULT_POOL_V1_9Z8Y7X6W5V4U3T2S1R0Q9P8O7N6M5L4K3J2I1H0G',
                  type: 'Lending & Borrowing',
                  wasm: '1f82f2759e66d49cb0a95ffb5239a066',
                  invocations: 1420,
                  desc: 'Collateralized borrow vaults supporting USDC and yield-bearing yUSDC.',
                },
                {
                  id: 'CSTAKE_LIQUID_REWARDS_3M4N5O6P7Q8R9S0T1U2V3W4X5Y6Z7A8B9C0D1E2F',
                  type: 'Liquid Staking Pool',
                  wasm: 'c4ca4238a0b923820dcc509a6f75849b',
                  invocations: 850,
                  desc: 'Auto-compounding staking rewards for validator ecosystem participants.',
                },
                {
                  id: 'CPAY_CROSSBORDER_SPLIT_7A8B9C0D1E2F3G4H5I6J7K8L9M0N1P2Q3R4S5T6U',
                  type: 'Cross-Border Splitter',
                  wasm: 'c81e728d9d4c2f636f067f89cc14862c',
                  invocations: 440,
                  desc: 'Atomic multi-recipient remittance distribution for international trade.',
                },
              ].map((c) => (
                <div key={c.id} className="p-4 rounded-xl bg-[#131315] border border-[#2D2D31] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/30">
                      {c.type}
                    </span>
                    <span className="text-[10px] font-mono text-[#62DF7D] font-bold">
                      {c.invocations.toLocaleString()} calls
                    </span>
                  </div>
                  <p className="text-xs font-mono font-bold text-[#FFFFFF] truncate" title={c.id}>
                    {c.id}
                  </p>
                  <p className="text-[11px] text-[#8A8A90] leading-snug">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CROSS-BORDER PAYMENTS */}
      {activeSubTab === 'payments' && (
        <div id="stellar-lab-payments-tab" className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#1B1B1E] border border-[#2D2D31] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2D2D31] pb-3">
              <div>
                <h3 className="text-sm font-bold font-mono text-[#FFFFFF]">Supported Stellar Assets</h3>
                <p className="text-xs text-[#8A8A90]">Native lumens and anchor-issued asset trustlines</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const sql = `SELECT * FROM stellar_assets;`;
                  setCurrentSql(sql);
                  setActiveSubTab('console');
                  handleExecuteSql(sql);
                }}
                className="text-xs font-mono"
              >
                Inspect Assets
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { code: 'XLM', name: 'Stellar Lumens', type: 'Native', supply: '50,000,000,000' },
                { code: 'USDC', name: 'USD Coin', type: 'Anchor Credit (Circle)', supply: '185,000,000' },
                { code: 'EURC', name: 'Euro Coin', type: 'Anchor Credit (Circle)', supply: '42,000,000' },
                { code: 'AQUA', name: 'Aquarius Liquidity', type: 'Protocol Token', supply: '100,000,000' },
                { code: 'yUSDC', name: 'Yield USD Vault', type: 'DeFi Derivative', supply: '15,000,000' },
              ].map((asset) => (
                <div key={asset.code} className="p-3.5 rounded-xl bg-[#131315] border border-[#2D2D31] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-extrabold font-mono text-[#FFFFFF]">{asset.code}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#2D2D31] text-[#8A8A90]">
                      {asset.type}
                    </span>
                  </div>
                  <p className="text-xs text-[#8A8A90]">{asset.name}</p>
                  <p className="text-[10px] font-mono text-[#62DF7D] pt-1">Supply: {asset.supply}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CURRICULUM & CHALLENGES */}
      {activeSubTab === 'learning' && (
        <div id="stellar-lab-learning-tab" className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Academy Module Card */}
          <div className="p-6 rounded-2xl bg-[#1B1B1E] border border-[#2D2D31] space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#3B82F6]" />
                <span className="text-xs font-mono font-bold text-[#3B82F6] uppercase">Academy Curriculum</span>
              </div>
              <h3 className="text-lg font-bold text-[#FFFFFF]">Stellar Blockchain Data Analysis</h3>
              <p className="text-xs text-[#8A8A90] leading-relaxed">
                Structured interactive course covering Stellar ledgers, transaction consensus, cross-border payment
                flows, and Soroban smart contract diagnostics with instant query evaluation.
              </p>

              <div className="space-y-2 pt-2">
                {[
                  '1. Stellar Ledgers, Accounts & Transactions (Beginner • 8m)',
                  '2. Payment Flows & Asset Distribution (Intermediate • 8m)',
                  '3. Soroban Smart Contracts & Event Frequency (Advanced • 9m)',
                ].map((les, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs font-mono text-[#C8C8CC]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#62DF7D]" />
                    <span>{les}</span>
                  </div>
                ))}
              </div>
            </div>

            <Button
              id="btn-launch-stellar-academy"
              variant="primary"
              onClick={() => setActiveTab('academy')}
              className="w-full mt-4 font-mono text-xs gap-2"
            >
              Open Academy Module
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* SQL Challenges Card */}
          <div className="p-6 rounded-2xl bg-[#1B1B1E] border border-[#2D2D31] space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#F59E0B]" />
                <span className="text-xs font-mono font-bold text-[#F59E0B] uppercase">Coding Challenges</span>
              </div>
              <h3 className="text-lg font-bold text-[#FFFFFF]">Stellar & Soroban SQL Challenges</h3>
              <p className="text-xs text-[#8A8A90] leading-relaxed">
                Test your skills in our automated test harness against live synthetic test cases. Gain points, rank up
                in the community leaderboard, and earn verification credentials.
              </p>

              <div className="space-y-2 pt-2">
                <div className="p-3 rounded-xl bg-[#131315] border border-[#2D2D31] space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-[#FFFFFF]">Stellar Top Payment Volume Assets</span>
                    <span className="text-[#F59E0B] font-bold">130 XP</span>
                  </div>
                  <p className="text-[10px] text-[#8A8A90]">Intermediate • Grouping & Aggregation</p>
                </div>

                <div className="p-3 rounded-xl bg-[#131315] border border-[#2D2D31] space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-[#FFFFFF]">Soroban Invocations & Event Frequency</span>
                    <span className="text-[#EF4444] font-bold">160 XP</span>
                  </div>
                  <p className="text-[10px] text-[#8A8A90]">Advanced • LEFT JOINs & Contract State</p>
                </div>
              </div>
            </div>

            <Button
              id="btn-launch-stellar-challenges"
              variant="primary"
              onClick={() => setActiveTab('challenges')}
              className="w-full mt-4 font-mono text-xs gap-2"
            >
              Solve Stellar Challenges
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
