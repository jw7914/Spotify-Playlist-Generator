export default function LoginPage() {
  const handleLogin = () => {
    // Use the backend URL in development, otherwise use relative path for production
    const backend = import.meta.env.DEV ? "http://localhost:8000" : "";
    window.location.href = `${backend}/api/auth/login`;
  };
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-4">
      <div className="max-w-md w-full text-center bg-card p-8 rounded-lg shadow">
        <h1 className="text-3xl font-bold mb-4 text-primary">
          Sign in to Spotify
        </h1>
        <p className="mb-6 text-muted-foreground">
          To use the Spotify Playlist Generator, please sign in with your
          Spotify account.
        </p>
        <button
          onClick={handleLogin}
          className="inline-flex items-center gap-2 px-6 py-2 rounded bg-primary text-white font-medium hover:bg-primary/90 transition text-lg shadow"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="12" cy="12" r="12" fill="#1DB954" />
            <path
              d="M17.25 16.13c-.38 0-.62-.12-.87-.25-2.37-1.38-5.37-1.5-8.12-.44-.37.13-.75-.06-.88-.43-.13-.37.06-.75.43-.88 3.08-1.15 6.38-1.01 9.05.5.35.2.47.65.27 1-.13.23-.37.36-.61.36zm1.23-2.62c-.48 0-.77-.18-1.08-.34-2.7-1.6-6.82-2.07-10-.6-.46.16-.96-.09-1.12-.55-.16-.46.09-.96.55-1.12 3.6-1.25 8.13-.73 11.18.74.44.22.61.76.39 1.2-.16.31-.47.47-.92.47zm.13-2.7c-3.23-1.92-8.56-2.09-11.6-.6-.54.25-1.18.02-1.43-.52-.25-.54-.02-1.18.52-1.43 3.5-1.62 9.38-1.42 13.02.74.56.33.74 1.05.41 1.61-.22.36-.62.56-1.01.56z"
              fill="#fff"
            />
          </svg>
          Sign in with Spotify
        </button>
      </div>
    </div>
  );
}
