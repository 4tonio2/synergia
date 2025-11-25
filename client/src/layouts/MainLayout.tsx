import { useLocation, Link } from "wouter";
import { Users, Mic, Settings } from "lucide-react";
import { ReactNode } from "react";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { path: "/patients", label: "Patients", icon: Users },
    { path: "/recordings", label: "Enregistrements", icon: Mic },
    { path: "/settings", label: "Paramètres", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <main className="flex-1 pb-20">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="flex justify-around items-center h-16">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path || location.startsWith(item.path + "/");
              
              return (
                <Link key={item.path} href={item.path}>
                  <a className={`flex flex-col items-center justify-center px-4 h-full transition-colors relative ${isActive ? "text-primary" : "text-gray-500 hover:text-gray-700"}`}>
                    <Icon className={`w-6 h-6 mb-1 ${isActive ? "stroke-[2.5]" : ""}`} />
                    <span className={`text-xs ${isActive ? "font-semibold" : "font-medium"}`}>{item.label}</span>
                    {isActive && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />}
                  </a>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
