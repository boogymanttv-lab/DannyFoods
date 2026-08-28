export function GoogleButton({ redirectTo }: { redirectTo: string }) {
  return (
    <a
      href={`/api/account/google/start?redirect=${encodeURIComponent(redirectTo)}`}
      className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-border bg-white py-3 font-semibold text-sm text-foreground/80 hover:bg-black/5 transition-colors"
    >
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" width="18" height="18">
        <path
          fill="#4285F4"
          d="M23.49 12.27c0-.82-.07-1.42-.22-2.05H12v3.72h6.5c-.13 1.06-.84 2.66-2.42 3.73l-.02.15 3.52 2.7.24.02c2.24-2.06 3.53-5.1 3.53-8.27z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.95-1.06 7.93-2.88l-3.78-2.92c-1.02.7-2.4 1.2-4.15 1.2-3.18 0-5.88-2.1-6.84-5l-.14.01-3.68 2.84-.05.14C3.26 21.3 7.31 24 12 24z"
        />
        <path
          fill="#FBBC05"
          d="M5.16 14.4a7.2 7.2 0 0 1-.38-2.4c0-.84.14-1.65.37-2.4l-.01-.16-3.73-2.9-.12.06A11.98 11.98 0 0 0 0 12c0 1.93.47 3.76 1.29 5.4l3.87-3z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c2.25 0 3.77.97 4.64 1.79l3.38-3.3C17.94 1.2 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.6l3.86 3c.97-2.9 3.67-5 6.85-5z"
        />
      </svg>
      Вход с Google
    </a>
  );
}
