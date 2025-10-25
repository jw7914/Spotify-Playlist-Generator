export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-5xl font-bold mb-4 text-primary">404</h1>
        <h2 className="text-2xl font-semibold mb-2">Page Not Found</h2>
        <p className="mb-6 text-muted-foreground">
          Sorry, the page you are looking for does not exist or has been moved.
        </p>
        <a
          href="/"
          className="inline-block px-6 py-2 rounded bg-primary text-white font-medium hover:bg-primary/90 transition"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}
