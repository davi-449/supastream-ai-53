import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ProjectOnboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (projectId: string) => void;
}

export default function ProjectOnboard({ open, onOpenChange, onCreated }: ProjectOnboardProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = [
    'Detalhes',
    'Integrações',
    'Documentos',
    'Revisão',
  ];

  const [showGitForm, setShowGitForm] = useState(false);
  const [gitRepo, setGitRepo] = useState('');
  const [gitToken, setGitToken] = useState('');
  const [gitStatus, setGitStatus] = useState<'idle'|'pending'|'connected'|'error'>('idle');
  const [pendingGit, setPendingGit] = useState<{ repository_url: string; token: string } | null>(null);

  const [showSupForm, setShowSupForm] = useState(false);
  const [supUrl, setSupUrl] = useState('');
  const [supKey, setSupKey] = useState('');
  const [supStatus, setSupStatus] = useState<'idle'|'pending'|'connected'|'error'>('idle');
  const [pendingSup, setPendingSup] = useState<{ project_url: string; anon_key: string } | null>(null);

  const canNext = step === 0 ? !!name.trim() : true;

  function maskToken(token: string | undefined, prefix = 'ghp') {
    if (!token) return '';
    const visible = token.slice(-4);
    if (token.length <= 8) return `${prefix}_xx...${visible}`;
    return `${prefix}_xx...${visible}`;
  }

  const { toast } = useToast();

  async function validateGithubToken(token: string) {
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' }
      });
      return res.status === 200;
    } catch (_) {
      return false;
    }
  }

  async function validateSupabaseKey(url: string, key: string) {
    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
        method: 'GET',
        headers: { apikey: key, Authorization: `Bearer ${key}` }
      });
      return res.status !== 401 && res.status !== 403;
    } catch (_) {
      return false;
    }
  }

  async function saveGitIntegration(projectId?: string | null) {
    setError(null);
    const client = getSupabaseClient();
    if (!client) {
      setError('Supabase client não configurado.');
      return;
    }
    // If projectId is provided, validate then insert; otherwise mark pending
    if (!gitRepo) {
      setError('Informe a URL do repositório.');
      return;
    }
    setGitStatus('pending');
    const isValid = gitToken ? await validateGithubToken(gitToken) : false;
    if (!isValid) {
      setGitStatus('error');
      toast({ title: 'Token inválido', description: 'Token GitHub inválido. Verifique e tente novamente.', variant: 'destructive' });
      return;
    }
    if (projectId) {
      try {
        const { error: err } = await client.from('github_integrations').insert({
          project_id: projectId,
          repository_url: gitRepo,
          status: 'connected',
          meta: { token: gitToken }
        });
        if (err) {
          setGitStatus('error');
          setError(err.message);
        } else {
          setGitStatus('connected');
          setPendingGit(null);
          toast({ title: 'GitHub conectado', description: 'Integração GitHub validada com sucesso.' });
        }
      } catch (e: any) {
        setGitStatus('error');
        setError(e?.message || 'Erro ao salvar integração GitHub');
      }
    } else {
      setPendingGit({ repository_url: gitRepo, token: gitToken });
      setGitStatus('pending');
    }
  }

  async function saveSupabaseIntegration(projectId?: string | null) {
    setError(null);
    const client = getSupabaseClient();
    if (!client) {
      setError('Supabase client não configurado.');
      return;
    }
    if (!supUrl || !supKey) {
      setError('Informe a URL e a anon key do Supabase.');
      return;
    }
    setSupStatus('pending');
    const isValid = await validateSupabaseKey(supUrl, supKey);
    if (!isValid) {
      setSupStatus('error');
      toast({ title: 'Chave inválida', description: 'Supabase URL/Key inválida. Verifique e tente novamente.', variant: 'destructive' });
      return;
    }
    if (projectId) {
      try {
        const { error: err } = await client.from('supabase_integrations').insert({
          project_id: projectId,
          project_url: supUrl,
          anon_key: supKey,
          status: 'connected',
          meta: {}
        });
        if (err) {
          setSupStatus('error');
          setError(err.message);
        } else {
          setSupStatus('connected');
          setPendingSup(null);
          toast({ title: 'Supabase conectado', description: 'Integração Supabase validada com sucesso.' });
        }
      } catch (e: any) {
        setSupStatus('error');
        setError(e?.message || 'Erro ao salvar integração Supabase');
      }
    } else {
      setPendingSup({ project_url: supUrl, anon_key: supKey });
      setSupStatus('pending');
    }
  }

  async function commitPendingIntegrations(projectId: string) {
    const client = getSupabaseClient();
    if (!client) return;
    if (pendingGit) {
      try {
        // validate before inserting
        const valid = pendingGit.token ? await validateGithubToken(pendingGit.token) : false;
        if (!valid) {
          setGitStatus('error');
          toast({ title: 'Token inválido', description: 'Token GitHub inválido. Não foi possível validar integração.', variant: 'destructive' });
        } else {
          await client.from('github_integrations').insert({
            project_id: projectId,
            repository_url: pendingGit.repository_url,
            status: 'connected',
            meta: { token: pendingGit.token }
          });
          setGitStatus('connected');
          setPendingGit(null);
        }
      } catch (_) {
        setGitStatus('error');
      }
    }
    if (pendingSup) {
      try {
        const valid = await validateSupabaseKey(pendingSup.project_url, pendingSup.anon_key);
        if (!valid) {
          setSupStatus('error');
          toast({ title: 'Chave inválida', description: 'Supabase URL/Key inválida. Não foi possível validar integração.', variant: 'destructive' });
        } else {
          await client.from('supabase_integrations').insert({
            project_id: projectId,
            project_url: pendingSup.project_url,
            anon_key: pendingSup.anon_key,
            status: 'connected',
            meta: {}
          });
          setSupStatus('connected');
          setPendingSup(null);
        }
      } catch (_) {
        setSupStatus('error');
      }
    }
  }

  async function handleCreate() {
    setError(null);
    const client = getSupabaseClient();
    if (!client) {
      setError('Supabase client não configurado.');
      return;
    }
    setLoading(true);
    try {
      if (!user) {
        setError('Usuário não autenticado. Faça login antes de criar um projeto.');
        setLoading(false);
        return;
      }

      const payload = { user_id: user.id, name: name.trim(), description: description.trim() };
      const { data, error: err } = await client.from('projects').insert(payload).select('*').single();
      if (err) {
        setError(err.message);
      } else if (data && (data.id || data[0]?.id)) {
        const projectId = data.id || data[0]?.id;
        // commit any pending integrations
        await commitPendingIntegrations(projectId);
        onOpenChange(false);
        onCreated?.(projectId);
      } else {
        onOpenChange(false);
        onCreated?.(data?.id || data?.[0]?.id || '');
      }
    } catch (e: any) {
      setError(e?.message || 'Erro ao criar projeto');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <Dialog.Overlay className="fixed inset-0 bg-black/40" />
          <div className="bg-white rounded-lg shadow-lg z-50 max-w-xl w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2 items-center">
                  {steps.map((s, i) => (
                    <div key={i} className={`h-2 w-8 rounded-full ${i <= step ? 'bg-primary' : 'bg-gray-200'}`} />
                  ))}
                </div>
                <Dialog.Close asChild>
                  <button className="text-sm text-muted-foreground">Fechar</button>
                </Dialog.Close>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (step === steps.length - 1) {
                    handleCreate();
                  } else {
                    setStep((s) => Math.min(s + 1, steps.length - 1));
                  }
                }}
              >
                <div className="space-y-4">
                  {step === 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Nome do Projeto</h3>
                      <Input placeholder="Nome do projeto" value={name} onChange={(e) => setName(e.target.value)} />
                      <p className="text-sm text-muted-foreground mt-2">Nome é obrigatório para prosseguir.</p>

                      <h4 className="mt-4 text-sm font-medium">Descrição (opcional)</h4>
                      <Input placeholder="Descrição curta" value={description} onChange={(e) => setDescription(e.target.value)} />
                    </div>
                  )}

                  {step === 1 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Integrações (opcional)</h3>
                      <p className="text-sm text-muted-foreground mb-4">Conecte GitHub ou Supabase agora ou pule e faça depois nas configurações.</p>

                      <div className="grid grid-cols-1 gap-4">
                        <div className="p-3 border rounded">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">GitHub</div>
                              <div className="text-sm text-muted-foreground">Integração via token ou OAuth (manual).</div>
                            </div>
                            <div>
                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${gitStatus === 'connected' ? 'bg-green-100 text-green-800' : gitStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' : gitStatus === 'error' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}`}>
                                {gitStatus === 'connected' ? 'Conectado' : gitStatus === 'pending' ? 'Pendente' : gitStatus === 'error' ? 'Erro' : 'Não conectado'}
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 space-y-2">
                            {/* Always keep inputs in DOM. Show masked/readOnly when connected and not editing */}
                            <Input aria-label="URL do repositório" placeholder="URL do repositório (https://github.com/owner/repo)" value={gitRepo} onChange={(e) => setGitRepo(e.target.value)} readOnly={gitStatus === 'connected' && !showGitForm} />
                            <Input aria-label="Token de acesso GitHub" placeholder="Token de acesso (personal access token)" value={gitStatus === 'connected' && !showGitForm ? maskToken(gitToken, 'ghp') : gitToken} onChange={(e) => setGitToken(e.target.value)} type={gitStatus === 'connected' && !showGitForm ? 'text' : 'password'} readOnly={gitStatus === 'connected' && !showGitForm} />

                            <div className="flex gap-2">
                              <Button type="button" onClick={() => saveGitIntegration(undefined)} disabled={gitStatus === 'connected'}>{gitStatus === 'connected' ? 'Conectado' : 'Salvar'}</Button>
                              {gitStatus === 'connected' ? (
                                <>
                                  <Button type="button" variant="ghost" onClick={() => { /* enable editing */ setShowGitForm(true); }}>Alterar</Button>
                                  <Button type="button" variant="destructive" onClick={() => { /* mark disconnected locally; keep token in state for audit */ setGitStatus('idle'); setPendingGit(null); }}>Desconectar</Button>
                                </>
                              ) : (
                                <Button type="button" variant="outline" onClick={() => { setShowGitForm(false); setGitRepo(''); setGitToken(''); setPendingGit(null); setGitStatus('idle'); }}>Cancelar</Button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="p-3 border rounded">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">Supabase</div>
                              <div className="text-sm text-muted-foreground">Conecte uma instância Supabase para usar autenticação e DB.</div>
                            </div>
                            <div>
                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${supStatus === 'connected' ? 'bg-green-100 text-green-800' : supStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' : supStatus === 'error' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}`}>
                                {supStatus === 'connected' ? 'Conectado' : supStatus === 'pending' ? 'Pendente' : supStatus === 'error' ? 'Erro' : 'Não conectado'}
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 space-y-2">
                            <Input aria-label="URL do Supabase" placeholder="URL do Supabase" value={supUrl} onChange={(e) => setSupUrl(e.target.value)} readOnly={supStatus === 'connected' && !showSupForm} />
                            <Input aria-label="Anon Key" placeholder="Anon Key" value={supStatus === 'connected' && !showSupForm ? maskToken(supKey, 'sb') : supKey} onChange={(e) => setSupKey(e.target.value)} type={supStatus === 'connected' && !showSupForm ? 'text' : 'password'} readOnly={supStatus === 'connected' && !showSupForm} />

                            <div className="flex gap-2">
                              <Button type="button" onClick={() => saveSupabaseIntegration(undefined)} disabled={supStatus === 'connected'}>{supStatus === 'connected' ? 'Conectado' : 'Salvar'}</Button>
                              {supStatus === 'connected' ? (
                                <>
                                  <Button type="button" variant="ghost" onClick={() => { setShowSupForm(true); }}>Alterar</Button>
                                  <Button type="button" variant="destructive" onClick={() => { setSupStatus('idle'); setPendingSup(null); }}>Desconectar</Button>
                                </>
                              ) : (
                                <Button type="button" variant="outline" onClick={() => { setShowSupForm(false); setSupUrl(''); setSupKey(''); setSupStatus('idle'); setPendingSup(null); }}>Cancelar</Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Documentos (opcional)</h3>
                      <p className="text-sm text-muted-foreground mb-4">Você pode fazer upload de PDFs para usar com a IA.</p>
                      <div>
                        <input aria-label="Upload documents" type="file" accept="application/pdf" multiple className="" />
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Revisão</h3>
                      <div className="p-3 bg-gray-50 rounded">
                        <div><strong>Nome:</strong> {name}</div>
                        <div className="mt-1"><strong>Descrição:</strong> {description || '—'}</div>
                      </div>
                    </div>
                  )}

                  {error && <div className="text-sm text-red-600">{error}</div>}
                </div>

                <div className="mt-6 flex justify-between">
                  <div>
                    {step > 0 && (
                      <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(s - 1, 0))}>Voltar</Button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {step < steps.length - 1 && (
                      <Button type="submit" disabled={!canNext}>{'Próximo'}</Button>
                    )}
                    {step === steps.length - 1 && (
                      <Button type="submit" disabled={loading}>{loading ? 'Criando...' : 'Criar projeto'}</Button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
