'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Play,
  CheckCheck,
  RefreshCw,
  AlertTriangle,
  UserCheck,
  Search,
  Check,
} from 'lucide-react';
import { api } from '../lib/api';

export const RemediationView: React.FC = () => {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approverId, setApproverId] = useState('sre-lead-alice');
  const [approverName, setApproverName] = useState('Alice SRE');
  const [actionMessage, setActionMessage] = useState<{ id: string; msg: string; error?: boolean } | null>(null);
  const [statusTab, setStatusTab] = useState<'all' | 'pending' | 'approved' | 'executed' | 'verified'>('all');

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const data = await api.getActionProposals({ limit: 30 });
      setProposals(data.actions || []);
    } catch (err) {
      console.error('Failed to load action proposals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const handleApprove = async (id: string) => {
    setActionMessage(null);
    try {
      const updated = await api.approveAction(id, {
        approverId,
        approverName,
        role: 'on-call-sre',
      });
      setActionMessage({
        id,
        msg: `Approved by ${approverId}. Status: ${updated.status} (${updated.approvals?.length || 0} approvals)`,
      });
      await fetchProposals();
    } catch (err: any) {
      setActionMessage({ id, msg: err.message, error: true });
    }
  };

  const handleExecute = async (id: string) => {
    setActionMessage(null);
    try {
      const res = await api.executeAction(id);
      setActionMessage({
        id,
        msg: `Executed successfully! Status: ${res.proposal?.status}. Output: ${res.proposal?.executionResult?.output}`,
      });
      await fetchProposals();
    } catch (err: any) {
      setActionMessage({ id, msg: err.message, error: true });
    }
  };

  const handleVerify = async (id: string) => {
    setActionMessage(null);
    try {
      const updated = await api.verifyAction(id);
      setActionMessage({
        id,
        msg: `Verification completed: ${updated.status}. Notes: ${updated.verificationNotes}`,
      });
      await fetchProposals();
    } catch (err: any) {
      setActionMessage({ id, msg: err.message, error: true });
    }
  };

  const handleReject = async (id: string) => {
    setActionMessage(null);
    try {
      const updated = await api.rejectAction(id, {
        actorId: approverId,
        reason: 'Manually rejected by on-call operator',
      });
      setActionMessage({ id, msg: `Action rejected. Status: ${updated.status}` });
      await fetchProposals();
    } catch (err: any) {
      setActionMessage({ id, msg: err.message, error: true });
    }
  };

  const filteredProposals = proposals.filter((p) => {
    if (statusTab === 'all') return true;
    if (statusTab === 'pending') return p.status === 'pending_approval' || p.status === 'proposed';
    return p.status === statusTab;
  });

  return (
    <div className="space-y-4">
      {/* Top Header / Policy Bar */}
      <div className="bg-neutrino-900 border border-neutrino-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center space-x-1 bg-neutrino-950 p-1 rounded-md border border-neutrino-800 font-mono text-xs">
          {(['all', 'pending', 'approved', 'executed', 'verified'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusTab(tab)}
              className={`px-2.5 py-1 rounded text-[11px] uppercase font-medium transition-colors ${
                statusTab === tab
                  ? 'bg-cyan-600 text-white font-semibold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Actor Selector & Refresh */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 bg-neutrino-950 px-2.5 py-1 rounded-md border border-neutrino-800 text-xs font-mono">
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-500 text-[10px]">Actor:</span>
            <input
              type="text"
              value={approverId}
              onChange={(e) => setApproverId(e.target.value)}
              placeholder="Actor ID"
              className="bg-transparent text-xs text-slate-200 outline-none w-24 font-mono"
            />
          </div>

          <button
            onClick={fetchProposals}
            disabled={loading}
            className="p-1.5 rounded-md bg-neutrino-950 border border-neutrino-800 text-slate-400 hover:text-slate-200 hover:border-neutrino-700 transition"
            title="Refresh action proposals"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Proposals List */}
      {loading ? (
        <div className="p-10 text-center text-xs text-slate-400 bg-neutrino-900 rounded-lg border border-neutrino-800 font-mono">
          Querying action proposals and safety policies from FalkorDB...
        </div>
      ) : filteredProposals.length === 0 ? (
        <div className="p-10 text-center text-xs text-slate-400 bg-neutrino-900 rounded-lg border border-neutrino-800 font-mono">
          No action proposals found matching status filter. Run an investigation to generate justified procedural actions.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProposals.map((p) => {
            const isPending = p.status === 'pending_approval' || p.status === 'proposed';
            const isApproved = p.status === 'approved';
            const isExecuted = p.status === 'executed';
            const isVerified = p.status === 'verified';
            const isRejected = p.status === 'rejected';

            return (
              <div
                key={p.id}
                className="bg-neutrino-900 p-4 rounded-lg border border-neutrino-800 space-y-3 hover:border-neutrino-700 transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2 mb-1.5">
                      <span className="font-mono text-xs text-cyan-400 font-bold bg-cyan-950/60 border border-cyan-800/80 px-2 py-0.2 rounded">
                        {p.id}
                      </span>
                      <span
                        className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded font-semibold border ${
                          p.riskLevel === 'high'
                            ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                            : p.riskLevel === 'medium'
                            ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                            : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                        }`}
                      >
                        Risk: {p.riskLevel}
                      </span>
                      <span
                        className={`text-[10px] font-mono uppercase px-1.5 py-0.2 rounded font-semibold border ${
                          isPending
                            ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                            : isApproved
                            ? 'bg-blue-950/60 text-blue-300 border-blue-800/60'
                            : isExecuted
                            ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60'
                            : isVerified
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                            : 'bg-neutrino-800 text-slate-400 border-neutrino-700'
                        }`}
                      >
                        {p.status}
                      </span>
                      {p.requiresTwoPersonApproval && (
                        <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 border border-amber-800/80 px-1.5 py-0.2 rounded">
                          2-Person Policy
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-semibold text-slate-100 font-sans leading-snug">
                      {p.explanation}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-mono mt-1">
                      Action: <span className="text-slate-200">{p.actionType}</span> | Target:{' '}
                      <span className="text-slate-200">{p.targetServiceId}</span> ({p.targetResource})
                    </p>
                  </div>

                  {/* Action Execution / Approval Buttons */}
                  <div className="flex items-center space-x-2 font-mono text-xs">
                    {isPending && (
                      <>
                        <button
                          onClick={() => handleApprove(p.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-semibold flex items-center space-x-1.5 transition shadow-xs text-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve ({p.approvals?.length || 0}/{p.requiresTwoPersonApproval ? 2 : 1})</span>
                        </button>
                        <button
                          onClick={() => handleReject(p.id)}
                          className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-md font-semibold flex items-center space-x-1.5 transition text-xs"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </>
                    )}

                    {isApproved && (
                      <button
                        onClick={() => handleExecute(p.id)}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md font-semibold flex items-center space-x-1.5 transition shadow-xs text-xs"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Execute Handler</span>
                      </button>
                    )}

                    {isExecuted && (
                      <button
                        onClick={() => handleVerify(p.id)}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md font-semibold flex items-center space-x-1.5 transition text-xs"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Verify Postconditions</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Preconditions & Postconditions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs bg-neutrino-950 p-2.5 rounded-md border border-neutrino-800 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-500 font-semibold block mb-1 uppercase text-[10px]">
                      Preconditions:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                      {p.preconditions?.map((pre: string, idx: number) => (
                        <li key={idx}>{pre}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block mb-1 uppercase text-[10px]">
                      Expected Postconditions:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                      {p.expectedPostconditions?.map((post: string, idx: number) => (
                        <li key={idx}>{post}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Output Notes */}
                {p.executionResult && (
                  <div className="text-xs font-mono bg-neutrino-950 p-2 rounded border border-neutrino-800 text-slate-300">
                    <span className="text-slate-400">Execution Output: </span>
                    {p.executionResult.output} (Duration: {p.executionResult.durationMs}ms)
                  </div>
                )}

                {p.verificationNotes && (
                  <div className="text-xs font-mono bg-emerald-950/30 p-2 rounded border border-emerald-800/60 text-emerald-200">
                    <span className="text-emerald-400 font-semibold">Verification: </span>
                    {p.verificationNotes}
                  </div>
                )}

                {actionMessage && actionMessage.id === p.id && (
                  <p
                    className={`text-xs p-2 rounded border font-mono ${
                      actionMessage.error
                        ? 'bg-rose-950/70 border-rose-800 text-rose-300'
                        : 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                    }`}
                  >
                    {actionMessage.msg}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
