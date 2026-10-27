'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

const TABELA = [
  { meta: 223609, taxas: [0.6, 0.9, 1.2, 1.5] },
  { meta: 335410, taxas: [0.69, 1.03, 1.38, 1.73] },
  { meta: 447212, taxas: [0.79, 1.19, 1.59, 1.98] },
  { meta: 594791.96, taxas: [0.91, 1.37, 1.83, 2.28] },
]
const FAIXAS = ['20% - 29,99%', '30% - 39,99%', '40% - 49,99%', '50% e acima']

const CAMPOS = [
  ['ticket', 'Ticket médio (R$)', ''],
  ['convLead', 'Conversão ligação → lead', '%'],
  ['convVenda', 'Conversão lead → venda', '%'],
  ['dias', 'Dias úteis', ''],
  ['vendedores', 'Nº de vendedores', ''],
] as const

type CampoId = (typeof CAMPOS)[number][0]

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (v: number, d = 0) => v.toLocaleString('pt-BR', { maximumFractionDigits: d })

export default function Calculadora() {
  const [metaIdx, setMetaIdx] = useState(0)
  const [campos, setCampos] = useState<Record<CampoId, string>>({
    ticket: '4000', convLead: '20', convVenda: '30', dias: '22', vendedores: '1',
  })
  const [margem, setMargem] = useState(30)
  const [fatInput, setFatInput] = useState<string | null>(null)
  const [status, setStatus] = useState('')

  const r = useMemo(() => {
    const n = (id: CampoId) => parseFloat(campos[id]) || 0
    const meta = TABELA[metaIdx].meta
    const ticket = n('ticket') || 1
    const cl = n('convLead') || 1
    const cv = n('convVenda') || 1
    const d = n('dias') || 1
    const v = n('vendedores') || 1

    const vendas = Math.ceil(meta / ticket)
    const leads = Math.ceil(vendas / (cv / 100))
    const ligacoes = Math.ceil(leads / (cl / 100))
    const fatProj = vendas * ticket
    const convTotal = (cl * cv) / 100

    const fat = fatInput === null ? fatProj : parseFloat(fatInput) || 0
    const idxM = margem >= 50 ? 3 : margem >= 40 ? 2 : margem >= 30 ? 1 : margem >= 20 ? 0 : -1
    const taxa = idxM >= 0 ? TABELA[metaIdx].taxas[idxM] : 0

    const base = (fat * taxa) / 100
    const gatilho = meta * 1.2
    const bateu = fat > gatilho
    const bonus = bateu ? base * 0.2 : 0
    const ating = meta ? fat / meta : 0
    const redPct = ating < 0.5 ? 0.3 : ating < 0.8 ? 0.2 : 0
    const reducao = base * redPct

    return {
      meta, ticket, cl, cv, d, v, vendas, leads, ligacoes, fatProj, convTotal, fat,
      idxM, taxa, base, gatilho, bateu, bonus, redPct, reducao,
      comissao: base + bonus - reducao, falta: meta - fat,
    }
  }, [metaIdx, campos, margem, fatInput])

  async function salvar() {
    setStatus('Salvando...')
    const supabase = createClient()
    const { error } = await supabase.from('simulacoes').insert({
      meta: r.meta, ticket: r.ticket, conv_lead: r.cl, conv_venda: r.cv,
      dias: r.d, vendedores: r.v, margem, faturamento: r.fat, comissao: r.comissao,
    })
    setStatus(error ? `Erro: ${error.message}` : 'Simulação salva ✅')
  }

  const input = 'border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none focus:border-indigo-500'
  const card = 'bg-white rounded-2xl shadow p-6'
  const linha = 'border-b border-slate-200'

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 p-6 font-sans [color-scheme:light]">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Calculadora de Vendas &amp; Comissão</h1>

        {/* 1. FUNIL */}
        <section className={card}>
          <h2 className="text-lg font-semibold text-indigo-700 mb-4">1. Funil de Vendas</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <label className="flex flex-col text-sm">
              <span className="text-slate-600 mb-1">Meta mensal</span>
              <select className={input} value={metaIdx} onChange={(e) => setMetaIdx(+e.target.value)}>
                {TABELA.map((t, i) => (
                  <option key={i} value={i} className="bg-white text-slate-900">
                    Meta {i + 1} - {brl(t.meta)}
                  </option>
                ))}
              </select>
            </label>
            {CAMPOS.map(([id, label, suf]) => (
              <label key={id} className="flex flex-col text-sm">
                <span className="text-slate-600 mb-1">{label}</span>
                <div className="flex items-center border border-slate-300 rounded-lg bg-white">
                  <input
                    type="number" step="any"
                    className="w-full p-2 rounded-lg bg-white text-slate-900 focus:outline-none"
                    value={campos[id]}
                    onChange={(e) => setCampos({ ...campos, [id]: e.target.value })}
                  />
                  {suf && <span className="px-2 text-slate-500">{suf}</span>}
                </div>
              </label>
            ))}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="p-2">Etapa</th><th className="p-2">Mês</th>
                <th className="p-2">Dia</th><th className="p-2">Dia / vendedor</th>
              </tr>
            </thead>
            <tbody>
              {([['Ligações', r.ligacoes], ['Leads qualificados', r.leads], ['Vendas', r.vendas]] as const).map(([nome, q]) => (
                <tr key={nome} className={linha}>
                  <td className="p-2">{nome}</td><td className="p-2">{num(q)}</td>
                  <td className="p-2 font-semibold">{num(q / r.d, 1)}</td>
                  <td className="p-2">{num(q / r.d / r.v, 1)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="p-2">Faturamento projetado</td><td className="p-2">{brl(r.fatProj)}</td>
                <td className="p-2">{brl(r.fatProj / r.d)}</td><td className="p-2">{brl(r.fatProj / r.d / r.v)}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-sm text-slate-600 mt-3">
            Conversão total: <b>{num(r.convTotal, 2)}%</b> · cerca de <b>{num(100 / r.convTotal, 1)}</b> ligações por venda
          </p>
        </section>

        {/* 2. COMISSÃO */}
        <section className={card}>
          <h2 className="text-lg font-semibold text-emerald-700 mb-4">2. Comissionamento</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 items-end">
            <label className="flex flex-col text-sm">
              <span className="text-slate-600 mb-1">Faturamento realizado (R$)</span>
              <input
                type="number" step="any" className={input}
                value={fatInput ?? r.fatProj}
                onChange={(e) => setFatInput(e.target.value)}
              />
            </label>
            <label className="flex flex-col text-sm">
              <span className="text-slate-600 mb-1">Margem média (%)</span>
              <select className={input} value={margem} onChange={(e) => setMargem(+e.target.value)}>
                {[20, 30, 40, 50].map((m) => (
                  <option key={m} value={m} className="bg-white text-slate-900">{m}%</option>
                ))}
              </select>
            </label>
            <button onClick={() => setFatInput(null)} className="h-10 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm">
              Usar faturamento projetado
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Box label="Faixa de meta" value={`Meta ${metaIdx + 1} - ${brl(r.meta)}`} />
            <Box label="Taxa aplicada" value={`${num(r.taxa, 2)}%`} />
            <div className="bg-emerald-600 text-white rounded-xl p-4">
              <div className="text-xs opacity-80">Comissão</div>
              <div className="text-2xl font-bold">{brl(r.comissao)}</div>
            </div>
          </div>

          <h3 className="font-semibold text-amber-700 mb-3">
            Taxa desempenho{' '}
            <span className="text-xs font-normal text-slate-500">(+20% sobre toda a comissão ao faturar acima de 20% da meta)</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <Box cor="bg-amber-50" label="Gatilho (meta + 20%)" value={brl(r.gatilho)} />
            <Box cor="bg-amber-50" label="Comissão base" value={brl(r.base)} />
            <Box cor="bg-amber-50" label="Bônus desempenho" value={
              r.bateu ? <span className="text-emerald-700">+ {brl(r.bonus)}</span>
                : <span className="text-slate-500">Não atingido · faltam {brl(r.gatilho - r.fat)}</span>
            } />
            <Box cor="bg-red-50" label="Redução desempenho" value={
              r.redPct ? <span className="text-red-600">− {brl(r.reducao)} ({num(r.redPct * 100)}%)</span>
                : <span className="text-slate-500">Sem redução</span>
            } />
          </div>

          <table className="w-full text-sm text-center">
            <thead>
              <tr className="bg-slate-100">
                <th className="p-2 text-left">Meta mensal</th><th className="p-2">Faturar acima de</th>
                <th className="p-2">Acréscimo</th><th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {TABELA.map((t, i) => {
                const s = i === metaIdx
                return (
                  <tr key={i} className={`${linha} ${s ? 'bg-amber-100 font-semibold' : ''}`}>
                    <td className="p-2 text-left">Meta {i + 1} - {brl(t.meta)}</td>
                    <td className="p-2">{brl(t.meta * 1.2)}</td><td className="p-2">+20%</td>
                    <td className="p-2">{s ? (r.fat > t.meta * 1.2 ? '✅ Atingido' : '⏳ Não atingido') : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <h4 className="font-semibold text-red-700 mt-5 mb-2 text-sm">
            Redução por baixo desempenho <span className="text-xs font-normal text-slate-500">(sobre a comissão base)</span>
          </h4>
          <table className="w-full text-sm text-center mb-6">
            <thead>
              <tr className="bg-slate-100">
                <th className="p-2 text-left">Meta mensal</th><th className="p-2">Abaixo de 50% (−30%)</th>
                <th className="p-2">50% a 79,99% (−20%)</th><th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {TABELA.map((t, i) => {
                const s = i === metaIdx
                const st = !s ? '—' : r.redPct === 0.3 ? '🔻 −30% aplicado' : r.redPct === 0.2 ? '🔻 −20% aplicado' : '✅ Sem redução'
                return (
                  <tr key={i} className={`${linha} ${s ? 'bg-red-50 font-semibold' : ''}`}>
                    <td className="p-2 text-left">Meta {i + 1} - {brl(t.meta)}</td>
                    <td className="p-2">abaixo de {brl(t.meta * 0.5)}</td>
                    <td className="p-2">{brl(t.meta * 0.5)} a {brl(t.meta * 0.7999)}</td>
                    <td className="p-2">{st}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {r.idxM < 0 && <p className="text-sm text-red-600 mb-3">Margem abaixo de 20% não gera comissão.</p>}
          <p className="text-sm text-slate-600 mb-3">
            {r.falta > 0
              ? <>Faltam <b>{brl(r.falta)}</b> (~{num(Math.ceil(r.falta / r.ticket))} vendas) para atingir a meta selecionada.</>
              : 'Meta selecionada atingida ✅'}
          </p>

          <table className="w-full text-sm text-center">
            <thead>
              <tr className="bg-slate-100">
                <th className="p-2 text-left">Meta mensal</th>
                {FAIXAS.map((f) => <th key={f} className="p-2">Margem {f}</th>)}
              </tr>
            </thead>
            <tbody>
              {TABELA.map((t, i) => (
                <tr key={i} className={linha}>
                  <td className="p-2 text-left">{brl(t.meta)}</td>
                  {t.taxas.map((x, j) => (
                    <td key={j} className={`p-2 ${i === metaIdx && j === r.idxM ? 'bg-emerald-500 text-white font-bold rounded' : ''}`}>
                      {num(x, 2)}%
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 flex items-center gap-3">
            <button onClick={salvar} className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm">
              Salvar simulação
            </button>
            <span className="text-sm text-slate-600">{status}</span>
          </div>
        </section>
      </div>
    </div>
  )
}

function Box({ label, value, cor = 'bg-emerald-50' }: { label: string; value: ReactNode; cor?: string }) {
  return (
    <div className={`${cor} rounded-xl p-4 text-slate-900`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  )
}
