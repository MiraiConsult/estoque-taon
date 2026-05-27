'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function TestePage() {
  const [log, setLog] = useState<string[]>(['Clique em "Testar" para iniciar']);

  const addLog = (msg: string) => setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const runTests = async () => {
    setLog([]);

    // Test 1: Check env vars
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    addLog(`URL: ${url ? url.substring(0, 30) + '...' : 'VAZIO!'}`);
    addLog(`Key: ${key ? key.substring(0, 20) + '...' : 'VAZIO!'}`);

    // Test 2: Raw fetch
    addLog('Teste 2: fetch direto...');
    try {
      const t0 = Date.now();
      const res = await fetch(`${url}/rest/v1/casas?select=name&limit=3`, {
        headers: { 'apikey': key || '' },
      });
      const data = await res.json();
      addLog(`OK em ${Date.now() - t0}ms - ${JSON.stringify(data)}`);
    } catch (err) {
      addLog(`ERRO fetch: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Test 3: Supabase client simple query
    addLog('Teste 3: supabase.from("casas")...');
    try {
      const t0 = Date.now();
      const { data, error } = await supabase.from('casas').select('name').limit(3);
      if (error) {
        addLog(`ERRO supabase: ${error.message} (code: ${error.code})`);
      } else {
        addLog(`OK em ${Date.now() - t0}ms - ${JSON.stringify(data)}`);
      }
    } catch (err) {
      addLog(`EXCEÇÃO: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Test 4: Supabase with join
    addLog('Teste 4: query com join...');
    try {
      const t0 = Date.now();
      const { data, error } = await supabase
        .from('stock_items')
        .select('id, quantity, product:products(name), casa:casas(name)')
        .limit(3);
      if (error) {
        addLog(`ERRO join: ${error.message}`);
      } else {
        addLog(`OK em ${Date.now() - t0}ms - ${data?.length} items`);
      }
    } catch (err) {
      addLog(`EXCEÇÃO: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Test 5: Products count
    addLog('Teste 5: products count...');
    try {
      const t0 = Date.now();
      const { count, error } = await supabase.from('products').select('id', { count: 'exact', head: true });
      if (error) {
        addLog(`ERRO count: ${error.message}`);
      } else {
        addLog(`OK em ${Date.now() - t0}ms - ${count} products`);
      }
    } catch (err) {
      addLog(`EXCEÇÃO: ${err instanceof Error ? err.message : String(err)}`);
    }

    addLog('--- TESTES COMPLETOS ---');
  };

  return (
    <div style={{ padding: 40, fontFamily: 'monospace', maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 20, marginBottom: 20 }}>Diagnostico Supabase</h1>
      <button
        onClick={runTests}
        style={{
          padding: '10px 24px',
          background: '#1d6fa5',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 14,
          marginBottom: 20,
        }}
      >
        Testar Conexao
      </button>
      <div
        style={{
          background: '#111',
          color: '#0f0',
          padding: 20,
          borderRadius: 8,
          fontSize: 13,
          lineHeight: 1.8,
          minHeight: 300,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {log.map((line, i) => (
          <div key={i} style={{ color: line.includes('ERRO') || line.includes('EXCEÇÃO') || line.includes('VAZIO') ? '#f55' : line.includes('OK') ? '#0f0' : '#aaa' }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
