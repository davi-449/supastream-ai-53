import { useEffect, useMemo, useRef, useState } from "react";
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Bot, User, FileText, CheckCircle, Paperclip, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import SafeMarkdown from "@/lib/SafeMarkdown";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { knowledge, KnowledgeFile } from "@/lib/knowledge";
import { useToast } from "@/hooks/use-toast";

interface Attachment { id: string; name: string; type: string; url: string; }

interface Message {
  id: string;
  content: string;
  sender: "user" | "pilot";
  timestamp: string; // ISO
  status?: "sending" | "sent" | "error";
  sources?: KnowledgeFile[];
  checklist?: { label: string; ok: boolean }[];
  replyToId?: string;
  attachments?: Attachment[];
}

interface PilotChatProps {
  projectId: string;
  projectName: string;
  hasDocuments: boolean;
}

function genId(prefix = '') {
  try {
    // use browser crypto when available for collision-resistant ids
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? (crypto as any).randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
    return prefix ? `${prefix}-${id}` : id;
  } catch {
    return prefix ? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

const STORAGE_KEY = (pid: string) => `pilot_chat_${pid}`;

const PilotChat = ({ projectId, projectName, hasDocuments }: PilotChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const { gemini } = useFeatureFlags();
  const geminiAtivo = !!gemini;
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const isProcessingRef = useRef(false);

  // Gemini availability: feature flag + backend health
  const [geminiHealth, setGeminiHealth] = useState(false);
  const geminiEnabled = !!gemini && geminiHealth;
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [pendingFiles, setPendingFiles] = useState<Attachment[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Supabase client is kept only in memory (ref) and never persisted to localStorage or UI
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<'disconnected'|'connecting'|'connected'|'error'>('disconnected');

  const accessibleFiles = useMemo(() => knowledge.queryAccessible(projectId).files, [projectId, messages.length, hasDocuments]);

  useEffect(() => {
    // Do not read from localStorage. Initialize with a neutral hello message that doesn't include any local mocks.
    const hello: Message = {
      id: "hello",
      content: `Olá! Eu sou o Pilot, sua assistente do projeto **${projectName}**. Conecte o Supabase para carregar dados reais.`,
      sender: "pilot",
      timestamp: new Date().toISOString(),
      status: "sent",
      sources: accessibleFiles,
      checklist: buildChecklist(projectId),
    };
    setMessages([hello]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    // Local persistence disabled. All chat history should be stored in Supabase only.
    // No-op to prevent any localStorage writes.
  }, [messages, projectId]);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Probe backend health for Gemini availability using a safe POST ping
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await fetch('https://emfddmyurnlsvpvlplzj.supabase.co/functions/v1/gemini', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!mounted) return;
        if (!resp.ok) {
          setGeminiHealth(false);
          return;
        }
        // consider healthy only if status 200
        setGeminiHealth(resp.status === 200);
      } catch (e) {
        if (!mounted) return;
        setGeminiHealth(false);
      }
    })();
    return () => { mounted = false; };
  }, [projectId]);

  const buildChecklist = (pid: string) => {
    const res = knowledge.queryAccessible(pid);
    return [
      { label: "Acesso ao acervo global OK", ok: res.checklist.accessChecked },
      { label: "Busca preparada", ok: res.checklist.searchPrepared },
      { label: "Permissões aplicadas", ok: res.checklist.permissionFiltered },
      { label: "Índice atualizado", ok: res.checklist.indexRefreshed },
    ];
  };

  const mensagensPreset = [
    "Como posso começar um novo projeto?",
    "Preciso de ajuda com integração GitHub.",
    "Quais PDFs você encontrou para este projeto?",
  ];

  const isDuplicateUserMessage = (content: string, replyToId?: string, attachments?: Attachment[]) => {
    // Verificar se existe mensagem idêntica nos últimos 10 segundos
    const tenSecondsAgo = Date.now() - 10000;
    return messages.some(m => 
      m.sender === 'user' && 
      m.content === content && 
      m.replyToId === replyToId && 
      ((m.attachments?.length ?? 0) === (attachments?.length ?? 0)) &&
      new Date(m.timestamp).getTime() > tenSecondsAgo
    );
  };

  const onSelectMessage = (index: number) => {
    setSelectedIdx(index);
  };

  const handleReply = (m: Message) => {
    setReplyTo(m);
  };

  const cancelReply = () => setReplyTo(null);

  const addSystemMessage = (text: string) => {
    const sys: Message = { id: genId('sys'), content: text, sender: 'pilot', timestamp: new Date().toISOString(), status: 'sent' };
    setMessages((prev) => {
      if (prev.some(m => m.sender === 'pilot' && m.content === text)) return prev;
      return [...prev, sys];
    });
  };

  const handleSendMessage = async () => {
    // Proteção dupla contra múltiplas submissões
    if (!geminiAtivo) { addSystemMessage('Atenção: Gemini/IA desativado no momento. Ative para enviar mensagens.'); return; }
    if (!inputValue.trim() || isLoading || isProcessingRef.current) return;
    
    // Bloquear imediatamente para evitar race conditions
    isProcessingRef.current = true;

    // Commands start with '/'
    if (inputValue.trim().startsWith('/')) {
      const raw = inputValue.trim();
      // Sanitize tokens (avoid storing secrets in chat history)
      const sanitized = raw.replace(/\s+([A-Za-z0-9-_]{16,})$/,' <REDACTED>');
      if (isDuplicateUserMessage(sanitized)) {
        addSystemMessage('Mensagem duplicada impedida.');
        setInputValue('');
        return;
      }
      const now = new Date().toISOString();
      const userMessage: Message = { id: genId('u'), content: sanitized, sender: 'user', timestamp: now, status: 'sending' };
      setMessages((prev) => [...prev, userMessage]);
      setInputValue('');
      setReplyTo(null);
      setPendingFiles([]);
      setIsLoading(true);
      try {
        await handleCommand(raw);
        // Atualizar status para 'sent' após sucesso
        setMessages(prev => prev.map(m => 
          m.id === userMessage.id ? { ...m, status: 'sent' } : m
        ));
      } catch (err: any) {
        addSystemMessage(`Erro ao executar comando: ${err?.message || String(err)}`);
        // Marcar mensagem como erro
        setMessages(prev => prev.map(m => 
          m.id === userMessage.id ? { ...m, status: 'error' } : m
        ));
      } finally {
        setIsLoading(false);
        isProcessingRef.current = false;
      }
      return;
    }

    const now = new Date().toISOString();
    const content = inputValue;
    if (isDuplicateUserMessage(content, replyTo?.id, pendingFiles)) {
      addSystemMessage('Mensagem duplicada impedida.');
      setInputValue('');
      isProcessingRef.current = false;
      return;
    }

    const userMessage: Message = {
      id: genId('u'),
      content: content,
      sender: "user",
      timestamp: now,
      status: "sending",
      replyToId: replyTo?.id,
      attachments: pendingFiles,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setReplyTo(null);
    setPendingFiles([]);
    setIsLoading(true);

    // If Gemini is enabled (feature flag + backend health), call backend proxy
    if (geminiEnabled) {
      try {
        const resp = await fetch('https://emfddmyurnlsvpvlplzj.supabase.co/functions/v1/gemini', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: content })
        });
        const out = await resp.json();
        if (!resp.ok) {
          const message = out?.error || `Gemini proxy error (${resp.status})`;
          toast({ title: 'Erro Gemini', description: message, variant: 'destructive' });
          addSystemMessage('Erro Gemini: ' + (out?.error || 'Resposta inválida'));
          setIsLoading(false);
          return;
        }
        const text = out?.text || out?.raw?.candidates?.[0]?.content?.parts?.[0]?.text || out?.raw?.output?.[0]?.content?.[0]?.text || JSON.stringify(out?.raw || out).slice(0, 2000);
        const reply: Message = {
          id: genId('p'),
          sender: 'pilot',
          timestamp: new Date().toISOString(),
          status: 'sent',
          sources: knowledge.queryAccessible(projectId).files.slice(0, 5),
          checklist: buildChecklist(projectId),
          content: text || 'Sem resposta do Gemini.'
        };
        setMessages((prev) => [...prev, reply]);
        // Marcar mensagem do usuário como enviada com sucesso
        setMessages(prev => prev.map(m => 
          m.id === userMessage.id ? { ...m, status: 'sent' } : m
        ));
      } catch (err: any) {
        toast({ title: 'Erro Gemini', description: err?.message || 'Falha ao contactar Gemini', variant: 'destructive' });
        addSystemMessage('Erro Gemini: ' + (err?.message || String(err)));
        // Marcar mensagem do usuário como erro
        setMessages(prev => prev.map(m => 
          m.id === userMessage.id ? { ...m, status: 'error' } : m
        ));
      } finally {
        setIsLoading(false);
        isProcessingRef.current = false;
      }
    } else {
      // Fallback local reply (existing behavior) when Gemini is not enabled
      const files = knowledge.queryAccessible(projectId).files;
      const sources = files.slice(0, Math.min(5, files.length));
      const attachmentsNote = userMessage.attachments?.length ? `\n\n### 📎 Anexos\n${userMessage.attachments.map((a, i) => `${i + 1}. ${a.name}`).join("\n")}` : "";
      const replyContent = [
        `## Análise`,
        `Com base no contexto do projeto **${projectName}** e no acervo acessível, seguem sugestões:`,
        `### ✅ Checklist de Ações`,
        `- [ ] Revisar documentação relevante`,
        `- [ ] Implementar a próxima tarefa`,
        `- [ ] Testar integração e fluxos`,
        `- [ ] Validar com stakeholders`,
        `### ℹ️ Fontes`,
        sources.length > 0 ? sources.map((s, i) => `${i + 1}. ${s.filename}`).join("\n") : `Nenhum PDF cadastrado ainda`,
        attachmentsNote,
      ].join("\n\n");
      // Avoid adding duplicate pilot reply
      setMessages((prev) => {
        if (prev.some(m => m.sender === 'pilot' && m.content === replyContent)) return prev;
        const reply: Message = {
          id: genId('p'),
          sender: "pilot",
          timestamp: new Date().toISOString(),
          status: "sent",
          sources,
          checklist: buildChecklist(projectId),
          content: replyContent,
        };
        return [...prev, reply];
      });
      // Marcar mensagem do usuário como enviada
      setMessages(prev => prev.map(m => 
        m.id === userMessage.id ? { ...m, status: 'sent' } : m
      ));
      setIsLoading(false);
      isProcessingRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey && (e.target as HTMLElement).id === "pilot-input") {
      e.preventDefault();
      // Adicionar proteção extra contra duplo envio
      if (!isLoading && !isProcessingRef.current) {
        handleSendMessage();
      }
    }
    if (e.key === "Escape") cancelReply();
    if (e.key.toLowerCase() === "r" && selectedIdx !== null) {
      e.preventDefault();
      handleReply(messages[selectedIdx]);
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => (i === null ? messages.length - 1 : Math.max(0, i - 1)));
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => (i === null ? 0 : Math.min(messages.length - 1, i + 1)));
    }
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files) return;
    const atts: Attachment[] = Array.from(files).map((f) => ({ id: `${f.name}-${genId()}`, name: f.name, type: f.type, url: URL.createObjectURL(f) }));
    setPendingFiles((prev) => [...prev, ...atts]);
    e.target.value = "";
  };

  const removePendingFile = (id: string) => setPendingFiles((prev) => prev.filter((a) => a.id !== id));

  // ---- Supabase command handling ----
  async function handleCommand(rawCmd: string) {
    const parts = rawCmd.trim().split(/\s+/);
    const cmd = parts[0];

    if (cmd === '/supabase' && parts[1] === 'connect') {
      const url = parts[2];
      const key = parts[3];
      if (!url || !key) { addSystemMessage('Uso: /supabase connect <url> <key>'); return; }
      setSupabaseStatus('connecting');
      try {
        const client = createClient(url, key, { auth: { persistSession: false } });
          const { data, error } = await client.from('builder_data').select('*').limit(1);
        if (error) throw error;
        supabaseRef.current = client;
        // Per policy: clear any local/session storage immediately after successful connection
        try {
          if (typeof window !== 'undefined') {
            if (window.localStorage) window.localStorage.clear();
            if (window.sessionStorage) window.sessionStorage.clear();
          }
        } catch (_) {
          // ignore
        }
        setSupabaseStatus('connected');
        addSystemMessage('Conexão com Supabase estabelecida com sucesso. (Credenciais mantidas em memória). Local storage/session storage limpos.');
      } catch (err: any) {
        setSupabaseStatus('error');
        addSystemMessage('Falha ao conectar Supabase: ' + (err?.message || String(err)));
      }
      return;
    }

    if (cmd === '/migrar-mock') {
      // Migration from local mocks is disabled to enforce single source of truth (Supabase).
      addSystemMessage('Migração de mocks/localStorage foi desabilitada. Todas as operações devem ser feitas via Supabase.');
      return;
    }

    if (cmd === '/listar') {
      const table = parts[1]; if (!table) { addSystemMessage('Uso: /listar <tabela>'); return; }
      if (!supabaseRef.current) { addSystemMessage('Supabase não conectado.'); return; }
      try {
        const { data, error } = await supabaseRef.current.from(table).select('*').limit(200);
        if (error) throw error;
        addSystemMessage(`Resultados (${data?.length ?? 0}):\n\n${JSON.stringify(data, null, 2)}`);
      } catch (err: any) {
        addSystemMessage('Erro ao listar: ' + (err?.message || String(err)));
      }
      return;
    }

    if (cmd === '/inserir') {
      const table = parts[1]; const json = parts.slice(2).join(' ');
      if (!table || !json) { addSystemMessage('Uso: /inserir <tabela> <json>'); return; }
      if (!supabaseRef.current) { addSystemMessage('Supabase não conectado.'); return; }
      try {
        const obj = JSON.parse(json);
        const { data, error } = await supabaseRef.current.from(table).insert([obj]).select();
        if (error) throw error;
        addSystemMessage('Inserção realizada: ' + JSON.stringify(data));
      } catch (err: any) {
        addSystemMessage('Erro ao inserir: ' + (err?.message || String(err)));
      }
      return;
    }

    if (cmd === '/atualizar') {
      const table = parts[1]; const id = parts[2]; const json = parts.slice(3).join(' ');
      if (!table || !id || !json) { addSystemMessage('Uso: /atualizar <tabela> <id> <json>'); return; }
      if (!supabaseRef.current) { addSystemMessage('Supabase não conectado.'); return; }
      try {
        const obj = JSON.parse(json);
        const { data, error } = await supabaseRef.current.from(table).update(obj).eq('id', id).select();
        if (error) throw error;
        addSystemMessage('Atualização realizada: ' + JSON.stringify(data));
      } catch (err: any) {
        addSystemMessage('Erro ao atualizar: ' + (err?.message || String(err)));
      }
      return;
    }

    if (cmd === '/deletar') {
      const table = parts[1]; const id = parts[2];
      if (!table || !id) { addSystemMessage('Uso: /deletar <tabela> <id>'); return; }
      if (!supabaseRef.current) { addSystemMessage('Supabase não conectado.'); return; }
      try {
        const { error } = await supabaseRef.current.from(table).delete().eq('id', id);
        if (error) throw error;
        addSystemMessage(`Registro ${id} removido da tabela ${table}.`);
      } catch (err: any) {
        addSystemMessage('Erro ao deletar: ' + (err?.message || String(err)));
      }
      return;
    }

    addSystemMessage('Comando desconhecido. Comandos disponíveis: /supabase connect, /listar, /inserir, /atualizar, /deletar');
  }

  return (
    <Card className="h-full flex flex-col" role="region" aria-label="Chat com o Pilot">
      <a href="#pilot-input" className="sr-only focus:not-sr-only focus:p-2 focus:bg-muted focus:underline">Pular para caixa de mensagem</a>
      <CardHeader className="border-b bg-card/70 backdrop-blur">
        <CardTitle className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-primary p-2"><Bot className="h-4 w-4 text-primary-foreground" /></div>
            <span>Pilot AI</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="secondary">
              <FileText className="h-3 w-3 mr-1" /> Acervo {hasDocuments ? "conectado" : "pronto"}
            </Badge>
            <Badge variant={supabaseRef.current ? 'outline' : 'secondary'} className={supabaseRef.current ? 'text-success' : 'text-muted-foreground'}>
              {supabaseStatus === 'connected' ? 'Supabase: conectado' : supabaseStatus === 'connecting' ? 'Supabase: conectando...' : supabaseStatus === 'error' ? 'Supabase: erro' : 'Supabase: desconectado'}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0" onKeyDown={handleKeyDown} tabIndex={0} aria-label="Histórico de mensagens">
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="space-y-4" role="log" aria-live="polite" aria-relevant="additions" aria-atomic="false">
            {messages.map((m, idx) => (
              <div key={m.id} className={`flex items-end gap-2 ${m.sender === "pilot" ? "flex-row" : "flex-row-reverse"}`}>
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className={m.sender === "pilot" ? "bg-primary text-primary-foreground" : "bg-secondary"} aria-hidden>
                    {m.sender === "pilot" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className={`rounded-2xl px-4 py-2 shadow max-w-[80%] outline-offset-2 ${m.sender === "pilot" ? "bg-muted/60 border text-foreground" : "bg-primary text-primary-foreground"} ${selectedIdx === idx ? 'ring-2 ring-ring' : ''}`} onClick={() => onSelectMessage(idx)}>
                  {m.replyToId && (
                    <div className="text-xs opacity-80 border-l-2 border-primary/40 pl-2 mb-2">
                      Em resposta a: {messages.find(mm => mm.id === m.replyToId)?.content.slice(0, 120)}
                    </div>
                  )}
                  <SafeMarkdown className="prose prose-sm max-w-none">{m.content}</SafeMarkdown>
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.attachments.map((a) => (
                        <div key={a.id} className="border rounded-md overflow-hidden">
                          {a.type.startsWith('image') ? (
                            <img src={a.url} alt={a.name} className="h-24 w-24 object-cover" />
                          ) : (
                            <a href={a.url} download className="text-xs underline p-2 inline-block bg-secondary">{a.name}</a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 space-y-1">
                    {m.sources && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Fontes:</span> {m.sources.length > 0 ? m.sources.map((s) => s.filename).join(", ") : "Nenhuma"}
                      </div>
                    )}
                    {m.checklist && (
                      <ul className="text-xs text-muted-foreground grid grid-cols-1 sm:grid-cols-2 gap-1" aria-label="Checklist de acesso e permissões">
                        {m.checklist.map((c, i) => (
                          <li key={i} className="flex items-center gap-1"><CheckCircle className={`h-3 w-3 ${c.ok ? 'text-success' : 'text-warning'}`} /> {c.label}</li>
                        ))}
                      </ul>
                    )}
                     <div className="text-[10px] text-muted-foreground/70 flex items-center gap-1" aria-hidden>
                       {new Date(m.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                       {m.status === 'sending' && (
                         <span className="inline-flex items-center gap-1 text-blue-600">
                           <span className="w-1 h-1 bg-current rounded-full animate-pulse"></span>
                           Enviando
                         </span>
                       )}
                       {m.status === 'error' && (
                         <span className="inline-flex items-center gap-1 text-red-600">
                           <X className="w-2 h-2" />
                           Erro
                         </span>
                       )}
                     </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant={m.sender === 'pilot' ? 'secondary' : 'outline'} onClick={() => handleReply(m)} aria-label="Responder esta mensagem">Responder</Button>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2 items-end">
                <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary text-primary-foreground"><Bot className="h-4 w-4" /></AvatarFallback></Avatar>
                <div className="bg-muted/60 border rounded-2xl px-4 py-2 shadow max-w-[80%]">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="inline-flex space-x-1" aria-hidden>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" style={{ animationDelay: '120ms' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" style={{ animationDelay: '240ms' }}></span>
                    </span>
                    <span aria-live="polite">Pilot digitando…</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </ScrollArea>

        <div className="border-t p-3">
          {replyTo && (
            <div className="flex items-center justify-between text-xs bg-muted/50 border rounded px-2 py-1 mb-2">
              <div className="truncate">Respondendo: {replyTo.content.slice(0, 140)}</div>
              <button onClick={cancelReply} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground" aria-label="Cancelar resposta"><X className="h-3 w-3" /> Cancelar</button>
            </div>
          )}
          {pendingFiles.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-2">
              {pendingFiles.map((a) => (
                <div key={a.id} className="relative border rounded overflow-hidden">
                  {a.type.startsWith('image') ? <img src={a.url} alt={a.name} className="h-16 w-16 object-cover" /> : <div className="p-2 text-xs bg-secondary">{a.name}</div>}
                  <button className="absolute top-1 right-1 bg-background/80 rounded p-0.5" onClick={() => removePendingFile(a.id)} aria-label={`Remover ${a.name}`}><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
          {/* Preset messages toolbar */}
          <div className="flex gap-2 mb-2">
            {mensagensPreset.map(m => (
              <button key={m} type="button" className="px-3 py-1 rounded bg-muted/20 hover:bg-muted/30 text-sm" onClick={() => setInputValue(m)}>
                {m}
              </button>
            ))}
          </div>

          <form className="flex gap-2" onSubmit={(e) => {
            e.preventDefault();
            // Apenas prevenir default, usar onKeyDown para enviar
          }}>
            <label htmlFor="file-input" className={`inline-flex items-center justify-center w-9 h-9 rounded-md border hover:bg-muted cursor-pointer ${!geminiAtivo || isLoading || isProcessingRef.current ? 'opacity-50 pointer-events-none' : ''}`} title="Enviar arquivo" aria-label="Enviar arquivo">
              <Paperclip className="h-4 w-4" />
            </label>
            <input 
              id="file-input" 
              type="file" 
              accept="image/*,.pdf,.txt,.md" 
              className="hidden" 
              onChange={handleFilePick} 
              multiple 
              aria-hidden 
              disabled={isLoading || isProcessingRef.current || !geminiAtivo}
            />
            <Input
              id="pilot-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem para o Pilot"
              className="flex-1"
              disabled={isLoading || !geminiAtivo || isProcessingRef.current}
              aria-label="Mensagem para o Pilot"
            />
            <Button 
              type="button" 
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading || !geminiAtivo || isProcessingRef.current} 
              aria-label="Enviar mensagem"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          {!geminiAtivo && (
            <div className="mt-2 text-sm text-yellow-700 bg-yellow-50 p-2 rounded">Atenção: Gemini/IA desativado no momento. Ative para usar o chat.</div>
          )}
          <p className="text-xs text-muted-foreground mt-2">Enter para enviar • Shift+Enter para nova linha • R para responder mensagem selecionada</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PilotChat;
