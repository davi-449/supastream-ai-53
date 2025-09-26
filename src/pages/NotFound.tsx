import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, Search } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-md">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-primary">404</h1>
          <h2 className="text-2xl font-semibold text-foreground">Página não encontrada</h2>
          <p className="text-muted-foreground">
            A página que você está procurando não existe ou foi movida.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <a href="/">
              <Home className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/">
              <Search className="h-4 w-4 mr-2" />
              Buscar Projetos
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
