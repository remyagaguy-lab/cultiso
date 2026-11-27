"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { ArrowUpIcon as ArrowUpOutlined, ArrowDownIcon as ArrowDownOutlined, AddCircleIcon as PlusOutlined } from "@solar-icons/react/linear";
import { WalletMoneyIcon as Wallet } from "@solar-icons/react/bold-duotone";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

interface TreasuryDashboardProps {
  draftTransaction?: {
    amount?: number;
    type?: string;
    category?: string;
    description?: string;
  } | null;
}

export default function TreasuryDashboard({ draftTransaction }: TreasuryDashboardProps) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [cultisoId, setCultisoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (draftTransaction) {
      setAmount(draftTransaction.amount?.toString() || "");
      setType(draftTransaction.type || "expense");
      setCategory(draftTransaction.category || "");
      setDescription(draftTransaction.description || "");
      setIsModalOpen(true);
    }
  }, [draftTransaction]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      // Récupérer le premier Cultiso (Jumeau Numérique)
      const { data: cultisos } = await supabase
        .from("cultisos")
        .select("id")
        .eq("user_id", userData.user.id)
        .limit(1);

      if (cultisos && cultisos.length > 0) {
        const cId = cultisos[0].id;
        setCultisoId(cId);

        // Fetch transactions
        const { data: txData } = await supabase
          .from("transactions")
          .select("*")
          .eq("cultiso_id", cId)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false });

        if (txData) setTransactions(txData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cultisoId) return;

    try {
      const { data, error } = await supabase.from("transactions").insert({
        cultiso_id: cultisoId,
        amount: parseFloat(amount),
        type,
        category,
        description,
        date: new Date().toISOString().split("T")[0]
      }).select();

      if (!error && data) {
        setTransactions([data[0], ...transactions]);
        setIsModalOpen(false);
        setAmount("");
        setCategory("");
        setDescription("");
      }
    } catch (err) {
      console.error("Error adding transaction", err);
    }
  };

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0);
  const balance = totalIncome - totalExpense;

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-title text-xl sm:text-2xl font-bold text-foreground tracking-tight m-0">Trésorerie</h1>
          <p className="text-sm text-muted mt-1 m-0">Gérez vos entrées et sorties d&apos;argent.</p>
        </div>
        <button 
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="bg-action hover:bg-[var(--ork-use-background-action-bold-hover)] text-on-action px-4 py-2 rounded-[var(--ork-use-radius-button)] text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors shadow-xs w-fit whitespace-nowrap shrink-0"
        >
          <PlusOutlined />
          Nouvelle Transaction
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6">
        <div className="bg-surface p-5 rounded-[var(--ork-use-radius-card)] border border-border flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-[var(--ork-use-radius-control)] bg-[var(--ork-use-background-brand-subtle)] text-t-brand flex items-center justify-center shrink-0">
              <ArrowUpOutlined className="text-base" />
            </div>
            <h2 className="text-sm text-muted font-semibold m-0">Entrées (Revenus)</h2>
          </div>
          <p className="text-2xl font-bold text-foreground font-mono-numbers m-0">{totalIncome.toLocaleString('fr-FR')} <span className="text-sm text-muted font-medium">FCFA</span></p>
        </div>

        <div className="bg-surface p-5 rounded-[var(--ork-use-radius-card)] border border-border flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-[var(--ork-use-radius-control)] bg-[var(--ork-use-background-action-subtle)] text-t-action flex items-center justify-center shrink-0">
              <ArrowDownOutlined className="text-base" />
            </div>
            <h2 className="text-sm text-muted font-semibold m-0">Sorties (Dépenses)</h2>
          </div>
          <p className="text-2xl font-bold text-foreground font-mono-numbers m-0">{totalExpense.toLocaleString('fr-FR')} <span className="text-sm text-muted font-medium">FCFA</span></p>
        </div>

        <div className="bg-brand p-5 rounded-[var(--ork-use-radius-card)] shadow-raised flex flex-col justify-between text-on-brand">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-[var(--ork-use-radius-control)] bg-white/15 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <h2 className="text-sm opacity-90 font-semibold m-0">Solde Actuel</h2>
          </div>
          <p className="text-2xl font-bold font-mono-numbers m-0">{balance.toLocaleString('fr-FR')} <span className="text-sm opacity-90 font-medium">FCFA</span></p>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-surface rounded-[var(--ork-use-radius-card)] border border-border overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border bg-sunken/70">
          <h2 className="text-sm font-title font-bold text-foreground m-0">Historique des transactions</h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-sm text-muted">Chargement...</div>
        ) : transactions.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center">
            <div className="w-12 h-12 bg-[var(--ork-use-background-brand-subtle)] rounded-[var(--ork-use-radius-control)] flex items-center justify-center mb-3 text-t-brand">
              <Wallet className="w-5 h-5" />
            </div>
            <h3 className="text-base font-title font-bold text-foreground mb-1.5 m-0">Aucune transaction</h3>
            <p className="text-xs sm:text-sm text-muted max-w-md m-0">Commencez à gérer votre trésorerie en ajoutant vos premières dépenses (intrants, salaires) ou revenus (ventes).</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-xs text-muted uppercase tracking-wider">
                <th className="px-5 py-3.5 font-semibold">Date</th>
                <th className="px-5 py-3.5 font-semibold">Catégorie</th>
                <th className="px-5 py-3.5 font-semibold">Description</th>
                <th className="px-5 py-3.5 font-semibold text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-border hover:bg-sunken/60 transition-colors">
                  <td className="px-5 py-3.5 text-xs font-mono-numbers text-muted whitespace-nowrap">{tx.date}</td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-[var(--ork-use-radius-badge)] text-xs font-medium bg-sunken text-foreground">
                      {tx.category}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-foreground">{tx.description || '-'}</td>
                  <td className={`px-5 py-3.5 text-sm font-bold text-right font-mono-numbers whitespace-nowrap ${tx.type === 'income' ? 'text-t-brand' : 'text-t-action'}`}>
                    {tx.type === 'income' ? '+' : '-'}{Number(tx.amount).toLocaleString('fr-FR')} FCFA
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[color-mix(in_srgb,var(--ork-sys-scrim)_40%,transparent)] z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface text-foreground rounded-[var(--ork-use-radius-dialog)] w-full max-w-md shadow-overlay border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h3 className="font-title font-bold text-lg text-foreground">Nouvelle Transaction</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted hover:text-foreground">✕</button>
            </div>
            
            <form onSubmit={handleAddTransaction} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-1">Type d&apos;opération</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    type="button"
                    onClick={() => setType('income')}
                    className={`p-2 text-sm font-medium rounded-[var(--ork-use-radius-button)] border ${type === 'income' ? 'bg-[var(--ork-use-background-success-subtle)] border-[var(--ork-use-border-success)] text-t-success' : 'border-border text-muted hover:bg-sunken'}`}
                  >
                    Rentrée d&apos;argent
                  </button>
                  <button 
                    type="button"
                    onClick={() => setType('expense')}
                    className={`p-2 text-sm font-medium rounded-[var(--ork-use-radius-button)] border ${type === 'expense' ? 'bg-[var(--ork-use-background-danger-subtle)] border-[var(--ork-use-border-danger)] text-t-danger' : 'border-border text-muted hover:bg-sunken'}`}
                  >
                    Dépense
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-1">Montant (FCFA)</label>
                <input 
                  type="number" 
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-surface text-foreground border border-border-strong rounded-[var(--ork-use-radius-control)] focus:outline-none focus:ring-2 focus:ring-[var(--ork-use-border-focused)] focus:border-transparent"
                  placeholder="Ex: 50000"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-foreground mb-1">Catégorie</label>
                <input 
                  type="text" 
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-surface text-foreground border border-border-strong rounded-[var(--ork-use-radius-control)] focus:outline-none focus:ring-2 focus:ring-[var(--ork-use-border-focused)] focus:border-transparent"
                  placeholder="Ex: Semences, Vente maïs, Salaire..."
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-foreground mb-1">Description (Optionnel)</label>
                <input 
                  type="text" 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-surface text-foreground border border-border-strong rounded-[var(--ork-use-radius-control)] focus:outline-none focus:ring-2 focus:ring-[var(--ork-use-border-focused)] focus:border-transparent"
                  placeholder="Ex: Achat de 2 sacs de NPK"
                />
              </div>

              <button 
                type="submit" 
                className="w-full bg-brand hover:bg-[var(--ork-use-background-brand-bold-hover)] text-on-brand py-3 rounded-[var(--ork-use-radius-button)] font-bold transition-colors"
              >
                Enregistrer
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
