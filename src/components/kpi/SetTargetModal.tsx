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
import { format } from 'date-fns';

const withCommas = (val: string) => {
  const digits = val.replace(/\D/g, '');
  return digits ? Number(digits).toLocaleString('en-US') : '';
};
const stripCommas = (val: string) => val.replace(/,/g, '');

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentTarget: number;
}

export function SetTargetModal({ open, onClose, onSuccess, currentTarget }: Props) {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (open) setAmount(currentTarget ? String(currentTarget) : '');
  }, [open, currentTarget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const revenue_target = parseFloat(stripCommas(amount)) || 0;

      const { error } = await supabase
        .from('monthly_targets')
        .upsert({ year, month, revenue_target }, { onConflict: 'year,month' });

      if (error) throw error;
      toast.success('Monthly target updated.');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[380px] rounded-xl border-border shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">Set Monthly Target</DialogTitle>
          <DialogDescription className="text-slate-500">
            Revenue target for {format(now, 'MMMM yyyy')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Target Amount (IDR)</Label>
            <Input
              inputMode="numeric"
              placeholder="e.g. 1,200,000,000"
              value={withCommas(amount)}
              onChange={e => setAmount(stripCommas(e.target.value))}
              required
              className="h-11 border-border text-lg font-mono"
              autoFocus
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="h-10 border-border">Cancel</Button>
            <Button type="submit" disabled={loading} className="h-10 bg-primary text-white hover:bg-primary/90 px-6 font-medium shadow-sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Target'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
