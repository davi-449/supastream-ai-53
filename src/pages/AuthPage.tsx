import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getSupabaseClient, setSupabaseClient } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export default function AuthPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [mode, setMode] = useState<'login'|'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If no client yet, allow using global injected values (the chat /supabase connect sets window.__SUPABASE__)
  const client = getSupabaseClient();

  useEffect(() => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('import.meta.env', import.meta.env);
      // eslint-disable-next-line no-console
      console.log('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL);
      // eslint-disable-next-line no-console
      console.log('VITE_SUPABASE_ANON_KEY', import.meta.env.VITE_SUPABASE_ANON_KEY);
      // eslint-disable-next-line no-console
      console.log('window.__SUPABASE__', typeof window !== 'undefined' ? (window as any).__SUPABASE__ : undefined);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email e senha são obrigatórios.');
      return;
    }
    if (password.length < 8) {
      setError('Senha precisa ter no mínimo 8 caracteres.');
      return;
    }

    if (!client) {
      setError('Supabase client não configurado. Conecte Supabase (via /supabase connect no chat) ou configure VITE vars.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: err } = await client.auth.signUp({ email, password });
        if (err) {
          setError(err.message);
          toast({ title: 'Erro', description: err.message, variant: 'destructive' });
        } else {
          toast({ title: 'Conta criada', description: 'Verifique seu e-mail para confirmar (se necessário).' });
          setMode('login');
        }
      } else {
        const { data, error: err } = await client.auth.signInWithPassword({ email, password });
        if (err) {
          setError(err.message);
          toast({ title: 'Erro', description: err.message, variant: 'destructive' });
        } else {
          toast({ title: 'Logado', description: 'Redirecionando...' });
          // redirect
          navigate('/');
        }
      }
    } catch (ex: any) {
      setError(ex?.message || String(ex));
      toast({ title: 'Erro inesperado', description: ex?.message || String(ex), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full mx-auto p-8 border rounded-xl bg-card shadow">
        <h2 className="text-2xl font-bold mb-6 text-center">{mode === 'login' ? 'Login' : 'Cadastro'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block mb-1 text-sm">Email</label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@exemplo.com" aria-label="Email" required minLength={3} disabled={loading} />
          </div>
          <div>
            <label htmlFor="password" className="block mb-1 text-sm">Senha</label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mín. 8 caracteres" aria-label="Senha" required minLength={8} disabled={loading} />
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Validando...' : mode === 'login' ? 'Entrar' : 'Cadastrar'}
          </Button>
        </form>

        <div className="text-center mt-4">
          <button className="text-sm text-primary underline" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Ainda não tem conta? Cadastre-se.' : 'Já tem conta? Faça login.'}</button>
        </div>

        {!client && (
          <div className="mt-4 text-sm text-muted-foreground">
            Supabase não configurado. Use o chat para conectar: <code>/supabase connect &lt;URL&gt; &lt;KEY&gt;</code> ou configure VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY.
          </div>
        )}
      </div>
    </div>
  );
}
