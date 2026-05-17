import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { TeamMember, Task } from '@/types';

const withCommas = (val: string) => {
  const digits = val.replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('en-US') : '';
};
const stripCommas = (val: string) => val.replace(/,/g, '');

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  members: TeamMember[];
  editTask?: Task | null;
}

export function AddTaskModal({ open, onClose, onSuccess, members, editTask }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'pending' as Task['status'],
    amount: '',
    due_date: '',
    assigned_to: 'none',
  });

  useEffect(() => {
    if (editTask) {
      setForm({
        title: editTask.title,
        description: editTask.description ?? '',
        status: editTask.status,
        amount: editTask.amount ? String(editTask.amount) : '',
        due_date: editTask.due_date ?? '',
        assigned_to: editTask.assigned_to ?? 'none',
      });
    } else {
      setForm({ title: '', description: '', status: 'pending', amount: '', due_date: '', assigned_to: 'none' });
    }
  }, [editTask, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        status: form.status,
        amount: form.amount ? parseFloat(stripCommas(form.amount)) : null,
        due_date: form.due_date || null,
        assigned_to: form.assigned_to === 'none' ? null : form.assigned_to,
      };

      const { error } = editTask
        ? await supabase.from('tasks').update(payload).eq('id', editTask.id)
        : await supabase.from('tasks').insert(payload);

      if (error) throw error;
      toast.success(editTask ? 'Task updated.' : 'Task added.');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] rounded-xl border-border shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">{editTask ? 'Edit Task' : 'Add Task'}</DialogTitle>
          <DialogDescription className="text-slate-500">
            {editTask ? 'Update task details.' : 'Add a new task and optionally assign it to a team member.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Title</Label>
            <Input
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Reorder PO #1842"
              required
              className="h-10 border-border"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Description <span className="normal-case font-normal text-slate-300">(optional)</span></Label>
            <Input
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Additional details..."
              className="h-10 border-border"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v as Task['status'] }))}>
                <SelectTrigger className="h-10 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Amount IDR <span className="normal-case font-normal text-slate-300">(optional)</span></Label>
              <Input
                inputMode="numeric"
                placeholder="0"
                value={withCommas(form.amount)}
                onChange={e => setForm(p => ({ ...p, amount: stripCommas(e.target.value) }))}
                className="h-10 border-border"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Due Date <span className="normal-case font-normal text-slate-300">(optional)</span></Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                className="h-10 border-border"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Assign To</Label>
              <Select value={form.assigned_to} onValueChange={v => setForm(p => ({ ...p, assigned_to: v }))}>
                <SelectTrigger className="h-10 border-border">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {members.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="h-10 border-border">Cancel</Button>
            <Button type="submit" disabled={loading} className="h-10 bg-primary text-white hover:bg-primary/90 px-6 font-medium shadow-sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : editTask ? 'Save Changes' : 'Add Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
