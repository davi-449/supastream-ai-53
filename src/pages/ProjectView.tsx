import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import PilotChat from "@/components/PilotChat";
import ProjectConfig from "@/components/ProjectConfig";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSupabaseClient } from '@/lib/supabase';
import {
  ArrowLeft,
  MessageSquare,
  Settings,
  GitBranch,
  Database,
  FileText,
  Activity
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import BackendStatusBadge from "@/components/BackendStatusBadge";
import { useAuth } from '@/contexts/AuthContext';

interface Project {
  id: string;
  name: string;
  description: string;
  github: boolean;
  supabase: boolean;
  hasDocuments: boolean;
}

const ProjectView = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("chat");

  // auth guard
  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!user) { window.location.href = '/login'; return null; }

  // Project data must be loaded from Supabase. No local mocks are used.
  const [project, setProject] = useState<Project | null>(null);

  const [isNewProject, setIsNewProject] = useState(false);

  useEffect(() => {
    if (projectId === 'new') {
      setIsNewProject(true);
      setProject({
        id: 'new',
        name: 'Novo Projeto',
        description: 'Configure seu novo projeto com IA Pilot',
        github: false,
        supabase: false,
        hasDocuments: false
      });
      setActiveTab('config');
      return;
    }

    // When opening an existing project, fetch it from Supabase and log diagnostics
    (async () => {
      // Log open action
      // eslint-disable-next-line no-console
      console.log('Opening project view for id=', projectId);
      const client = getSupabaseClient();
      if (!client) {
        // eslint-disable-next-line no-console
        console.log('Supabase client not configured, cannot fetch project');
        return;
      }

      try {
        const { data: projData, error: projErr } = await client.from('projects').select('*').eq('id', projectId).single();
        // eslint-disable-next-line no-console
        console.log('Fetched project:', projData, 'Error:', projErr);
        if (projErr) {
          // leave project null to show error state
          return;
        }
        setProject(projData || null);

        // Fetch builder_data (diagnostic) but do not block rendering if empty
        const { data: builderData, error: builderErr } = await client.from('builder_data').select('*').eq('user_id', user?.id);
        // eslint-disable-next-line no-console
        console.log('builder_data:', builderData, 'Error:', builderErr);

        // Fetch integrations (diagnostic)
        const { data: github, error: githubErr } = await client.from('github_integrations').select('*').eq('project_id', projectId);
        // eslint-disable-next-line no-console
        console.log('GitHub Integrations:', github, 'Error:', githubErr);

        const { data: supab, error: supabErr } = await client.from('supabase_integrations').select('*').eq('project_id', projectId);
        // eslint-disable-next-line no-console
        console.log('Supabase Integrations:', supab, 'Error:', supabErr);

        // Update project booleans based on integrations status === 'connected'
        const hasGithubConnected = Array.isArray(github) && github.some((it: any) => it && it.status === 'connected');
        const hasSupabaseConnected = Array.isArray(supab) && supab.some((it: any) => it && it.status === 'connected');
        setProject(prev => prev ? ({ ...prev, github: !!hasGithubConnected, supabase: !!hasSupabaseConnected }) : null);

      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error fetching project diagnostics', e);
      }
    })();

  }, [projectId]);

  const handleBackToDashboard = () => {
    navigate('/');
  };

  const handleProjectUpdate = (updates: Partial<Project>) => {
    setProject(prev => ({ ...prev, ...updates }));
    
    if (isNewProject && (updates.github || updates.supabase)) {
      toast({
        title: "Projeto Configurado",
        description: "Agora você pode usar o Pilot AI!",
      });
      setActiveTab('chat');
    }
  };

  const getIntegrationStatus = () => {
    const githubConnected = !!project?.github;
    const supabaseConnected = !!project?.supabase;
    const connected = [githubConnected, supabaseConnected].filter(Boolean).length;
    const total = 2;

    if (connected === total) return { status: 'complete', color: 'success', text: 'Integrado' };
    if (connected > 0) return { status: 'partial', color: 'warning', text: 'Parcial' };
    return { status: 'none', color: 'error', text: 'Pendente' };
  };

  const integrationStatus = getIntegrationStatus();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackToDashboard}
                aria-label="Voltar ao dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              
              <div>
                <h1 className="text-xl font-semibold">{project?.name ?? 'Projeto'}</h1>
                <p className="text-sm text-muted-foreground">{project?.description ?? ''}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <BackendStatusBadge />
              <Badge className={`badge-${integrationStatus.color}`}>
                <Activity className="h-3 w-3 mr-1" />
                {integrationStatus.text}
              </Badge>
              {project?.github ? (
                <Badge className="badge-success">
                  <GitBranch className="h-3 w-3 mr-1" />
                  GitHub
                </Badge>
              ) : null}
              {project?.supabase ? (
                <Badge className="badge-success">
                  <Database className="h-3 w-3 mr-1" />
                  Supabase
                </Badge>
              ) : null}
              {project?.hasDocuments ? (
                <Badge variant="secondary">
                  <FileText className="h-3 w-3 mr-1" />
                  PDFs
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 h-[calc(100vh-80px)]">
        {(!project && !isNewProject) ? (
          <div className="h-64 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="text-muted-foreground">
                <h3 className="text-lg font-medium">Projeto não carregado</h3>
                <p>Conecte o Supabase e abra o projeto para carregar os dados reais. Sem conexão, não há mocks locais.</p>
              </div>
            </div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-6">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat Pilot
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configurações
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0">
            <TabsContent value="chat" className="h-full m-0">
              {(!project?.github && !project?.supabase && !isNewProject) ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center space-y-4 max-w-md">
                    <div className="text-muted-foreground">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">Configure as Integrações</h3>
                      <p className="text-sm">
                        Para usar o Pilot AI, configure pelo menos uma integração (GitHub ou Supabase) na aba de configurações.
                      </p>
                    </div>
                    <Button onClick={() => setActiveTab('config')}>
                      Ir para Configurações
                    </Button>
                  </div>
                </div>
              ) : (
                project ? (
                  <PilotChat
                    projectId={project.id}
                    projectName={project.name}
                    hasDocuments={project.hasDocuments}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">Projeto carregando...</div>
                )
              )}
            </TabsContent>

            <TabsContent value="config" className="h-full m-0 overflow-auto">
              <div className="max-w-4xl mx-auto">
                <ProjectConfig 
                  project={project}
                  onUpdate={handleProjectUpdate}
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>
        )}
      </main>
    </div>
  );
};

export default ProjectView;
