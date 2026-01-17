import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      navigate('/dashboard');
    }

    // Recuperar email salvo
    const savedEmail = localStorage.getItem('educalota_user_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, [session, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      if (rememberMe) {
        localStorage.setItem('educalota_user_email', email);
      } else {
        localStorage.removeItem('educalota_user_email');
      }

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao tentar autenticar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden opacity-40 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-3xl"></div>
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[60%] rounded-full bg-blue-100 dark:bg-blue-900/20 blur-3xl"></div>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-surface-dark rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden z-10">
        <div className="h-2 w-full bg-primary"></div>
        <div className="p-8 sm:p-10 flex flex-col gap-8">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-4xl">school</span>
            </div>
            <div>
              <h1 className="text-3xl font-black text-primary dark:text-white">EducaLota</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Gestão de Educação Especial</p>
            </div>
          </div>

          <form className="flex flex-col gap-5" onSubmit={handleAuth}>
            {error && (
              <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100">
                {error}
              </div>
            )}
            {message && (
              <div className="p-3 rounded-lg bg-green-50 text-green-600 text-sm font-medium border border-green-100">
                {message}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-bold ml-1">E-mail</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400">mail</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="text-sm font-bold">Senha</label>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400">lock</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 pl-12 pr-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2 px-1">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer accent-primary"
              />
              <label
                htmlFor="rememberMe"
                className="text-sm font-medium text-slate-600 dark:text-slate-400 select-none cursor-pointer"
              >
                Lembrar meus dados
              </label>
            </div>

            <Button
              type="submit"
              isLoading={loading}
              className="mt-2 w-full h-12"
            >
              Entrar no Sistema
            </Button>
          </form>

          <div className="text-center">
            <p className="text-sm text-slate-500">
              Esqueceu sua senha?{" "}
              <button
                type="button"
                className="text-primary font-bold hover:underline"
                onClick={() => alert("Entre em contato com o administrador do sistema.")}
              >
                Recuperar acesso
              </button>
            </p>
          </div>
        </div>
      </div>

      <p className="mt-8 text-xs text-slate-400 font-medium">© 2024 Secretaria de Educação. Sistema EducaLota v1.2</p>
    </div>
  );
};

export default Login;
