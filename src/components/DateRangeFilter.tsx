import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Filter } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export type DateRangeValue = {
  startDate: Date;
  endDate: Date;
  label: string;
};

interface Props {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
}

const presetBuilders: { key: string; label: string; build: () => DateRangeValue }[] = [
  { key: 'today',      label: 'Hoje',         build: () => ({ startDate: startOfDay(new Date()), endDate: endOfDay(new Date()), label: 'Hoje' }) },
  { key: 'yesterday',  label: 'Ontem',        build: () => { const d = subDays(new Date(), 1); return { startDate: startOfDay(d), endDate: endOfDay(d), label: 'Ontem' }; } },
  { key: '7d',         label: '7 dias',       build: () => ({ startDate: startOfDay(subDays(new Date(), 6)), endDate: endOfDay(new Date()), label: 'Últimos 7 dias' }) },
  { key: '15d',        label: '15 dias',      build: () => ({ startDate: startOfDay(subDays(new Date(), 14)), endDate: endOfDay(new Date()), label: 'Últimos 15 dias' }) },
  { key: '30d',        label: '30 dias',      build: () => ({ startDate: startOfDay(subDays(new Date(), 29)), endDate: endOfDay(new Date()), label: 'Últimos 30 dias' }) },
  { key: 'thisWeek',   label: 'Esta semana',  build: () => ({ startDate: startOfWeek(new Date(), { weekStartsOn: 0 }), endDate: endOfWeek(new Date(), { weekStartsOn: 0 }), label: 'Esta semana' }) },
  { key: 'thisMonth',  label: 'Este mês',     build: () => ({ startDate: startOfMonth(new Date()), endDate: endOfMonth(new Date()), label: 'Este mês' }) },
  { key: 'lastMonth',  label: 'Mês passado',  build: () => { const d = subMonths(new Date(), 1); return { startDate: startOfMonth(d), endDate: endOfMonth(d), label: 'Mês passado' }; } },
  { key: '3m',         label: '3 meses',      build: () => ({ startDate: startOfMonth(subMonths(new Date(), 2)), endDate: endOfMonth(new Date()), label: 'Últimos 3 meses' }) },
  { key: '6m',         label: '6 meses',      build: () => ({ startDate: startOfMonth(subMonths(new Date(), 5)), endDate: endOfMonth(new Date()), label: 'Últimos 6 meses' }) },
  { key: '12m',        label: '12 meses',     build: () => ({ startDate: startOfMonth(subMonths(new Date(), 11)), endDate: endOfMonth(new Date()), label: 'Últimos 12 meses' }) },
  { key: 'year',       label: 'Este ano',     build: () => ({ startDate: startOfYear(new Date()), endDate: endOfYear(new Date()), label: 'Este ano' }) },
];

export function buildPresetRange(key: string): DateRangeValue {
  const p = presetBuilders.find(b => b.key === key);
  return p ? p.build() : presetBuilders[6].build(); // default thisMonth
}

export function getCurrentMonthRange(): DateRangeValue {
  return presetBuilders[6].build();
}

export default function DateRangeFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customStart, setCustomStart] = useState<Date | undefined>(value.startDate);
  const [customEnd, setCustomEnd] = useState<Date | undefined>(value.endDate);

  const applyPreset = (key: string) => {
    onChange(presetBuilders.find(b => b.key === key)!.build());
    setOpen(false);
  };

  const applyCustom = () => {
    if (!customStart || !customEnd) return;
    const s = startOfDay(customStart);
    const e = endOfDay(customEnd);
    onChange({
      startDate: s,
      endDate: e,
      label: `${format(s, 'dd/MM/yy')} - ${format(e, 'dd/MM/yy')}`,
    });
    setCustomOpen(false);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2 text-xs font-medium">
          <Filter className="h-3.5 w-3.5" />
          <span className="capitalize">{value.label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[280px] p-2">
        {!customOpen ? (
          <>
            <div className="grid grid-cols-2 gap-1">
              {presetBuilders.map(p => (
                <Button
                  key={p.key}
                  size="sm"
                  variant={value.label === p.build().label ? 'default' : 'ghost'}
                  className="h-8 justify-start text-xs"
                  onClick={() => applyPreset(p.key)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="mt-2 border-t pt-2">
              <Button
                size="sm"
                variant="outline"
                className="w-full h-8 text-xs"
                onClick={() => setCustomOpen(true)}
              >
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                Período personalizado
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Selecione o período</p>
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase text-muted-foreground">Início</p>
              <Calendar
                mode="single"
                selected={customStart}
                onSelect={setCustomStart}
                locale={ptBR}
                className={cn('p-1 pointer-events-auto rounded-md border')}
              />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase text-muted-foreground">Fim</p>
              <Calendar
                mode="single"
                selected={customEnd}
                onSelect={setCustomEnd}
                locale={ptBR}
                className={cn('p-1 pointer-events-auto rounded-md border')}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="ghost" className="flex-1 h-8 text-xs" onClick={() => setCustomOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" className="flex-1 h-8 text-xs" onClick={applyCustom} disabled={!customStart || !customEnd}>
                Aplicar
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
