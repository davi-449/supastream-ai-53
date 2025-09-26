import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Upload,
  GitBranch,
  Database,
  FileText,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { knowledge, KnowledgeFile } from "@/lib/knowledge";
import TaskChecklist from "@/components/TaskChecklist";
import { getSupabaseClient } from '@/lib/supabase';

interface Project {
  id: string;
  name: string;
  github: boolean;
  supabase: boolean;
}

interface ProjectConfigProps {
  project?: Project | null;
  onUpdate: (updates: Partial<Project>) => void;
}

const ProjectConfig = ({ project, onUpdate }: ProjectConfigProps) => {
  if (!project) {
    return (
      <div className="w-full p-8 text-center text-muted-foreground">
        Nenhum projeto carregado.<br/>Conecte ao Supabase e selecione um projeto para ver as configurações.
      </div>
    );
  }
  const [githubToken, setGithubToken] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGlobalDefault, setIsGlobalDefault] = useState(true);
  const [files, setFiles] = useState<KnowledgeFile[]>([]);

  // Integration states
  const [githubStatus, setGithubStatus] = useState<'idle'|'pending'|'connected'|'error'>(project.github ? 'connected' : 'idle');
  const [supStatus, setSupStatus] = useState<'idle'|'pending'|'connected'|'error'>(project.supabase ? 'connected' : 'idle');
  const [githubReadOnly, setGithubReadOnly] = useState(false);
  const [supReadOnly, setSupReadOnly] = useState(false);

  const { toast } = useToast();

  function maskToken(token: string | undefined, prefix = 'ghp') {
    if (!token) return '';
    const visible = token.slice(-4);
    if (token.length <= 8) return `${prefix}_xx...${visible}`;
    return `${prefix}_xx...${visible}`;
  }

  useEffect(() => {
    const res = knowledge.queryAccessible(project.id);
    setFiles(res.files);
  }, [project.id]);

  // Load persisted integrations from Supabase when the project mounts/changes
  useEffect(() => {
    async function fetchIntegrations() {
      const client = getSupabaseClient();
      if (!client) return;
      try {
        const { data: githubData } = await client
          .from('github_integrations')
          .select('*')
          .eq('project_id', project.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (Array.isArray(githubData) && githubData.length > 0) {
          const gh = githubData[0] as any;
          if (gh && gh.status === 'connected') {
            const token = (gh.meta && gh.meta.token) || gh.token || '';
            if (!githubToken) {
              setGithubToken(token ? maskToken(token, 'ghp') : '');
            }
            setGithubReadOnly(!!token);
            setGithubStatus('connected');
          }
        }

        const { data: supData } = await client
          .from('supabase_integrations')
          .select('*')
          .eq('project_id', project.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (Array.isArray(supData) && supData.length > 0) {
          const sb = supData[0] as any;
          if (sb && sb.status === 'connected') {
            const url = sb.project_url || '';
            const key = sb.anon_key || '';
            if (!supabaseUrl) {
              setSupabaseUrl(url);
            }
            if (!supabaseKey) {
              setSupabaseKey(key ? maskToken(key, 'sb') : '');
            }
            setSupReadOnly(!!key || !!url);
            setSupStatus('connected');
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error fetching integrations', e);
      }
    }

    fetchIntegrations();
  }, [project.id]);

  const projectFiles = useMemo(() => knowledge.listForProject(project.id), [project.id, files]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const f = event.target.files;
    if (!f) return;

    Array.from(f).forEach(file => {
      if (file.type === 'application/pdf') {
        // Knowledge system disabled - files must be handled through Supabase
        const rec = { id: Date.now().toString(), filename: file.name, uploadedAt: new Date().toISOString(), isGlobal: isGlobalDefault };
        setFiles(prev => [...prev, rec]);
        toast({
          title: "PDF Enviado",
          description: `${file.name} adicionado ao acervo ${isGlobalDefault ? 'global' : 'do projeto'}.`,
        });
      } else {
        toast({
          title: "Arquivo Inválido",
          description: "Apenas arquivos PDF são aceitos.",
          variant: "destructive"
        });
      }
    });

    event.target.value = '';
  };

  const handleRemoveFile = (fileId: string) => {
    // Knowledge system disabled - file removal must be handled through Supabase
    setFiles(prev => prev.filter(f => f.id !== fileId));
    toast({
      title: "PDF Removido",
      description: "Arquivo removido do acervo.",
    });
  };

  const handleToggleGlobal = (file: KnowledgeFile) => {
    const newVal = !file.isGlobal;
    // Knowledge system disabled - global setting must be handled through Supabase
    setFiles(prev => prev.map(f => (f.id === file.id ? { ...f, isGlobal: newVal } : f)));
  };

  const handleGithubConnect = async () => {
    if (!githubToken.trim()) {
      toast({
        title: "Token Obrigatório",
        description: "Insira seu token do GitHub.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      onUpdate({ github: true });
      setGithubToken('');
      setIsLoading(false);
      toast({
        title: "GitHub Conectado",
        description: "Integração configurada com sucesso!",
      });
    }, 1200);
  };

  const handleSupabaseConnect = async () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      toast({
        title: "Dados Obrigatórios",
        description: "Insira URL e chave do Supabase.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      onUpdate({ supabase: true });
      setSupabaseUrl('');
      setSupabaseKey('');
      setIsLoading(false);
      toast({
        title: "Supabase Conectado",
        description: "Integração configurada com sucesso!",
      });
    }, 1200);
  };

  const getStatusBadge = (connected: boolean, service: string) => {
    if (connected) {
      return (
        <Badge className="badge-success">
          <CheckCircle className="h-3 w-3 mr-1" />
          {service} Conectado
        </Badge>
      );
    }
    return (
      <Badge className="badge-error">
        <XCircle className="h-3 w-3 mr-1" />
        {service} Pendente
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Configurações do Projeto</h2>
        <div className="flex gap-2">
          {getStatusBadge(project.github, 'GitHub')}
          {getStatusBadge(project.supabase, 'Supabase')}
        </div>
      </div>

      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="documents">
            <FileText className="h-4 w-4 mr-2" />
            Documentos PDF
          </TabsTrigger>
          <TabsTrigger value="github">
            <GitBranch className="h-4 w-4 mr-2" />
            GitHub
          </TabsTrigger>
          <TabsTrigger value="supabase">
            <Database className="h-4 w-4 mr-2" />
            Supabase
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Upload de PDFs para IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg" role="note" aria-live="polite">
                <span className="text-sm">Arquivos adicionados aqui entram no acervo global por padrão. Desmarque para restringir ao projeto atual.</span>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox id="is-global" checked={isGlobalDefault} onCheckedChange={(v) => setIsGlobalDefault(!!v)} />
                <Label htmlFor="is-global">Disponível para todos os projetos</Label>
              </div>

              <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-medium mb-2">Adicionar PDFs ao Acervo</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Faça upload de manuais, especificações e documentos para o Pilot consultar
                </p>
                <Label htmlFor="pdf-upload" className="cursor-pointer">
                  <Button variant="outline" asChild>
                    <span>Selecionar PDFs</span>
                  </Button>
                </Label>
                <Input
                  id="pdf-upload"
                  type="file"
                  accept=".pdf"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  aria-label="Upload de arquivos PDF"
                />
              </div>

              {projectFiles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Arquivos Acessíveis ({projectFiles.length})</Label>
                  {projectFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-destructive" />
                        <div>
                          <p className="font-medium text-sm">{file.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            Upload: {new Date(file.uploadedAt).toLocaleDateString('pt-BR')} • {file.isGlobal ? 'Global' : 'Vinculado ao projeto'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleToggleGlobal(file)}
                          aria-label={`Tornar ${file.filename} ${file.isGlobal ? 'apenas do projeto' : 'global'}`}
                        >
                          {file.isGlobal ? 'Tornar do projeto' : 'Tornar global'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveFile(file.id)}
                          aria-label={`Remover ${file.filename}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Checklist de Tarefas</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskChecklist
                initial={[
                  { id: 'cat1', title: 'Planejamento', items: [
                    { id: 't1', label: 'Definir escopo', done: false },
                    { id: 't2', label: 'Mapear integrações', done: false },
                  ]},
                  { id: 'cat2', title: 'Execução', items: [
                    { id: 't3', label: 'Implementar chat moderno', done: false },
                    { id: 't4', label: 'Configurar acervo global', done: false },
                  ]},
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="github" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Integração GitHub
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <AlertCircle className="h-4 w-4 text-warning" />
                <p className="text-sm">
                  Configure seu token GitHub para sincronização automática de código
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="github-token">Token de Acesso GitHub</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="github-token"
                      type={showSecrets ? 'text' : 'password'}
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className="flex-1"
                      autoComplete="off"
                      aria-label="Token de acesso GitHub"
                      readOnly={githubReadOnly}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowSecrets(!showSecrets)}
                      aria-label={showSecrets ? 'Ocultar token' : 'Mostrar token'}
                      disabled={githubReadOnly}
                    >
                      {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Crie em: GitHub → Settings → Developer settings → Personal access tokens
                  </p>
                </div>

                <Button
                  onClick={handleGithubConnect}
                  disabled={isLoading || project.github || !githubToken.trim()}
                  className="w-full"
                >
                  {isLoading ? 'Conectando...' : 'Conectar GitHub'}
                </Button>
              </div>

              {project.github && (
                <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium text-success">GitHub conectado com sucesso!</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="supabase" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Integração Supabase
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <AlertCircle className="h-4 w-4 text-warning" />
                <p className="text-sm">
                  Configure Supabase para backend, banco de dados e autenticação
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="supabase-url">URL do Projeto</Label>
                  <Input
                    id="supabase-url"
                    type="text"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    placeholder="https://your-project.supabase.co"
                    className="mt-1"
                    autoComplete="off"
                    aria-label="URL do projeto Supabase"
                    readOnly={supReadOnly}
                  />
                </div>

                <div>
                  <Label htmlFor="supabase-key">Chave de API (anon/public)</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="supabase-key"
                      type={showSecrets ? 'text' : 'password'}
                      value={supabaseKey}
                      onChange={(e) => setSupabaseKey(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="flex-1"
                      autoComplete="off"
                      aria-label="Chave de API Supabase"
                      readOnly={supReadOnly}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowSecrets(!showSecrets)}
                      aria-label={showSecrets ? 'Ocultar chave' : 'Mostrar chave'}
                      disabled={supReadOnly}
                    >
                      {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Encontre em: Supabase Dashboard → Settings → API
                  </p>
                </div>

                <Button
                  onClick={handleSupabaseConnect}
                  disabled={isLoading || project.supabase || !supabaseUrl.trim() || !supabaseKey.trim()}
                  className="w-full"
                >
                  {isLoading ? 'Conectando...' : 'Conectar Supabase'}
                </Button>
              </div>

              {project.supabase && (
                <div className="p-3 bg-success/10 border border-success/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span className="text-sm font-medium text-success">Supabase conectado com sucesso!</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjectConfig;
