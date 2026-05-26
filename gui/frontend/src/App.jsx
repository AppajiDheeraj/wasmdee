import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Moon,
  Sun,
} from 'lucide-react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import authVisual from './assets/images/auth-visual.jpg';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z"
    />
  </svg>
);

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
    <path
      fill="currentColor"
      d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.56-.29-5.26-1.28-5.26-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.16 1.18A10.96 10.96 0 0 1 12 5.5c.98 0 1.96.13 2.88.39 2.19-1.49 3.15-1.18 3.15-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14 0 1.54-.01 2.79-.01 3.17 0 .31.21.68.8.56A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
    />
  </svg>
);

function App() {
  const [mode, setMode] = useState('signin');
  const [theme, setTheme] = useState('dark');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const isSignUp = mode === 'signup';

  const handleSubmit = (event) => {
    event.preventDefault();
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid h-screen overflow-hidden min-[900px]:grid-cols-[minmax(360px,0.86fr)_minmax(420px,1.14fr)]">
        <section className="relative flex min-h-0 flex-col px-6 py-5 sm:px-10 lg:px-12">
          <header className="flex h-10 items-center justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              className="rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </header>

          <div className="flex min-h-0 flex-1 items-center justify-center py-4">
            <div className="w-full max-w-[400px]">
              <div className="mb-6 space-y-2.5">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  {isSignUp ? 'Create your account.' : 'Welcome back.'}
                </h1>
                <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                  {isSignUp
                    ? 'Start your Wasmdee workspace with an email or a trusted social provider.'
                    : 'Sign in to continue building, testing, and shipping your WebAssembly projects.'}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button type="button" variant="outline" className="h-11 rounded-lg bg-card">
                  <GoogleIcon />
                  Google
                </Button>
                <Button type="button" variant="outline" className="h-11 rounded-lg bg-card">
                  <GitHubIcon />
                  GitHub
                </Button>
              </div>

              <div className="my-5 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                Or use email
                <span className="h-px flex-1 bg-border" />
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                {isSignUp && (
                  <div className="grid gap-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" name="name" placeholder="Dheeraj Appaji" autoComplete="name" />
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {!isSignUp && (
                      <button
                        type="button"
                        className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      className="pr-11"
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="h-11 w-full rounded-lg text-sm font-semibold">
                  {isSignUp ? 'Create account' : 'Sign in'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                  onClick={() => setMode(isSignUp ? 'signin' : 'signup')}
                >
                  {isSignUp ? 'Sign in' : 'Sign up'}
                </button>
              </p>
            </div>
          </div>
        </section>

        <section className="hidden min-h-0 p-2 min-[900px]:block">
          <div className="relative h-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <img
              src={authVisual}
              alt="A vintage computer resting in a sunlit meadow"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-10 text-white">
              <div className="mb-5 flex w-fit items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-medium backdrop-blur">
                <Check className="h-3.5 w-3.5" />
                Desktop native, web fast
              </div>
              <h2 className="max-w-xl text-3xl font-semibold leading-tight tracking-tight">
                A quieter place to compile ideas into working software.
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-6 text-white/78">
                Keep the workflow focused with a native Wails shell, polished auth entry, and a theme
                system ready for the rest of the product.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
