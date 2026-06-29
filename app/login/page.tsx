'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = '/';
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data?.error || 'Senha incorreta.');
    } catch {
      setError('Não foi possível conectar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.wrap}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <div style={styles.brand}>AVANTIA</div>
        <h1 style={styles.title}>Dashboard de Licitações</h1>
        <p style={styles.subtitle}>Acesso restrito. Informe a senha de acesso.</p>

        <label htmlFor="password" style={styles.label}>
          Senha
        </label>
        <input
          id="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
          placeholder="••••••••"
        />

        {error && <div style={styles.error}>{error}</div>}

        <button type="submit" disabled={loading || !password} style={styles.button}>
          {loading ? 'Verificando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#F4F5F8',
    padding: '24px',
  },
  card: {
    width: '100%',
    maxWidth: '360px',
    background: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #E1E3E8',
    boxShadow: '0 4px 12px rgba(14, 36, 71, 0.08)',
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
  },
  brand: {
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.18em',
    color: '#E88126',
    marginBottom: '16px',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
    color: '#0E2447',
  },
  subtitle: {
    margin: '6px 0 24px',
    fontSize: '13px',
    color: '#71757B',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#14213D',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #C4C7CD',
    borderRadius: '6px',
    outline: 'none',
    color: '#14213D',
    background: '#fff',
  },
  error: {
    marginTop: '12px',
    fontSize: '13px',
    color: '#b3261e',
  },
  button: {
    marginTop: '24px',
    padding: '11px 16px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
    background: '#0E2447',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
};
