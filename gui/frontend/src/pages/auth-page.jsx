import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Moon, Sun } from 'lucide-react';
import { GitHubIcon, GoogleIcon } from '@/components/auth/auth-icons';
import { LogoMark } from '@/components/brand/logo-mark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import authVisual from '@/assets/images/auth-visual.jpg';

export function AuthPage({
  form,
  isSignUp,
  isSubmitting,
  mode,
  notice,
  noticeClasses,
  showPassword,
  theme,
  onOAuth,
  onPasswordReset,
  onSubmit,
  onToggleMode,
  onTogglePassword,
  onToggleTheme,
  onUpdateForm,
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen overflow-hidden min-[900px]:grid-cols-[minmax(360px,0.86fr)_minmax(420px,1.14fr)]">
        <section className="relative flex min-h-0 flex-col px-6 py-5 sm:px-10 lg:px-12">
          <header className="flex h-10 items-center justify-between">
            <div className="flex items-center gap-3">
              <LogoMark size="sm" />
              <span className="text-lg font-bold tracking-tight">Wasmdee</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              className="rounded-full text-muted-foreground hover:text-foreground"
              onClick={onToggleTheme}
            >
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
          </header>

          <div className="flex min-h-0 flex-1 items-center justify-center py-4">
            <div className="w-full max-w-[400px]">
              <div className="mb-6 flex flex-col gap-2.5">
                <LogoMark />
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
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-lg bg-card"
                  disabled={isSubmitting}
                  onClick={() => onOAuth('google')}
                >
                  <GoogleIcon />
                  Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-lg bg-card"
                  disabled={isSubmitting}
                  onClick={() => onOAuth('github')}
                >
                  <GitHubIcon />
                  GitHub
                </Button>
              </div>

              <div className="my-5 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                Or use email
                <span className="h-px flex-1 bg-border" />
              </div>

              <form className="flex flex-col gap-4" onSubmit={onSubmit}>
                {isSignUp && (
                  <div className="grid gap-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Dheeraj Appaji"
                      autoComplete="name"
                      value={form.name}
                      onChange={onUpdateForm}
                    />
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
                    value={form.email}
                    onChange={onUpdateForm}
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
                        disabled={isSubmitting}
                        onClick={onPasswordReset}
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
                      value={form.password}
                      onChange={onUpdateForm}
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                      onClick={onTogglePassword}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="h-11 w-full rounded-lg text-sm font-semibold"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {isSignUp ? 'Create account' : 'Sign in'}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              {notice.text && (
                <p className={`mt-4 rounded-lg border px-3 py-2 text-sm ${noticeClasses[notice.tone]}`}>
                  {notice.text}
                </p>
              )}

              <p className="mt-5 text-center text-sm text-muted-foreground">
                {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                  onClick={onToggleMode}
                >
                  {mode === 'signup' ? 'Sign in' : 'Sign up'}
                </button>
              </p>
            </div>
          </div>
        </section>

        <section className="hidden min-h-0 p-2 min-[900px]:block">
          <div className="relative h-full overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <img
              src={authVisual}
              alt="A focused desktop workspace"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-10 text-white">
              <div className="mb-5 flex w-fit items-center gap-2 rounded-md bg-white/12 px-3 py-1 text-xs font-medium backdrop-blur">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Desktop native, web fast
              </div>
              <h2 className="max-w-xl text-3xl font-semibold leading-tight tracking-tight">
                A quieter place to compile ideas into working software.
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-6 text-white/78">
                Keep the workflow focused with a native Wails shell, polished auth entry, and a
                production-ready dashboard once you sign in.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
