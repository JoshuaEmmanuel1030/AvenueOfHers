import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { TeamMember } from '@/types';
import { cn } from '@/lib/utils';

const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#f43f5e',
  '#8b5cf6', '#0ea5e9', '#ec4899', '#64748b',
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editMember?: TeamMember | null;
}

export function AddMemberModal({ open, onClose, onSuccess, editMember }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', role: '', avatar_color: COLORS[0] });

  useEffect(() => {
    if (editMember) {
      setForm({ name: editMember.name, role: editMember.role ?? '', avatar_color: editMember.avatar_color });
    } else {
      setForm({ name: '', role: '', avatar_color: COLORS[0] });
    }
  }, [editMember, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const payload = { name: form.name, role: form.role || null, avatar_color: form.avatar_color };
      const { error } = editMember
        ? await supabase.from('team_members').update(payload).eq('id', editMember.id)
        : await supabase.from('team_members').insert(payload);
      if (error) throw error;
      toast.success(editMember ? 'Member updated.' : 'Team member added.');
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
      <DialogContent className="sm:max-w-[400px] rounded-xl border-border shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">{editMember ? 'Edit Member' : 'Add Team Member'}</DialogTitle>
          <DialogDescription className="text-slate-500">
            {editMember ? 'Update member details.' : 'Add a new person to your team.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Avatar preview */}
          <div className="flex justify-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-sm"
              style={{ backgroundColor: form.avatar_color }}
            >
              {form.name ? form.name[0].toUpperCase() : '?'}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Name</Label>
            <Input
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Rina"
              required
              className="h-10 border-border"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Role <span className="normal-case font-normal text-slate-300">(optional)</span></Label>
            <Input
              value={form.role}
              onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              placeholder="e.g. Ops Manager"
              className="h-10 border-border"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Avatar Color</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, avatar_color: c }))}
                  className={cn(
                    'w-7 h-7 rounded-full transition-transform',
                    form.avatar_color === c && 'ring-2 ring-offset-2 ring-slate-400 scale-110'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="h-10 border-border">Cancel</Button>
            <Button type="submit" disabled={loading} className="h-10 bg-primary text-white hover:bg-primary/90 px-6 font-medium shadow-sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : editMember ? 'Save Changes' : 'Add Member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
