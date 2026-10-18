'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle2, XCircle, Play, CheckCheck, RefreshCw, AlertTriangle, UserCheck } from 'lucide-react';
import { api } from '../lib/api';

export const RemediationView: React.FC = () => {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approverId, setApproverId] = useState('sre-lead-alice');
  const [approverName, setApproverName] = useState('Alice SRE');
  const [actionMessage, setActionMessage] = useState<{ id: string; msg: string; error?: boolean } | null>(null);

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const data = await api.getActionProposals({ limit: 20 });
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <span>Remediation & Action Approval Boundary</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Safe diagnostic & remediation workflow governance. Enforces two-person approvals on consequential actions before allowlisted execution.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-neutrino-850 px-3 py-1.5 rounded-lg border border-neutrino-750">
            <UserCheck className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={approverId}
              onChange={(e) => setApproverId(e.target.value)}
              placeholder="Actor ID"
              className="bg-transparent text-xs text-slate-200 outline-none w-28 font-mono"
            />
          </div>
          <button
            onClick={fetchProposals}
            disabled={loading}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-neutrino-800 hover:bg-neutrino-700 text-slate-200 text-xs border border-neutrino-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Proposals List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-neutrino-850 rounded-xl border border-neutrino-750">
          Loading FalkorDB action proposals...
        </div>
      ) : proposals.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400 bg-neutrino-850 rounded-xl border border-neutrino-750">
          No action proposals pending or recorded in the graph. Run an investigation to generate justified procedural actions.
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map((p) => {
            const isPending = p.status === 'pending_approval' || p.status === 'proposed';
            const isApproved = p.status === 'approved';
            const isExecuted = p.status === 'executed';
            const isVerified = p.status === 'verified';
            const isRejected = p.status === 'rejected';

            return (
              <div
                key={p.id}
                className="bg-neutrino-850 p-5 rounded-xl border border-neutrino-750 space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-mono text-xs text-cyan-400 font-semibold">{p.id}</span>
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold ${
                          p.riskLevel === 'high'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : p.riskLevel === 'medium'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        Risk: {p.riskLevel}
                      </span>
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold ${
                          isPending
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                            : isApproved
                            ? 'bg-blue-950/80 text-blue-300 border border-blue-800'
                            : isExecuted
                            ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800'
                            : isVerified
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        Status: {p.status}
                      </span>
                      {p.requiresTwoPersonApproval && (
                        <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 border border-amber-800/80 px-1.5 py-0.5 rounded">
                          2-Person Policy
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-slate-100">{p.explanation}</h4>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Action Type: <span className="text-slate-200">{p.actionType}</span> | Target:{' '}
                      <span className="text-slate-200">{p.targetServiceId}</span> ({p.targetResource})
                    </p>
                  </div>

                  {/* Actions Lifecycle Control Buttons */}
                  <div className="flex items-center space-x-2">
                    {isPending && (
                      <>
                        <button
                          onClick={() => handleApprove(p.id)}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve ({p.approvals?.length || 0}/{p.requiresTwoPersonApproval ? 2 : 1})</span>
                        </button>
                        <button
                          onClick={() => handleReject(p.id)}
                          className="px-3.5 py-2 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </>
                    )}

                    {isApproved && (
                      <button
                        onClick={() => handleExecute(p.id)}
                        className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Execute Handler</span>
                      </button>
                    )}

                    {isExecuted && (
                      <button
                        onClick={() => handleVerify(p.id)}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Verify Postconditions</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Preconditions & Postconditions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-neutrino-900/60 p-3 rounded-lg border border-neutrino-800">
                  <div>
                    <span className="text-slate-400 font-medium block mb-1">Preconditions:</span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                      {p.preconditions?.map((pre: string, idx: number) => (
                        <li key={idx}>{pre}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block mb-1">Expected Postconditions:</span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                      {p.expectedPostconditions?.map((post: string, idx: number) => (
                        <li key={idx}>{post}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Execution / Verification Notes */}
                {p.executionResult && (
                  <div className="text-xs font-mono bg-neutrino-900 p-2.5 rounded border border-neutrino-800 text-slate-300">
                    <span className="text-slate-400">Execution Output: </span>
                    {p.executionResult.output} (Duration: {p.executionResult.durationMs}ms)
                  </div>
                )}

                {p.verificationNotes && (
                  <div className="text-xs font-mono bg-emerald-950/40 p-2.5 rounded border border-emerald-800/60 text-emerald-200">
                    <span className="text-emerald-400">Verification: </span>
                    {p.verificationNotes}
                  </div>
                )}

                {/* Message display */}
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
