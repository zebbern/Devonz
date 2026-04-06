import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useStore } from '@nanostores/react';
import { supabase } from '~/lib/supabase.client';
import { authStore } from '~/lib/stores/auth';
import { createInitialProfile } from '~/lib/api/user';
import { toast } from 'react-toastify';
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const { user } = useStore(authStore);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        toast.success('Successfully logged in!');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        if (data.user) {
          await createInitialProfile(data.user.id, data.user.email!);
        }

        toast.success('Sign up successful! Please check your email for verification.');
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bolt-elements-background-depth-0 p-4">
      <div className="max-w-md w-full p-8 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-2xl shadow-xl backdrop-blur-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-heading font-bold text-bolt-elements-textPrimary mb-2">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-bolt-elements-textSecondary">
            {isLogin ? 'Sign in to continue your journey' : 'Join us to explore the future'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-bolt-elements-textSecondary ml-1">Email</label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-bolt-elements-background-depth-2"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-bolt-elements-textSecondary ml-1">Password</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-bolt-elements-background-depth-2"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full py-6 text-lg font-semibold bg-accent-500 hover:bg-accent-600 active:scale-95 transition-all"
          >
            {loading ? <div className="i-svg-spinners:180-ring text-2xl mr-2" /> : null}
            {isLogin ? 'Sign In' : 'Sign Up'}
          </Button>
        </form>

        <div className="mt-8 text-center text-sm">
          <span className="text-bolt-elements-textSecondary">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}
          </span>{' '}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-accent-500 hover:text-accent-400 font-semibold transition-colors"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </div>

        <div className="mt-8 pt-8 border-t border-bolt-elements-borderColor text-center">
          <div className="inline-flex items-center text-xs text-bolt-elements-textTertiary space-x-2">
            <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
            <span>Secure connection to Supabase</span>
          </div>
        </div>
      </div>
    </div>
  );
}
