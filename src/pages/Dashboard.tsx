import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import ProjectOnboard from '@/components/ProjectOnboard';
import ProjectCard from "@/components/ProjectCard";
import { getSupabaseClient } from '@/lib/supabase';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Settings,
  User,
  LogOut,
  Grid3X3,
  List
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import BackendStatusBadge from "@/components/BackendStatusBadge";
import { useAuth } from '@/contexts/AuthContext';

interface Project {
  id: string;
  name: string;
  description: string;
  github: boolean;
  supabase: boolean;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [onboardOpen, setOnboardOpen] = useState(false);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!user) {
    window.location.href = '/login';
    return null;
  }

  // Projects must be loaded from Supabase. No local mocks or fallbacks allowed.
  const [projects, setProjects] = useState<Project[]>([]);
  const [fetchError, setFetchError] = useState<any | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const filteredProjects = projects.filter(project =>
    (project.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (project.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    let mounted = true;
    async function fetchProjects() {
      setLoadingProjects(true);
      setFetchError(null);
      const client = getSupabaseClient();
      if (!client) {
        setFetchError(new Error('Supabase client não configurado'));
        setProjects([]);
        setLoadingProjects(false);
        return;
      }
      try {
        const { data, error } = await client.from('projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        if (!mounted) return;
        if (error) {
          setFetchError(error);
          setProjects([]);
        } else {
          setProjects(data ?? []);
        }
      } catch (e) {
        setFetchError(e);
        setProjects([]);
      } finally {
        setLoadingProjects(false);
      }
    }
    if (user?.id) fetchProjects();
    return () => { mounted = false; };
  }, [user?.id, refreshKey]);

  // Diagnóstico ácido de multi-tenant Supabase - Só use se quer saber direito
  useEffect(() => {
    (async () => {
      const client = getSupabaseClient();
      if (!client) return;
      const supabase: any = client;

      const userRes = await supabase.auth.getUser();
      console.log("Usuário autenticado:", userRes);

      const { data: projects, error: errProjects } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userRes.data?.user?.id);
      console.log("Projetos:", projects, "Erro:", errProjects);

      if (projects && projects.length > 0) {
        const pid = projects[0].id;
        const { data: github, error: errGithub } = await supabase
          .from('github_integrations')
          .select('*')
          .eq('project_id', pid);
        console.log("GitHub Integrations:", github, "Erro:", errGithub);

        const { data: supab, error: errSupab } = await supabase
          .from('supabase_integrations')
          .select('*')
          .eq('project_id', pid);
        console.log("Supabase Integrations:", supab, "Erro:", errSupab);

        if (errProjects || errGithub || errSupab) {
          throw new Error(JSON.stringify({ errProjects, errGithub, errSupab }));
        }
      }

      const { data: builder, error: errBuilder } = await supabase
        .from('builder_data')
        .select('*')
        .eq('user_id', userRes.data?.user?.id);
      console.log("builder_data:", builder, "Erro:", errBuilder);

      if (errBuilder) {
        throw new Error(JSON.stringify({ errBuilder }));
      }
    })();
  }, []);

  const handleProjectClick = (projectId: string) => {
    navigate(`/project/${projectId}`);
  };

  const handleNewProject = () => {
    // Open onboarding modal
    setOnboardOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                SaaS Projects
              </h1>
              <div className="text-sm text-muted-foreground">
                {projects.length} projeto{projects.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <BackendStatusBadge />
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar projetos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-80"
                  aria-label="Buscar projetos"
                />
              </div>

              {/* View Toggle */}
              <div className="flex items-center border rounded-lg p-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  aria-label="Visualização em grade"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  aria-label="Visualização em lista"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        U
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    <span>Perfil</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Configurações</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={async () => { await signOut(); window.location.href = '/login'; }}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sair</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {searchQuery && (
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">
              {filteredProjects.length} resultado{filteredProjects.length !== 1 ? 's' : ''} para "{searchQuery}"
            </p>
          </div>
        )}

        {/* Projects Grid */}
        {fetchError && (
          <div className="mb-4 text-red-600">{(fetchError && (fetchError.message || JSON.stringify(fetchError))) || 'Erro ao carregar projetos'}</div>
        )}
        <div className={`grid gap-6 ${
          viewMode === 'grid'
            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
            : 'grid-cols-1 max-w-4xl mx-auto'
        }`}>
          {/* New Project Card */}
          <ProjectCard
            isNewProject
            onClick={handleNewProject}
          />

          {/* Existing Projects */}
          {loadingProjects ? (
            <div className="col-span-full p-8 text-center">Carregando projetos...</div>
          ) : (
            filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => handleProjectClick(project.id)}
              />
            ))
          )}
        </div>

        {/* Empty State */}
        {filteredProjects.length === 0 && !loadingProjects && searchQuery && (
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-4">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Nenhum projeto encontrado</h3>
              <p>Tente buscar com outros termos ou crie um novo projeto.</p>
            </div>
            <Button onClick={handleNewProject} className="mt-4">
              Criar Novo Projeto
            </Button>
          </div>
        )}

        {/* Stats Footer */}
        <div className="mt-16 pt-8 border-t">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">{projects.length}</div>
              <div className="text-sm text-muted-foreground">Projetos Ativos</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-success">
                {projects.filter(p => p.github && p.supabase).length}
              </div>
              <div className="text-sm text-muted-foreground">Totalmente Integrados</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-warning">
                {projects.filter(p => !p.github || !p.supabase).length}
              </div>
              <div className="text-sm text-muted-foreground">Precisam Configuração</div>
            </div>
          </div>
        </div>
      </main>

      <ProjectOnboard open={onboardOpen} onOpenChange={setOnboardOpen} onCreated={(projectId) => {
        if (projectId) navigate(`/project/${projectId}`);
        setRefreshKey(k => k + 1);
      }} />
    </div>
  );
};

export default Dashboard;
