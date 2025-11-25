import { useToast as useToastOriginal } from "@/hooks/use-toast";

export function useCustomToast() {
  const { toast } = useToastOriginal();

  const success = (message: string) => {
    toast({
      title: "✅ Succès",
      description: message,
      className: "bg-green-50 border-green-200",
    });
  };

  const error = (message: string) => {
    toast({
      title: "❌ Erreur",
      description: message,
      variant: "destructive",
    });
  };

  const info = (message: string) => {
    toast({
      title: "ℹ️ Information",
      description: message,
      className: "bg-blue-50 border-blue-200",
    });
  };

  const warning = (message: string) => {
    toast({
      title: "⚠️ Attention",
      description: message,
      className: "bg-yellow-50 border-yellow-200",
    });
  };

  return { success, error, info, warning };
}
