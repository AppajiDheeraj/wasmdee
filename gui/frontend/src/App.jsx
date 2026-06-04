import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthPage } from '@/pages/auth-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

function App() {
  const [mode, setMode] = useState('signin');
  const [theme, setTheme] = useState('light');
  const [showPassword, setShowPassword] = useState(false);
  const [session, setSession] = useState(null);
  const [isSessionLoading, setIsSessionLoading] = useState(isSupabaseConfigured);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [notice, setNotice] = useState({
    tone: 'info',
    text: isSupabaseConfigured
      ? ''
      : 'Add your Supabase URL and publishable key to gui/frontend/.env to enable authentication.',
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    if (!supabase) {
      setIsSessionLoading(false);
      return undefined;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) {
        return;
      }

      if (error) {
        setNotice({ tone: 'error', text: error.message });
      }

      setSession(data.session);
      setIsSessionLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsSessionLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isSignUp = mode === 'signup';
  const user = session?.user;
  const previewUser =
    import.meta.env.DEV && new URLSearchParams(window.location.search).get('preview') === 'dashboard'
      ? {
          email: 'dheeraj@wasmdee.local',
          user_metadata: {
            full_name: 'Dheeraj Appaji',
          },
        }
      : null;
  const dashboardUser = user || previewUser;
  const localUser = {
    email: 'local@wasmdee.dev',
    user_metadata: {
      full_name: 'Local Runtime',
    },
  };

  const updateForm = (event) => {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!supabase) {
      setNotice({
        tone: 'error',
        text: 'Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY first.',
      });
      return;
    }

    setIsSubmitting(true);
    setNotice({ tone: 'info', text: '' });

    const credentials = {
      email: form.email.trim(),
      password: form.password,
    };

    const { data, error } = isSignUp
      ? await supabase.auth.signUp({
          ...credentials,
          options: {
            data: {
              full_name: form.name.trim(),
            },
            emailRedirectTo: window.location.origin,
          },
        })
      : await supabase.auth.signInWithPassword(credentials);

    if (error) {
      setNotice({ tone: 'error', text: error.message });
      setIsSubmitting(false);
      return;
    }

    if (isSignUp && !data.session) {
      setNotice({
        tone: 'success',
        text: 'Account created. Check your email to confirm your address, then sign in.',
      });
    } else {
      setNotice({ tone: 'success', text: isSignUp ? 'Account ready.' : 'Signed in.' });
    }

    setIsSubmitting(false);
  };

  const handleOAuth = async (provider) => {
    if (!supabase) {
      setNotice({
        tone: 'error',
        text: 'Supabase is not configured yet. Add your project URL and publishable key first.',
      });
      return;
    }

    setIsSubmitting(true);
    setNotice({ tone: 'info', text: '' });

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setNotice({ tone: 'error', text: error.message });
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!supabase) {
      setNotice({
        tone: 'error',
        text: 'Supabase is not configured yet. Add your project URL and publishable key first.',
      });
      return;
    }

    if (!form.email.trim()) {
      setNotice({ tone: 'error', text: 'Enter your email address first.' });
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
      redirectTo: window.location.origin,
    });

    setNotice(
      error
        ? { tone: 'error', text: error.message }
        : { tone: 'success', text: 'Password reset email sent.' }
    );
    setIsSubmitting(false);
  };

  const handleSignOut = async () => {
    if (!supabase) {
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.signOut();
    setNotice(error ? { tone: 'error', text: error.message } : { tone: 'info', text: '' });
    setIsSubmitting(false);
  };

  const toggleMode = () => {
    setMode(isSignUp ? 'signin' : 'signup');
    setNotice({ tone: 'info', text: '' });
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const noticeClasses = {
    error: 'border-destructive/35 bg-destructive/10 text-destructive',
    info: 'border-border bg-muted text-muted-foreground',
    success: 'border-foreground/20 bg-secondary text-foreground',
  };

  if (isSessionLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking session...
        </div>
      </main>
    );
  }

  if (dashboardUser || !isSupabaseConfigured) {
    return (
      <DashboardPage
        user={dashboardUser || localUser}
        isSubmitting={isSubmitting}
        onSignOut={handleSignOut}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <AuthPage
      form={form}
      isSignUp={isSignUp}
      isSubmitting={isSubmitting}
      mode={mode}
      notice={notice}
      noticeClasses={noticeClasses}
      showPassword={showPassword}
      theme={theme}
      onOAuth={handleOAuth}
      onPasswordReset={handlePasswordReset}
      onSubmit={handleSubmit}
      onToggleMode={toggleMode}
      onTogglePassword={() => setShowPassword(!showPassword)}
      onToggleTheme={toggleTheme}
      onUpdateForm={updateForm}
    />
  );
}

export default App;
