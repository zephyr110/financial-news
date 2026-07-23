import { Alert, AlertDescription } from "./ui/alert";
import { AlertCircle } from "lucide-react";

export default function ErrorBanner({ message }) {
  if (!message) return null;

  return (
    <Alert variant="destructive" className="mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
