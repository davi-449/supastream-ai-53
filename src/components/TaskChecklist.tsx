import { useEffect, useMemo, useRef, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { GripVertical, Plus, Trash2 } from "lucide-react";

export interface TaskItem { id: string; label: string; done: boolean; }
export interface TaskCategory { id: string; title: string; items: TaskItem[]; }

interface TaskChecklistProps {
  initial: TaskCategory[];
  onChange?: (data: TaskCategory[]) => void;
}

function genId(prefix = '') {
  try {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? (crypto as any).randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
    return prefix ? `${prefix}-${id}` : id;
  } catch {
    return prefix ? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

export default function TaskChecklist({ initial, onChange }: TaskChecklistProps) {
  const [data, setData] = useState<TaskCategory[]>(initial);
  const dragItem = useRef<{ cat: string; id: string } | null>(null);

  useEffect(() => { onChange?.(data); }, [data, onChange]);

  const toggle = (catId: string, id: string) => {
    setData(prev => prev.map(c => c.id !== catId ? c : { ...c, items: c.items.map(i => i.id === id ? { ...i, done: !i.done } : i) }));
  };

  const handleDragStart = (catId: string, id: string) => (e: React.DragEvent) => {
    dragItem.current = { cat: catId, id };
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropOn = (catId: string, targetId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragItem.current; if (!from) return;
    setData(prev => {
      const copy = prev.map(c => ({ ...c, items: [...c.items] }));
      const srcCat = copy.find(c => c.id === from.cat)!;
      const srcIdx = srcCat.items.findIndex(i => i.id === from.id);
      const [moved] = srcCat.items.splice(srcIdx, 1);
      const dstCat = copy.find(c => c.id === catId)!;
      const dstIdx = dstCat.items.findIndex(i => i.id === targetId);
      dstCat.items.splice(dstIdx, 0, moved);
      return copy;
    });
    dragItem.current = null;
  };

  const handleDropToEnd = (catId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragItem.current; if (!from) return;
    setData(prev => {
      const copy = prev.map(c => ({ ...c, items: [...c.items] }));
      const srcCat = copy.find(c => c.id === from.cat)!;
      const srcIdx = srcCat.items.findIndex(i => i.id === from.id);
      const [moved] = srcCat.items.splice(srcIdx, 1);
      const dstCat = copy.find(c => c.id === catId)!;
      dstCat.items.push(moved);
      return copy;
    });
    dragItem.current = null;
  };

  const remove = (catId: string, id: string) => setData(prev => prev.map(c => c.id !== catId ? c : { ...c, items: c.items.filter(i => i.id !== id) }));

  const add = (catId: string) => setData(prev => prev.map(c => c.id !== catId ? c : { ...c, items: [...c.items, { id: genId(), label: 'Nova tarefa', done: false }] }));

  return (
    <Accordion type="multiple" className="w-full">
      {data.map((cat) => (
        <AccordionItem key={cat.id} value={cat.id} className="border rounded-lg mb-2 overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">{cat.title}</AccordionTrigger>
          <AccordionContent>
            <ul className="space-y-2 px-2 py-2" onDragOver={(e) => e.preventDefault()} onDrop={handleDropToEnd(cat.id)}>
              {cat.items.map((t) => (
                <li key={t.id}
                  className="group flex items-center gap-2 p-2 rounded-lg border bg-card transition-colors focus-within:ring-1 focus-within:ring-ring"
                  draggable
                  onDragStart={handleDragStart(cat.id, t.id)}
                  onDrop={handleDropOn(cat.id, t.id)}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground opacity-60 group-hover:opacity-100" aria-hidden />
                  <Checkbox checked={t.done} onCheckedChange={() => toggle(cat.id, t.id)} aria-label={`Marcar ${t.label}`} />
                  <span className={`flex-1 text-sm transition-all ${t.done ? 'line-through opacity-60' : ''}`}>{t.label}</span>
                  <Button variant="ghost" size="icon" onClick={() => remove(cat.id, t.id)} aria-label="Remover tarefa">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
              <li className="pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => add(cat.id)}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar tarefa
                </Button>
              </li>
            </ul>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
