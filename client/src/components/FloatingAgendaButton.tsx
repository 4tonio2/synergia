import { Calendar } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

/**
 * FloatingAgendaButton
 * - Affiché sur toutes les pages authentifiées
 * - Ouvre l'application Agenda avec l'email de l'utilisateur en paramètre de requête
 * - Hypothèse: le paramètre attendu est `email` (peut être ajusté si l'autre app en attend un différent)
 */
export default function FloatingAgendaButton() {
  const { isAuthenticated, supabaseUser, user } = useAuth();
  const [location] = useLocation();

  // Pages où on cache le bouton (similaire à la navbar)
  const hiddenPaths = [
    "/landing",
    "/patients/*/record",
    "/recordings/new-free",
    "/login",
    "/home",
    "/signup",
    "/register",
    "/auth",
  ];

  const shouldHide = hiddenPaths.some((path) => {
    if (path.includes("*")) {
      const regex = new RegExp("^" + path.replace("*", "[^/]+") + "$");
      return regex.test(location);
    }
    return location === path;
  });

  if (!isAuthenticated || shouldHide) return null;

  const email = supabaseUser?.email ?? user?.email ?? "";

  const openAgenda = () => {
    const baseUrl = "https://agenda-v0.vercel.app";
    const url = email
      ? `${baseUrl}?email=${encodeURIComponent(email)}`
      : baseUrl;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      onClick={openAgenda}
      aria-label="Ouvrir mon agenda"
      className="absolute right-4 bottom-24 z-50 flex items-center justify-center w-14 h-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 text-white transition-all duration-200 hover:scale-105 active:scale-95"
      title="Agenda"
    >
      <Calendar className="w-6 h-6" />
    </button>
  );
}
