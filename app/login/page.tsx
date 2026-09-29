'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/components/AuthProvider';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/dashboard';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please enter username and password');
      return;
    }

    const success = login(username, password);
    if (success) {
      router.push(from);
    } else {
      setError('Invalid username or password');
      setPassword('');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0f1e'
    }}>
      <div style={{
        background: '#0f1419',
        border: '1px solid #1e293b',
        borderRadius: '8px',
        padding: '32px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
      }}>
        <h1 style={{
          color: '#e2e8f0',
          fontSize: '24px',
          fontWeight: 'bold',
          marginBottom: '8px',
          textAlign: 'center'
        }}>Mind Over Markets</h1>

        <p style={{
          color: '#94a3b8',
          fontSize: '14px',
          textAlign: 'center',
          marginBottom: '24px'
        }}>CRM Dashboard</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{
              display: 'block',
              color: '#cbd5e1',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '8px'
            }}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#e2e8f0',
                fontSize: '14px',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              color: '#cbd5e1',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '8px'
            }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#e2e8f0',
                fontSize: '14px',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#7f1d1d',
              border: '1px solid #991b1b',
              borderRadius: '6px',
              padding: '10px 12px',
              color: '#fca5a5',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            style={{
              background: '#22c55e',
              color: '#0a0f1e',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#16a34a'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#22c55e'}
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
