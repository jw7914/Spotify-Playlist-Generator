import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function LogoutPage() {
  const { logout } = useAuth();

  useEffect(() => {
    logout();
  }, [logout]);

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center animate-pulse">
          <h1 className="text-2xl font-bold mb-2">Signing out...</h1>
          <p className="text-zinc-500">Please wait a moment.</p>
        </div>
      </div>
    </>
  );
}
