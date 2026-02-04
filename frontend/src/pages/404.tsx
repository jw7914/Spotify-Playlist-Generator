import { Button } from "@heroui/react";
import { AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white px-4">
      <div className="max-w-md w-full text-center flex flex-col items-center gap-6">
        <AlertCircle size={80} className="text-red-500" />
        <div className="space-y-2">
            <h1 className="text-5xl font-bold text-white">404</h1>
            <h2 className="text-2xl font-semibold text-zinc-300">Page Not Found</h2>
        </div>
        <p className="text-zinc-400">
          Sorry, the page you are looking for does not exist or has been moved.
        </p>
        <Button
          onPress={() => navigate("/")}
          className="bg-green-500 text-black font-bold"
          size="lg"
          variant="flat"
        >
          Go Home
        </Button>
      </div>
    </div>
  );
}
